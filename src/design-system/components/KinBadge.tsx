import { AlertTriangle, Check, CircleAlert } from 'lucide-react'
import { KIN_LEVEL_LABEL, type KinLevel } from '@/lib/genomics'
import { Badge, type BadgeTone } from './Badge'

// 근연 등급 색·아이콘. cross-planner 행렬 셀·범례·경고 요약이 같은 아이콘(강한 근연 AlertTriangle, 근연 주의 CircleAlert)을 쓴다
const KIN_TONE: Record<KinLevel, BadgeTone> = { ok: 'positive', caution: 'warning', warn: 'negative' }
const KIN_ICON = { ok: Check, caution: CircleAlert, warn: AlertTriangle } as const

export interface KinBadgeProps {
  /** 근연 등급. 공조계수에서 구할 때는 `kinLevel(f)`(@/lib/genomics) */
  level: KinLevel
  className?: string
}

/** 근연 등급 배지(공조계수 f 기준, 색 + 아이콘 + 문자). 정상 / 근연 주의 / 강한 근연 */
export function KinBadge({ level, className }: KinBadgeProps) {
  const Icon = KIN_ICON[level]
  return (
    <Badge tone={KIN_TONE[level]} className={className}>
      <Icon size={12} aria-hidden="true" />
      {KIN_LEVEL_LABEL[level]}
    </Badge>
  )
}
