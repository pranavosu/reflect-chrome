// nn.ts is reflect's original intent model: a small Keras LSTM classifier
// (embedding -> LSTM -> LSTM -> dense -> dense -> sigmoid) trained in 2020.
// Inference is written out in plain TypeScript, so it needs no ML library.
import { IntentModel, lazyModel } from './intent_model'

const SEQUENCE_LENGTH = 75
const EMBEDDING_SIZE = 64

type Weights = { [name: string]: Float32Array }
type WordMap = { [word: string]: number }

interface ModelJson {
  weightsManifest: { paths: string[]; weights: { name: string; shape: number[] }[] }[]
}

export function originalModel(name: string): IntentModel {
  return lazyModel(
    () => load(name),
    ({ wordMap, weights }, intent) => forward(weights, tokenize(wordMap, intent))
  )
}

// ---- tokenizer ----

// the 2020 training pipeline also expanded contractions and dropped stop words,
// but reflect's shipped inference never did. The model has always run on this
// cleaning, so it stays as-is
function clean(intent: string): string {
  return intent
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .toLowerCase()
    .replace(/\s{2,}/g, ' ')
}

// turn an intent into `length` word ids, left-padded with zeros; unknown words
// are 0. Longer inputs keep the original model's quirk of dropping words from
// both ends, since that's what it has always seen
export function tokenize(
  wordMap: WordMap,
  intent: string,
  length: number = SEQUENCE_LENGTH
): number[] {
  const ids: number[] = clean(intent)
    .split(' ')
    .map((word) => (Object.hasOwn(wordMap, word) ? wordMap[word] : 0))
  const padded: number[] = new Array(length).fill(0)
  const shift: number = length - ids.length
  for (let i = 0; i < Math.min(length, ids.length); i++) {
    if (i + shift >= 0) padded[i + shift] = ids[i]
  }
  return padded
}

// ---- network ----

export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x))

// Keras LSTM forward pass. Gates are packed as [input, forget, cell, output]
// along the 4 * units axis of the kernel, recurrent kernel and bias.
function lstm(
  sequence: Float32Array[],
  inputDim: number,
  units: number,
  kernel: Float32Array,
  recurrentKernel: Float32Array,
  bias: Float32Array
): Float32Array[] {
  const h = new Float32Array(units)
  const c = new Float32Array(units)
  const z = new Float32Array(4 * units)
  const outputs: Float32Array[] = []

  for (const x of sequence) {
    z.set(bias)
    for (let k = 0; k < inputDim; k++) {
      const xk = x[k]
      if (xk === 0) continue
      const row = k * 4 * units
      for (let j = 0; j < 4 * units; j++) z[j] += xk * kernel[row + j]
    }
    for (let k = 0; k < units; k++) {
      const hk = h[k]
      if (hk === 0) continue
      const row = k * 4 * units
      for (let j = 0; j < 4 * units; j++) z[j] += hk * recurrentKernel[row + j]
    }
    for (let j = 0; j < units; j++) {
      const i = sigmoid(z[j])
      const f = sigmoid(z[units + j])
      const g = Math.tanh(z[2 * units + j])
      const o = sigmoid(z[3 * units + j])
      c[j] = f * c[j] + i * g
      h[j] = o * Math.tanh(c[j])
    }
    outputs.push(Float32Array.from(h))
  }
  return outputs
}

function dense(
  x: Float32Array,
  inputDim: number,
  outputDim: number,
  kernel: Float32Array,
  bias: Float32Array
): Float32Array {
  const y = Float32Array.from(bias)
  for (let k = 0; k < inputDim; k++) {
    const xk = x[k]
    const row = k * outputDim
    for (let j = 0; j < outputDim; j++) y[j] += xk * kernel[row + j]
  }
  return y
}

function forward(w: Weights, tokens: number[]): number {
  const embedded: Float32Array[] = tokens.map((t) =>
    w['embedding_1/embeddings'].subarray(t * EMBEDDING_SIZE, (t + 1) * EMBEDDING_SIZE)
  )
  const seq1 = lstm(
    embedded,
    64,
    64,
    w['lstm_1/kernel'],
    w['lstm_1/recurrent_kernel'],
    w['lstm_1/bias']
  )
  const seq2 = lstm(
    seq1,
    64,
    64,
    w['lstm_2/kernel'],
    w['lstm_2/recurrent_kernel'],
    w['lstm_2/bias']
  )
  const fc1 = dense(seq2[seq2.length - 1], 64, 256, w['FC1/kernel'], w['FC1/bias'])
  const out = dense(fc1, 256, 1, w['out_layer/kernel'], w['out_layer/bias'])
  return sigmoid(out[0])
}

// ---- loading ----

async function load(name: string): Promise<{ wordMap: WordMap; weights: Weights }> {
  const startTime = performance.now()
  const dir: string = chrome.runtime.getURL(`res/models/${name}/`)
  const [modelJson, tokenizerJson]: [ModelJson, string] = await Promise.all([
    fetch(dir + 'model.json').then((r) => r.json()),
    fetch(dir + 'tokenizer.json').then((r) => r.json()),
  ])

  // weights are float32 arrays concatenated in manifest order
  const weights: Weights = {}
  for (const group of modelJson.weightsManifest) {
    const buffers: ArrayBuffer[] = await Promise.all(
      group.paths.map((p) => fetch(dir + p).then((r) => r.arrayBuffer()))
    )
    const data = new Uint8Array(buffers.reduce((n, b) => n + b.byteLength, 0))
    buffers.reduce((offset, b) => (data.set(new Uint8Array(b), offset), offset + b.byteLength), 0)

    let offset = 0
    for (const spec of group.weights) {
      const size: number = spec.shape.reduce((a, b) => a * b, 1)
      weights[spec.name] = new Float32Array(data.buffer, offset, size)
      offset += size * 4
    }
  }

  // the tokenizer file is JSON-encoded twice
  const wordMap: WordMap = JSON.parse(JSON.parse(tokenizerJson).config.word_index)
  console.log(`Original model loaded in ${Math.floor(performance.now() - startTime)} ms`)
  return { wordMap, weights }
}
