import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findLeaks } from '../scripts/check-bundle-secrets.mjs'

// 서버 전용 값(허용 도메인, 비밀 키, 운영 DB 주소, Gmail 계정)이 공개 번들에 들어가면 빌드를 실패시킨다(로그인 설계 6절 번들 점검).
test('finds server-only names and configured values in built files, reporting names not values', () => {
  const env = { AUTH_ALLOWED_DOMAINS: 'example.test, second.test', SMTP_PASS: 'abcd efgh', AUTH_SECRET: 'abc' }
  const leaks = findLeaks([
    { path: 'dist/a.js', text: 'const d="second.test"' },
    { path: 'dist/b.js', text: 'process.env.SMTP_PASS' },
    { path: 'dist/c.js', text: 'clean abc' },
  ], env)
  assert.deepEqual(leaks.sort(), ['dist/a.js: AUTH_ALLOWED_DOMAINS 값', 'dist/b.js: SMTP_PASS'])
  assert.ok(leaks.every(l => !l.includes('second.test') && !l.includes('abcd')))
})

test('clean bundles and missing env values report nothing', () => {
  assert.deepEqual(findLeaks([{ path: 'dist/a.js', text: 'console.log(1)' }], {}), [])
})
