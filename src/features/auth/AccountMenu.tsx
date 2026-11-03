import { useState, type FormEvent } from 'react'
import { LogIn, LogOut, UserRound } from 'lucide-react'
import { Button } from '@/design-system'
import { useAuth } from './AuthProvider'
import { AuthRequestError } from './client'

// 사이드바(1024 이상)와 메뉴 시트(1024 미만) 아래쪽 계정 영역. 행 모양은 셸이 rowClassName으로 넘긴다(테마 전환 행과 같게).
// 메뉴 시트 안에서는 onBeforeLogin으로 시트를 먼저 닫아, 모달이 겹치지 않고 닫힌 뒤 포커스가 메뉴 버튼으로 돌아가게 한다.

export function AccountMenu({ rowClassName, onBeforeLogin }: { rowClassName: string; onBeforeLogin?: () => void }) {
  const { user, ready, openLogin, rename, logout } = useAuth()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!ready) return <div data-auth-account="loading" className="min-h-10" aria-hidden="true" />

  if (!user) {
    const start = () => {
      if (!onBeforeLogin) return openLogin()
      onBeforeLogin()
      requestAnimationFrame(() => openLogin())
    }
    return (
      <div data-auth-account="signed-out">
        <button type="button" data-auth-login="" className={rowClassName} onClick={start}>
          <LogIn size={16} aria-hidden="true" className="text-muted" />
          로그인
        </button>
      </div>
    )
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await rename(draft)
      setEditing(false)
    } catch (e) {
      setError(e instanceof AuthRequestError ? e.message : '잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-auth-account="signed-in" className="flex flex-col gap-1">
      {editing ? (
        <form className="auth-account-form" onSubmit={save}>
          <label htmlFor="auth-account-name" className="text-xs font-semibold text-muted">표시 이름</label>
          <input id="auth-account-name" value={draft} maxLength={20} autoFocus disabled={busy} autoComplete="nickname"
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault() }} />
          {error && <p role="alert" className="text-xs text-negative">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={busy || !draft.trim()}>저장</Button>
            <Button size="sm" disabled={busy} onClick={() => { setEditing(false); setError('') }}>취소</Button>
          </div>
        </form>
      ) : (
        <button type="button" data-auth-name="" className={rowClassName} aria-label={`표시 이름 ${user.name}, 바꾸기`}
          onClick={() => { setDraft(user.name); setEditing(true) }}>
          <UserRound size={16} aria-hidden="true" className="text-muted" />
          <span className="min-w-0 truncate">{user.name}</span>
        </button>
      )}
      <button type="button" className={rowClassName} onClick={() => void logout()}>
        <LogOut size={16} aria-hidden="true" className="text-muted" />
        로그아웃
      </button>
    </div>
  )
}
