import { useId, type ReactNode } from 'react'
import { cn } from './cn'

export interface SwitchProps {
  /** 켜짐 여부(제어형) */
  checked: boolean
  /** 눌렀을 때 다음 값으로 호출 */
  onChange: (next: boolean) => void
  /** 보이는 라벨. 접근 이름이 된다 */
  label: ReactNode
  /** 라벨 아래 보조 설명(aria-describedby로 연결) */
  description?: ReactNode
  disabled?: boolean
  /** 바깥 label 요소 클래스(높이·여백 조정용, 예: 'h-8') */
  className?: string
}

/**
 * 켜고 끄는 보기 옵션 스위치. role="switch" + aria-checked, Space·Enter로 토글(네이티브 button),
 * 포커스 링은 전역 :focus-visible 규칙, 색은 토큰만 써서 다크 모드는 토큰 교체로 따라간다. 켜짐은 잉크(--color-text) 채움.
 */
export function Switch({ checked, onChange, label, description, disabled, className }: SwitchProps) {
  const id = useId()
  const labelId = `${id}-label`
  const descId = description != null ? `${id}-desc` : undefined
  return (
    <label
      className={cn(
        // touch-hit-y: 라벨 전체가 누르는 영역이고, 좁은 화면·터치에서는 세로 44px까지 넓힌다(트랙 36×20은 같다)
        'touch-hit-y flex items-center gap-2 text-[13px] text-text',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed',
          // 켜짐 = 잉크 채움(강조색은 데이터·선택 표시에만, 2026-10-30)
          checked ? 'border-text bg-text' : 'border-border bg-surface-2',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-0.5 size-3.5 rounded-full bg-surface shadow-1 transition-all',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </button>
      {description != null ? (
        <span className="flex flex-col leading-tight">
          <span id={labelId}>{label}</span>
          <span id={descId} className="text-xs text-muted">
            {description}
          </span>
        </span>
      ) : (
        <span id={labelId}>{label}</span>
      )}
    </label>
  )
}
