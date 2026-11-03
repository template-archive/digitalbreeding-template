import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AuthRequestError, fetchSession, logoutAccount, renameAccount, type AuthUser } from './client'
import { LoginDialog } from './LoginDialog'

// 허브 로그인 상태. 보기 기능은 로그인과 무관하게 동작하고, 요청 만들기 같은 동작만 requireLogin으로 감싼다(로그인 설계 5.7).
// 임베드(미리보기 iframe)에서는 enabled=false로 두어 /api/auth/me를 부르지 않는다.

export type AuthContextValue = {
  user: AuthUser | null
  available: boolean
  ready: boolean
  /** 로그인 창을 연다. 성공하면 then을 실행한다. */
  openLogin(then?: () => void): void
  /** 로그인 상태면 바로 then, 아니면 로그인 창 → 성공 후 then */
  requireLogin(then: () => void): void
  /** 401을 받은 호출이 부른다: 로그아웃 상태로 바꾸고 로그인 창을 연다 */
  signedOut(then?: () => void): void
  /** 401이면 signedOut()으로 넘기고, 그 밖의 오류는 던진다 */
  rename(name: string): Promise<void>
  logout(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [state, setState] = useState<{ user: AuthUser | null; available: boolean; ready: boolean }>(
    enabled ? { user: null, available: true, ready: false } : { user: null, available: false, ready: true },
  )
  const [open, setOpen] = useState(false)
  const pending = useRef<(() => void) | undefined>(undefined)
  const opener = useRef<HTMLElement | null>(null)
  const userRef = useRef<AuthUser | null>(null)
  userRef.current = state.user

  useEffect(() => {
    if (!enabled) return
    let alive = true
    fetchSession().then(session => { if (alive) setState({ ...session, ready: true }) })
    return () => { alive = false }
  }, [enabled])

  const openLogin = useCallback((then?: () => void) => {
    pending.current = then
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setOpen(true)
  }, [])
  const requireLogin = useCallback((then: () => void) => {
    if (userRef.current) then()
    else openLogin(then)
  }, [openLogin])
  const signedOut = useCallback((then?: () => void) => {
    setState(s => ({ ...s, user: null }))
    openLogin(then)
  }, [openLogin])
  const rename = useCallback(async (name: string) => {
    try {
      const user = await renameAccount(name)
      setState(s => ({ ...s, user }))
    } catch (error) {
      if (error instanceof AuthRequestError && error.status === 401) {
        signedOut()
        return
      }
      throw error
    }
  }, [signedOut])
  // 서버가 세션을 지웠을 때만 로그아웃 상태로 바꾼다. 실패하면 쿠키·세션이 남아 있으므로 오류를 던져 화면이 알리게 한다.
  const logout = useCallback(async () => {
    try {
      await logoutAccount()
    } catch (error) {
      if (!(error instanceof AuthRequestError && error.status === 401)) throw error
    }
    setState(s => ({ ...s, user: null }))
  }, [])

  // 모달이 열려 있는 동안은 창 밖에 포커스를 줄 수 없으므로, 창이 닫힌(언마운트된) 뒤 연 버튼으로 돌려준다.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (wasOpen.current && !open && opener.current?.isConnected) opener.current.focus()
    wasOpen.current = open
  }, [open])
  const close = useCallback(() => {
    setOpen(false)
    pending.current = undefined
  }, [])
  const success = useCallback((user: AuthUser) => {
    setState(s => ({ ...s, user, available: true }))
    setOpen(false)
    const then = pending.current
    pending.current = undefined
    then?.()
  }, [])

  const value = useMemo<AuthContextValue>(() => ({ ...state, openLogin, requireLogin, signedOut, rename, logout }), [state, openLogin, requireLogin, signedOut, rename, logout])
  return (
    <AuthContext.Provider value={value}>
      {children}
      {enabled && open && <LoginDialog open available={state.available} onClose={close} onSuccess={success} />}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
