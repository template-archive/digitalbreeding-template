import { createHash, randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { FeedbackError, validateAction } from './feedback-domain.ts'
import { FEEDBACK_TEMPLATES } from './feedback-templates.ts'
import { limitRequests, readSharedFeedback, saveSharedFeedback } from './feedback-database.ts'

const COOKIE = 'db_feedback_guest'
type Request = IncomingMessage & { body?: unknown }
const header = (request: IncomingMessage, key: string) => {
  const value = request.headers[key]
  return Array.isArray(value) ? value[0] || '' : value || ''
}
function session(request: IncomingMessage) {
  const cookies = header(request, 'cookie').split(';').map(c => c.trim())
  const value = cookies.find(c => c.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1) || ''
  return /^[a-f0-9]{64}$/.test(value) ? value : null
}
async function readBody(request: Request) {
  if (!header(request, 'content-type').toLowerCase().startsWith('application/json')) throw new FeedbackError(415, 'JSON 형식으로 요청해 주세요.')
  if (Number(header(request, 'content-length')) > 20000) throw new FeedbackError(413, '코멘트 요청이 너무 큽니다.')
  try {
    if (request.body !== undefined) {
      const body: unknown = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
      if (Buffer.byteLength(JSON.stringify(body) || '') > 20000) throw new FeedbackError(413, '코멘트 요청이 너무 큽니다.')
      return body
    }
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of request) {
      const buffer = Buffer.from(chunk)
      size += buffer.length
      if (size > 20000) throw new FeedbackError(413, '코멘트 요청이 너무 큽니다.')
      chunks.push(buffer)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch (error) {
    if (error instanceof FeedbackError) throw error
    throw new FeedbackError(400, '요청 내용을 읽을 수 없습니다.')
  }
}
export async function handleFeedback(request: Request, response: ServerResponse) {
  const send = (status: number, value: unknown) => {
    response.statusCode = status
    response.end(JSON.stringify(value))
  }
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'private, no-store')
  response.setHeader('Vary', 'Cookie')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  try {
    if (request.method !== 'GET' && request.method !== 'POST') {
      response.setHeader('Allow', 'GET, POST')
      throw new FeedbackError(405, '지원하지 않는 요청 방식입니다.')
    }
    const host = header(request, 'host')
    const secure = process.env.VERCEL === '1' || header(request, 'x-forwarded-proto') === 'https'
    const url = new URL(request.url || '/', 'https://' + host)
    const template = url.searchParams.get('template') || ''
    if (!FEEDBACK_TEMPLATES.has(template)) throw new FeedbackError(404, '피드백을 남길 템플릿을 찾을 수 없습니다.')
    if (request.method === 'POST') {
      const origin = header(request, 'origin')
      let sameOrigin = false
      try { sameOrigin = new URL(origin).origin === (secure ? 'https://' : 'http://') + host } catch { /* Missing origins cannot mutate feedback. */ }
      if (!sameOrigin || header(request, 'sec-fetch-site') === 'cross-site') throw new FeedbackError(403, '이 사이트에서 작성한 요청만 저장할 수 있습니다.')
    }
    let token = session(request)
    if (!token && request.method === 'POST') throw new FeedbackError(401, '브라우저 쿠키를 허용한 뒤 피드백을 다시 열어 주세요.')
    if (!token) {
      token = randomBytes(32).toString('hex')
      response.setHeader('Set-Cookie', COOKIE + '=' + token + '; HttpOnly; SameSite=Lax; Path=/api/feedback; Max-Age=31536000' + (secure ? '; Secure' : ''))
    }
    const actorId = createHash('sha256').update(token).digest('hex')
    const action = request.method === 'POST' ? validateAction(await readBody(request)) : null
    const ip = process.env.VERCEL === '1' ? header(request, 'x-forwarded-for').split(',')[0].trim() : request.socket.remoteAddress || 'local'
    await limitRequests('read:' + ip, 300)
    if (request.method === 'GET') {
      return send(200, { storage: 'shared', actorId, ...await readSharedFeedback(template) })
    }
    if (!action) throw new FeedbackError(400, '요청 내용을 확인해 주세요.')
    await limitRequests('write:' + actorId, 30)
    await limitRequests('write-ip:' + ip, 180)
    return send(200, { storage: 'shared', actorId, ...await saveSharedFeedback(template, actorId, action) })
  } catch (error) {
    if (error instanceof FeedbackError) {
      if (error.status === 429) response.setHeader('Retry-After', '60')
      return send(error.status, { error: error.message })
    }
    console.error('[feedback] storage failure', error instanceof Error ? error.name : 'UnknownError')
    return send(503, { error: '공유 저장소에 연결하지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도해 주세요.' })
  }
}
