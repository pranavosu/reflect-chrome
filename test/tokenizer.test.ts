import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { tokenize } from '../src/nn'

const raw = JSON.parse(readFileSync('dist/res/models/acc85.95/tokenizer.json', 'utf8'))
const wordMap: Record<string, number> = JSON.parse(JSON.parse(raw).config.word_index)
const pinned: { input: string; tokens: number[] }[] = JSON.parse(
  readFileSync('test/fixtures/tokenizer-pinned.json', 'utf8')
)

test('tokenize matches the pinned pre-refactor output', () => {
  for (const { input, tokens } of pinned) {
    assert.deepEqual(tokenize(wordMap, input), tokens, JSON.stringify(input))
  }
})

test('words that are Object.prototype keys are unknown words, not functions', () => {
  for (const word of ['constructor', 'tostring', '__proto__']) {
    const tokens = tokenize(wordMap, `call the ${word} please`)
    assert.ok(
      tokens.every((t) => Number.isInteger(t)),
      word
    )
  }
})
