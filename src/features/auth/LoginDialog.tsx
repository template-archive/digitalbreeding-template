import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/design-system'
import { AuthRequestError, requestLoginCode, verifyLoginCode, type AuthUser } from './client'
import './auth.css'

// 두 단계 로그인 창(로그인 설계 3·5.7절). 회사 이름·도메인·예시 주소는 쓰지 않고, 입력한 주소도 다시 보여 주지 않는다.
// 열고 닫기·Esc·바깥 클릭·스크롤 잠금은 「프로젝트에 가져오기」 창(TemplateResources)과 같은 방식이다.

export type LoginDialogProps = { open: boolean; available: boolean; onClose(): void; onSuccess(user: AuthUser): void }

const CODE_SENT = '코드를 보냈습니다. 메일이 오지 않으면 주소를 확인해 주세요.'
const CLOSED = '로그인을 아직 사용할 수 없습니다.'
let rememberedEmail = ''
/** 코드를 보낸 뒤 창을 닫았다 다시 열어도, 코드가 유효한 동안(10분)은 코드 단계와 다시 받기 대기 시간을 이어 간다. */
let sentCode: { email: string; resendAt: number; expiresAt: number } | null = null
const CODE_TTL_MS = 10 * 60_000
const resumable = () => (sentCode && sentCode.expiresAt > Date.now() && sentCode.email === rememberedEmail ? sentCode : null)

/** 한글 조합 중 Enter는 글자 확정이지 제출이 아니다. */
const holdWhileComposing = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault()
}

export function LoginDialog({ open, available, onClose, onSuccess }: LoginDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const [step, setStep] = useState<'email' | 'code'>(() => (resumable() ? 'code' : 'email'))
  const [email, setEmail] = useState(rememberedEmail)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [needsName, setNeedsName] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resendAt, setResendAt] = useState(() => resumable()?.resendAt ?? 0)
  const [now, setNow] = useState(() => Date.now())
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000))

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !open) return
    const overflow = document.body.style.overflow
    const gutter = document.documentElement.style.scrollbarGutter
    document.documentElement.style.scrollbarGutter = 'stable'
    document.body.style.overflow = 'hidden'
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
      document.body.style.overflow = overflow
      document.documentElement.style.scrollbarGutter = gutter
    }
  }, [open])

  useEffect(() => {
    if (step !== 'code' || resendAt <= Date.now()) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [step, resendAt])

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await work()
    } catch (e) {
      setError(e instanceof AuthRequestError ? e.message : '잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }
  const sendCode = () => run(async () => {
    const { resendAfter } = await requestLoginCode(email.trim())
    rememberedEmail = email.trim()
    const nextResend = Date.now() + resendAfter * 1000
    sentCode = { email: rememberedEmail, resendAt: nextResend, expiresAt: Date.now() + CODE_TTL_MS }
    setStep('code')
    setResendAt(nextResend)
    setNow(Date.now())
    requestAnimationFrame(() => codeRef.current?.focus())
  })
  const submitEmail = (event: FormEvent) => { event.preventDefault(); void sendCode() }
  const submitCode = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      const result = await verifyLoginCode(email.trim(), code, needsName ? name : undefined)
      if ('needsName' in result) {
        setNeedsName(true)
        requestAnimationFrame(() => nameRef.current?.focus())
        return
      }
      sentCode = null
      onSuccess(result.user)
    })
  }
  const changeAddress = () => {
    sentCode = null
    setStep('email')
    setCode('')
    setName('')
    setNeedsName(false)
    setError('')
  }

  return (
    <dialog ref={dialogRef} aria-labelledby={id + '-title'} aria-describedby={id + '-desc'} className="template-resource-dialog" data-auth-dialog="" data-print-hide=""
      onKeyDown={event => event.stopPropagation()}
      onCancel={event => { event.preventDefault(); onClose() }}
      onClick={event => {
        if (event.target !== event.currentTarget) return
        const box = event.currentTarget.getBoundingClientRect()
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose()
      }}>
      <header className="template-resource-header">
        <div><h2 id={id + '-title'}>로그인</h2><p id={id + '-desc'}>업무용 메일 주소로 로그인합니다.</p></div>
        <button type="button" aria-label="로그인 닫기" className="template-resource-close" onClick={onClose}><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="template-resource-body">
        {!available ? (
          <div>
            <p className="auth-notice" role="status">{CLOSED}</p>
            <div className="auth-actions"><Button className="auth-submit" onClick={onClose} autoFocus>닫기</Button></div>
          </div>
        ) : step === 'email' ? (
          <form data-auth-step="email" onSubmit={submitEmail} noValidate>
            <div className="auth-field">
              <label htmlFor={id + '-email'}>메일 주소</label>
              <input id={id + '-email'} type="email" inputMode="email" autoComplete="email" autoFocus required maxLength={254}
                value={email} disabled={busy} aria-invalid={!!error} aria-describedby={error ? id + '-error' : undefined}
                onChange={event => setEmail(event.target.value)} onKeyDown={holdWhileComposing} />
            </div>
            {error && <p id={id + '-error'} className="auth-error" role="alert">{error}</p>}
            <div className="auth-actions">
              <Button type="submit" variant="primary" className="auth-submit" disabled={busy || !email.trim()}>코드 받기</Button>
            </div>
          </form>
        ) : (
          <form data-auth-step="code" onSubmit={submitCode} noValidate>
            <p className="auth-notice" role="status">{CODE_SENT}</p>
            <div className="auth-field">
              <label htmlFor={id + '-code'}>6자리 코드</label>
              <input ref={codeRef} id={id + '-code'} inputMode="numeric" autoComplete="one-time-code" maxLength={11} required autoFocus
                value={code} disabled={busy} aria-invalid={!!error} aria-describedby={id + '-code-hint' + (error ? ' ' + id + '-error' : '')}
                onChange={event => setCode(event.target.value)} onKeyDown={holdWhileComposing} />
              <p id={id + '-code-hint'} className="auth-hint">새 코드를 받으면 이전 코드는 쓸 수 없습니다.</p>
            </div>
            {needsName && (
              <div className="auth-field" data-auth-name-field="">
                <label htmlFor={id + '-name'}>표시 이름</label>
                <input ref={nameRef} id={id + '-name'} autoComplete="nickname" maxLength={20} required
                  value={name} disabled={busy} aria-describedby={id + '-name-hint'}
                  onChange={event => setName(event.target.value)} onKeyDown={holdWhileComposing} />
                <p id={id + '-name-hint'} className="auth-hint">요청에 표시될 이름입니다.</p>
              </div>
            )}
            {error && <p id={id + '-error'} className="auth-error" role="alert">{error}</p>}
            <div className="auth-actions">
              <Button type="submit" variant="primary" className="auth-submit" disabled={busy || !code.trim() || (needsName && !name.trim())}>확인</Button>
              <Button disabled={busy || wait > 0} onClick={() => void sendCode()}>{wait > 0 ? `다시 받기 (${wait}초)` : '다시 받기'}</Button>
              <Button variant="ghost" disabled={busy} onClick={changeAddress}>주소 바꾸기</Button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  )
}
