import { parseAllowedDomains } from './domain.ts'
import { readSmtpSettings, type SmtpSettings } from './mailer.ts'

// 로그인 환경 설정(로그인 설계 5.3·5.8, 2026-11-03 사용자 결정: 운영 비밀은 운영에만).
// 운영은 전용 DB(AUTH_DATABASE_URL)와 Gmail SMTP가 모두 있어야 열린다. DATABASE_URL·console로 대체하지 않는다.
// 미리보기·로컬은 공용 DB의 preview 범위와 console(서버 로그) 코드를 쓴다.

export type AuthConfig =
  | { available: true; scope: 'production' | 'preview'; allowedDomains: string[]; secret: string; databaseUrl: string; mail: SmtpSettings | { kind: 'console' } }
  | { available: false; reason: 'domains' | 'secret' | 'database' | 'mail' }

export function readAuthConfig(env: Record<string, string | undefined>): AuthConfig {
  const production = env.VERCEL_ENV === 'production'
  const allowedDomains = parseAllowedDomains(env.AUTH_ALLOWED_DOMAINS)
  if (!allowedDomains.length) return { available: false, reason: 'domains' }
  const secret = env.AUTH_SECRET || ''
  if (secret.length < 32) return { available: false, reason: 'secret' }
  const databaseUrl = production ? env.AUTH_DATABASE_URL : env.DATABASE_URL || env.POSTGRES_URL
  if (!databaseUrl) return { available: false, reason: 'database' }
  const smtp = readSmtpSettings(env)
  if (!smtp && production) return { available: false, reason: 'mail' }
  return { available: true, scope: production ? 'production' : 'preview', allowedDomains, secret, databaseUrl, mail: smtp ?? { kind: 'console' } }
}
