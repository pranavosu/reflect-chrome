import { env, pipeline, FeatureExtractionPipeline, ProgressInfo } from '@huggingface/transformers'
import { IntentModel, lazyModel } from './intent_model'
import { reportSmartModelStatus } from './messages'
import { sigmoid } from './nn'

const HEAD_URL: string = 'res/models/minilm-l6-head.json'

interface Head {
  model: string
  dtype: 'q8'
  pooling: 'mean' | 'cls'
  normalize: boolean
  weights: number[]
  bias: number
}

export function smartModel(): IntentModel {
  return lazyModel(load, async ({ extractor, head }, intent) => {
    const output = await extractor(intent, { pooling: head.pooling, normalize: head.normalize })
    const embedding = output.data
    let z: number = head.bias
    for (let i = 0; i < embedding.length; i++) z += head.weights[i] * embedding[i]
    output.dispose()
    return sigmoid(z)
  })
}

function configureRuntime(): void {
  env.allowLocalModels = false
  env.useBrowserCache = true
  const onnxWasm = env.backends.onnx.wasm
  if (onnxWasm !== undefined) {
    onnxWasm.wasmPaths = { wasm: chrome.runtime.getURL('ort/ort-wasm-simd-threaded.wasm') }
    onnxWasm.numThreads = 1
    onnxWasm.proxy = false
  }
}

async function load(): Promise<{ extractor: FeatureExtractionPipeline; head: Head }> {
  const startTime = performance.now()
  try {
    configureRuntime()
    reportSmartModelStatus({ state: 'loading', progress: 0 })
    const head: Head = await (await fetch(chrome.runtime.getURL(HEAD_URL))).json()

    let reported = 0
    const extractor = await pipeline('feature-extraction', head.model, {
      dtype: head.dtype,
      device: 'wasm',
      progress_callback: (p: ProgressInfo) => {
        const step = p.status === 'progress_total' ? Math.floor(p.progress / 10) * 10 : reported
        if (step !== reported) {
          reported = step
          reportSmartModelStatus({ state: 'loading', progress: step })
        }
      },
    })

    reportSmartModelStatus({ state: 'ready' })
    console.log(`Smart model loaded in ${Math.floor(performance.now() - startTime)} ms`)
    return { extractor, head }
  } catch (err) {
    reportSmartModelStatus({
      state: 'error',
      message: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
