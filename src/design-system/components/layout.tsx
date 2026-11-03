import type { ReactNode } from 'react'
import { AlertTriangle, Inbox } from 'lucide-react'
import { cn } from './cn'

// ---------------- Stat ----------------

export interface StatProps {
  value: ReactNode
  unit?: string
  label: ReactNode
  caption?: ReactNode
  /** 기본 'lg'(40px). md 30px, xl 44px — 앱 화면에서 어떤 숫자도 48px 이상이 되지 않게(2026-10-30, 앱 화면 규칙). 인포그래픽 캔버스는 CanvasBigNumber */
  size?: 'md' | 'lg' | 'xl'
  /** 강조 색(토큰 변수 등). 기본 text */
  color?: string
  className?: string
}

const STAT_SIZE = { md: 'text-[30px]', lg: 'text-[40px]', xl: 'text-[44px]' } as const

/** 큰 숫자(요약 카드). 대표(lg 40px)는 보조(md 30px)의 1.3배 이상 */
export function Stat({ value, unit, label, caption, size = 'lg', color, className }: StatProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <div className="text-sm font-semibold text-muted">{label}</div>
      <div className="flex items-baseline gap-1 tabular-nums" style={color ? { color } : undefined}>
        <span className={cn('font-extrabold leading-none tracking-tight', STAT_SIZE[size], !color && 'text-text')}>{value}</span>
        {unit && <span className={cn('font-bold', size === 'xl' ? 'text-2xl' : 'text-xl', !color && 'text-muted')}>{unit}</span>}
      </div>
      {caption && <div className="text-xs text-muted">{caption}</div>}
    </div>
  )
}

// ---------------- SectionHeader ----------------

export function SectionHeader({
  title,
  description,
  actions,
  level = 2,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** 1이면 페이지 제목(24px), 2면 섹션 제목(16px) */
  level?: 1 | 2
  className?: string
}) {
  const H = level === 1 ? 'h1' : 'h2'
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-4 gap-y-2', className)}>
      <div className="min-w-0">
        <H className={cn('text-text', level === 1 ? 'text-2xl font-bold tracking-tight' : 'text-base font-semibold')}>{title}</H>
        {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// ---------------- 상태 화면 ----------------

export function EmptyState({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center', className)}>
      <Inbox size={28} aria-hidden="true" className="text-muted" />
      <p className="text-sm font-semibold text-text">{title}</p>
      {description && <p className="max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-2 rounded-lg border border-negative/30 bg-negative/5 px-6 py-10 text-center', className)}>
      <AlertTriangle size={28} aria-hidden="true" className="text-negative" />
      <p className="text-sm font-semibold text-text">{title}</p>
      {description && <p className="max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Skeleton({ height = 16, className }: { height?: number | string; className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-surface-2', className)} style={{ height }} />
}

// ---------------- PageGrid ----------------

/**
 * 반응형 12열 격자. 자식은 col-span-* 클래스로 배치한다.
 * 예: <Card className="col-span-12 lg:col-span-8" />  (모바일은 col-span-12로 1열)
 */
export function PageGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-12 gap-3 md:gap-4 [&>*]:min-w-0', className)}>{children}</div>
}
