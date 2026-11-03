import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countHit, rateBucket } from '../server/rate-limit.ts'

test('buckets differ by window and scope, never contain the raw key', () => {
  const a = rateBucket('production', 'code-addr:a@example.test', 'minute')
  assert.notEqual(a, rateBucket('production', 'code-addr:a@example.test', 'hour'))
  assert.notEqual(a, rateBucket('preview', 'code-addr:a@example.test', 'minute'))
  assert.match(a, /^[0-9a-f]{64}$/)
})

test('countHit truncates to the requested window and returns the hit count', async () => {
  const calls = []
  const sql = { query: async (text, params) => { calls.push({ text, params }); return [{ hits: 3 }] } }
  assert.equal(await countHit(sql, 'preview', 'k', 'hour'), 3)
  const insert = calls.find(c => /INSERT INTO feedback_rate_limits/.test(c.text))
  assert.equal(insert.params[1], 'hour')
  assert.equal(insert.params[0], rateBucket('preview', 'k', 'hour'))
  assert.match(insert.text, /date_trunc\(\$2::text, now\(\)\)/)
  await assert.rejects(countHit(sql, 'preview', 'k', 'week'))
})
