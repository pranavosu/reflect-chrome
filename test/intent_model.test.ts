import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lazyModel } from '../src/intent_model'

test('lazyModel loads once and shares the load between callers', async () => {
  let loads = 0
  const model = lazyModel(
    async () => ++loads,
    (n, intent) => n + intent.length
  )
  assert.deepEqual(await Promise.all([model.score('ab'), model.score('abc'), model.warmUp()]), [
    3,
    4,
    undefined,
  ])
  assert.equal(loads, 1)
})

test('lazyModel retries after a failed load', async () => {
  let attempts = 0
  const model = lazyModel(
    async () => {
      if (++attempts === 1) throw new Error('offline')
      return 10
    },
    (n) => n
  )
  await assert.rejects(model.score('x'), /offline/)
  assert.equal(await model.score('x'), 10)
  assert.equal(attempts, 2)
})
