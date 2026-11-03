import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  codeMatches, generateCode, hashCode, hashToken, isAllowedEmail, isTokenShape, newSessionToken,
  normalizeCode, normalizeEmail, parseAllowedDomains, sessionStatus, validateName,
} from '../server/auth/domain.ts'

test('email is trimmed and lowercased; bad shapes fail with the format message', () => {
  assert.equal(normalizeEmail('  Kim@Example.TEST '), 'kim@example.test')
  for (const bad of ['', 'kim', 'kim@', '@example.test', 'a b@example.test', 'a@b', 'x'.repeat(250) + '@example.test', 123, null])
    assert.throws(() => normalizeEmail(bad), e => e.status === 400 && e.message === '메일 주소 형식을 확인해 주세요.')
})

test('only exact listed domains are allowed; subdomains must be listed', () => {
  const domains = parseAllowedDomains(' Example.test, @second.test ,, ')
  assert.deepEqual(domains, ['example.test', 'second.test'])
  assert.equal(isAllowedEmail('a@example.test', domains), true)
  assert.equal(isAllowedEmail('a+tag@example.test', domains), true)
  assert.equal(isAllowedEmail('a@second.test', domains), true)
  assert.equal(isAllowedEmail('a@mail.example.test', domains), false)
  assert.equal(isAllowedEmail('a@example.test.other.test', domains), false)
  assert.equal(isAllowedEmail('a@other.test', domains), false)
  assert.equal(isAllowedEmail('a@example.test', []), false)
  assert.deepEqual(parseAllowedDomains(undefined), [])
})

test('codes are six digits and accept pasted spacing', () => {
  for (let i = 0; i < 200; i++) assert.match(generateCode(), /^\d{6}$/)
  assert.equal(normalizeCode(' 123 456\n'), '123456')
  assert.equal(normalizeCode('123-456'), '123456')
  assert.equal(normalizeCode('012345'), '012345')
  assert.equal(normalizeCode('12345'), null)
  assert.equal(normalizeCode('1234567'), null)
  assert.equal(normalizeCode('12345a'), null)
  assert.equal(normalizeCode(123456), null)
})

test('code hashes depend on the secret and email', () => {
  const h = hashCode('s'.repeat(32), 'a@example.test', '123456')
  assert.equal(codeMatches('s'.repeat(32), 'a@example.test', '123456', h), true)
  assert.equal(codeMatches('s'.repeat(32), 'a@example.test', '123457', h), false)
  assert.equal(codeMatches('t'.repeat(32), 'a@example.test', '123456', h), false)
  assert.equal(codeMatches('s'.repeat(32), 'b@example.test', '123456', h), false)
  assert.equal(codeMatches('s'.repeat(32), 'a@example.test', '123456', 'short'), false)
  assert.doesNotMatch(h, /123456/)
})

test('names are 1–20 characters without control characters', () => {
  assert.equal(validateName('  홍길동 '), '홍길동')
  assert.equal([...validateName('가'.repeat(20))].length, 20)
  for (const bad of ['', '   ', '가'.repeat(21), 'a\u0007b', 'a\nb', 5, null])
    assert.throws(() => validateName(bad), e => e.status === 400 && e.message === '표시 이름을 1–20자로 입력해 주세요.')
})

test('sessions expire after 30 idle days or 90 days total and touch once a day', () => {
  const day = 86_400_000, t0 = new Date('2026-11-01T00:00:00Z')
  const at = d => new Date(t0.getTime() + d * day)
  assert.equal(sessionStatus({ createdAt: t0, lastSeenAt: t0 }, at(0.5)), 'valid')
  assert.equal(sessionStatus({ createdAt: t0, lastSeenAt: t0 }, at(1)), 'touch')
  assert.equal(sessionStatus({ createdAt: t0, lastSeenAt: at(29) }, at(29.5)), 'valid')
  assert.equal(sessionStatus({ createdAt: t0, lastSeenAt: t0 }, at(30)), 'expired')
  assert.equal(sessionStatus({ createdAt: t0, lastSeenAt: at(89.5) }, at(90)), 'expired')
})

test('session tokens are 43-char base64url and only their hash is stored', () => {
  const token = newSessionToken()
  assert.equal(isTokenShape(token), true)
  assert.notEqual(newSessionToken(), token)
  assert.match(hashToken(token), /^[0-9a-f]{64}$/)
  assert.equal(isTokenShape('x'.repeat(43) + '!'), false)
  assert.equal(isTokenShape(''), false)
})

// nodemailer는 받는 주소 문자열을 주소 목록으로 해석한다. 괄호·따옴표·쉼표·꺾쇠가 섞인 변형이 같은 메일함으로 가면서
// 주소별 발송 한도 키는 달라지므로, 평범한 주소 모양만 받는다(최종 검토 Important 1).
test('address variants that mail servers would rewrite are rejected', () => {
  for (const bad of ['victim(1)@example.test', '"victim"@example.test', 'a,victim@example.test', '<victim>@example.test', 'a;b@example.test', 'victim@example.test>', 'a@exa_mple.test', 'a@-example.test', 'a@example..test'])
    assert.throws(() => normalizeEmail(bad), e => e.status === 400, bad)
  for (const ok of ['kim.lee@example.test', 'kim+tag@example.test', 'k_lee-2@mail.example.test', "o'brien@example.test"])
    assert.equal(normalizeEmail(ok), ok)
})
