import { createHash } from 'node:crypto'

// 쓰기 제한: 키마다 현재 창(분·시·일, DB 시각 기준으로 자름)의 누적 횟수를 센다. 원래 키는 저장하지 않고 해시만 둔다.
// 피드백(분 창)과 로그인(분·시·일 창)이 같은 표를 쓰며, 각 환경이 쓰는 DB에 표가 하나씩 있다.

export type RateWindow = 'minute' | 'hour' | 'day'
export type SqlQuery = { query(text: string, params?: unknown[]): Promise<Record<string, unknown>[]> }

const WINDOWS: readonly RateWindow[] = ['minute', 'hour', 'day']

export const RATE_LIMIT_TABLE = 'CREATE TABLE IF NOT EXISTS feedback_rate_limits (bucket text PRIMARY KEY, window_start timestamptz NOT NULL, hits integer NOT NULL)'

const HIT = `INSERT INTO feedback_rate_limits(bucket, window_start, hits) VALUES($1, date_trunc($2::text, now()), 1)
ON CONFLICT(bucket) DO UPDATE SET window_start = date_trunc($2::text, now()),
  hits = CASE WHEN feedback_rate_limits.window_start = date_trunc($2::text, now()) THEN feedback_rate_limits.hits + 1 ELSE 1 END
RETURNING hits`

export function rateBucket(scope: string, key: string, window: RateWindow): string {
  return createHash('sha256').update(scope + ':' + window + ':' + key).digest('hex')
}

export async function countHit(sql: SqlQuery, scope: string, key: string, window: RateWindow): Promise<number> {
  if (!WINDOWS.includes(window)) throw new Error('unknown rate window: ' + String(window))
  const rows = await sql.query(HIT, [rateBucket(scope, key, window), window])
  // 하루 창 버킷이 창 안에서 지워지지 않도록 2일 기준으로 가끔 정리한다.
  if (Math.random() < .02) await sql.query("DELETE FROM feedback_rate_limits WHERE window_start < now() - interval '2 days'")
  return Number(rows[0]!.hits)
}
