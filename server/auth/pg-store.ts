import { neon } from '@neondatabase/serverless'
import { randomUUID } from 'node:crypto'
import { countHit, RATE_LIMIT_TABLE } from '../rate-limit.ts'
import type { AuthStore, HubUser } from './store.ts'

// Postgres(Neon) 로그인 저장소. 운영은 전용 DB, 미리보기·로컬은 공용 DB에 preview 범위로 쓴다(로그인 설계 5.3·5.4).
// 코드·세션 토큰은 해시만 저장한다. 표는 처음 쓸 때 만든다(피드백과 다른 잠금 번호).

const SCHEMA = [
  'SELECT pg_advisory_xact_lock(74190832)',
  'CREATE TABLE IF NOT EXISTS hub_users (id text PRIMARY KEY, scope text NOT NULL, email text NOT NULL, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), last_login_at timestamptz NOT NULL DEFAULT now(), UNIQUE(scope, email))',
  'CREATE TABLE IF NOT EXISTS hub_login_codes (scope text NOT NULL, email text NOT NULL, code_hash text NOT NULL, expires_at timestamptz NOT NULL, attempts integer NOT NULL DEFAULT 0, sent_at timestamptz NOT NULL, PRIMARY KEY(scope, email))',
  'CREATE TABLE IF NOT EXISTS hub_sessions (token_hash text PRIMARY KEY, scope text NOT NULL, user_id text NOT NULL REFERENCES hub_users(id) ON DELETE CASCADE, created_at timestamptz NOT NULL, last_seen_at timestamptz NOT NULL)',
  RATE_LIMIT_TABLE,
]

type Row = Record<string, unknown>
const date = (value: unknown) => value instanceof Date ? value : new Date(String(value))
const user = (row: Row): HubUser => ({ id: String(row.id), name: String(row.name), email: String(row.email) })

export function createPgStore(databaseUrl: string, scope: 'production' | 'preview'): AuthStore {
  const sql = neon(databaseUrl)
  let initialized: Promise<void> | undefined
  const ready = async () => {
    initialized ??= sql.transaction(SCHEMA.map(statement => sql.query(statement))).then(() => undefined).catch(error => { initialized = undefined; throw error })
    await initialized
  }
  const query = async (text: string, params: unknown[] = []) => { await ready(); return await sql.query(text, params) as Row[] }
  // 만료된 코드·세션은 가끔 지운다(쓰기 제한 표와 같은 방식).
  const sweep = async () => {
    if (Math.random() >= .02) return
    await query('DELETE FROM hub_login_codes WHERE scope=$1 AND expires_at < now()', [scope])
    await query("DELETE FROM hub_sessions WHERE scope=$1 AND (last_seen_at < now() - interval '30 days' OR created_at < now() - interval '90 days')", [scope])
  }

  return {
    async hit(key, window) { await ready(); return countHit(sql, scope, key, window) },
    async putCode(code) {
      await query(
        'INSERT INTO hub_login_codes(scope, email, code_hash, expires_at, attempts, sent_at) VALUES($1,$2,$3,$4,0,$5) ON CONFLICT(scope, email) DO UPDATE SET code_hash=EXCLUDED.code_hash, expires_at=EXCLUDED.expires_at, attempts=0, sent_at=EXCLUDED.sent_at',
        [scope, code.email, code.codeHash, code.expiresAt.toISOString(), code.sentAt.toISOString()],
      )
      await sweep()
    },
    async getCode(email) {
      const rows = await query('SELECT email, code_hash, expires_at, attempts, sent_at FROM hub_login_codes WHERE scope=$1 AND email=$2', [scope, email])
      const r = rows[0]
      return r ? { email: String(r.email), codeHash: String(r.code_hash), expiresAt: date(r.expires_at), attempts: Number(r.attempts), sentAt: date(r.sent_at) } : null
    },
    async addCodeAttempt(email) { await query('UPDATE hub_login_codes SET attempts = attempts + 1 WHERE scope=$1 AND email=$2', [scope, email]) },
    async deleteCode(email) { await query('DELETE FROM hub_login_codes WHERE scope=$1 AND email=$2', [scope, email]) },
    async findUser(email) {
      const rows = await query('SELECT id, name, email FROM hub_users WHERE scope=$1 AND email=$2', [scope, email])
      return rows[0] ? user(rows[0]) : null
    },
    async createUser(email, name) {
      await query('INSERT INTO hub_users(id, scope, email, name) VALUES($1,$2,$3,$4) ON CONFLICT(scope, email) DO NOTHING', [randomUUID(), scope, email, name])
      const rows = await query('SELECT id, name, email FROM hub_users WHERE scope=$1 AND email=$2', [scope, email])
      return user(rows[0]!)
    },
    async renameUser(id, name) {
      const rows = await query('UPDATE hub_users SET name=$3 WHERE scope=$1 AND id=$2 RETURNING id, name, email', [scope, id, name])
      if (!rows[0]) throw new Error('user not found')
      return user(rows[0])
    },
    async recordLogin(id, at) { await query('UPDATE hub_users SET last_login_at=$3 WHERE scope=$1 AND id=$2', [scope, id, at.toISOString()]) },
    async createSession(tokenHash, userId, at) {
      await query('INSERT INTO hub_sessions(token_hash, scope, user_id, created_at, last_seen_at) VALUES($1,$2,$3,$4,$4)', [tokenHash, scope, userId, at.toISOString()])
      await sweep()
    },
    async getSession(tokenHash) {
      const rows = await query('SELECT s.token_hash, s.created_at, s.last_seen_at, u.id, u.name, u.email FROM hub_sessions s JOIN hub_users u ON u.id = s.user_id WHERE s.scope=$1 AND s.token_hash=$2', [scope, tokenHash])
      const r = rows[0]
      return r ? { tokenHash: String(r.token_hash), user: user(r), createdAt: date(r.created_at), lastSeenAt: date(r.last_seen_at) } : null
    },
    async touchSession(tokenHash, at) { await query('UPDATE hub_sessions SET last_seen_at=$3 WHERE scope=$1 AND token_hash=$2', [scope, tokenHash, at.toISOString()]) },
    async deleteSession(tokenHash) { await query('DELETE FROM hub_sessions WHERE scope=$1 AND token_hash=$2', [scope, tokenHash]) },
  }
}
