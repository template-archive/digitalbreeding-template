import type { IncomingMessage, ServerResponse } from 'node:http'
import { clientIp, header, HttpError, isSameOrigin, isSecure, prepareJson, readCookie, readJsonBody } from '../http.ts'
import { readAuthConfig } from './config.ts'
import { MSG_CLOSED, MSG_CODE_SENT, MSG_LOGIN_REQUIRED, MSG_UNAVAILABLE } from './domain.ts'
import { createConsoleMailer, createSmtpMailer } from './mailer.ts'
import { createPgStore } from './pg-store.ts'
import { createAuthService, type AuthService, type PublicUser } from './service.ts'

// /api/auth/{code|verify|me|name|logout} 처리기(로그인 설계 5.1). Vercel 함수(api/auth/[action].ts)와 Vite 개발 미들웨어가 함께 쓴다.
// 응답에는 메일 주소·허용 도메인·가입 여부를 넣지 않는다. 오류 로그에는 오류 이름만 남긴다.

export const SESSION_COOKIE = 'db_hub_session'
const SESSION_MAX_AGE = 90 * 86_400
const ACTIONS = ['code', 'verify', 'me', 'name', 'logout'] as const
type Action = typeof ACTIONS[number]
type Request = IncomingMessage & { body?: unknown; originalUrl?: string }
const BODY_MESSAGES = { notJson: 'JSON 형식으로 요청해 주세요.', tooLarge: '요청이 너무 큽니다.', invalid: '요청 내용을 읽을 수 없습니다.' }

/** Vite 미들웨어는 앞부분(/api/auth)을 떼고 url을 넘기므로 originalUrl을 먼저 본다. */
function actionOf(request: Request): Action | null {
  const path = new URL(request.originalUrl ?? request.url ?? '/', 'http://local').pathname
  const name = path.match(/^\/api\/auth\/([a-z]+)\/?$/)?.[1]
  return (ACTIONS as readonly string[]).includes(name ?? '') ? name as Action : null
}

function sessionCookie(request: IncomingMessage, token: string, maxAge: number) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/api; Max-Age=${maxAge}` + (isSecure(request) ? '; Secure' : '')
}

async function readObject(request: Request): Promise<Record<string, unknown>> {
  const body = await readJsonBody(request, 2000, BODY_MESSAGES)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, BODY_MESSAGES.invalid)
  return body as Record<string, unknown>
}

export function createAuthHandler(getService: () => AuthService | null) {
  return async function handleAuthRequest(request: Request, response: ServerResponse) {
    const send = prepareJson(response)
    response.setHeader('Vary', 'Cookie')
    try {
      const action = actionOf(request)
      if (!action) throw new HttpError(404, '찾을 수 없는 요청입니다.')
      const method = action === 'me' ? 'GET' : 'POST'
      if (request.method !== method) {
        response.setHeader('Allow', method)
        throw new HttpError(405, '지원하지 않는 요청 방식입니다.')
      }
      if (method === 'POST' && !isSameOrigin(request)) throw new HttpError(403, '이 사이트에서 보낸 요청만 처리합니다.')
      const service = getService()
      if (!service) {
        if (action === 'me') return send(200, { user: null, available: false })
        throw new HttpError(503, MSG_CLOSED)
      }
      const token = readCookie(request, SESSION_COOKIE)
      const ip = clientIp(request)

      if (action === 'me') {
        const user = await service.currentUser(token)
        if (token && !user) response.setHeader('Set-Cookie', sessionCookie(request, '', 0))
        return send(200, { user, available: true })
      }
      if (action === 'logout') {
        await service.logout(token)
        response.setHeader('Set-Cookie', sessionCookie(request, '', 0))
        return send(200, { ok: true })
      }
      const body = await readObject(request)
      if (action === 'code') {
        const hubUrl = (isSecure(request) ? 'https://' : 'http://') + header(request, 'host')
        const { resendAfter } = await service.requestCode({ email: body.email, ip, hubUrl })
        return send(200, { message: MSG_CODE_SENT, resendAfter })
      }
      if (action === 'verify') {
        const result = await service.verify({ email: body.email, code: body.code, name: body.name, ip })
        if ('needsName' in result) return send(200, { needsName: true })
        response.setHeader('Set-Cookie', sessionCookie(request, result.token, SESSION_MAX_AGE))
        return send(200, { user: result.user })
      }
      return send(200, { user: await service.rename(token, body.name) })
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.retryAfter) response.setHeader('Retry-After', String(error.retryAfter))
        return send(error.status, { error: error.message })
      }
      console.error('[auth] failure', error instanceof Error ? error.name : 'UnknownError')
      return send(503, { error: MSG_UNAVAILABLE })
    }
  }
}

let cached: { service: AuthService | null } | undefined
/** 환경 변수로 서비스를 한 번만 만든다. 설정이 모자라면 로그인을 닫는다(이유 이름만 로그). */
function defaultService(): AuthService | null {
  if (cached) return cached.service
  const config = readAuthConfig(process.env)
  if (!config.available) {
    console.warn('[auth] login closed:', config.reason)
    cached = { service: null }
    return null
  }
  cached = {
    service: createAuthService({
      store: createPgStore(config.databaseUrl, config.scope),
      mailer: config.mail.kind === 'smtp' ? createSmtpMailer(config.mail) : createConsoleMailer(),
      allowedDomains: config.allowedDomains,
      secret: config.secret,
    }),
  }
  return cached.service
}

export const handleAuth = createAuthHandler(defaultService)

/** 다른 API(작업 요청 등)가 로그인한 사람만 받을 때 쓴다. 꺼짐 503, 로그인 안 됨 401. */
export async function requireUser(request: IncomingMessage): Promise<PublicUser> {
  const service = defaultService()
  if (!service) throw new HttpError(503, MSG_CLOSED)
  const user = await service.currentUser(readCookie(request, SESSION_COOKIE))
  if (!user) throw new HttpError(401, MSG_LOGIN_REQUIRED)
  return user
}
