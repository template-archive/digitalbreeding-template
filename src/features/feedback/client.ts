import { parseFeedback } from './model'
import type { FeedbackAction, FeedbackSnapshot } from './protocol'

const reads = new Map<string, Promise<FeedbackSnapshot>>()
export class FeedbackApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
async function request(template: string, action?: FeedbackAction): Promise<FeedbackSnapshot> {
  let response: Response
  try {
    response = await fetch('/api/feedback?template=' + encodeURIComponent(template), {
      method: action ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: action ? { 'Content-Type': 'application/json' } : {},
      body: action ? JSON.stringify(action) : undefined,
      signal: AbortSignal.timeout(12000),
    })
  } catch { throw new FeedbackApiError(0, '네트워크에 연결하지 못했습니다. 입력 내용은 유지됩니다. 연결 후 다시 시도해 주세요.') }
  if (!response.headers.get('content-type')?.includes('application/json')) throw new FeedbackApiError(response.status, '공유 API를 사용할 수 없습니다. Vercel 배포 또는 로컬 DB 설정을 확인해 주세요.')
  const value = await response.json()
  if (!response.ok) throw new FeedbackApiError(response.status, typeof value.error === 'string' ? value.error : '공유 저장소에 연결하지 못했습니다.')
  if (value.storage !== 'shared' || !/^[a-f0-9]{64}$/.test(value.actorId) || !Number.isSafeInteger(value.revision) || value.revision < 0) throw new FeedbackApiError(503, '코멘트 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  return { storage: 'shared', actorId: value.actorId, revision: value.revision, data: parseFeedback(JSON.stringify(value.data)) }
}
export function loadSharedFeedback(template: string) {
  const existing = reads.get(template)
  if (existing) return existing
  const pending = request(template).finally(() => reads.delete(template))
  reads.set(template, pending)
  return pending
}
export function sendFeedback(template: string, action: FeedbackAction) { return request(template, action) }
export function displayName() {
  try {
    const name = localStorage.getItem('db-feedback:display-name:v1')
    if (name !== null) return name.slice(0, 30)
    const legacy = JSON.parse(localStorage.getItem('db-feedback:identity:v1') || 'null')
    if (typeof legacy?.name === 'string') return legacy.name.slice(0, 30)
  } catch { /* Server-backed feedback works even when localStorage is unavailable. */ }
  return '익명'
}
export function rememberName(name: string) {
  const value = name.trim().slice(0, 30) || '익명'
  try { localStorage.setItem('db-feedback:display-name:v1', value) } catch { /* Optional preference only. */ }
  return value
}
