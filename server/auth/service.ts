import { HttpError } from '../http.ts'
import {
  CODE_MAX_ATTEMPTS, CODE_TTL_MS, MSG_CODE_FAILED, MSG_LOGIN_REQUIRED, MSG_RATE, MSG_SEND_FAILED, RESEND_SECONDS,
  codeMatches, generateCode, hashCode, hashToken, isAllowedEmail, isTokenShape, newSessionToken,
  normalizeCode, normalizeEmail, sessionStatus, validateName,
} from './domain.ts'
import type { Mailer } from './mailer.ts'
import type { AuthStore, RateWindow } from './store.ts'

// 로그인 동작(로그인 설계 3·5.2·5.3·5.6절).
// - 허용 여부와 관계없이 코드 요청 응답은 같다. 주소 한도도 똑같이 센다. 예외는 실제 발송의 전체 한도(429)와 발송 실패(503)뿐.
// - 코드 확인 실패는 이유와 관계없이 한 문구.
// - 사용자 정보는 { id, name }만 밖으로 내보낸다.

export type PublicUser = { id: string; name: string }
export type AuthService = {
  requestCode(input: { email: unknown; ip: string; hubUrl: string }): Promise<{ resendAfter: number }>
  verify(input: { email: unknown; code: unknown; name?: unknown; ip: string }): Promise<{ needsName: true } | { user: PublicUser; token: string }>
  currentUser(token: string | null): Promise<PublicUser | null>
  rename(token: string | null, name: unknown): Promise<PublicUser>
  logout(token: string | null): Promise<void>
}

const RETRY_SECONDS: Record<RateWindow, number> = { minute: 60, hour: 3600, day: 86400 }

export function createAuthService(deps: { store: AuthStore; mailer: Mailer; allowedDomains: string[]; secret: string; now?: () => Date }): AuthService {
  const { store, mailer, allowedDomains, secret } = deps
  const now = deps.now ?? (() => new Date())
  const limit = async (key: string, window: RateWindow, max: number) => {
    if (await store.hit(key, window) > max) throw new HttpError(429, MSG_RATE, RETRY_SECONDS[window])
  }
  const failed = () => new HttpError(400, MSG_CODE_FAILED)
  const publicUser = (user: { id: string; name: string }): PublicUser => ({ id: user.id, name: user.name })

  async function currentUser(token: string | null): Promise<PublicUser | null> {
    if (!token || !isTokenShape(token)) return null
    const hash = hashToken(token)
    const session = await store.getSession(hash)
    if (!session) return null
    const status = sessionStatus(session, now())
    // 허용 도메인에서 빠진 주소의 세션도 끝낸다(퇴사·도메인 변경).
    if (status === 'expired' || !isAllowedEmail(session.user.email, allowedDomains)) {
      await store.deleteSession(hash)
      return null
    }
    if (status === 'touch') await store.touchSession(hash, now())
    return publicUser(session.user)
  }

  return {
    async requestCode({ email: raw, ip, hubUrl }) {
      const email = normalizeEmail(raw)
      await limit('code-ip:' + ip, 'hour', 20)
      await limit('code-addr:' + email, 'minute', 1)
      await limit('code-addr:' + email, 'hour', 5)
      await limit('code-addr:' + email, 'day', 10)
      if (!isAllowedEmail(email, allowedDomains)) return { resendAfter: RESEND_SECONDS }
      await limit('send-global', 'day', 300)
      const code = generateCode()
      const at = now()
      await store.putCode({ email, codeHash: hashCode(secret, email, code), expiresAt: new Date(at.getTime() + CODE_TTL_MS), attempts: 0, sentAt: at })
      try {
        await mailer.sendLoginCode(email, code, hubUrl)
      } catch (error) {
        await store.deleteCode(email)
        console.error('[auth] mail failure', error instanceof Error ? error.name : 'UnknownError')
        throw new HttpError(503, MSG_SEND_FAILED)
      }
      return { resendAfter: RESEND_SECONDS }
    },

    async verify({ email: raw, code: rawCode, name, ip }) {
      await limit('verify-ip:' + ip, 'minute', 10)
      const email = normalizeEmail(raw)
      const code = normalizeCode(rawCode)
      if (!code || !isAllowedEmail(email, allowedDomains)) throw failed()
      const row = await store.getCode(email)
      if (!row || row.expiresAt.getTime() <= now().getTime() || row.attempts >= CODE_MAX_ATTEMPTS) throw failed()
      if (!codeMatches(secret, email, code, row.codeHash)) {
        await store.addCodeAttempt(email)
        throw failed()
      }
      let user = await store.findUser(email)
      if (!user) {
        // 이름을 묻는 동안 코드는 그대로 둔다. 이름과 함께 다시 보내면 그때 소비한다.
        if (name === undefined || name === null || name === '') return { needsName: true }
        user = await store.createUser(email, validateName(name))
      }
      const at = now()
      await store.deleteCode(email)
      await store.recordLogin(user.id, at)
      const token = newSessionToken()
      await store.createSession(hashToken(token), user.id, at)
      return { user: publicUser(user), token }
    },

    currentUser,

    async rename(token, name) {
      const user = await currentUser(token)
      if (!user) throw new HttpError(401, MSG_LOGIN_REQUIRED)
      return publicUser(await store.renameUser(user.id, validateName(name)))
    },

    async logout(token) {
      if (token && isTokenShape(token)) await store.deleteSession(hashToken(token))
    },
  }
}
