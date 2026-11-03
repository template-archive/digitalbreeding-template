import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { readAuthConfig } from '../server/auth/config.ts'
import { createAuthHandler } from '../server/auth/handler.ts'
import { createAuthService } from '../server/auth/service.ts'
import { createMemoryStore } from '../server/auth/memory-store.ts'

const SECRET = 's'.repeat(32)

function makeService() {
  const mailer = { sent: [], async sendLoginCode(to, code) { this.sent.push({ to, code }) } }
  const service = createAuthService({ store: createMemoryStore(() => new Date()), mailer, allowedDomains: ['example.test'], secret: SECRET })
  return { service, mailer }
}

async function call(handler, { method = 'POST', path = '/api/auth/code', originalUrl, origin = 'https://localhost', cookie, body = '{}', ip = '127.0.0.1' } = {}) {
  const request = Readable.from([body])
  request.method = method
  request.url = path
  if (originalUrl) request.originalUrl = originalUrl
  request.headers = { host: 'localhost', 'x-forwarded-proto': 'https', 'content-type': 'application/json', ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}) }
  request.socket = { remoteAddress: ip }
  const headers = {}
  let text = ''
  const response = { statusCode: 200, setHeader: (name, value) => { headers[name] = value }, end: t => { text = t } }
  await handler(request, response)
  return { status: response.statusCode, headers, text, result: text ? JSON.parse(text) : null }
}
const cookieOf = r => String(r.headers['Set-Cookie'] || '')
const tokenOf = r => cookieOf(r).match(/db_hub_session=([^;]*)/)?.[1]

test('config: production never falls back to the shared database or console mail', () => {
  const base = { VERCEL_ENV: 'production', AUTH_ALLOWED_DOMAINS: 'example.test', AUTH_SECRET: SECRET, DATABASE_URL: 'postgres://shared' }
  assert.deepEqual(readAuthConfig(base), { available: false, reason: 'database' })
  assert.deepEqual(readAuthConfig({ ...base, AUTH_DATABASE_URL: 'postgres://auth' }), { available: false, reason: 'mail' })
  const ok = readAuthConfig({ ...base, AUTH_DATABASE_URL: 'postgres://auth', SMTP_USER: 'u', SMTP_PASS: 'p' })
  assert.equal(ok.available, true)
  assert.equal(ok.databaseUrl, 'postgres://auth')
  assert.equal(ok.mail.kind, 'smtp')
  assert.equal(ok.scope, 'production')
  assert.deepEqual(ok.allowedDomains, ['example.test'])
})

test('config: preview and local use the shared database, preview scope and console mail', () => {
  const c = readAuthConfig({ VERCEL_ENV: 'preview', AUTH_ALLOWED_DOMAINS: 'example.test', AUTH_SECRET: SECRET, DATABASE_URL: 'postgres://shared', AUTH_DATABASE_URL: 'postgres://auth' })
  assert.equal(c.databaseUrl, 'postgres://shared')
  assert.equal(c.scope, 'preview')
  assert.equal(c.mail.kind, 'console')
  assert.equal(readAuthConfig({ AUTH_ALLOWED_DOMAINS: 'example.test', AUTH_SECRET: SECRET, POSTGRES_URL: 'postgres://p' }).databaseUrl, 'postgres://p')
  assert.equal(readAuthConfig({ AUTH_SECRET: SECRET, DATABASE_URL: 'x' }).reason, 'domains')
  assert.equal(readAuthConfig({ AUTH_ALLOWED_DOMAINS: 'example.test', AUTH_SECRET: 'short', DATABASE_URL: 'x' }).reason, 'secret')
  assert.equal(readAuthConfig({ AUTH_ALLOWED_DOMAINS: 'example.test', AUTH_SECRET: SECRET }).reason, 'database')
  assert.equal(readAuthConfig({ AUTH_ALLOWED_DOMAINS: 'example.test', AUTH_SECRET: SECRET, DATABASE_URL: 'x', SMTP_USER: 'u', SMTP_PASS: 'p' }).mail.kind, 'smtp')
})

test('mutations need the same origin; unknown actions 404; wrong methods 405', async () => {
  const h = createAuthHandler(() => makeService().service)
  assert.equal((await call(h, { origin: 'https://evil.test' })).status, 403)
  assert.equal((await call(h, { origin: '' })).status, 403)
  assert.equal((await call(h, { path: '/api/auth/nope' })).status, 404)
  assert.equal((await call(h, { method: 'GET', path: '/api/auth/code' })).status, 405)
  assert.equal((await call(h, { method: 'POST', path: '/api/auth/me' })).status, 405)
  const r = await call(h, { method: 'GET', path: '/api/auth/me' })
  assert.equal(r.headers['Cache-Control'], 'private, no-store')
  assert.equal(r.headers['X-Content-Type-Options'], 'nosniff')
})

test('closed login keeps me answering and closes the rest', async () => {
  const h = createAuthHandler(() => null)
  assert.deepEqual((await call(h, { method: 'GET', path: '/api/auth/me' })).result, { user: null, available: false })
  for (const path of ['/api/auth/code', '/api/auth/verify', '/api/auth/name', '/api/auth/logout']) {
    const r = await call(h, { path, body: '{"email":"a@example.test"}' })
    assert.equal(r.status, 503)
    assert.equal(r.result.error, '로그인을 아직 사용할 수 없습니다.')
  }
})

test('full flow sets a 90-day HttpOnly cookie and never returns an email', async () => {
  const { service, mailer } = makeService()
  const h = createAuthHandler(() => service)
  const texts = []
  const sent = await call(h, { body: JSON.stringify({ email: 'kim@example.test' }) })
  texts.push(sent.text)
  assert.deepEqual(sent.result, { message: '코드를 보냈습니다. 메일이 오지 않으면 주소를 확인해 주세요.', resendAfter: 60 })
  const code = mailer.sent[0].code
  const ask = await call(h, { path: '/api/auth/verify', body: JSON.stringify({ email: 'kim@example.test', code }) })
  texts.push(ask.text)
  assert.deepEqual(ask.result, { needsName: true })
  assert.equal(ask.headers['Set-Cookie'], undefined)
  const done = await call(h, { path: '/api/auth/verify', body: JSON.stringify({ email: 'kim@example.test', code, name: '홍길동' }) })
  texts.push(done.text)
  assert.deepEqual(Object.keys(done.result.user).sort(), ['id', 'name'])
  const cookie = cookieOf(done)
  for (const part of ['HttpOnly', 'SameSite=Lax', 'Path=/api', 'Max-Age=7776000', 'Secure']) assert.ok(cookie.includes(part), part)
  const session = 'db_hub_session=' + tokenOf(done)
  const me = await call(h, { method: 'GET', path: '/api/auth/me', cookie: session })
  texts.push(me.text)
  assert.deepEqual(me.result, { user: done.result.user, available: true })
  const renamed = await call(h, { path: '/api/auth/name', cookie: session, body: JSON.stringify({ name: '김철수' }) })
  texts.push(renamed.text)
  assert.equal(renamed.result.user.name, '김철수')
  const out = await call(h, { path: '/api/auth/logout', cookie: session })
  assert.deepEqual(out.result, { ok: true })
  assert.ok(cookieOf(out).includes('Max-Age=0'))
  assert.deepEqual((await call(h, { method: 'GET', path: '/api/auth/me', cookie: session })).result, { user: null, available: true })
  for (const t of texts) assert.doesNotMatch(t, /@/)
})

test('a stale session cookie is cleared and protected calls answer 401', async () => {
  const h = createAuthHandler(() => makeService().service)
  const stale = 'db_hub_session=' + 'a'.repeat(43)
  const me = await call(h, { method: 'GET', path: '/api/auth/me', cookie: stale })
  assert.deepEqual(me.result, { user: null, available: true })
  assert.ok(cookieOf(me).includes('Max-Age=0'))
  const r = await call(h, { path: '/api/auth/name', cookie: stale, body: '{"name":"김"}' })
  assert.equal(r.status, 401)
  assert.equal(r.result.error, '로그인이 필요합니다.')
})

test('vite middleware paths work through originalUrl', async () => {
  const h = createAuthHandler(() => makeService().service)
  const r = await call(h, { path: '/code', originalUrl: '/api/auth/code', body: JSON.stringify({ email: 'kim@example.test' }) })
  assert.equal(r.status, 200)
  assert.equal((await call(h, { method: 'GET', path: '/me', originalUrl: '/api/auth/me?x=1' })).status, 200)
})

test('rate limits answer 429 with Retry-After; bad bodies answer 400 or 415', async () => {
  const { service } = makeService()
  const h = createAuthHandler(() => service)
  await call(h, { body: JSON.stringify({ email: 'kim@example.test' }) })
  const r = await call(h, { body: JSON.stringify({ email: 'kim@example.test' }) })
  assert.equal(r.status, 429)
  assert.ok(Number(r.headers['Retry-After']) > 0)
  assert.equal((await call(h, { body: '{bad' })).status, 400)
  assert.equal((await call(h, { body: '[]' })).status, 400)
  assert.equal((await call(h, { body: JSON.stringify({ email: 'nope' }) })).result.error, '메일 주소 형식을 확인해 주세요.')
})

test('unexpected storage errors answer 503 without details', async () => {
  const broken = { requestCode: async () => { throw new Error('connection refused to db host') } }
  const r = await call(createAuthHandler(() => broken), { body: JSON.stringify({ email: 'kim@example.test' }) })
  assert.equal(r.status, 503)
  assert.equal(r.result.error, '로그인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.')
})
