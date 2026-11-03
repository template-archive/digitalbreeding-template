import { test } from 'node:test'
import assert from 'node:assert/strict'
import { threadFromHash, threadUrl, filterThreads, isUnread, startsComment } from '../src/features/feedback/review.ts'
import { parseHash } from '../src/gallery/router.ts'

const id = '77dcf9a8-4c95-4b3c-a6e5-4ed47ac96c46'
const thread = (number, resolved, messages) => ({
  id: 'thread-' + number, number, resolved, label: number === 1 ? 'fix' : 'question',
  anchor: { selector: null, quote: '차트 제목', x: 0, y: 0, width: 390 }, messages,
})
const message = (id, authorId, author, body) => ({ id, authorId, author, body, createdAt: '2026-11-03T00:00:00Z' })
test('comment links resolve a template route while library routes and malformed paths stay correct', () => {
  assert.deepEqual(parseHash('#/t/kpi/program-overview?comment=' + id), { name: 'template', category: 'kpi', slug: 'program-overview' })
  assert.deepEqual(parseHash('#/library?category=kpi&q=chart'), { name: 'list', category: 'kpi', search: 'chart' })
  assert.equal(parseHash('#/t/%E0%A4%A/example?comment=' + id).name, 'notfound')
  assert.equal(parseHash('#/t/kpi/program-overview/extra?comment=' + id).name, 'notfound')
})
test('share links preserve theme and the template but never copy embed or access parameters', () => {
  const url = threadUrl('https://example.com/app/?embed=1&theme=dark&x-vercel-protection-bypass=SECRET#/library', 'kpi/program-overview', id)
  const parsed = new URL(url)
  assert.equal(parsed.search, '?theme=dark')
  assert.equal(parsed.pathname, '/app/')
  assert.equal(threadFromHash(parsed.hash, 'kpi/program-overview'), id)
  assert.equal(threadFromHash(parsed.hash, 'kpi/genetic-gain-tracker'), null)
  assert.equal(threadFromHash('#/t/kpi/program-overview?comment=not-a-uuid', 'kpi/program-overview'), null)
  assert.throws(() => threadUrl('javascript:alert(1)', 'kpi/program-overview', id))
})
test('search finds reply authors and text, respects status, and treats punctuation literally', () => {
  const threads = [
    thread(1, false, [message('m1', 'a', 'A 연구원', '원글'), message('m2', 'b', 'B 연구원', '[검토] 축 간격 변경')]),
    thread(2, true, [message('m3', 'b', 'B 연구원', '해결된 질문')]),
  ]
  assert.deepEqual(filterThreads(threads, 'open', 'b 연구원 [검토]').map(t => t.number), [1])
  assert.equal(filterThreads(threads, 'resolved', '질문').length, 1)
  assert.equal(filterThreads(threads, 'all', '[').length, 1)
  assert.equal(filterThreads(threads, 'open', '해결된 질문').length, 0)
  assert.equal(threads.length, 2)
})
test('unread state is personal and advances only when another person adds a new message', () => {
  const one = thread(1, false, [message('m1', 'a', 'A', '원글')])
  const two = thread(1, false, [...one.messages, message('m2', 'b', 'B', '답글')])
  assert.equal(isUnread(one, 'a', {}), false)
  assert.equal(isUnread(one, null, {}), false)
  assert.equal(isUnread(two, 'a', { [two.id]: 'm1' }), true)
  assert.equal(isUnread(two, 'a', { [two.id]: 'm2' }), false)
  assert.equal(isUnread(two, 'b', {}), false)
})
test('comment shortcut never intercepts typing, composition, or browser shortcuts', () => {
  const event = { key: 'c', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, isComposing: false }
  assert.equal(startsComment(event, false), true)
  assert.equal(startsComment(event, true), false)
  for (const key of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey', 'isComposing']) assert.equal(startsComment({ ...event, [key]: true }, false), false)
  assert.equal(startsComment({ ...event, key: 'Escape' }, false), false)
})
