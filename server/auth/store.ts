import type { RateWindow } from '../rate-limit.ts'

// 로그인 데이터 저장소 계약. 운영은 전용 DB(AUTH_DATABASE_URL), 미리보기·로컬은 공용 DB의 preview 범위를 쓴다(로그인 설계 5.3·5.4).
// 메일 주소는 관리용으로 원문 저장하지만 API 응답에는 절대 넣지 않는다.

export type { RateWindow }
export type HubUser = { id: string; name: string; email: string }
export type LoginCode = { email: string; codeHash: string; expiresAt: Date; attempts: number; sentAt: Date }
export type SessionRow = { tokenHash: string; user: HubUser; createdAt: Date; lastSeenAt: Date }

export interface AuthStore {
  /** 현재 창(분·시·일)의 누적 횟수 */
  hit(key: string, window: RateWindow): Promise<number>
  /** 같은 주소의 이전 코드를 바꿔 쓴다 */
  putCode(code: LoginCode): Promise<void>
  getCode(email: string): Promise<LoginCode | null>
  /**
   * 코드 확인 한 번을 원자적으로 처리한다(동시 요청이 시도 제한을 넘지 못하게).
   * 유효한 코드(만료 전·시도 maxAttempts 미만)가 없으면 'invalid', 해시가 같으면 'match'(시도를 세지 않음),
   * 다르면 시도를 1 올리고 'mismatch'.
   */
  consumeAttempt(email: string, codeHash: string, now: Date, maxAttempts: number): Promise<'match' | 'mismatch' | 'invalid'>
  deleteCode(email: string): Promise<void>
  findUser(email: string): Promise<HubUser | null>
  /** 이미 있으면 기존 사용자를 돌려준다 */
  createUser(email: string, name: string): Promise<HubUser>
  renameUser(id: string, name: string): Promise<HubUser>
  recordLogin(id: string, at: Date): Promise<void>
  createSession(tokenHash: string, userId: string, at: Date): Promise<void>
  getSession(tokenHash: string): Promise<SessionRow | null>
  touchSession(tokenHash: string, at: Date): Promise<void>
  deleteSession(tokenHash: string): Promise<void>
}
