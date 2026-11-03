import type { ReactNode } from 'react'
import { cn } from './cn'

export interface CardProps {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  padding?: 'sm' | 'md' | 'lg'
  children?: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article'
  headingLevel?: 2 | 3
}

const PAD = { sm: 'p-3', md: 'p-4', lg: 'p-6' } as const

/** 기본 표면: 1px 경계, 그림자 없는 평면 */
export function Card({ title, subtitle, actions, padding = 'md', children, className, as: Tag = 'section', headingLevel = 2 }: CardProps) {
  const hasHeader = title || subtitle || actions
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <Tag className={cn('min-w-0 rounded-lg border border-border bg-surface', PAD[padding], className)}>
      {hasHeader && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            {title && <Heading className="text-[15px] font-semibold leading-snug text-text">{title}</Heading>}
            {subtitle && <p className="mt-1 break-keep text-[13px] leading-relaxed text-muted wrap-break-word">{subtitle}</p>}
          </div>
          {/* 좁은 화면: 제목 줄에 안 맞으면 아래 줄로 내려가고, 그 줄에서도 넓으면 안쪽에서 줄을 바꾼다(shrink-0이면 카드 밖으로 넘쳤다, 2026-10-30) */}
          {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </Tag>
  )
}
