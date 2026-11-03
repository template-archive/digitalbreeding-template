import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Check, CircleDashed, CircleSlash, PauseCircle, PencilLine } from 'lucide-react'
import { Badge, Segmented, type BadgeTone } from '@/design-system'
import { formatFixed, formatSigned } from '@/lib/format'
import {
  BASIS_LABEL,
  GEBV_RESCUE,
  LIMITS,
  REC_LABEL,
  TRAIT_LABEL,
  Y_HOLD,
  Y_PROMOTE,
  type Decision,
  type Line,
  type Rec,
  type Trait,
} from '../data'

// ---------------------------------------------------------------- 숫자

export const f1 = (v: number) => formatFixed(v, 1)
export const f2 = (v: number) => formatFixed(v, 2)
export const fGebv = (v: number) => formatSigned(v, 1)

/** 형질 표시값 글자(단위 포함 여부 선택) */
export function traitText(l: Line, t: Trait, unit = false): string {
  switch (t) {
    case 'heading':
      return `${l.d.heading}${unit ? '일' : ''}`
    case 'culm':
      return `${l.d.culm}${unit ? ' cm' : ''}`
    case 'blast':
      return f1(l.d.blast)
    case 'taste':
      return f1(l.d.taste)
  }
}
export function limitText(t: Trait, unit = false): string {
  switch (t) {
    case 'heading':
      return `${LIMITS.heading}${unit ? '일' : ''}`
    case 'culm':
      return `${LIMITS.culm}${unit ? ' cm' : ''}`
    case 'blast':
      return f1(LIMITS.blast)
    case 'taste':
      return f1(LIMITS.taste)
  }
}
/** "밥맛 67.4 < 68.0" / "출수기 124일 > 122일" */
export const violText = (l: Line, t: Trait) => `${TRAIT_LABEL[t]} ${traitText(l, t, true)} ${t === 'taste' ? '<' : '>'} ${limitText(t, true)}`

/** 자동 판정 근거 문장(상세 머리) */
export function basisSentence(l: Line): string {
  switch (l.basis) {
    case 'violation':
      return `${BASIS_LABEL.violation} — ${l.viol.map(t => violText(l, t)).join(' · ')}`
    case 'yield':
      return `${BASIS_LABEL.yield} ${f1(l.d.idx)} ≥ ${f1(Y_PROMOTE)}`
    case 'rescue':
      return `${BASIS_LABEL.rescue} — 지수 ${f1(l.d.idx)}(보류 구간)이지만 수량 GEBV ${fGebv(l.gebv)} ≥ ${fGebv(GEBV_RESCUE)}`
    case 'border':
      return `${BASIS_LABEL.border} — 지수 ${f1(l.d.idx)}(${f1(Y_HOLD)}~${f1(Y_PROMOTE - 0.1)}), 수량 GEBV ${fGebv(l.gebv)} < ${fGebv(GEBV_RESCUE)}`
    case 'short':
      return `${BASIS_LABEL.short} — 지수 ${f1(l.d.idx)} < ${f1(Y_HOLD)}`
    default:
      return '대비 품종'
  }
}

/** 자동 판정 근거 짧은 글(오류 문구·툴팁) */
export function recDetail(l: Line): string {
  switch (l.basis) {
    case 'violation':
      return l.viol.map(t => violText(l, t)).join(' · ')
    case 'short':
      return `수량 지수 ${f1(l.d.idx)} < ${f1(Y_HOLD)}`
    case 'rescue':
      return `GEBV 보완 ${fGebv(l.gebv)}`
    default:
      return `수량 지수 ${f1(l.d.idx)}`
  }
}
/** "탈락 권고 · 밥맛 67.4 < 68.0" */
export const recShort = (l: Line) => (l.rec ? `${REC_LABEL[l.rec]} 권고 · ${recDetail(l)}` : '대비 품종')
/** "탈락 권고(밥맛 67.4 < 68.0)" */
export const recParen = (l: Line) => (l.rec ? `${REC_LABEL[l.rec]} 권고(${recDetail(l)})` : '대비 품종')

// ---------------------------------------------------------------- 배지

export const REC_TONE: Record<Rec, BadgeTone> = { promote: 'positive', hold: 'warning', drop: 'negative' }
const REC_ICON = { promote: ArrowUpRight, hold: PauseCircle, drop: CircleSlash } as const
/** 판정 색 토큰 클래스(글자) */
export const REC_TEXT: Record<Rec, string> = { promote: 'text-positive', hold: 'text-warning', drop: 'text-negative' }
export const REC_BG: Record<Rec, string> = { promote: 'bg-positive', hold: 'bg-warning', drop: 'bg-negative' }

export function RecBadge({ rec, suffix = '', compact = false }: { rec: Rec | null; suffix?: string; compact?: boolean }) {
  if (!rec) return <Badge tone="info">대비</Badge>
  const Icon = REC_ICON[rec]
  return (
    <Badge tone={REC_TONE[rec]}>
      {!compact && <Icon size={11} aria-hidden="true" />}
      {REC_LABEL[rec]}
      {suffix}
    </Badge>
  )
}

/** 행 미저장 표시(rga-scheduler 행 표시와 같은 규격: 연필 + 문자). 색만으로 알리지 않는다 */
export function UnsavedMark() {
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-[11px] font-semibold text-warning">
      <PencilLine size={11} aria-hidden="true" />
      미저장
    </span>
  )
}

/**
 * 결정 배지. 사람이 정한 결정은 채운 배지 + 체크, 자동 판정(RecBadge)은 연한 배지라 나란한 두 열이 같은 말로 보이지 않는다(검토 A1).
 * 글자색은 표면색이라 라이트(흰 글자)·다크(어두운 글자) 모두 채움 위 대비 4.5:1 이상이다.
 */
export function DecisionBadge({ decision, dirty, differ, compact = false }: { decision: Decision | null; dirty?: boolean; differ?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      {decision ? (
        <span data-decision={decision} className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-[3px] text-xs font-semibold leading-none text-surface ${REC_BG[decision]}`}>
          <Check size={11} strokeWidth={3} aria-hidden="true" />
          {REC_LABEL[decision]}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs text-muted">
          {!compact && <CircleDashed size={11} aria-hidden="true" />}
          미결정
        </span>
      )}
      {differ && <span className="text-[11px] font-semibold text-text">다름</span>}
      {dirty && <UnsavedMark />}
    </span>
  )
}

// ---------------------------------------------------------------- 형질 셀

/** 한계 위반(negative 굵게 + 값 앞 '!')·경계(점선 밑줄) 표시. ▲▼는 증감 전용이라 위반 방향은 열 머리의 한계와 낭독 문구로 전한다(visual-language 「기호와 심각도」) */
export function TraitValue({ l, t, children }: { l: Line; t: Trait; children?: ReactNode }) {
  const text = children ?? traitText(l, t)
  if (l.viol.includes(t))
    return (
      <span className="font-bold text-negative">
        {/* 값과 붙으면 '!6.0'이 '16.0'처럼 읽혀 간격을 둔다 */}
        <span aria-hidden="true" className="mr-1">!</span>
        {text}
        <span className="sr-only"> (한계 {t === 'taste' ? '미달' : '초과'})</span>
      </span>
    )
  if (l.border.includes(t))
    return (
      <span title="한계와 같음(통과)" className="underline decoration-muted decoration-dotted underline-offset-[3px]">
        {text}
        <span className="sr-only"> (한계와 같음, 통과)</span>
      </span>
    )
  return <>{text}</>
}

// ---------------------------------------------------------------- 결정 토글(공통 Segmented: 옵션별 data 속성·미선택 허용)

const DECISION_OPTIONS: { value: Decision; label: string }[] = [
  { value: 'promote', label: '진급' },
  { value: 'hold', label: '보류' },
  { value: 'drop', label: '탈락' },
]

export function DecisionSegmented({ value, onChange, ariaLabel, rec }: { value: Decision | null; onChange: (v: Decision) => void; ariaLabel: string; rec: Rec | null }) {
  return (
    <Segmented<Decision>
      ariaLabel={ariaLabel}
      value={value}
      onChange={onChange}
      optionClassName="inline-flex min-h-8 items-center gap-1"
      options={DECISION_OPTIONS.map(o => ({
        value: o.value,
        data: { 'data-decision-option': o.value },
        label: (
          <>
            {o.value === value && <span aria-hidden="true" className={`size-2 rounded-full ${REC_BG[o.value]}`} />}
            {o.label}
            {rec === o.value && <span className="text-[11px] font-normal text-muted">(권고)</span>}
          </>
        ),
      }))}
    />
  )
}

export const TrendIcon = { up: ArrowUpRight, down: ArrowDownRight }
