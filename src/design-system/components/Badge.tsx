import type { ReactNode } from 'react'
import { cn } from './cn'

export type BadgeTone = 'neutral' | 'positive' | 'negative' | 'warning' | 'info'

// Tailwind가 정적으로 찾을 수 있게 클래스 문자열을 풀어 쓴다.
// 색 톤 배경은 의미색 10%를 --badge-base에 섞는다. --badge-base가 없으면 transparent라 bg-{tone}/10과 같은 반투명 배경이고,
// 색이 깔린 컨테이너(DataTable highlight 행 등)는 --badge-base를 불투명 surface로 지정해 배경색과 겹쳐 대비가 떨어지지 않게 한다.
const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-muted border-border',
  positive: 'bg-[color-mix(in_srgb,var(--color-positive)_10%,var(--badge-base,transparent))] text-positive border-positive/30',
  negative: 'bg-[color-mix(in_srgb,var(--color-negative)_10%,var(--badge-base,transparent))] text-negative border-negative/30',
  warning: 'bg-[color-mix(in_srgb,var(--color-warning)_10%,var(--badge-base,transparent))] text-warning border-warning/30',
  info: 'bg-[color-mix(in_srgb,var(--color-info)_10%,var(--badge-base,transparent))] text-info border-info/30',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-xs font-medium leading-none',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
