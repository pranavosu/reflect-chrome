import { pipeline } from '@huggingface/transformers'
import fs from 'node:fs'

const DATA_URL =
  'https://raw.githubusercontent.com/jackyzha0/reflect-nlp/master/nlp/data/cumulative.csv'
const OUT = new URL('../dist/res/models/minilm-l6-head.json', import.meta.url)
const MODEL = { id: 'Xenova/all-MiniLM-L6-v2', dtype: 'q8', pooling: 'mean', normalize: true }
const LAMBDA = 0.1

function parseCsv(text) {
  const rows = []
  let row = [],
    field = '',
    quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function trainLR(X, y, { lambda, epochs = 1500, lr = 0.1 }) {
  const d = X[0].length,
    n = X.length
  const mean = new Float64Array(d),
    std = new Float64Array(d)
  for (const x of X) for (let j = 0; j < d; j++) mean[j] += x[j] / n
  for (const x of X) for (let j = 0; j < d; j++) std[j] += (x[j] - mean[j]) ** 2 / n
  for (let j = 0; j < d; j++) std[j] = Math.sqrt(std[j]) || 1
  const Z = X.map((x) => Float64Array.from(x, (v, j) => (v - mean[j]) / std[j]))
  const w = new Float64Array(d),
    m = new Float64Array(d + 1),
    v = new Float64Array(d + 1)
  let b = 0
  for (let e = 1; e <= epochs; e++) {
    const g = new Float64Array(d)
    let gb = 0
    for (let i = 0; i < n; i++) {
      let z = b
      for (let j = 0; j < d; j++) z += w[j] * Z[i][j]
      const err = 1 / (1 + Math.exp(-z)) - y[i]
      for (let j = 0; j < d; j++) g[j] += (err * Z[i][j]) / n
      gb += err / n
    }
    for (let j = 0; j <= d; j++) {
      const gj = j < d ? g[j] + lambda * w[j] : gb
      m[j] = 0.9 * m[j] + 0.1 * gj
      v[j] = 0.999 * v[j] + 0.001 * gj * gj
      const step = (lr * (m[j] / (1 - 0.9 ** e))) / (Math.sqrt(v[j] / (1 - 0.999 ** e)) + 1e-8)
      if (j < d) w[j] -= step
      else b -= step
    }
  }
  const weights = Array.from(w, (wj, j) => wj / std[j])
  const bias = b - weights.reduce((s, wj, j) => s + wj * mean[j], 0)
  return { weights, bias }
}

const score = (h, x) =>
  1 / (1 + Math.exp(-(h.bias + x.reduce((s, xj, j) => s + xj * h.weights[j], 0))))

const csv = parseCsv(await (await fetch(DATA_URL)).text())
const header = csv[0]
const iIntent = header.indexOf('intent'),
  iValid = header.indexOf('valid')
const rows = csv
  .slice(1)
  .map((r) => [String(r[iIntent] ?? ''), (r[iValid] ?? '').trim()])
  .map(([t, v]) => [t, v === 'yse' ? 'yes' : v])
  .filter(([t, v]) => t.trim() !== '' && (v === 'yes' || v === 'no'))
  .map(([t, v]) => [t, v === 'yes' ? 1 : 0])
console.log(`loaded ${rows.length} labeled intents`)

const extract = await pipeline('feature-extraction', MODEL.id, { dtype: MODEL.dtype })
const X = []
for (let i = 0; i < rows.length; i += 64) {
  const out = await extract(
    rows.slice(i, i + 64).map(([t]) => t),
    { pooling: MODEL.pooling, normalize: MODEL.normalize }
  )
  X.push(...out.tolist())
}
const y = rows.map(([, l]) => l)

const norm = (s) => s.toLowerCase().split(/\s+/).filter(Boolean).join(' ')
let seed = 7
const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32
const foldOf = new Map(
  [...new Set(rows.map(([t]) => norm(t)))].map((g) => [g, Math.floor(rnd() * 5)])
)
let correct = 0
for (let f = 0; f < 5; f++) {
  const train = [],
    test = []
  rows.forEach(([t], i) => (foldOf.get(norm(t)) === f ? test : train).push(i))
  const h = trainLR(
    train.map((i) => X[i]),
    train.map((i) => y[i]),
    { lambda: LAMBDA }
  )
  for (const i of test) if (score(h, X[i]) > 0.5 === (y[i] === 1)) correct++
}
const cvAccuracy = correct / rows.length
console.log(`grouped 5-fold CV accuracy: ${(cvAccuracy * 100).toFixed(1)}%`)

const head = trainLR(X, y, { lambda: LAMBDA })
fs.writeFileSync(
  OUT,
  JSON.stringify({
    model: MODEL.id,
    dtype: MODEL.dtype,
    pooling: MODEL.pooling,
    normalize: MODEL.normalize,
    trainedOn: `${DATA_URL} (${rows.length} intents)`,
    cvAccuracy: +cvAccuracy.toFixed(3),
    bias: +head.bias.toFixed(6),
    weights: head.weights.map((w) => +w.toFixed(6)),
  }) + '\n'
)
console.log(`wrote ${OUT.pathname}`)
