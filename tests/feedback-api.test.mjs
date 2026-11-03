import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { handleFeedback } from '../server/feedback-handler.ts'

async function call({ method = 'POST', template = 'kpi/program-overview', origin = 'https://localhost', cookie = 'db_feedback_guest=' + 'a'.repeat(64), type = 'application/json', body = '{}', contentLength } = {}) {
  const request = Readable.from([body])
  request.method = method
  request.url = '/api/feedback?template=' + encodeURIComponent(template)
  request.headers = { host: 'localhost', 'x-forwarded-proto': 'https', 'content-type': type, ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}), ...(contentLength ? { 'content-length': contentLength } : {}) }
  request.socket = { remoteAddress: '127.0.0.1' }
  const headers = {}
  let result
  const response = { statusCode: 200, setHeader: (name, value) => { headers[name] = value }, end: text => { result = JSON.parse(text) } }
  await handleFeedback(request, response)
  return { status: response.statusCode, headers, result }
}
test('API rejects cross-origin and missing-origin mutations before touching the database', async () => {
  assert.equal((await call({ origin: 'https://evil.example' })).status, 403)
  assert.equal((await call({ origin: '' })).status, 403)
})
test('API requires an initialized anonymous browser cookie', async () => {
  const result = await call({ cookie: '' })
  assert.equal(result.status, 401)
  assert.equal(result.headers['Cache-Control'], 'private, no-store')
})
test('API rejects unknown templates and unsupported methods', async () => {
  assert.equal((await call({ method: 'GET', template: 'kpi/does-not-exist' })).status, 404)
  assert.equal((await call({ method: 'DELETE' })).status, 405)
})
test('API rejects invalid JSON, oversize payloads, and non-JSON writes', async () => {
  assert.equal((await call({ body: '{broken' })).status, 400)
  assert.equal((await call({ contentLength: '20001' })).status, 413)
  assert.equal((await call({ type: 'text/plain' })).status, 415)
  assert.equal((await call()).status, 400)
})
