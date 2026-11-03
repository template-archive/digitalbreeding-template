import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Badge } from '@/design-system'
import { isDesirable, type Trait } from '../data'

/** 변화 방향 판정 배지: 색 + 문자("바람직"/"비바람직"), 색만으로 구분하지 않는다 */
export function DirectionBadge({ trait, value, selection }: { trait: Trait; value: number; selection?: boolean }) {
  const ok = isDesirable(trait, value)
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight
  return (
    <Badge tone={ok ? 'positive' : 'warning'}>
      <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-text">
        <Icon size={12} aria-hidden="true" className={ok ? 'text-positive' : 'text-warning'} />
        {ok ? '바람직' : '비바람직'}
        {selection ? ' · 선발 형질' : ''}
      </span>
    </Badge>
  )
}
