import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyServerEnv } from '../server/env.ts'

// process.env에 undefined를 넣으면 문자열 "undefined"가 된다. 없는 값은 아예 건드리지 않아야 한다.
test('missing values stay unset instead of becoming the string "undefined"', () => {
  const target = {}
  copyServerEnv(target, { AUTH_SECRET: 's' }, ['AUTH_SECRET', 'AUTH_ALLOWED_DOMAINS', 'SMTP_USER'])
  assert.deepEqual(target, { AUTH_SECRET: 's' })
  const real = { ...process.env }
  copyServerEnv(process.env, {}, ['DB_TEST_UNSET_KEY_X'])
  assert.equal(process.env.DB_TEST_UNSET_KEY_X, undefined)
  assert.deepEqual(Object.keys(process.env).sort(), Object.keys(real).sort())
})

test('values already in the environment win over .env files', () => {
  const target = { DATABASE_URL: 'from-shell' }
  copyServerEnv(target, { DATABASE_URL: 'from-file', POSTGRES_URL: 'p' }, ['DATABASE_URL', 'POSTGRES_URL'])
  assert.deepEqual(target, { DATABASE_URL: 'from-shell', POSTGRES_URL: 'p' })
})

test('empty strings in .env files are ignored', () => {
  const target = {}
  copyServerEnv(target, { SMTP_USER: '' }, ['SMTP_USER'])
  assert.deepEqual(target, {})
})
