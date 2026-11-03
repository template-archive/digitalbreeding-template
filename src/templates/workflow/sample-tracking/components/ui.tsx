import type { ReactNode } from 'react'
import { AlertOctagon, Clock } from 'lucide-react'
import { Badge } from '@/design-system'
import type { Platform } from '../data'

/** 플랫폼 색(범주 팔레트 토큰) */
export const PLATFORM_COLOR: Record<Platform, string> = {
  KASP: 'var(--viz-cat-1)',
  GBS: 'var(--viz-cat-3)',
  '6K': 'var(--viz-cat-2)',
}

/** 플랫폼 표식: 색 점 + 이름(색만으로 구분하지 않는다) */
export function PlatformTag({ platform, className }: { platform: Platform; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-sm border border-border bg-surface px-1.5 py-0.5 text-[11px] font-semibold leading-none text-text ${className ?? ''}`}>
      <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ background: PLATFORM_COLOR[platform] }} />
      {platform}
    </span>
  )
}

export function DelayBadge({ days }: { days: number }) {
  return (
    <Badge tone="warning">
      <Clock size={11} aria-hidden="true" />
      지연 +{days}일
    </Badge>
  )
}

export function PlateAlertBadge({ compact }: { compact?: boolean }) {
  return (
    <Badge tone="negative">
      <AlertOctagon size={11} aria-hidden="true" />
      {compact ? '경보' : '플레이트 경보'}
    </Badge>
  )
}

/** 라벨 : 값 한 줄 */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[11px] font-medium text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-[13px] text-text">{children}</dd>
    </div>
  )
}
