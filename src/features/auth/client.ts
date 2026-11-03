// 허브 로그인 API 호출(같은 출처, 세션은 HttpOnly 쿠키라 화면 코드는 쿠키를 읽지 않는다).
// 서버 문구를 그대로 오류 메시지로 넘긴다. 서버 문구에는 회사 이름·도메인이 없다.

export type AuthUser = { id: string; name: string }

export class AuthRequestError extends Error {
  readonly status: number
  readonly retryAfter: number | null
  constructor(status: number, message: string, retryAfter: number | null) {
    super(message)
    this.status = status
    this.retryAfter = retryAfter
  }
}

const OFFLINE = '로그인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'

async function call<T>(path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch('/api/auth/' + path, body === undefined
      ? { credentials: 'same-origin', headers: { Accept: 'application/json' } }
      : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new AuthRequestError(0, OFFLINE, null)
  }
  const data = await response.json().catch(() => null) as (T & { error?: string }) | null
  if (!response.ok) {
    const retry = Number(response.headers.get('Retry-After'))
    throw new AuthRequestError(response.status, data?.error || OFFLINE, Number.isFinite(retry) && retry > 0 ? retry : null)
  }
  return data as T
}

/** 앱 시작 때 한 번. 실패해도 보기 기능은 그대로이므로 '로그인 안 됨'으로 본다. */
export async function fetchSession(): Promise<{ user: AuthUser | null; available: boolean }> {
  try {
    const data = await call<{ user: AuthUser | null; available: boolean }>('me')
    return { user: data.user ?? null, available: data.available !== false }
  } catch {
    return { user: null, available: true }
  }
}

export async function requestLoginCode(email: string): Promise<{ resendAfter: number }> {
  const data = await call<{ resendAfter: number }>('code', { email })
  return { resendAfter: data.resendAfter }
}

export async function verifyLoginCode(email: string, code: string, name?: string): Promise<{ needsName: true } | { user: AuthUser }> {
  const data = await call<{ needsName?: true; user?: AuthUser }>('verify', name === undefined ? { email, code } : { email, code, name })
  return data.needsName ? { needsName: true } : { user: data.user! }
}

export async function renameAccount(name: string): Promise<AuthUser> {
  return (await call<{ user: AuthUser }>('name', { name })).user
}

export async function logoutAccount(): Promise<void> {
  await call<{ ok: true }>('logout', {})
}
