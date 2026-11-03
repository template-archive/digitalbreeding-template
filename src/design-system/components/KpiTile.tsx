import { useContext, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { formatDelta, formatNumber } from '@/lib/format'
import { useContentWidth } from '../hooks/useContentWidth'
import { cn } from './cn'
import { KpiRowContext } from './kpiRowContext'
import { SeverityTag } from './SeverityTag'
import { Tooltip } from './Tooltip'

import { SEV_BAR, type KpiSeverity } from './severity'

export type { KpiSeverity }

/** 정상 범위 눈금. min~max 축 위에 lo~hi 구간을 음영으로, 현재 값을 세로 눈금으로 그린다 */
export interface KpiRange {
  min: number
  max: number
  lo: number
  hi: number
  /** 눈금 위치에 쓸 값. 생략하면 숫자 value를 쓴다 */
  value?: number
  /** 눈금 아래 설명. 예: '정상 범위 0.95–1.10' */
  label?: ReactNode
}

export interface KpiTileProps {
  /** 문자열이 아닌 노드(보조 설명이 섞인 제목 등)를 넘기면 plainLabel도 넘긴다 */
  label: ReactNode
  /** 접근성 이름(설명 버튼·달성 막대)에 쓰는 평문 라벨. 생략하면 label이 문자열일 때 그것을 쓴다 */
  plainLabel?: string
  value: number | string
  unit?: string
  /** 값 아래 보조 표기. 예: '12.8 kg/10a/년' */
  sub?: ReactNode
  /** 전기 대비 변화량. 단위는 deltaUnit(기본 '%'). null이면 비교 불가로 보고 '—'를 표시한다 */
  delta?: number | null
  /** 변화량 단위. 기본 '%'. 예: '%p', '년', '건', '' */
  deltaUnit?: string
  /** 변화량 소수 자릿수. 기본 1 */
  deltaDigits?: number
  /** 변화의 기준. 예: '전년 대비' */
  deltaLabel?: string
  /** 좋은 방향. 기본 'up' */
  better?: 'up' | 'down'
  /** 목표값(value와 같은 단위). 숫자 value일 때 달성률 막대를 그린다 */
  target?: number
  /** 목표 표기를 직접 지정. 기본 `목표 {target}{unit}` */
  targetLabel?: ReactNode
  /** 달성률(%)을 직접 지정. 문자열 value이거나 달성률 정의가 value/target이 아닐 때 쓴다(100 = 목표 달성) */
  achievement?: number
  /** 지정하면 달성률을 이 자릿수로 '달성률 98.7%' 형태로 표시한다. 생략하면 정수 %(달성 시 '달성') */
  achievementDigits?: number
  /** 달성 막대의 비율 이름. 기본 '달성률'. 접근성 이름 `{plainLabel} 목표 대비 {achievementLabel}`과 막대 아래 '{achievementLabel} 98.7%' 표기(achievementDigits·severity를 줄 때)에 쓴다. 예: '수급률' */
  achievementLabel?: string
  /**
   * 심각도. 달성 막대(target·achievement)가 있으면 막대를 심각도 색으로 칠하고 막대 아래 줄에 문자 태그(달성/주의/경보)를 붙인다.
   * 막대가 없으면 머리 줄에 문자 태그(아이콘 + 경보/주의)를 붙이고, 타일 테두리를 옅은 심각도 색(대비 약 1.3:1)으로 둔다(ok는 표시 없음). 2026-10-30
   */
  severity?: KpiSeverity
  /** 머리 오른쪽(기간 옆)에 놓는 상태 표시. 보통 <Badge> */
  badge?: ReactNode
  /** 정상 범위 눈금 */
  range?: KpiRange
  /**
   * @deprecated 2026-10-30부터 그리지 않는다(앱 화면 규칙: KPI 타일에 스파크라인을 두지 않는다). 받기는 하지만 무시한다.
   * 추세가 필요하면 템플릿의 자체 차트에 둔다. 목표 달성 막대(target·achievement)는 그대로다.
   */
  spark?: number[]
  /** 기준 기간. 예: '2026 하계' */
  period?: string
  info?: ReactNode
  /** 숫자 value 표기 소수 자릿수 */
  digits?: number
  /**
   * default: 기본(값 28/30px), compact: 좁은 열(값 28/30px·단위 16px), hero: 대표 지표(값 최대 40px, 라벨 14px 잉크색).
   * 어떤 값도 48px 이상이 되지 않는다. hero는 칸 폭에 맞춰 줄되 형제 값(28/30px)보다 작아지지 않고, 넓으면 형제의 1.3배 이상(40px)이다.
   * 대표 타일은 크기로만 구분한다(강조색 테두리·링 없음, 2026-10-30)
   */
  size?: 'default' | 'compact' | 'hero'
  className?: string
}


// 앱 화면 규칙(2026-10-30): 값은 48px 미만, 대표 값 = 형제의 1.3배 이상(40 ÷ 30). --kpi-sib은 대표 값이 줄어들 수 있는 하한(형제 값 크기)
const VALUE_SIZE = { default: 'text-[28px] sm:text-[30px]', compact: 'text-[28px] sm:text-[30px]', hero: 'text-[40px] [--kpi-sib:28px] sm:[--kpi-sib:30px]' } as const
/** 막대 없는 심각도 타일 테두리(warning·critical): 옅게(surface 대비 약 1.3:1). 심각도는 머리 줄 태그 + 아이콘이 말한다 */
// 불투명 color-mix(표면색 85%): 반투명(border-warning/15)과 같은 색이지만, 알파를 버리고 재는 검사(tasteskill heavy-borders)도 실제 대비로 잰다
const SEV_TILE: Partial<Record<KpiSeverity, string>> = {
  warning: 'border-[color-mix(in_oklab,var(--color-warning)_15%,var(--color-surface))]',
  critical: 'border-[color-mix(in_oklab,var(--color-negative)_15%,var(--color-surface))]',
}
/** 이 내용 폭(px) 미만이면 좁은 칸: 기간·배지·태그를 라벨 아래 줄로, 막대 아래 태그를 왼쪽 정렬로 */
const NARROW_PX = 240
/** hero 값 글자 크기 = clamp(형제 값, 내용 폭 × 이 비율, 40px)(390px 2열 칸에서 '145/412'가 타일 밖으로 나가지 않게) */
const HERO_FIT = 0.22
/** 대표 타일 내용 폭이 이 값(px) 이상이면 달성 막대를 값 오른쪽에(1440·768 KpiRow 2칸), 미만이면 값 아래(390 전체 폭) */
const HERO_SIDE_PX = 400
const UNIT_SIZE = { default: 'text-base sm:text-lg', compact: 'text-base', hero: 'text-lg sm:text-xl' } as const

export function KpiTile({
  label,
  plainLabel,
  value,
  unit,
  sub,
  delta,
  deltaUnit,
  deltaDigits,
  deltaLabel,
  better = 'up',
  target,
  targetLabel,
  achievement,
  achievementDigits,
  achievementLabel = '달성률',
  severity,
  badge,
  range,
  // spark: @deprecated — 받되 그리지 않는다
  period,
  info,
  digits,
  size = 'default',
  className,
}: KpiTileProps) {
  const hero = size === 'hero'
  const name = plainLabel ?? (typeof label === 'string' ? label : '')
  const fmt = (v: number) => formatNumber(v, digits !== undefined ? { digits } : {})
  const display = typeof value === 'number' ? fmt(value) : value

  // 변화량 — 표시 자릿수로 반올림해 0이면 '변화 없음'
  const dDigits = deltaDigits ?? 1
  const hasDelta = typeof delta === 'number'
  const good = !hasDelta || Number(Math.abs(delta).toFixed(dDigits)) === 0 ? null : delta > 0 === (better === 'up')
  const deltaTone = good === null ? 'text-muted' : good ? 'text-positive' : 'text-negative'

  // 달성률(%) — 직접 지정하거나 value/target으로 계산. better=down이면 목표/값
  let pct: number | null = null
  if (achievement !== undefined) pct = achievement
  else if (typeof value === 'number' && typeof target === 'number' && target !== 0) {
    const ratio = value / target
    pct = (better === 'up' ? ratio : 1 / ratio) * 100
  }
  const fill = pct === null ? 0 : Math.min(100, Math.max(0, pct))
  const reached = pct !== null && pct >= 100
  const tLabel = targetLabel ?? (target !== undefined ? `목표 ${fmt(target)}${unit ?? ''}` : null)
  const pctText = pct === null ? '' : achievementDigits !== undefined ? `${formatNumber(pct, { digits: achievementDigits })}%` : `${Math.round(fill)}%`
  // 달성 막대가 없으면 심각도를 머리 줄 태그 + 테두리로 보인다(목표 없는 지표의 경보·주의가 보통 타일과 똑같이 보이던 문제, H1)
  const headSev = severity && pct === null && severity !== 'ok' ? severity : null
  const { ref: boxRef, width } = useContentWidth()
  const narrow = width > 0 && width < NARROW_PX
  const heroCap = hero && width > 0 ? Math.round(width * HERO_FIT) : null
  // 넓은 대표 타일(KpiRow 2칸, 내용 폭 400px 이상)이고 형제 대부분이 바닥 막대가 없으면(KpiRow가 정함) 달성 막대를 값 오른쪽에 둔다.
  // 막대가 값 아래에 쌓이면 대표 타일만 막대 높이(약 36px)만큼 길어져, 같은 줄 형제 타일 아래에 빈 띠가 남았다(tasteskill panel-void, 2026-10-30)
  const row = useContext(KpiRowContext)
  const sideBar = hero && pct !== null && width >= HERO_SIDE_PX && row?.heroSideBar === true

  const achievementBlock = (cls: string) => (
    <div className={cn('flex flex-col gap-1', cls)}>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-surface-2"
        role="meter"
        aria-label={`${name} 목표 대비 ${achievementLabel}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill)}
        aria-valuetext={achievementDigits !== undefined ? pctText : `${Math.round(pct ?? 0)}%`}
      >
        <div className={cn('h-full rounded-full', severity ? SEV_BAR[severity] : reached ? 'bg-positive' : 'bg-accent')} style={{ width: `${fill}%` }} />
      </div>
      {achievementDigits !== undefined || severity ? (
        <div className={cn('flex flex-wrap items-center gap-1 text-xs tabular-nums', narrow ? 'justify-start gap-x-2' : 'justify-between')}>
          <span className="text-muted">
            {tLabel}
            {tLabel ? ' · ' : ''}
            {/* 기존 '달성률 ' 한 텍스트 노드와 같게(노드가 나뉘면 글자 배치가 1px 달라진다) */}
            {`${achievementLabel} `}
            <b className="font-semibold text-text">{pctText}</b>
          </span>
          {/* 작은 글자는 의미색 대비가 부족할 수 있어 글자는 text 색, 심각도 색은 아이콘·테두리·막대로 표시 */}
          {severity && <SeverityTag severity={severity} />}
        </div>
      ) : (
        <span className="text-xs text-muted tabular-nums">
          {tLabel}
          {tLabel ? ' · ' : ''}
          {reached ? '달성' : pctText}
        </span>
      )}
    </div>
  )

  const rangePos = (x: number) => (range ? `${((Math.min(range.max, Math.max(range.min, x)) - range.min) / (range.max - range.min)) * 100}%` : '0%')
  const rangeValue = range ? range.value ?? (typeof value === 'number' ? value : null) : null

  return (
    <div
      ref={boxRef}
      data-kpi-tile=""
      data-severity={headSev ?? undefined}
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-lg border bg-surface p-3 sm:p-4',
        headSev ? SEV_TILE[headSev] : 'border-border',
        className,
      )}
    >
      {/* 머리 줄: 좁은 칸이면 기간·배지·태그를 라벨 아래 줄로(라벨이 2줄을 넘지 않게). ⓘ는 라벨 글 끝에 붙는다 */}
      <div className={cn('flex gap-x-2 gap-y-1', narrow ? 'flex-col items-start' : 'items-start justify-between')}>
        <span className={cn('min-w-0 break-keep font-medium leading-snug', hero ? 'text-sm text-text' : 'text-[13px] text-muted')}>
          {label}
          {info && (
            <Tooltip content={info} className="ml-1 align-middle">
              <button type="button" aria-label={`${name} 설명`} className="touch-hit rounded-sm text-muted hover:text-text">
                <Info size={13} aria-hidden="true" />
              </button>
            </Tooltip>
          )}
        </span>
        {(period || badge || headSev) && (
          <div className={cn('flex items-center gap-x-2 gap-y-1', narrow ? 'flex-wrap' : 'shrink-0')}>
            {period && <span className="shrink-0 text-xs text-muted tabular-nums">{period}</span>}
            {badge}
            {headSev && <SeverityTag severity={headSev} />}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className={cn(sideBar && 'flex items-end gap-x-6')}>
          <div className={cn('flex flex-wrap items-baseline gap-x-1 tabular-nums', sideBar && 'shrink-0')}>
            <span
              className={cn('font-bold leading-none tracking-tight text-text', VALUE_SIZE[size])}
              style={heroCap !== null ? { fontSize: `clamp(var(--kpi-sib), ${heroCap}px, 40px)` } : undefined}
            >
              {display}
            </span>
            {unit && <span className={cn('font-semibold text-muted', UNIT_SIZE[size])}>{unit}</span>}
          </div>
          {sideBar && achievementBlock('min-w-0 flex-1')}
        </div>
        {sub && <div className="mt-1 text-xs text-muted tabular-nums">{sub}</div>}
      </div>

      {(delta !== undefined || deltaLabel) && (
        <div className="flex flex-wrap items-center gap-x-1.5 text-xs tabular-nums">
          {hasDelta && (
            <span className={cn('font-semibold', deltaTone)}>
              <span className="sr-only">{good === null ? '변화 없음' : good ? '개선' : '악화'} </span>
              {formatDelta(delta, { digits: dDigits, unit: deltaUnit ?? '%' })}
            </span>
          )}
          {delta === null && (
            <span className="font-semibold text-muted">
              <span className="sr-only">비교 불가 </span>—
            </span>
          )}
          {deltaLabel && <span className="text-muted">{deltaLabel}</span>}
        </div>
      )}

      {pct !== null && !sideBar && achievementBlock('mt-auto')}

      {range && (
        <div className={cn('flex flex-col gap-1', (pct === null || sideBar) && 'mt-auto')}>
          <div className="relative h-1.5 rounded-full bg-surface-2" aria-hidden="true">
            <div className="absolute inset-y-0 rounded-full bg-positive/30" style={{ left: rangePos(range.lo), right: `calc(100% - ${rangePos(range.hi)})` }} />
            {rangeValue !== null && (
              <div className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text" style={{ left: rangePos(rangeValue) }} />
            )}
          </div>
          {range.label && <span className="text-xs text-muted tabular-nums">{range.label}</span>}
        </div>
      )}
    </div>
  )
}
