import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allowSite, allowanceLeft, withIntent } from '../src/storage'

const now = new Date('2026-10-28T12:00:00.000Z')

test('allowSite opens a site and drops expired allowances', () => {
  const allowances = {
    'old.com': '2026-10-28T11:00:00.000Z',
    'live.com': '2026-10-28T12:30:00.000Z',
  }
  assert.deepEqual(allowSite(allowances, 'youtube.com', 5, now), {
    'live.com': '2026-10-28T12:30:00.000Z',
    'youtube.com': '2026-10-28T12:05:00.000Z',
  })
})

test('allowanceLeft is zero for unknown or expired sites', () => {
  assert.equal(allowanceLeft({}, 'youtube.com'), 0)
  assert.equal(allowanceLeft({ 'youtube.com': '2000-01-01T00:00:00.000Z' }, 'youtube.com'), 0)
  assert.ok(allowanceLeft({ 'youtube.com': '2999-01-01T00:00:00.000Z' }, 'youtube.com') > 0)
})

test('withIntent keeps exactly the newest max entries', () => {
  const entry = (intent: string) => ({ intent, url: 'x.com', accepted: 'no' as const })
  const log = {
    '2026-10-28T09:00:00.000Z': entry('a'),
    '2026-10-28T10:00:00.000Z': entry('b'),
    '2026-10-28T11:00:00.000Z': entry('c'),
  }
  const next = withIntent(log, entry('d'), now, 3)
  assert.deepEqual(Object.keys(next), [
    '2026-10-28T10:00:00.000Z',
    '2026-10-28T11:00:00.000Z',
    '2026-10-28T12:00:00.000Z',
  ])
  assert.equal(next['2026-10-28T12:00:00.000Z'].intent, 'd')
})
