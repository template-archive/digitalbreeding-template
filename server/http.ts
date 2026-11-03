import type { IncomingMessage, ServerResponse } from 'node:http'

// 피드백·로그인·작업 요청 API가 함께 쓰는 HTTP 도우미. 문구는 각 API가 넘긴다.

export class HttpError extends Error {
  readonly status: number
  readonly retryAfter?: number
  constructor(status: number, message: string, retryAfter?: number) {
    super(message)
    this.status = status
    this.retryAfter = retryAfter
  }
}

type Request = IncomingMessage & { body?: unknown }

export function header(request: IncomingMessage, key: string): string {
  const value = request.headers[key]
  return Array.isArray(value) ? value[0] || '' : value || ''
}

export function isSecure(request: IncomingMessage): boolean {
  return process.env.VERCEL === '1' || header(request, 'x-forwarded-proto') === 'https'
}

/** 쓰기 요청은 이 사이트에서 보낸 것만 받는다(Origin이 현재 호스트, 교차 사이트 fetch 아님). */
export function isSameOrigin(request: IncomingMessage): boolean {
  const host = header(request, 'host')
  let same = false
  try { same = new URL(header(request, 'origin')).origin === (isSecure(request) ? 'https://' : 'http://') + host } catch { /* Missing origins cannot mutate. */ }
  return same && header(request, 'sec-fetch-site') !== 'cross-site'
}

export function clientIp(request: IncomingMessage): string {
  return process.env.VERCEL === '1' ? header(request, 'x-forwarded-for').split(',')[0]!.trim() : request.socket?.remoteAddress || 'local'
}

export function readCookie(request: IncomingMessage, name: string): string | null {
  const cookies = header(request, 'cookie').split(';').map(c => c.trim())
  const found = cookies.find(c => c.startsWith(name + '='))
  return found ? found.slice(name.length + 1) : null
}

export async function readJsonBody(request: Request, limit: number, messages: { notJson: string; tooLarge: string; invalid: string }): Promise<unknown> {
  if (!header(request, 'content-type').toLowerCase().startsWith('application/json')) throw new HttpError(415, messages.notJson)
  if (Number(header(request, 'content-length')) > limit) throw new HttpError(413, messages.tooLarge)
  try {
    if (request.body !== undefined) {
      const body: unknown = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
      if (Buffer.byteLength(JSON.stringify(body) || '') > limit) throw new HttpError(413, messages.tooLarge)
      return body
    }
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of request) {
      const buffer = Buffer.from(chunk)
      size += buffer.length
      if (size > limit) throw new HttpError(413, messages.tooLarge)
      chunks.push(buffer)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, messages.invalid)
  }
}

/** 표준 머리글(개인 응답, 캐시 금지, MIME 추측 금지)을 붙이고 JSON을 보내는 함수를 돌려준다. */
export function prepareJson(response: ServerResponse): (status: number, value: unknown) => void {
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'private, no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  return (status, value) => {
    response.statusCode = status
    response.end(JSON.stringify(value))
  }
}
