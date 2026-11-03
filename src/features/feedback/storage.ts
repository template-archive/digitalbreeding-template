export * from './model.ts'
import { parseFeedback, MAX_BODY, type FeedbackData, type Identity, type Message } from './model.ts'
export const storageKey = (template: string) => 'db-feedback:v1:' + template
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const identityKey = 'db-feedback:identity:v1'
export function readFeedback(template: string): FeedbackData {
  return parseFeedback(localStorage.getItem(storageKey(template)))
}
export function updateFeedback(template: string, mutate: (data: FeedbackData) => void): FeedbackData {
  const data = readFeedback(template)
  mutate(data)
  const serialized = JSON.stringify(data)
  parseFeedback(serialized)
  localStorage.setItem(storageKey(template), serialized)
  window.dispatchEvent(new CustomEvent('db-feedback-change', { detail: template }))
  return data
}
export function getIdentity(): Identity {
  const raw = localStorage.getItem(identityKey)
  if (raw) {
    let parsed: unknown
    try { parsed = JSON.parse(raw) }
    catch { throw new Error('브라우저에 저장된 작성자 정보를 읽을 수 없습니다. 사이트 저장 데이터를 확인해 주세요.') }
    if (object(parsed) && text(parsed.id, 100) && text(parsed.name, 30)) return parsed as unknown as Identity
  }
  const identity = { id: crypto.randomUUID(), name: '익명' }
  localStorage.setItem(identityKey, JSON.stringify(identity))
  return identity
}
export function renameIdentity(identity: Identity, name: string): Identity {
  const updated = { ...identity, name: name.trim().slice(0, 30) || '익명' }
  localStorage.setItem(identityKey, JSON.stringify(updated))
  return updated
}
export function makeMessage(identity: Identity, body: string): Message {
  const value = body.trim()
  if (!value || value.length > MAX_BODY) throw new Error('코멘트를 1–2,000자로 입력해 주세요.')
  return { id: crypto.randomUUID(), authorId: identity.id, author: identity.name, body: value, createdAt: new Date().toISOString() }
}
