import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from './cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 기본 'secondary' */
  variant?: ButtonVariant
  /** 기본 'md'(높이 36px). 'sm'은 표 안·필터 옆(높이 28px). 좁은 화면·터치에서는 실제 높이·너비 최소 44px */
  size?: ButtonSize
  /** 글자 앞 아이콘. lucide 아이콘이면 aria-hidden을 붙여 넘긴다. 아이콘만 있는 버튼은 aria-label 필수 */
  icon?: ReactNode
  children?: ReactNode
}

const VARIANT: Record<ButtonVariant, string> = {
  // 주 버튼은 거의 검정 채움(라이트 #1d1f20 + 흰 글자, 다크 흰 채움 + 검정 글자). 강조색은 데이터·선택 표시에만(앱 화면 규칙, 2026-10-30)
  primary: 'bg-primary text-primary-contrast border-primary hover:opacity-90',
  secondary: 'bg-surface text-text border-border hover:bg-surface-2',
  ghost: 'bg-transparent text-muted border-transparent hover:bg-surface-2 hover:text-text',
  danger: 'bg-surface text-negative border-negative/40 hover:bg-negative/10',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-7 px-2 text-xs',
  md: 'h-9 px-3.5 text-[13px]',
}

/**
 * 업무 화면용 버튼. type 기본값은 'button'(폼 안에서 의도치 않은 제출 방지).
 * 좁은 화면(< 640px)·터치에서는 실제 크기를 44px 이상으로 넓혀 이웃 컨트롤의 누르는 영역과 겹치지 않게 한다.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'secondary', size = 'md', icon, type = 'button', className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 touch:min-h-11 touch:min-w-11',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
})
