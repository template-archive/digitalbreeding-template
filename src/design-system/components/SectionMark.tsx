import type { ReactNode } from 'react'
import { cn } from './cn'

export interface SectionMarkProps {
  children: ReactNode
  className?: string
}

/** 섹션 시작 표식: 8px 사각형(반경 없음, 잉크색) + 짧은 라벨. 장식으로 반복하지 않고 구획의 시작에만 쓴다 */
export function SectionMark({ children, className }: SectionMarkProps) {
  return (
    <p className={cn('inline-flex items-center gap-2 text-xs font-medium text-muted', className)}>
      <span aria-hidden="true" className="size-2 shrink-0 bg-text" />
      {children}
    </p>
  )
}
