import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createMemoryStore } from '../server/auth/memory-store.ts'
import { createPgStore } from '../server/auth/pg-store.ts'

// 같은 계약을 메모리 저장소(테스트용)와 Postgres 저장소에 돌린다. Postgres는 AUTH_TEST_DATABASE_URL이 있을 때만.
const unique = () => 'store-test-' + randomBytes(6).toString('hex') + '@example.test'
const later = () => new Date(Date.now() + 600_000)
const tokenHash = () => randomBytes(32).toString('hex')

function contract(name, make, options = {}) {
  test(name + ': a new code replaces the previous one and attempts count up', options, async () => {
    const s = await make(), email = unique(), now = new Date()
    assert.equal(await s.getCode(email), null)
    assert.equal(await s.consumeAttempt(email, 'h1', now, 5), 'invalid')
    await s.putCode({ email, codeHash: 'h1', expiresAt: later(), attempts: 0, sentAt: now })
    assert.equal(await s.consumeAttempt(email, 'x', now, 5), 'mismatch')
    await s.putCode({ email, codeHash: 'h2', expiresAt: later(), attempts: 0, sentAt: now })
    assert.equal(await s.consumeAttempt(email, 'h1', now, 5), 'mismatch')
    const row = await s.getCode(email)
    assert.equal(row.codeHash, 'h2')
    assert.equal(row.attempts, 1)
    assert.ok(row.expiresAt instanceof Date)
    assert.equal(await s.consumeAttempt(email, 'h2', now, 5), 'match')
    assert.equal((await s.getCode(email)).attempts, 1)
    await s.deleteCode(email)
    assert.equal(await s.getCode(email), null)
  })

  test(name + ': attempts stop at the limit and expired codes are invalid', options, async () => {
    const s = await make(), email = unique(), now = new Date()
    await s.putCode({ email, codeHash: 'h', expiresAt: later(), attempts: 0, sentAt: now })
    for (let i = 0; i < 5; i++) assert.equal(await s.consumeAttempt(email, 'x', now, 5), 'mismatch')
    assert.equal(await s.consumeAttempt(email, 'h', now, 5), 'invalid')
    const old = unique()
    await s.putCode({ email: old, codeHash: 'h', expiresAt: new Date(now.getTime() - 1000), attempts: 0, sentAt: now })
    assert.equal(await s.consumeAttempt(old, 'h', now, 5), 'invalid')
  })

  test(name + ': users are unique per email and sessions join their user', options, async () => {
    const s = await make(), email = unique(), token = tokenHash()
    assert.equal(await s.findUser(email), null)
    const u = await s.createUser(email, '홍길동')
    assert.deepEqual(Object.keys(u).sort(), ['email', 'id', 'name'])
    assert.equal((await s.createUser(email, '다른 이름')).id, u.id)
    assert.equal((await s.findUser(email)).name, '홍길동')
    const created = new Date(Date.now() - 1000)
    await s.createSession(token, u.id, created)
    const session = await s.getSession(token)
    assert.equal(session.user.id, u.id)
    assert.equal(session.user.email, email)
    assert.equal(session.createdAt.getTime(), created.getTime())
    const seen = new Date()
    await s.touchSession(token, seen)
    assert.equal((await s.getSession(token)).lastSeenAt.getTime(), seen.getTime())
    assert.equal((await s.renameUser(u.id, '김철수')).name, '김철수')
    assert.equal((await s.getSession(token)).user.name, '김철수')
    await s.recordLogin(u.id, new Date())
    await s.deleteSession(token)
    assert.equal(await s.getSession(token), null)
  })

  test(name + ': hits count per key and window', options, async () => {
    const s = await make(), key = unique()
    assert.equal(await s.hit(key, 'hour'), 1)
    assert.equal(await s.hit(key, 'hour'), 2)
    assert.equal(await s.hit(key, 'day'), 1)
    assert.equal(await s.hit(key + 'x', 'hour'), 1)
  })
}

contract('memory', async () => createMemoryStore(() => new Date()))
contract('postgres', async () => createPgStore(process.env.AUTH_TEST_DATABASE_URL, 'preview'),
  { skip: !process.env.AUTH_TEST_DATABASE_URL && 'AUTH_TEST_DATABASE_URL 없음' })

test('memory hits reset when the clock enters a new window', async () => {
  let now = new Date('2026-11-04T10:59:30Z')
  const s = createMemoryStore(() => now)
  assert.equal(await s.hit('k', 'minute'), 1)
  assert.equal(await s.hit('k', 'minute'), 2)
  now = new Date('2026-11-04T11:00:05Z')
  assert.equal(await s.hit('k', 'minute'), 1)
  assert.equal(await s.hit('k', 'hour'), 1)
})
