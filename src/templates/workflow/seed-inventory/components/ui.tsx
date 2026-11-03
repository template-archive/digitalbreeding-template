import type { ReactNode } from 'react'
import { AlertTriangle, Ban, CircleAlert, Clock, Dna, FlaskConical, GitMerge, MapPinned, PackageCheck, Send, Sprout, Undo2 } from 'lucide-react'
import { Badge, type BadgeTone } from '@/design-system'
import { formatFixed, formatNumber } from '@/lib/format'
import {
  AS_OF,
  CAT_LABEL,
  GERM_LABEL,
  LOT_STATUS_LABEL,
  REQ_STATUS_LABEL,
  daysBetween,
  gDigits,
  tableDate,
  toGrains,
  type BlockCode,
  type Cat,
  type GermInfo,
  type ItemEval,
  type LotStatus,
  type ReqStatus,
  type Unit,
  type Use,
  type WarnCode,
  WARN_LABEL,
  USE_MARGIN_DAYS,
} from '../data'

// ---------------------------------------------------------------- 숫자

/** 재고 g 표기(100 g 이상 정수, 미만 소수 1자리) */
export const fmtG = (g: number) => formatFixed(g, g === 0 ? 0 : gDigits(g))
/** 1 g 미만 환산량(시료 립 → g) */
export const fmtSmallG = (g: number) => (Math.abs(g) < 1 ? formatFixed(g, 2) : fmtG(g))
export const fmtQty = (v: number, unit: Unit) => (unit === 'g' ? `${fmtG(v)} g` : `${formatNumber(Math.round(v))}립`)
export const fmtKg = (g: number) => formatFixed(g / 1000, 1)
export const fmtGrains = (g: number, tgw: number) => `약 ${formatNumber(toGrains(g, tgw))}립`

/** 요청량 g 표기: g 요청은 입력한 정수 그대로, 립 요청은 환산 g */
export const reqG = (e: ItemEval) => (e.item.unit === 'g' ? formatNumber(e.item.qty) : fmtSmallG(e.need ?? 0))

// ---------------------------------------------------------------- 배지

const USE_ICON: Record<Use, typeof GitMerge> = {
  교배: GitMerge,
  'MET 파종': MapPinned,
  'AYT 파종': Sprout,
  '외부 분양': Send,
  '유전체 분석 시료': Dna,
}
const USE_TONE: Record<Use, BadgeTone> = {
  교배: 'info',
  'MET 파종': 'neutral',
  'AYT 파종': 'neutral',
  '외부 분양': 'warning',
  '유전체 분석 시료': 'neutral',
}
export function UseBadge({ use }: { use: Use }) {
  const Icon = USE_ICON[use]
  return (
    <Badge tone={USE_TONE[use]}>
      <Icon size={11} aria-hidden="true" />
      {use}
    </Badge>
  )
}

const REQ_TONE: Record<ReqStatus, BadgeTone> = {
  pending: 'warning',
  approved: 'info',
  shipped: 'positive',
  rejected: 'neutral',
}
const REQ_ICON: Record<ReqStatus, typeof Clock> = {
  pending: Clock,
  approved: PackageCheck,
  shipped: Send,
  rejected: Undo2,
}
export function ReqStatusBadge({ status }: { status: ReqStatus }) {
  const Icon = REQ_ICON[status]
  return (
    <Badge tone={REQ_TONE[status]}>
      <Icon size={11} aria-hidden="true" />
      {REQ_STATUS_LABEL[status]}
    </Badge>
  )
}

const LOT_TONE: Record<LotStatus, BadgeTone> = {
  ok: 'positive',
  fail: 'negative',
  empty: 'negative',
  hold: 'warning',
  awaiting: 'neutral',
}
export function LotStatusBadge({ status }: { status: LotStatus }) {
  return <Badge tone={LOT_TONE[status]}>{LOT_STATUS_LABEL[status]}</Badge>
}

export function CatBadge({ cat }: { cat: Cat }) {
  return <Badge tone={cat === 'check' || cat === 'cand' ? 'info' : 'neutral'}>{CAT_LABEL[cat]}</Badge>
}

/** 발아: %·판정 배지·판정일. stacked = 표의 오른쪽 정렬 숫자 열(세로 쌓기·끝 정렬) */
export function GermCell({ germ, stacked }: { germ: GermInfo; stacked?: boolean }) {
  if (germ.state === 'exempt') return <span className="text-muted">검사 제외</span>
  if (germ.state === 'testing')
    return (
      <span className={`inline-flex ${stacked ? 'flex-col items-end gap-0.5' : 'flex-wrap items-center gap-1'}`}>
        <Badge tone="info">
          <FlaskConical size={11} aria-hidden="true" />
          검사 중
        </Badge>
        {germ.expect && <span className="whitespace-nowrap text-[11px] text-muted">{tableDate(germ.expect)} 판정 예정</span>}
      </span>
    )
  const tone: BadgeTone = germ.state === 'pass' ? 'positive' : germ.state === 'caution' ? 'warning' : 'negative'
  return (
    <span className={`inline-flex ${stacked ? 'flex-col items-end gap-0.5' : 'flex-wrap items-center gap-1'}`}>
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <span className="font-semibold tabular-nums">{germ.last?.germ}%</span>
        <Badge tone={tone}>{GERM_LABEL[germ.state]}</Badge>
      </span>
      {germ.last && <span className="whitespace-nowrap text-[11px] text-muted tabular-nums">{stacked ? `${tableDate(germ.last.resultDate)} 판정` : tableDate(germ.last.resultDate)}</span>}
    </span>
  )
}

/** 재검사 기한 배지(지남·30일 이내) */
export function DueCell({ germ, alignEnd }: { germ: GermInfo; alignEnd?: boolean }) {
  if (germ.state === 'fail') return <span className="text-xs text-muted">재증식 필요</span>
  if (!germ.due) return <span className="text-muted">—</span>
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${alignEnd ? 'justify-end' : ''}`}>
      <span className="tabular-nums">{tableDate(germ.due)}</span>
      {germ.dueState === 'overdue' && (
        <Badge tone="negative">
          <CircleAlert size={11} aria-hidden="true" />
          지남 {daysBetween(germ.due, AS_OF)}일
        </Badge>
      )}
      {germ.dueState === 'soon' && (
        <Badge tone="warning">
          <Clock size={11} aria-hidden="true" />
          {daysBetween(AS_OF, germ.due)}일 남음
        </Badge>
      )}
    </span>
  )
}

/** 최소 보유량 대비 작은 막대(장식). 값은 옆 글자가 말한다 */
export function StockBar({ value, min, alarm, className = 'mt-1 w-16' }: { value: number; min: number; alarm: boolean; className?: string }) {
  const pct = Math.max(0, Math.min(1, value / min)) * 100
  return (
    <span aria-hidden="true" className={`relative block h-1.5 shrink-0 overflow-hidden rounded-full bg-surface-2 ${className}`}>
      <span className={`absolute inset-y-0 left-0 rounded-full ${alarm ? 'bg-negative' : 'bg-accent/60'}`} style={{ width: `${pct}%` }} />
    </span>
  )
}

// ---------------------------------------------------------------- 점검 문구

export function blockText(code: BlockCode, e: ItemEval): string {
  const lot = e.lot
  switch (code) {
    case 'short':
      return `재고 부족 ${fmtG(lot?.bal ?? 0)} / ${reqG(e)} g`
    case 'fail':
      return `발아 불합격 ${lot?.germ.last?.germ ?? ''}% — 재증식 필요`
    case 'none':
      return '사용 가능 로트 없음'
    case 'unreleased':
      return '출원 전 계통 — 외부 분양 불가'
    case 'invalidQty':
      return '요청량은 1 이상의 정수'
  }
}
/** 날짜(YYYY-MM-DD)는 하이픈에서 줄이 갈리지 않게 한 단위로 묶는다(배지 문장 자체는 줄바꿈). 390px "2027-|03-16" 방지 */
function DateUnit({ d }: { d: string | undefined }) {
  return <span className="whitespace-nowrap tabular-nums">{d ?? ''}</span>
}

export function warnText(code: WarnCode, e: ItemEval): ReactNode {
  const g = e.lot?.germ
  switch (code) {
    case 'caution':
      return `발아 주의 ${g?.last?.germ ?? ''}%`
    case 'overdue':
      return (
        <>
          재검사 기한 지남(<DateUnit d={g?.due} />)
        </>
      )
    case 'untested':
      return '발아 검사 전'
    case 'failDna':
      return '발아 불합격(시료 용도 허용)'
    case 'belowMinAfter':
      return '출고 후 최소 보유량 미달'
    case 'dueBeforeUse':
      return (
        <>
          {WARN_LABEL.dueBeforeUse}: 재검사 기한 <DateUnit d={g?.due} /> — 필요일 <DateUnit d={e.reqNeed} /> 뒤 {USE_MARGIN_DAYS}일 안에 끝남 · 출고 전 발아 재검사 권장
        </>
      )
  }
}

export function CheckBadges({ e }: { e: ItemEval }) {
  const parts: ReactNode[] = []
  for (const b of e.blocks)
    parts.push(
      <Badge key={`b-${b}`} tone="negative" className="max-w-full items-start leading-snug">
        <Ban size={11} aria-hidden="true" className="mt-px shrink-0" />
        <span className="min-w-0 whitespace-normal">차단 · {blockText(b, e)}</span>
      </Badge>,
    )
  for (const w of e.warns)
    parts.push(
      <Badge key={`w-${w}`} tone="warning" className="max-w-full items-start leading-snug">
        <AlertTriangle size={11} aria-hidden="true" className="mt-px shrink-0" />
        <span className="min-w-0 whitespace-normal">주의 · {warnText(w, e)}</span>
      </Badge>,
    )
  if (!parts.length) return <span className="text-xs text-positive">점검 통과</span>
  return <span className="flex min-w-0 flex-wrap gap-1">{parts}</span>
}
