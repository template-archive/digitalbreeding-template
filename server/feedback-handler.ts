import { createHash, randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { FeedbackError, validateAction } from './feedback-domain.ts'
import { FEEDBACK_TEMPLATES } from './feedback-templates.ts'
import { limitRequests, readSharedFeedback, saveSharedFeedback } from './feedback-database.ts'
import { clientIp, header, HttpError, isSameOrigin, isSecure, prepareJson, readCookie, readJsonBody } from './http.ts'

const COOKIE = 'db_feedback_guest'
type Request = IncomingMessage & { body?: unknown }
const BODY_MESSAGES = { notJson: 'JSON 형식으로 요청해 주세요.', tooLarge: '코멘트 요청이 너무 큽니다.', invalid: '요청 내용을 읽을 수 없습니다.' }

function session(request: IncomingMessage) {
  const value = readCookie(request, COOKIE) || ''
  return /^[a-f0-9]{64}$/.test(value) ? value : null
}

export async function handleFeedback(request: Request, response: ServerResponse) {
  const send = prepareJson(response)
  response.setHeader('Vary', 'Cookie')
  try {
    if (request.method !== 'GET' && request.method !== 'POST') {
      response.setHeader('Allow', 'GET, POST')
      throw new FeedbackError(405, '지원하지 않는 요청 방식입니다.')
    }
    const secure = isSecure(request)
    const url = new URL(request.url || '/', 'https://' + header(request, 'host'))
    const template = url.searchParams.get('template') || ''
    if (!FEEDBACK_TEMPLATES.has(template)) throw new FeedbackError(404, '피드백을 남길 템플릿을 찾을 수 없습니다.')
    if (request.method === 'POST' && !isSameOrigin(request)) throw new FeedbackError(403, '이 사이트에서 작성한 요청만 저장할 수 있습니다.')
    let token = session(request)
    if (!token && request.method === 'POST') throw new FeedbackError(401, '브라우저 쿠키를 허용한 뒤 피드백을 다시 열어 주세요.')
    if (!token) {
      token = randomBytes(32).toString('hex')
      response.setHeader('Set-Cookie', COOKIE + '=' + token + '; HttpOnly; SameSite=Lax; Path=/api/feedback; Max-Age=31536000' + (secure ? '; Secure' : ''))
    }
    const actorId = createHash('sha256').update(token).digest('hex')
    const action = request.method === 'POST' ? validateAction(await readJsonBody(request, 20000, BODY_MESSAGES)) : null
    const ip = clientIp(request)
    await limitRequests('read:' + ip, 300)
    if (request.method === 'GET') {
      return send(200, { storage: 'shared', actorId, ...await readSharedFeedback(template) })
    }
    if (!action) throw new FeedbackError(400, '요청 내용을 확인해 주세요.')
    await limitRequests('write:' + actorId, 30)
    await limitRequests('write-ip:' + ip, 180)
    return send(200, { storage: 'shared', actorId, ...await saveSharedFeedback(template, actorId, action) })
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 429) response.setHeader('Retry-After', '60')
      return send(error.status, { error: error.message })
    }
    console.error('[feedback] storage failure', error instanceof Error ? error.name : 'UnknownError')
    return send(503, { error: '공유 저장소에 연결하지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도해 주세요.' })
  }
}
