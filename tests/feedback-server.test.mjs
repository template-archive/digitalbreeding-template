import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateAction, applyAction, FeedbackError } from '../server/feedback-domain.ts'
import { parseFeedback } from '../src/features/feedback/model.ts'
const now = '2026-11-03T00:00:00Z'
const actor = 'a'.repeat(64), other = 'b'.repeat(64)
const create = (overrides = {}) => ({
  type: 'create', requestId: crypto.randomUUID(), anchor: { selector: null, quote: '', x: 0, y: 0, width: 900 },
  label: 'fix', author: '', body: ' 코멘트 ', ...overrides,
})
const apply = (data, who, action) => applyAction(data, who, validateAction(action), now)

test('server controls identity, timestamps, and monotonic per-template numbers', () => {
  const empty = parseFeedback(null)
  const action = create({ authorId: 'forged', createdAt: 'forged' })
  const first = apply(empty, actor, action)
  const second = apply(first, other, create({ author: '연구원' }))
  assert.equal(empty.threads.length, 0)
  assert.equal(first.threads[0].messages[0].authorId, actor)
  assert.equal(first.threads[0].messages[0].createdAt, now)
  assert.equal(first.threads[0].messages[0].author, '익명')
  assert.equal(first.threads[0].messages[0].body, '코멘트')
  assert.deepEqual(second.threads.map(t => t.number), [1, 2])
})
test('only the original anonymous browser can delete; other users can collaborate', () => {
  const initial = apply(parseFeedback(null), actor, create())
  const threadId = initial.threads[0].id
  assert.throws(() => apply(initial, other, { type: 'delete', threadId }), e => e instanceof FeedbackError && e.status === 403)
  const changed = apply(initial, other, { type: 'label', threadId, label: 'question' })
  const resolved = apply(changed, other, { type: 'resolve', threadId, resolved: true })
  assert.equal(resolved.threads[0].resolved, true)
  assert.equal(resolved.threads[0].label, 'question')
  const deleted = apply(resolved, actor, { type: 'delete', threadId })
  assert.equal(deleted.threads.length, 0)
  assert.equal(deleted.nextNumber, 2)
})
test('retrying create and reply is idempotent and does not duplicate a saved comment', () => {
  const action = create()
  const one = apply(parseFeedback(null), actor, action)
  assert.deepEqual(apply(one, actor, action), one)
  assert.throws(() => apply(one, other, action), e => e.status === 409)
  const reply = { type: 'reply', requestId: crypto.randomUUID(), threadId: action.requestId, author: '동료', body: '답글' }
  const two = apply(one, other, reply)
  assert.deepEqual(apply(two, other, reply), two)
  assert.equal(two.threads[0].messages.length, 2)
  const resolved = apply(two, actor, { type: 'resolve', threadId: action.requestId, resolved: true })
  assert.deepEqual(apply(resolved, other, reply), resolved)
})
test('resolved/deleted threads reject new replies and missing deletes remain safe', () => {
  const action = create()
  const one = apply(parseFeedback(null), actor, action)
  const resolved = apply(one, actor, { type: 'resolve', threadId: action.requestId, resolved: true })
  const reply = { type: 'reply', requestId: crypto.randomUUID(), threadId: action.requestId, author: '', body: '답글' }
  assert.throws(() => apply(resolved, other, reply), e => e.status === 409)
  const deleted = apply(one, actor, { type: 'delete', threadId: action.requestId })
  assert.throws(() => apply(deleted, other, reply), e => e.status === 404)
  assert.deepEqual(apply(deleted, other, { type: 'delete', threadId: action.requestId }), deleted)
})
test('rejects malformed actions, body limits, labels, and non-finite anchors', () => {
  for (const action of [
    null, {}, create({ label: 'constructor' }), create({ body: ' ' }), create({ body: 'x'.repeat(2001) }),
    create({ author: 'x'.repeat(31) }), create({ requestId: 'not-uuid' }), create({ anchor: { selector: null, quote: '', x: NaN, y: 0, width: 0 } }),
    { type: 'resolve', threadId: crypto.randomUUID(), resolved: 'false' },
  ]) assert.throws(() => validateAction(action), e => e instanceof FeedbackError && e.status === 400)
})
