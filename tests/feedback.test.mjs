import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { parseFeedback, readFeedback, updateFeedback, getIdentity, renameIdentity, makeMessage, storageKey } from '../src/features/feedback/storage.ts'

let values
let events
beforeEach(() => {
  values = new Map()
  events = []
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  globalThis.window = { dispatchEvent: event => { events.push(event); return true } }
})
const fixture = () => ({
  version: 1, nextNumber: 2, threads: [{
    id: 'thread-1', number: 1, label: 'fix', resolved: false,
    anchor: { selector: 'h1:nth-of-type(1)', quote: '제목', x: .2, y: .5, width: 800 },
    messages: [{ id: 'message-1', authorId: 'guest-1', author: '익명', body: '수정해 주세요', createdAt: '2026-11-03T00:00:00Z' }],
  }],
})
test('missing storage starts empty; valid feedback round-trips', () => {
  assert.deepEqual(parseFeedback(null), { version: 1, nextNumber: 1, threads: [] })
  assert.deepEqual(parseFeedback(JSON.stringify(fixture())), fixture())
})
test('invalid and unknown versions fail without changing existing storage', () => {
  for (const raw of ['{', '{"version":2}', '{"version":1,"nextNumber":1,"threads":[{}]}']) {
    values.set(storageKey('kpi/a'), raw)
    assert.throws(() => updateFeedback('kpi/a', data => { data.threads = [] }))
    assert.equal(values.get(storageKey('kpi/a')), raw)
  }
})
test('rejects unsafe labels, coordinates, duplicate numbers and malformed messages', () => {
  for (const corrupt of [
    data => { data.threads[0].label = 'constructor' },
    data => { data.threads[0].anchor.x = -1 },
    data => { data.threads[0].anchor.y = 1.1 },
    data => { data.threads[0].messages[0].body = 'x'.repeat(2001) },
    data => { data.threads[0].messages[0].createdAt = 'invalid' },
    data => { data.threads.push({ ...data.threads[0], id: 'another' }) },
    data => { data.nextNumber = 1 },
  ]) {
    const data = fixture(); corrupt(data)
    assert.throws(() => parseFeedback(JSON.stringify(data)))
  }
})
test('template isolation and read-latest mutations preserve earlier comments', () => {
  values.set(storageKey('kpi/a'), JSON.stringify(fixture()))
  updateFeedback('kpi/a', data => { data.threads[0].resolved = true })
  updateFeedback('kpi/a', data => { data.threads[0].label = 'question' })
  assert.equal(readFeedback('kpi/a').threads[0].resolved, true)
  assert.equal(readFeedback('kpi/a').threads[0].label, 'question')
  assert.equal(readFeedback('kpi/b').threads.length, 0)
  assert.equal(events.length, 2)
  assert.equal(events[0].detail, 'kpi/a')
})
test('quota failure reports failure and leaves previous data intact', () => {
  const raw = JSON.stringify(fixture())
  values.set(storageKey('kpi/a'), raw)
  globalThis.localStorage.setItem = () => { throw new Error('QuotaExceededError') }
  assert.throws(() => updateFeedback('kpi/a', data => { data.threads[0].resolved = true }), /QuotaExceededError/)
  assert.equal(values.get(storageKey('kpi/a')), raw)
  assert.equal(events.length, 0)
})
test('anonymous identity persists, optional name defaults, and messages retain historical names', () => {
  const guest = getIdentity()
  assert.deepEqual(getIdentity(), guest)
  const first = makeMessage(guest, '  첫 의견  ')
  const renamed = renameIdentity(guest, ' 연구원 ')
  assert.equal(renamed.id, guest.id)
  assert.equal(renamed.name, '연구원')
  assert.equal(makeMessage(renamed, '답글').author, '연구원')
  assert.equal(first.author, '익명')
  assert.equal(first.body, '첫 의견')
  assert.equal(renameIdentity(renamed, ' ').name, '익명')
  assert.throws(() => makeMessage(guest, ' '))
  assert.throws(() => makeMessage(guest, 'x'.repeat(2001)))
})
