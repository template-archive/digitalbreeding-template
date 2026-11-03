import { randomUUID } from 'node:crypto'
import type { AuthStore, HubUser, LoginCode, RateWindow } from './store.ts'

// 테스트 전용 저장소. Postgres 저장소와 같은 계약 테스트(tests/auth-store.test.mjs)를 통과해야 한다.
// 쓰기 제한 창은 주입한 시계의 분·시·일(UTC) 시작 시각으로 나눈다.

const WINDOW_MS: Record<RateWindow, number> = { minute: 60_000, hour: 3_600_000, day: 86_400_000 }

export function createMemoryStore(now: () => Date): AuthStore {
  const hits = new Map<string, { start: number; count: number }>()
  const codes = new Map<string, LoginCode>()
  const users = new Map<string, HubUser>()
  const sessions = new Map<string, { userId: string; createdAt: Date; lastSeenAt: Date }>()
  const byId = (id: string) => [...users.values()].find(u => u.id === id)

  return {
    async hit(key, window) {
      const size = WINDOW_MS[window]
      if (!size) throw new Error('unknown rate window: ' + String(window))
      const start = Math.floor(now().getTime() / size) * size
      const bucket = window + ':' + key
      const current = hits.get(bucket)
      const count = current && current.start === start ? current.count + 1 : 1
      hits.set(bucket, { start, count })
      return count
    },
    async putCode(code) { codes.set(code.email, { ...code }) },
    async getCode(email) { const c = codes.get(email); return c ? { ...c } : null },
    async consumeAttempt(email, codeHash, at, maxAttempts) {
      // 읽기와 증가 사이에 await가 없어 한 번에 처리된다(Postgres는 UPDATE … RETURNING 한 문장).
      const c = codes.get(email)
      if (!c || c.expiresAt.getTime() <= at.getTime() || c.attempts >= maxAttempts) return 'invalid'
      if (c.codeHash === codeHash) return 'match'
      c.attempts += 1
      return 'mismatch'
    },
    async deleteCode(email) { codes.delete(email) },
    async findUser(email) { const u = users.get(email); return u ? { ...u } : null },
    async createUser(email, name) {
      if (!users.has(email)) users.set(email, { id: randomUUID(), name, email })
      return { ...users.get(email)! }
    },
    async renameUser(id, name) {
      const u = byId(id)
      if (!u) throw new Error('user not found')
      u.name = name
      return { ...u }
    },
    async recordLogin() { /* 메모리 저장소는 마지막 로그인 시각을 쓰지 않는다 */ },
    async createSession(tokenHash, userId, at) { sessions.set(tokenHash, { userId, createdAt: at, lastSeenAt: at }) },
    async getSession(tokenHash) {
      const s = sessions.get(tokenHash)
      const u = s && byId(s.userId)
      return s && u ? { tokenHash, user: { ...u }, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt } : null
    },
    async touchSession(tokenHash, at) { const s = sessions.get(tokenHash); if (s) s.lastSeenAt = at },
    async deleteSession(tokenHash) { sessions.delete(tokenHash) },
  }
}
