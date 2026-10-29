import { test } from 'node:test'
import assert from 'node:assert/strict'
import { entryFor, matchingEntry, pageOf, siteOf } from '../src/sites'

test('siteOf keeps the host and port and drops a leading www.', () => {
  assert.equal(siteOf('https://www.youtube.com/watch?v=1'), 'youtube.com')
  assert.equal(siteOf('http://127.0.0.1:8080/x'), '127.0.0.1:8080')
  assert.equal(siteOf('https://m.youtube.com/'), 'm.youtube.com')
  assert.equal(siteOf('https://awww.com/'), 'awww.com')
  assert.equal(siteOf('chrome://newtab/'), '')
  assert.equal(siteOf('not a url'), '')
  assert.equal(siteOf(undefined), '')
})

test('pageOf ignores query, fragment and trailing slashes', () => {
  assert.equal(pageOf('https://www.reddit.com/r/foo/?sort=new#top'), 'reddit.com/r/foo')
  assert.equal(pageOf('https://youtube.com/'), 'youtube.com')
  assert.equal(pageOf('https://youtube.com/Watch'), 'youtube.com/Watch')
  assert.equal(pageOf('chrome://extensions/'), '')
})

test('entryFor accepts sites, pages and pasted URLs', () => {
  assert.equal(entryFor('YouTube.com'), 'youtube.com')
  assert.equal(entryFor('  www.youtube.com/  '), 'youtube.com')
  assert.equal(entryFor('https://www.Reddit.com/'), 'reddit.com')
  assert.equal(entryFor('https://www.youtube.com/Watch?v=abc'), 'youtube.com/Watch')
  assert.equal(entryFor('reddit.com/r/foo/'), 'reddit.com/r/foo')
  assert.equal(entryFor('127.0.0.1:8080'), '127.0.0.1:8080')
  assert.equal(entryFor('not a site'), undefined)
  assert.equal(entryFor('localhost'), undefined)
  assert.equal(entryFor(''), undefined)
})

test('matchingEntry blocks exact sites and exact pages', () => {
  const list = ['youtube.com', 'x.com', 'reddit.com/r/foo', 'example.com/']
  assert.equal(matchingEntry('https://www.youtube.com/watch?v=1', list), 'youtube.com')
  assert.equal(matchingEntry('https://reddit.com/r/foo/', list), 'reddit.com/r/foo')
  assert.equal(matchingEntry('https://reddit.com/r/bar', list), undefined)
  // old "site/" entries keep blocking only the homepage
  assert.equal(matchingEntry('https://example.com/', list), 'example.com/')
  assert.equal(matchingEntry('https://example.com/about', list), undefined)
})

test('matchingEntry no longer blocks hosts that merely contain an entry', () => {
  const list = ['youtube.com', 'x.com']
  for (const url of [
    'https://netflix.com/',
    'https://www.dropbox.com/home',
    'https://notyoutube.com/',
    'https://m.youtube.com/',
    'https://youtube.com:8080/',
    'chrome://newtab/',
  ]) {
    assert.equal(matchingEntry(url, list), undefined, url)
  }
})

test('a site entry wins over a page entry', () => {
  assert.equal(
    matchingEntry('https://youtube.com/watch', ['youtube.com/watch', 'youtube.com']),
    'youtube.com'
  )
})
