import { ArrowDownToLine, ArrowUpToLine, Check, CircleCheck, Clock, PencilLine, RotateCcw, TriangleAlert } from 'lucide-react'
import { Badge } from '@/design-system'
import { BAND_LABEL, STATUS_LABEL, TARGET_SEEDS, type Band, type Derived, type F1Status } from '../data'

const I = 12

/** 행 미저장 표시(rga-scheduler 행 표시와 같은 규격: 연필 + 문자) */
export function UnsavedMark() {
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-[11px] font-semibold text-warning">
      <PencilLine size={11} aria-hidden="true" />
      미저장
    </span>
  )
}

/** 결실 판정 배지 — 색 + 아이콘 + 문자(색 없이도 구분) */
export function BandBadge({ band }: { band: Band }) {
  if (band === 'low')
    return (
      <Badge tone="warning">
        <ArrowDownToLine size={I} aria-hidden="true" />
        {BAND_LABEL.low}
      </Badge>
    )
  if (band === 'high')
    return (
      <Badge tone="negative">
        <ArrowUpToLine size={I} aria-hidden="true" />
        {BAND_LABEL.high}
      </Badge>
    )
  if (band === 'missing')
    return (
      <Badge tone="neutral">
        <PencilLine size={I} aria-hidden="true" />
        {BAND_LABEL.missing}
      </Badge>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      <Check size={I} aria-hidden="true" />
      {BAND_LABEL.normal}
    </span>
  )
}

/** F1 진위 배지. discard > 0이면 '확인(자식 n주 폐기)' */
export function StatusBadge({ status, discard = 0 }: { status: F1Status; discard?: number }) {
  if (status === 'suspect')
    return (
      <Badge tone="negative">
        <TriangleAlert size={I} aria-hidden="true" />
        {STATUS_LABEL.suspect}
      </Badge>
    )
  if (status === 'pending')
    return (
      <Badge tone="info">
        <Clock size={I} aria-hidden="true" />
        {STATUS_LABEL.pending}
      </Badge>
    )
  const badge = (
    <Badge tone="positive">
      <CircleCheck size={I} aria-hidden="true" />
      {STATUS_LABEL.confirmed}
    </Badge>
  )
  if (discard <= 0) return badge
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      {badge}
      <span className="whitespace-nowrap text-[11px] leading-none text-muted">(자식 {discard}주 폐기)</span>
    </span>
  )
}

export function recrossText(r: Derived): string | null {
  if (r.recross === 'suspect') return '자식 의심'
  if (r.recross === 'short') return `종자 부족 ${Math.round(r.eff)}/${TARGET_SEEDS}`
  if (r.recross === 'needInput') return '입력 필요'
  return null
}

/** 재교배 사유 배지 */
export function RecrossBadge({ row }: { row: Derived }) {
  const text = recrossText(row)
  if (!text) return <span className="text-xs text-muted">—</span>
  if (row.recross === 'needInput')
    return (
      <Badge tone="neutral">
        <PencilLine size={I} aria-hidden="true" />
        {text}
      </Badge>
    )
  return (
    <Badge tone={row.recross === 'suspect' ? 'negative' : 'warning'}>
      <RotateCcw size={I} aria-hidden="true" />
      {text}
    </Badge>
  )
}
