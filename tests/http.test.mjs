import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { HttpError, isSameOrigin, readCookie, readJsonBody } from '../server/http.ts'

function req(headers = {}, body = '') {
  const request = Readable.from([body])
  request.method = 'POST'
  request.url = '/api/x'
  request.headers = { host: 'localhost', 'x-forwarded-proto': 'https', 'content-type': 'application/json', ...headers }
  request.socket = { remoteAddress: '127.0.0.1' }
  return request
}

test('same-origin requires a matching Origin and rejects cross-site fetches', () => {
  assert.equal(isSameOrigin(req({ origin: 'https://localhost' })), true)
  assert.equal(isSameOrigin(req({ origin: 'https://evil.test' })), false)
  assert.equal(isSameOrigin(req({})), false)
  assert.equal(isSameOrigin(req({ origin: 'https://localhost', 'sec-fetch-site': 'cross-site' })), false)
})

test('readCookie finds one cookie among several', () => {
  assert.equal(readCookie(req({ cookie: 'a=1; db_hub_session=tok; b=2' }), 'db_hub_session'), 'tok')
  assert.equal(readCookie(req({ cookie: 'a=1' }), 'db_hub_session'), null)
  assert.equal(readCookie(req({}), 'db_hub_session'), null)
})

test('readJsonBody enforces type, size and syntax with caller messages', async () => {
  const m = { notJson: 'N', tooLarge: 'L', invalid: 'I' }
  await assert.rejects(readJsonBody(req({ 'content-type': 'text/plain' }, '{}'), 100, m), e => e instanceof HttpError && e.status === 415 && e.message === 'N')
  await assert.rejects(readJsonBody(req({}, 'x'.repeat(101)), 100, m), e => e.status === 413 && e.message === 'L')
  await assert.rejects(readJsonBody(req({ 'content-length': '101' }, '{}'), 100, m), e => e.status === 413)
  await assert.rejects(readJsonBody(req({}, '{bad'), 100, m), e => e.status === 400 && e.message === 'I')
  assert.deepEqual(await readJsonBody(req({}, '{"a":1}'), 100, m), { a: 1 })
})
