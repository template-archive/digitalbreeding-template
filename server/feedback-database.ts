import { neon } from '@neondatabase/serverless'
import { parseFeedback, type FeedbackData } from '../src/features/feedback/model.ts'
import type { FeedbackAction } from '../src/features/feedback/protocol.ts'
import { applyAction, FeedbackError } from './feedback-domain.ts'
import { countHit, RATE_LIMIT_TABLE, type RateWindow } from './rate-limit.ts'

export const SCHEMA = [
  "SELECT pg_advisory_xact_lock(74190831)",
  "CREATE TABLE IF NOT EXISTS feedback_pages (scope text NOT NULL, template text NOT NULL, revision bigint NOT NULL DEFAULT 0, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(scope, template))",
  RATE_LIMIT_TABLE,
]
let initialized: Promise<void> | undefined
function sqlClient() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!url) throw new FeedbackError(503, '공유 저장소가 아직 연결되지 않았습니다. 관리자에게 DB 연결을 요청해 주세요.')
  return neon(url)
}
function scope() {
  return process.env.VERCEL_ENV === 'production' ? 'production' : 'preview:' + (process.env.VERCEL_GIT_COMMIT_REF || 'local')
}
async function ready() {
  if (!initialized) {
    const sql = sqlClient()
    initialized = sql.transaction(SCHEMA.map(statement => sql.query(statement))).then(() => undefined).catch(error => { initialized = undefined; throw error })
  }
  await initialized
}
export async function limitRequests(key: string, limit: number, window: RateWindow = 'minute') {
  await ready()
  if (await countHit(sqlClient(), scope(), key, window) > limit) throw new FeedbackError(429, '요청이 많습니다. 잠시 후 다시 시도해 주세요.')
}
export async function readSharedFeedback(template: string): Promise<{ data: FeedbackData; revision: number }> {
  await ready()
  const sql = sqlClient()
  const rows = await sql.query('SELECT data, revision FROM feedback_pages WHERE scope=$1 AND template=$2', [scope(), template])
  if (!rows.length) return { data: parseFeedback(null), revision: 0 }
  return { data: parseFeedback(JSON.stringify(rows[0].data)), revision: Number(rows[0].revision) }
}
export async function saveSharedFeedback(template: string, actorId: string, action: FeedbackAction) {
  await ready()
  const sql = sqlClient()
  const namespace = scope()
  await sql.query('INSERT INTO feedback_pages(scope, template, data) VALUES($1,$2,$3::jsonb) ON CONFLICT DO NOTHING', [namespace, template, JSON.stringify(parseFeedback(null))])
  // Optimistic compare-and-swap retries the action on the newest document; it never overwrites another writer.
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await readSharedFeedback(template)
    const next = applyAction(current.data, actorId, action, new Date().toISOString())
    const rows = await sql.query('UPDATE feedback_pages SET data=$1::jsonb, revision=revision+1, updated_at=now() WHERE scope=$2 AND template=$3 AND revision=$4 RETURNING data, revision', [JSON.stringify(next), namespace, template, current.revision])
    if (rows.length) return { data: parseFeedback(JSON.stringify(rows[0].data)), revision: Number(rows[0].revision) }
    await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 60))
  }
  throw new FeedbackError(409, '동시에 저장 중인 코멘트가 많습니다. 입력 내용은 유지됩니다. 다시 저장해 주세요.')
}
