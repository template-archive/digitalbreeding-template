import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAuthService } from '../server/auth/service.ts'
import { createMemoryStore } from '../server/auth/memory-store.ts'

const MSG_FAILED = '코드가 맞지 않거나 만료되었습니다. 코드를 다시 받아 주세요.'
const MINUTE = 60_000, HOUR = 3_600_000, DAY = 86_400_000

function setup({ domains = ['example.test'], store: shared, clock: sharedClock } = {}) {
  const clock = sharedClock ?? { now: new Date('2026-11-04T10:00:00Z'), advance(ms) { this.now = new Date(this.now.getTime() + ms) } }
  const store = shared ?? createMemoryStore(() => clock.now)
  const mailer = {
    sent: [], fail: false,
    async sendLoginCode(to, code, hubUrl) { if (this.fail) throw new Error('smtp down'); this.sent.push({ to, code, hubUrl }) },
  }
  const service = createAuthService({ store, mailer, allowedDomains: domains, secret: 's'.repeat(32), now: () => clock.now })
  const sendAndRead = async (email, ip = '1') => {
    await service.requestCode({ email, ip, hubUrl: 'https://hub.example.test' })
    return mailer.sent.at(-1).code
  }
  const login = async (email, name = '홍길동', ip = '1') => {
    const code = await sendAndRead(email, ip)
    return service.verify({ email, code, name, ip })
  }
  return { clock, store, mailer, service, sendAndRead, login }
}
const rate = e => e.status === 429 && e.message === '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
const failed = e => e.status === 400 && e.message === MSG_FAILED

test('allowed and disallowed addresses get the same answer; only allowed ones get mail', async () => {
  const { service, mailer } = setup()
  const a = await service.requestCode({ email: 'kim@example.test', ip: '1', hubUrl: 'https://hub.example.test' })
  const b = await service.requestCode({ email: 'kim@other.test', ip: '1', hubUrl: 'https://hub.example.test' })
  assert.deepEqual(a, b)
  assert.deepEqual(a, { resendAfter: 60 })
  assert.deepEqual(mailer.sent.map(m => m.to), ['kim@example.test'])
  assert.equal(mailer.sent[0].hubUrl, 'https://hub.example.test')
})

test('per-address limits apply to disallowed addresses too', async () => {
  const { service } = setup()
  await service.requestCode({ email: 'x@other.test', ip: '1', hubUrl: 'h' })
  await assert.rejects(service.requestCode({ email: 'x@other.test', ip: '2', hubUrl: 'h' }), rate)
})

test('address limits: one per minute, five per hour, ten per day', async () => {
  const { service, mailer, clock } = setup()
  const ask = () => service.requestCode({ email: 'kim@example.test', ip: String(Math.random()), hubUrl: 'h' })
  await ask()
  clock.advance(1000)
  await assert.rejects(ask(), rate)
  for (let i = 1; i < 5; i++) { clock.advance(MINUTE); await ask() }
  clock.advance(MINUTE)
  await assert.rejects(ask(), rate)
  clock.now = new Date('2026-11-04T11:00:00Z')
  for (let i = 0; i < 5; i++) { await ask(); clock.advance(MINUTE) }
  clock.now = new Date('2026-11-04T12:00:00Z')
  await assert.rejects(ask(), rate)
  assert.equal(mailer.sent.length, 10)
})

test('ip limit is twenty code requests per hour', async () => {
  const { service } = setup()
  for (let i = 0; i < 20; i++) await service.requestCode({ email: `u${i}@example.test`, ip: '9', hubUrl: 'h' })
  await assert.rejects(service.requestCode({ email: 'u20@example.test', ip: '9', hubUrl: 'h' }), rate)
})

test('global sends stop at 300 per day for allowed addresses', async () => {
  const { service, store, mailer } = setup()
  for (let i = 0; i < 300; i++) await store.hit('send-global', 'day')
  await assert.rejects(service.requestCode({ email: 'kim@example.test', ip: '1', hubUrl: 'h' }), rate)
  assert.equal(mailer.sent.length, 0)
  assert.deepEqual(await service.requestCode({ email: 'kim@other.test', ip: '2', hubUrl: 'h' }), { resendAfter: 60 })
})

test('mail failure deletes the stored code and answers 503 with the fixed message', async () => {
  const { service, store, mailer } = setup()
  mailer.fail = true
  await assert.rejects(service.requestCode({ email: 'kim@example.test', ip: '1', hubUrl: 'h' }),
    e => e.status === 503 && e.message === '코드 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.')
  assert.equal(await store.getCode('kim@example.test'), null)
})

test('a new user needs a name, and asking for it does not consume the code', async () => {
  const { service, sendAndRead } = setup()
  const code = await sendAndRead('Kim@Example.test')
  assert.deepEqual(await service.verify({ email: 'kim@example.test', code, ip: '1' }), { needsName: true })
  await assert.rejects(service.verify({ email: 'kim@example.test', code, name: '  ', ip: '1' }), e => e.status === 400 && e.message === '표시 이름을 1–20자로 입력해 주세요.')
  const done = await service.verify({ email: 'kim@example.test', code: code.slice(0, 3) + ' ' + code.slice(3), name: '홍길동', ip: '1' })
  assert.equal(done.user.name, '홍길동')
  assert.deepEqual(Object.keys(done.user).sort(), ['id', 'name'])
  assert.equal(typeof done.token, 'string')
  assert.equal((await service.currentUser(done.token)).name, '홍길동')
  await assert.rejects(service.verify({ email: 'kim@example.test', code, ip: '1' }), failed)
})

test('returning users skip the name step', async () => {
  const { service, sendAndRead, login, clock } = setup()
  const first = await login('kim@example.test')
  clock.advance(MINUTE)
  const code = await sendAndRead('kim@example.test')
  const again = await service.verify({ email: 'kim@example.test', code, ip: '1' })
  assert.equal(again.user.id, first.user.id)
  assert.equal(again.user.name, '홍길동')
})

test('wrong, expired, replaced and over-tried codes all fail with one message', async () => {
  const { service, sendAndRead, clock } = setup()
  const code = await sendAndRead('a@example.test')
  const wrong = code === '000000' ? '111111' : '000000'
  for (let i = 0; i < 5; i++) await assert.rejects(service.verify({ email: 'a@example.test', code: wrong, ip: 'a' }), failed)
  await assert.rejects(service.verify({ email: 'a@example.test', code, ip: 'a2' }), failed)

  const late = await sendAndRead('b@example.test')
  clock.advance(10 * MINUTE + 1000)
  await assert.rejects(service.verify({ email: 'b@example.test', code: late, name: '김', ip: 'b' }), failed)

  const old = await sendAndRead('c@example.test')
  clock.advance(MINUTE)
  const fresh = await sendAndRead('c@example.test')
  if (old !== fresh) await assert.rejects(service.verify({ email: 'c@example.test', code: old, name: '김', ip: 'c' }), failed)
  assert.ok('user' in await service.verify({ email: 'c@example.test', code: fresh, name: '김', ip: 'c' }))

  await assert.rejects(service.verify({ email: 'x@other.test', code: '123456', ip: 'd' }), failed)
  await assert.rejects(service.verify({ email: 'nobody@example.test', code: '123456', ip: 'd' }), failed)
  await assert.rejects(service.verify({ email: 'c@example.test', code: 'abc', ip: 'd' }), failed)
})

test('verify is limited to ten tries per minute per ip', async () => {
  const { service } = setup()
  for (let i = 0; i < 10; i++) await assert.rejects(service.verify({ email: 'a@example.test', code: '123456', ip: '7' }), failed)
  await assert.rejects(service.verify({ email: 'a@example.test', code: '123456', ip: '7' }), rate)
})

test('sessions: idle 30 days and absolute 90 days expire; daily touch keeps them alive', async () => {
  const { service, login, clock } = setup()
  const { token } = await login('kim@example.test')
  clock.advance(29 * DAY)
  assert.ok(await service.currentUser(token))
  clock.advance(29 * DAY)
  assert.ok(await service.currentUser(token))
  clock.advance(30 * DAY)
  assert.equal(await service.currentUser(token), null)

  clock.advance(MINUTE)
  const second = (await login('kim@example.test', undefined, '2')).token
  for (let day = 20; day < 90; day += 20) { clock.advance(20 * DAY); assert.ok(await service.currentUser(second), 'day ' + day) }
  clock.advance(10 * DAY)
  assert.equal(await service.currentUser(second), null)
  assert.equal(await service.currentUser('not-a-token'), null)
  assert.equal(await service.currentUser(null), null)
})

test('removing a domain from the allow list ends its sessions', async () => {
  const first = setup({ domains: ['example.test', 'second.test'] })
  const { token } = await first.login('lee@second.test')
  const narrowed = setup({ domains: ['example.test'], store: first.store, clock: first.clock })
  assert.equal(await narrowed.service.currentUser(token), null)
  assert.equal(await first.service.currentUser(token), null)
})

test('rename requires a session; logout ends it', async () => {
  const { service, login } = setup()
  await assert.rejects(service.rename(null, '김'), e => e.status === 401 && e.message === '로그인이 필요합니다.')
  const { token } = await login('kim@example.test')
  assert.deepEqual(Object.keys(await service.rename(token, ' 김철수 ')).sort(), ['id', 'name'])
  assert.equal((await service.currentUser(token)).name, '김철수')
  await service.logout(token)
  assert.equal(await service.currentUser(token), null)
  await service.logout(token)
  await service.logout(null)
})
