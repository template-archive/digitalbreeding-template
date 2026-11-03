import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, CircleAlert, Info, X } from 'lucide-react'
import { cn } from './cn'

export type ToastTone = 'positive' | 'info' | 'warning' | 'negative'

export interface ToastProps {
  /** null이면 숨김. 라이브 영역(role=status)은 항상 DOM에 남아 있어 스크린리더가 변화를 읽는다 */
  message: ReactNode | null
  onClose: () => void
  /** 기본 'positive'(저장·확정 완료) */
  tone?: ToastTone
  /** 자동 닫힘(ms). 0이면 자동으로 닫지 않는다. 기본 4000 */
  duration?: number
  /** 위치 덮어쓰기. 기본: 모바일 하단 중앙(bottom-20, 고정 하단 바 위) · md 이상 우하단 */
  className?: string
  /** 닫기 버튼 접근성 이름. 기본 '알림 닫기' */
  closeLabel?: string
}

const TONE: Record<ToastTone, { border: string; icon: string; Icon: typeof Check }> = {
  positive: {
    border: 'border-positive/40',
    icon: 'text-positive',
    Icon: Check,
  },
  info: { border: 'border-info/40', icon: 'text-info', Icon: Info },
  warning: {
    border: 'border-warning/40',
    icon: 'text-warning',
    Icon: CircleAlert,
  },
  negative: {
    border: 'border-negative/40',
    icon: 'text-negative',
    Icon: CircleAlert,
  },
}

/** 상태 토스트: role=status, aria-live=polite, 자동 닫힘, 닫기 버튼. 보통 useToast()와 함께 쓴다. */
export function Toast({ message, onClose, tone = 'positive', duration = 4000, className, closeLabel = '알림 닫기' }: ToastProps) {
  useEffect(() => {
    if (message == null || !duration) return
    const t = window.setTimeout(onClose, duration)
    return () => window.clearTimeout(t)
  }, [message, onClose, duration])
  const { border, icon, Icon } = TONE[tone]
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('pointer-events-none fixed inset-x-4 bottom-20 z-50 flex justify-center md:inset-x-auto md:bottom-6 md:right-6', className)}
    >
      {message != null && (
        <div className={cn('pointer-events-auto flex max-w-md items-start gap-3 rounded-lg border bg-surface px-4 py-3 text-[13px] text-text shadow-2', border)}>
          <Icon size={18} aria-hidden="true" className={cn('mt-0.5 shrink-0', icon)} />
          <div className="min-w-0 flex-1">{message}</div>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="shrink-0 rounded-sm text-muted hover:text-text">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}

export interface UseToastResult {
  /** 메시지를 띄운다. 같은 문구를 다시 띄워도 타이머가 새로 시작된다 */
  show: (message: ReactNode, opts?: { tone?: ToastTone; duration?: number }) => void
  dismiss: () => void
  /** <Toast {...toastProps} />로 펼쳐 넘긴다 */
  toastProps: ToastProps
}

/**
 * 템플릿 단위 토스트 상태. 컨텍스트·전역 뷰포트가 필요 없다.
 * const toast = useToast(); toast.show('저장했습니다'); … <Toast {...toast.toastProps} />
 */
export function useToast(defaults?: { tone?: ToastTone; duration?: number }): UseToastResult {
  const [state, setState] = useState<{
    message: ReactNode
    tone?: ToastTone
    duration?: number
    id: number
  } | null>(null)
  const seq = useRef(0)
  const dismiss = useCallback(() => setState(null), [])
  const show = useCallback<UseToastResult['show']>((message, opts) => {
    seq.current += 1
    setState({
      message,
      tone: opts?.tone,
      duration: opts?.duration,
      id: seq.current,
    })
  }, [])
  // 같은 문구를 다시 띄워도 타이머가 새로 시작되도록 show() 호출마다 새 요소를 만든다(렌더마다 만들지는 않는다)
  const message = useMemo(() => (state ? <span key={state.id}>{state.message}</span> : null), [state])
  return {
    show,
    dismiss,
    toastProps: {
      message,
      onClose: dismiss,
      tone: state?.tone ?? defaults?.tone,
      duration: state?.duration ?? defaults?.duration,
    },
  }
}
