import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { AuthRequestError, fetchSession, logoutAccount, renameAccount, requestLoginCode, verifyLoginCode } from '../src/features/auth/client.ts'

let calls = []
function fake(responses) {
  const queue = [...responses]
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', credentials: init.credentials, body: init.body ? JSON.parse(init.body) : undefined })
    const r = queue.shift()
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json', ...(r.headers || {}) } })
  }
}
beforeEach(() => { calls = [] })

test('verify returns needsName or the user', async () => {
  fake([{ status: 200, body: { needsName: true } }, { status: 200, body: { user: { id: 'u', name: '홍' } } }])
  assert.deepEqual(await verifyLoginCode('a@example.test', '123456'), { needsName: true })
  assert.deepEqual(await verifyLoginCode('a@example.test', '123456', '홍'), { user: { id: 'u', name: '홍' } })
  assert.equal(calls[0].url, '/api/auth/verify')
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].body.name, undefined)
  assert.equal(calls[1].body.name, '홍')
  assert.equal(calls[1].credentials, 'same-origin')
})

test('code request, rename, logout and session use their endpoints', async () => {
  fake([
    { status: 200, body: { message: '코드를 보냈습니다. 메일이 오지 않으면 주소를 확인해 주세요.', resendAfter: 60 } },
    { status: 200, body: { user: { id: 'u', name: '김' } } },
    { status: 200, body: { ok: true } },
    { status: 200, body: { user: null, available: false } },
  ])
  assert.deepEqual(await requestLoginCode('a@example.test'), { resendAfter: 60 })
  assert.deepEqual(await renameAccount('김'), { id: 'u', name: '김' })
  await logoutAccount()
  assert.deepEqual(await fetchSession(), { user: null, available: false })
  assert.deepEqual(calls.map(c => c.method + ' ' + c.url), ['POST /api/auth/code', 'POST /api/auth/name', 'POST /api/auth/logout', 'GET /api/auth/me'])
  assert.deepEqual(calls[0].body, { email: 'a@example.test' })
})

test('errors carry status, server message and Retry-After', async () => {
  fake([{ status: 429, body: { error: '요청이 많습니다. 잠시 후 다시 시도해 주세요.' }, headers: { 'Retry-After': '42' } }])
  await assert.rejects(requestLoginCode('a@example.test'),
    e => e instanceof AuthRequestError && e.status === 429 && e.retryAfter === 42 && e.message.startsWith('요청이 많습니다'))
})

test('an expired session surfaces as 401 so the provider can sign out', async () => {
  fake([{ status: 401, body: { error: '로그인이 필요합니다.' } }])
  await assert.rejects(renameAccount('김'), e => e.status === 401 && e.retryAfter === null)
})

test('session lookup tolerates network failure', async () => {
  globalThis.fetch = async () => { throw new TypeError('offline') }
  assert.deepEqual(await fetchSession(), { user: null, available: true })
})

test('network failure on an action becomes a readable error', async () => {
  globalThis.fetch = async () => { throw new TypeError('offline') }
  await assert.rejects(requestLoginCode('a@example.test'), e => e instanceof AuthRequestError && e.status === 0 && /연결/.test(e.message))
})
