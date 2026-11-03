import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'
import { cn } from './cn'

export interface BottomSheetProps {
  /** 열림. false면 아무것도 렌더하지 않는다(좁은 화면 조건도 호출 측이 함께 건다: `open={narrow && sheetOpen}`) */
  open: boolean
  onClose: () => void
  /** 대화상자 제목 요소의 id(aria-labelledby). 제목은 children 안에 템플릿이 둔다 */
  labelledBy: string
  children: ReactNode
  /**
   * 시트 머리 줄 왼쪽 문구(예: '계통 상세·결정'). 주면 머리(border-b, px-4 py-2) · 본문(스크롤, p-4) · `footer`로 나뉜 구조,
   * 없으면 시트 전체가 스크롤되고 맨 위 오른쪽에 「닫기」만 있는 구조(p-4)
   */
  header?: ReactNode
  /** 머리가 있는 구조에서 시트 아래 고정 줄(border-t, px-4 py-2.5, 양끝 정렬). 시트 안 저장 버튼 등 */
  footer?: ReactNode
  /** 시트 최대 높이(CSS 길이). 기본 '85vh' */
  maxHeight?: string
  /** 배경 버튼 접근 이름. 기본 '상세 닫기' */
  backdropLabel?: string
  className?: string
}

/**
 * 390px 화면의 상세 하단 시트. fixed inset-0 z-40 오버레이 + 배경 버튼(bg-text/30) + rounded-t-xl 대화상자(role=dialog, aria-modal).
 * Esc·배경·「닫기」(autoFocus)로 닫힌다. 규격 출처: workflow/crossing-record(머리 없음), workflow/advancement-decision(머리·아래 줄). 2026-10-29 승격.
 * SaveBar보다 DOM 앞에 두면(시트 안 저장 버튼이 있을 때) 같은 data-action 선택자의 첫 일치가 시트 쪽이 된다.
 */
export function BottomSheet({ open, onClose, labelledBy, children, header, footer, maxHeight = '85vh', backdropLabel = '상세 닫기', className }: BottomSheetProps) {
  const closeRef = useRef(onClose)
  const dialogRef = useRef<HTMLDivElement>(null)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []).filter(element => element.getClientRects().length > 0)
    const initialFocus = focusable()[0] ?? dialogRef.current
    initialFocus?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const elements = focusable()
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (!first || !last) {
        event.preventDefault()
        dialogRef.current?.focus()
      } else if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [open])

  if (!open) return null
  const close = (
    <Button size="sm" variant="ghost" icon={<X size={14} aria-hidden="true" />} onClick={onClose}>
      닫기
    </Button>
  )
  const structured = header != null
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button type="button" aria-label={backdropLabel} className="absolute inset-0 bg-text/30" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={labelledBy}
        style={{ maxHeight }}
        className={cn('relative rounded-t-xl border-t border-border bg-surface shadow-2', structured ? 'flex flex-col' : 'overflow-y-auto p-4', className)}
      >
        {structured ? (
          <>
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="text-xs text-muted">{header}</span>
              {close}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
            {footer != null && <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">{footer}</div>}
          </>
        ) : (
          <>
            <div className="mb-2 flex justify-end">{close}</div>
            {children}
          </>
        )}
      </div>
    </div>
  )
}
