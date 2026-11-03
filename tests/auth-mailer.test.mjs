import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createConsoleMailer, createSmtpMailer, loginCodeMail, readSmtpSettings } from '../server/auth/mailer.ts'

// 코드 메일은 회사 이름·도메인·받는 사람 주소를 담지 않는다(로그인 설계 5.5, 반목표).
test('code mail carries the code, validity, and hub link but no recipient or domain', () => {
  const mail = loginCodeMail('123456', 'https://hub.example.test')
  assert.equal(mail.subject, '[템플릿 허브] 로그인 코드 123456')
  for (const body of [mail.text, mail.html]) {
    assert.match(body, /123456/)
    assert.match(body, /10분/)
    assert.match(body, /직접 요청하지 않았다면/)
    assert.match(body, /https:\/\/hub\.example\.test/)
    assert.doesNotMatch(body, /@/)
  }
})

test('smtp settings need both user and app password; defaults point to Gmail', () => {
  assert.equal(readSmtpSettings({ SMTP_USER: 'hub@gmail.com' }), null)
  assert.equal(readSmtpSettings({ SMTP_PASS: 'x' }), null)
  assert.deepEqual(readSmtpSettings({ SMTP_USER: 'hub@gmail.com', SMTP_PASS: 'x' }),
    { kind: 'smtp', host: 'smtp.gmail.com', port: 465, user: 'hub@gmail.com', pass: 'x', from: 'hub@gmail.com', fromName: '템플릿 허브' })
  const custom = readSmtpSettings({ SMTP_USER: 'resend', SMTP_PASS: 'k', SMTP_HOST: 'smtp.resend.com', SMTP_PORT: '587', MAIL_FROM: 'hub@mail.example.test', MAIL_FROM_NAME: '허브' })
  assert.equal(custom.host, 'smtp.resend.com')
  assert.equal(custom.port, 587)
  assert.equal(custom.from, 'hub@mail.example.test')
  assert.equal(custom.fromName, '허브')
})

test('smtp mailer sends one message with the hub sender name', async () => {
  const sent = []
  const mailer = createSmtpMailer(readSmtpSettings({ SMTP_USER: 'hub@gmail.com', SMTP_PASS: 'x' }), { sendMail: async m => { sent.push(m) } })
  await mailer.sendLoginCode('a@example.test', '654321', 'https://hub.example.test')
  assert.equal(sent.length, 1)
  assert.equal(sent[0].to, 'a@example.test')
  assert.match(String(sent[0].from), /템플릿 허브/)
  assert.match(String(sent[0].from), /hub@gmail\.com/)
  assert.equal(sent[0].subject, '[템플릿 허브] 로그인 코드 654321')
  assert.match(sent[0].text, /654321/)
  assert.match(sent[0].html, /654321/)
})

test('a hanging SMTP server fails within the timeout instead of the function limit', async () => {
  const mailer = createSmtpMailer(readSmtpSettings({ SMTP_USER: 'u', SMTP_PASS: 'p' }), { sendMail: () => new Promise(() => {}) }, 50)
  const started = Date.now()
  await assert.rejects(mailer.sendLoginCode('a@example.test', '111111', 'https://h'), /timeout/i)
  assert.ok(Date.now() - started < 1000)
})

test('console mailer prints the code for preview and local logins', async () => {
  const lines = []
  await createConsoleMailer(l => lines.push(l)).sendLoginCode('a@example.test', '222222', 'https://h')
  assert.match(lines.join('\n'), /222222/)
})
