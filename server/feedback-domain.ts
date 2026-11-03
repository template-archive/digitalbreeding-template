import { parseFeedback, type Anchor, type FeedbackData, type FeedbackLabel } from '../src/features/feedback/model.ts'
import type { FeedbackAction } from '../src/features/feedback/protocol.ts'
import { HttpError } from './http.ts'

export class FeedbackError extends HttpError {}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const label = (v: unknown): v is FeedbackLabel => v === 'fix' || v === 'question' || v === 'idea'
const fail = (message: string): never => { throw new FeedbackError(400, message) }
function body(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 2000) return fail('코멘트를 1–2,000자로 입력해 주세요.')
  return value.trim()
}
function author(value: unknown) {
  if (typeof value !== 'string' || value.length > 30) return fail('표시 이름은 30자 이내로 입력해 주세요.')
  return value.trim() || '익명'
}
function anchor(value: unknown): Anchor {
  if (!object(value) || !(value.selector === null || (typeof value.selector === 'string' && value.selector.length > 0 && value.selector.length <= 4000)) || typeof value.quote !== 'string' || value.quote.length > 100 || typeof value.x !== 'number' || !Number.isFinite(value.x) || value.x < 0 || value.x > 1 || typeof value.y !== 'number' || !Number.isFinite(value.y) || value.y < 0 || value.y > 1 || typeof value.width !== 'number' || !Number.isFinite(value.width) || value.width < 0 || value.width > 20000) return fail('코멘트 위치가 올바르지 않습니다. 위치를 다시 선택해 주세요.')
  return { selector: value.selector, quote: value.quote, x: value.x, y: value.y, width: value.width }
}
export function validateAction(value: unknown): FeedbackAction {
  if (!object(value)) return fail('요청 형식이 올바르지 않습니다.')
  if (value.type === 'create') {
    if (!uuid(value.requestId) || !label(value.label)) return fail('코멘트 요청이 올바르지 않습니다.')
    return { type: 'create', requestId: value.requestId, anchor: anchor(value.anchor), label: value.label, author: author(value.author), body: body(value.body) }
  }
  if (!uuid(value.threadId)) return fail('코멘트 번호가 올바르지 않습니다.')
  if (value.type === 'reply') {
    if (!uuid(value.requestId)) return fail('답글 요청이 올바르지 않습니다.')
    return { type: 'reply', requestId: value.requestId, threadId: value.threadId, author: author(value.author), body: body(value.body) }
  }
  if (value.type === 'label' && label(value.label)) return { type: 'label', threadId: value.threadId, label: value.label }
  if (value.type === 'resolve' && typeof value.resolved === 'boolean') return { type: 'resolve', threadId: value.threadId, resolved: value.resolved }
  if (value.type === 'delete') return { type: 'delete', threadId: value.threadId }
  return fail('지원하지 않는 코멘트 요청입니다.')
}

/** This only accepts validated actions; the actor and timestamp always come from the server. */
export function applyAction(previous: FeedbackData, actorId: string, action: FeedbackAction, now: string): FeedbackData {
  const data = structuredClone(previous)
  const message = (id: string, name: string, text: string) => ({ id, authorId: actorId, author: name, body: text, createdAt: now })
  if (action.type === 'create') {
    const duplicate = data.threads.find(t => t.id === action.requestId)
    if (duplicate) {
      if (duplicate.messages[0].authorId !== actorId) throw new FeedbackError(409, '요청 번호가 충돌했습니다. 페이지를 새로고침해 주세요.')
      return data
    }
    if (data.threads.length >= 500) throw new FeedbackError(409, '템플릿당 최대 500개 코멘트를 저장할 수 있습니다.')
    data.threads.push({ id: action.requestId, number: data.nextNumber++, anchor: action.anchor, label: action.label, resolved: false, messages: [message(action.requestId, action.author, action.body)] })
  } else {
    const thread = data.threads.find(t => t.id === action.threadId)
    if (!thread) {
      if (action.type === 'delete') return data
      throw new FeedbackError(404, '코멘트가 삭제되었습니다. 목록을 다시 확인해 주세요.')
    }
    if (action.type === 'delete') {
      if (thread.messages[0].authorId !== actorId) throw new FeedbackError(403, '이 브라우저에서 작성한 코멘트만 삭제할 수 있습니다.')
      data.threads = data.threads.filter(t => t.id !== action.threadId)
    } else if (action.type === 'reply') {
      const duplicate = thread.messages.find(m => m.id === action.requestId)
      if (duplicate) {
        if (duplicate.authorId !== actorId) throw new FeedbackError(409, '답글 요청 번호가 충돌했습니다.')
        return data
      }
      if (thread.resolved) throw new FeedbackError(409, '해결된 코멘트입니다. 다시 열고 답글을 남겨 주세요.')
      if (thread.messages.length >= 100) throw new FeedbackError(409, '답글은 최대 100개까지 저장할 수 있습니다.')
      thread.messages.push(message(action.requestId, action.author, action.body))
    } else if (action.type === 'label') thread.label = action.label
    else thread.resolved = action.resolved
  }
  const serialized = JSON.stringify(data)
  if (new TextEncoder().encode(serialized).length > 2 * 1024 * 1024) throw new FeedbackError(409, '이 템플릿의 피드백 저장 용량이 가득 찼습니다.')
  return parseFeedback(serialized)
}
