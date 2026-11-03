import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { HttpError } from '../http.ts'

// 로그인 규칙(순수 함수). 값과 문구는 로그인 설계(docs/superpowers/specs/2026-11-03-hub-auth-design.md) 5.2·5.3·5.6을 따른다.
// 허용 도메인은 서버 환경 변수에서만 오고, 어떤 문구에도 도메인이나 회사 이름을 넣지 않는다.

const DAY_MS = 86_400_000
export const CODE_TTL_MS = 10 * 60_000
export const CODE_MAX_ATTEMPTS = 5
export const RESEND_SECONDS = 60
export const SESSION_IDLE_MS = 30 * DAY_MS
export const SESSION_MAX_MS = 90 * DAY_MS
export const SESSION_TOUCH_MS = DAY_MS

export const MSG_CODE_SENT = '코드를 보냈습니다. 메일이 오지 않으면 주소를 확인해 주세요.'
export const MSG_CODE_FAILED = '코드가 맞지 않거나 만료되었습니다. 코드를 다시 받아 주세요.'
export const MSG_CLOSED = '로그인을 아직 사용할 수 없습니다.'
export const MSG_SEND_FAILED = '코드 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.'
export const MSG_EMAIL_FORMAT = '메일 주소 형식을 확인해 주세요.'
export const MSG_RATE = '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
export const MSG_NAME = '표시 이름을 1–20자로 입력해 주세요.'
export const MSG_LOGIN_REQUIRED = '로그인이 필요합니다.'
export const MSG_UNAVAILABLE = '로그인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'

// 평범한 주소 모양만 받는다. 괄호·따옴표·쉼표·꺾쇠가 섞이면 메일 서버가 다른 형태로 고쳐 써서 주소별 발송 한도를 우회할 수 있다.
const EMAIL = /^[a-z0-9._%+'-]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, MSG_EMAIL_FORMAT)
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !EMAIL.test(email)) throw new HttpError(400, MSG_EMAIL_FORMAT)
  return email
}

export function parseAllowedDomains(value: string | undefined): string[] {
  return (value || '').split(',').map(d => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean)
}

export function isAllowedEmail(email: string, domains: string[]): boolean {
  const domain = email.slice(email.lastIndexOf('@') + 1)
  return domains.includes(domain)
}

/** 붙여 넣은 코드의 공백·줄바꿈·하이픈은 빼고 6자리 숫자만 받는다. */
export function normalizeCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.replace(/[\s-]/g, '')
  return /^\d{6}$/.test(code) ? code : null
}

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

/** 6자리 코드는 단순 해시로는 바로 풀리므로 서버 비밀 키를 섞는다. */
export function hashCode(secret: string, email: string, code: string): string {
  return createHmac('sha256', secret).update(email + ':' + code).digest('hex')
}

export function codeMatches(secret: string, email: string, code: string, hash: string): boolean {
  const expected = Buffer.from(hashCode(secret, email, code), 'hex')
  const actual = Buffer.from(hash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function isTokenShape(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value)
}

export function validateName(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, MSG_NAME)
  const name = value.trim()
  const length = [...name].length
  if (length < 1 || length > 20 || /[\u0000-\u001f\u007f]/.test(name)) throw new HttpError(400, MSG_NAME)
  return name
}

/** 사용 없이 30일, 처음 만든 뒤 90일이면 만료. 마지막 기록이 하루 넘게 지났으면 연장 기록(touch)을 남긴다. */
export function sessionStatus(session: { createdAt: Date; lastSeenAt: Date }, now: Date): 'valid' | 'touch' | 'expired' {
  const idle = now.getTime() - session.lastSeenAt.getTime()
  const age = now.getTime() - session.createdAt.getTime()
  if (idle >= SESSION_IDLE_MS || age >= SESSION_MAX_MS) return 'expired'
  return idle >= SESSION_TOUCH_MS ? 'touch' : 'valid'
}
