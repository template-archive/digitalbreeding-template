export type FeedbackLabel = 'fix' | 'question' | 'idea'
export const LABELS: Record<FeedbackLabel, string> = { fix: '수정 요청', question: '질문', idea: '제안' }
export interface Anchor {
  selector: string | null
  quote: string
  x: number
  y: number
  width: number
}
export interface Message { id: string; authorId: string; author: string; body: string; createdAt: string }
export interface Thread {
  id: string
  number: number
  label: FeedbackLabel
  resolved: boolean
  anchor: Anchor
  messages: Message[]
}
export interface FeedbackData { version: 1; nextNumber: number; threads: Thread[] }
export interface Identity { id: string; name: string }
export const MAX_BODY = 2000
const empty = (): FeedbackData => ({ version: 1, nextNumber: 1, threads: [] })
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const fraction = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1

/** Reject damaged or unknown versions instead of silently overwriting stored feedback. */
export function parseFeedback(raw: string | null): FeedbackData {
  if (raw === null) return empty()
  let value: unknown
  try { value = JSON.parse(raw) }
  catch { throw new Error('저장된 코멘트를 읽을 수 없습니다. 기존 데이터는 보존됩니다.') }
  if (!object(value) || value.version !== 1 || !Number.isSafeInteger(value.nextNumber) || (value.nextNumber as number) < 1 || !Array.isArray(value.threads) || value.threads.length > 500) throw new Error('저장된 코멘트를 읽을 수 없습니다. 기존 데이터는 보존됩니다.')
  const ids = new Set<string>()
  const numbers = new Set<number>()
  for (const t of value.threads) {
    if (!object(t) || !text(t.id, 100) || ids.has(t.id) || !Number.isSafeInteger(t.number) || (t.number as number) < 1 || numbers.has(t.number as number) || (t.number as number) >= (value.nextNumber as number) || !Object.hasOwn(LABELS, String(t.label)) || typeof t.resolved !== 'boolean' || !object(t.anchor) || !(t.anchor.selector === null || text(t.anchor.selector, 4000)) || typeof t.anchor.quote !== 'string' || t.anchor.quote.length > 100 || !fraction(t.anchor.x) || !fraction(t.anchor.y) || typeof t.anchor.width !== 'number' || !Number.isFinite(t.anchor.width) || t.anchor.width < 0 || !Array.isArray(t.messages) || !t.messages.length || t.messages.length > 100) throw new Error('저장된 코멘트 형식이 올바르지 않습니다. 기존 데이터는 보존됩니다.')
    ids.add(t.id); numbers.add(t.number as number)
    const messages = new Set<string>()
    for (const m of t.messages) {
      if (!object(m) || !text(m.id, 100) || messages.has(m.id) || !text(m.authorId, 100) || !text(m.author, 30) || !text(m.body, MAX_BODY) || !text(m.createdAt, 100) || !Number.isFinite(Date.parse(m.createdAt))) throw new Error('저장된 답글을 읽을 수 없습니다.')
      messages.add(m.id)
    }
  }
  return value as unknown as FeedbackData
}
