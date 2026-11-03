import type { ReactNode } from 'react'
import { cn } from './cn'
import { Legend, type LegendItem } from './Legend'

export interface ChartCardProps {
  title: ReactNode
  subtitle?: ReactNode
  /** 출처·기준. 예: '출처: 2026 하계 시험포장(목업)' */
  source?: ReactNode
  actions?: ReactNode
  /** 차트 영역 높이(px) */
  height: number
  /** HTML 범례(선택) */
  legend?: LegendItem[]
  children: ReactNode
  className?: string
  headingLevel?: 2 | 3
}

/** 차트 + 제목·범례·출처. 차트 영역 높이를 고정해 0px 접힘을 막는다. */
export function ChartCard({ title, subtitle, source, actions, height, legend, children, className, headingLevel = 2 }: ChartCardProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <section className={cn('flex min-w-0 flex-col rounded-lg border border-border bg-surface p-4', className)}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <Heading className="text-[15px] font-semibold leading-snug text-text">{title}</Heading>
          {subtitle && <p className="mt-1 break-keep text-[13px] leading-relaxed text-muted wrap-break-word">{subtitle}</p>}
        </div>
        {/* 좁은 화면: 제목 줄에 안 맞으면 아래 줄로 내려가고, 그 줄에서도 넓으면 안쪽에서 줄을 바꾼다(shrink-0이면 카드 밖으로 넘쳤다, 2026-10-30) */}
        {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {legend && legend.length > 0 && <Legend items={legend} className="mb-2" />}
      <div className="min-w-0" style={{ height }}>
        {children}
      </div>
      {source && <p className="mt-3 break-keep text-xs leading-relaxed text-muted">{source}</p>}
    </section>
  )
}
