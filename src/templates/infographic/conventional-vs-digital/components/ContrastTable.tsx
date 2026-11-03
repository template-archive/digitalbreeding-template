import { Fragment, type ReactNode } from 'react'
import { CanvasSectionTitle, u } from '@/design-system'
import { formatSigned } from '@/lib/format'
import {
  ANNUAL_COST_EOK,
  BASIS,
  COST_PCT,
  COST_PER_GAIN,
  COST_PER_GAIN_PCT,
  COST_PER_GAIN_REALIZED_PCT,
  COST_RATIO,
  CYCLE_SPEEDUP,
  DEV_SAVED,
  DEV_SAVED_PCT,
  DEV_YEARS,
  DG,
  DG_PCT,
  EVAL_LINES,
  EVAL_LINES_PCT,
  GAIN_RATIO,
  REALIZED_RATIO,
  I,
  I_PCT,
  L,
  L_SAVED,
  N_PLOTS,
  N_PLOTS_PCT,
  PER_LINE,
  P_PARENT,
  R,
  R_DELTA,
  R_PCT,
  SHORTEST_ACTUAL_YEARS,
  TRIAL_LINES,
  TRIAL_YEARS,
} from '../data'
import { CONV_FILL, DIGI_FILL, f1, f2, fmtI, int } from './shared'

type Direction = 'better' | 'neutral'

interface Row {
  no: string
  label: string
  unit: string
  conv: number
  convText: string
  convSub?: string
  dig: number
  digText: string
  digSub?: string
  /** 변화 배지 첫 줄(방향 글자 포함), 둘째 줄(보조) */
  change: [ReactNode, string?]
  direction: Direction
  hero?: boolean
}

interface Group {
  name: string
  rows: Row[]
}

const c = BASIS.conventional
const d = BASIS.digital
const pct = (p: number) => int(p * 100)

export const GROUPS: Group[] = [
  {
    name: '시간',
    rows: [
      {
        no: '1',
        label: '품종 개발 기간',
        unit: '년',
        conv: DEV_YEARS.conventional,
        convText: f1(DEV_YEARS.conventional),
        convSub: '교배 → 출원',
        dig: DEV_YEARS.digital,
        digText: f1(DEV_YEARS.digital),
        digSub: `설계값 · 실제 최단 ${SHORTEST_ACTUAL_YEARS}년`,
        change: [<><b>{f1(DEV_SAVED)}년 단축</b></>, `(${formatSigned(-DEV_SAVED_PCT, 1)}%)`],
        direction: 'better',
      },
      {
        no: '2',
        label: '세대 간격(L)',
        unit: '년',
        conv: L[c],
        convText: f1(L[c]),
        convSub: '포장 세대 진전',
        dig: L[d],
        digText: f1(L[d]),
        digSub: '속성세대진전',
        change: [<><b>{f1(L_SAVED)}년 단축</b></>, `순환 ${f2(CYCLE_SPEEDUP)}배`],
        direction: 'better',
      },
    ],
  },
  {
    name: '선발',
    rows: [
      {
        no: '3',
        label: '선발 정확도(r)',
        unit: '0~1',
        conv: R[c],
        convText: f2(R[c]),
        convSub: '표현형 선발',
        dig: R[d],
        digText: f2(R[d]),
        digSub: '유전체 예측(GBLUP)',
        change: [<><b>{formatSigned(R_DELTA, 2)} 향상</b></>, `(${formatSigned(R_PCT, 1)}%)`],
        direction: 'better',
      },
      {
        no: '4',
        label: '선발 강도(i)',
        unit: '무차원',
        conv: I[c],
        convText: fmtI(I[c]),
        convSub: `부모 상위 ${pct(P_PARENT[c])}%`,
        dig: I[d],
        digText: fmtI(I[d]),
        digSub: `부모 상위 ${pct(P_PARENT[d])}%`,
        change: [<><b>{formatSigned(I_PCT, 1)}% 향상</b></>],
        direction: 'better',
      },
      {
        no: '5',
        label: '사이클당 평가 계통 수',
        unit: '계통',
        conv: EVAL_LINES.conventional,
        convText: int(EVAL_LINES.conventional),
        convSub: '관찰 포장 표현형',
        dig: EVAL_LINES.digital,
        digText: int(EVAL_LINES.digital),
        digSub: '6K SNP 칩 GEBV',
        change: [<><b>{formatSigned(EVAL_LINES_PCT, 1)}% 증가</b></>],
        direction: 'better',
      },
    ],
  },
  {
    name: '규모·비용',
    rows: [
      {
        no: '6',
        label: '시험 규모',
        unit: '구 · 단계별 1세트 시험구',
        conv: N_PLOTS.conventional,
        convText: int(N_PLOTS.conventional),
        convSub: `${int(TRIAL_LINES.conventional)}계통 · 시험 ${int(TRIAL_YEARS.conventional)}년`,
        dig: N_PLOTS.digital,
        digText: int(N_PLOTS.digital),
        digSub: `${int(TRIAL_LINES.digital)}계통 · 시험 ${int(TRIAL_YEARS.digital)}년`,
        change: [<><b>{formatSigned(N_PLOTS_PCT, 1)}% 증가</b></>],
        direction: 'neutral',
      },
      {
        no: '7',
        label: '연간 직접비(추정)',
        unit: '억 원',
        conv: ANNUAL_COST_EOK.conventional,
        convText: f2(ANNUAL_COST_EOK.conventional),
        convSub: `계통당 선발 평가 ${f1(PER_LINE.conventional)}만 원`,
        dig: ANNUAL_COST_EOK.digital,
        digText: f2(ANNUAL_COST_EOK.digital),
        digSub: `계통당 선발 평가 ${f1(PER_LINE.digital)}만 원`,
        change: [<><b>{f2(COST_RATIO)}배 증가</b></>, `(${formatSigned(COST_PCT, 1)}%)`],
        direction: 'neutral',
      },
      {
        no: '8',
        label: '개량 1 kg/10a당 연간 직접비',
        unit: '만 원 · 추정 · 예측 ΔG 기준',
        conv: COST_PER_GAIN.conventional,
        convText: int(COST_PER_GAIN.conventional),
        dig: COST_PER_GAIN.digital,
        digText: int(COST_PER_GAIN.digital),
        change: [<><b>{f1(-COST_PER_GAIN_PCT)}% 감소(예측)</b></>, `실현 기준 ${f1(-COST_PER_GAIN_REALIZED_PCT)}% 감소`],
        direction: 'better',
      },
    ],
  },
  {
    name: '성과',
    rows: [
      {
        no: '9',
        label: '연간 유전적 개량량(ΔG)',
        unit: 'kg/10a/년',
        conv: DG.conventional,
        convText: f2(DG.conventional),
        convSub: `${f2(DG_PCT.conventional)}%/년`,
        dig: DG.digital,
        digText: f2(DG.digital),
        digSub: `${f2(DG_PCT.digital)}%/년`,
        change: [<><b>{f1(GAIN_RATIO)}배 향상<span style={{ fontSize: u(16) }}>(예측)</span></b></>, `실현 ${f1(REALIZED_RATIO)}배`],
        direction: 'better',
        hero: true,
      },
    ],
  },
]

// 열 너비(논리 px). 합 = 표 폭 1100
const COL = { no: 34, val: 126, track: 210, label: 228, badge: 166 } // 정리 회차 2: '(예측)'·실현 2줄 표기로 변화 칸 142 → 166
const GRID = `${COL.no}px ${COL.val}px ${COL.track}px ${COL.label}px ${COL.track}px ${COL.val}px ${COL.badge}px`
  .split(' ')
  .map(s => u(Number(s.replace('px', ''))))
  .join(' ')

/** 0 기준선(가운데 열 쪽 트랙 끝)에서 바깥으로 뻗는 막대. 같은 행 최대값 = 트랙 전체 */
function Track({ value, max, side, sub, hero }: { value: number; max: number; side: 'left' | 'right'; sub?: string; hero?: boolean }) {
  const w = (value / max) * 100
  const left = side === 'left'
  return (
    <div className="relative flex h-full flex-col justify-center" style={{ gap: u(5) }}>
      <div className="relative" style={{ height: u(hero ? 26 : 18) }}>
        <div
          aria-hidden
          className="absolute inset-y-0"
          style={{
            [left ? 'right' : 'left']: 0,
            width: `${w}%`,
            background: left ? CONV_FILL : DIGI_FILL,
            borderRadius: left ? `${u(3)} 0 0 ${u(3)}` : `0 ${u(3)} ${u(3)} 0`,
            boxShadow: left ? 'inset 0 0 0 1px color-mix(in oklab, var(--color-text-muted) 55%, transparent)' : undefined,
          }}
        />
      </div>
      {sub && (
        <p className={`whitespace-nowrap text-muted ${left ? 'text-right' : 'text-left'}`} style={{ fontSize: u(17), lineHeight: 1.1 }}>
          {sub}
        </p>
      )}
    </div>
  )
}

function ChangeBadge({ row }: { row: Row }) {
  const tone =
    row.hero
      ? 'border-accent bg-accent text-accent-contrast'
      : row.direction === 'better'
        ? 'border-positive/40 bg-positive/10 text-positive'
        : 'border-border bg-surface-2 text-text'
  return (
    <div className={`flex flex-col justify-center border text-center leading-tight ${tone}`} style={{ borderRadius: u(6), padding: `${u(4)} ${u(8)}`, fontSize: u(row.hero ? 22 : 17), borderWidth: u(1.5) }}>
      <span className="whitespace-nowrap">{row.change[0]}</span>
      {row.change[1] && <span className="whitespace-nowrap" style={{ fontSize: u(16) }}>{row.change[1]}</span>}
    </div>
  )
}

function RowView({ row }: { row: Row }) {
  const max = Math.max(row.conv, row.dig)
  const valSize = row.hero ? 34 : 25
  return (
    <div
     
      className={`grid items-center ${row.hero ? 'border-accent bg-accent/5' : 'border-transparent'} border`}
      style={{
        gridTemplateColumns: GRID,
        flex: row.hero ? '1.45 1 0' : '1 1 0',
        minHeight: 0,
        borderWidth: u(2),
        borderRadius: u(8),
        marginInline: u(-2),
      }}
    >
      <span className="flex justify-center">
        <span
          className={`inline-flex items-center justify-center border font-bold tabular-nums ${row.hero ? 'border-accent text-accent' : 'border-muted text-muted'}`}
          style={{ width: u(26), height: u(26), borderRadius: '50%', fontSize: u(16), borderWidth: u(1.5) }}
        >
          {row.no}
        </span>
      </span>
      <span className="text-right font-bold tabular-nums text-text" style={{ fontSize: u(valSize), paddingRight: u(12), lineHeight: 1 }}>
        <span className="sr-only">전통 </span>
        {row.convText}
      </span>
      <div className="h-full" style={{ paddingRight: u(2) }}>
        <Track value={row.conv} max={max} side="left" sub={row.convSub} hero={row.hero} />
      </div>
      <div className="flex h-full flex-col items-center justify-center border-x border-border text-center" style={{ borderInlineWidth: u(2), padding: `0 ${u(8)}` }}>
        <span className="font-bold text-text" style={{ fontSize: u(row.hero ? 21 : 18), lineHeight: 1.15 }}>
          {row.label}
        </span>
        <span className="text-muted" style={{ fontSize: u(16), lineHeight: 1.2 }}>
          {row.unit}
        </span>
      </div>
      <div className="h-full" style={{ paddingLeft: u(2) }}>
        <Track value={row.dig} max={max} side="right" sub={row.digSub} hero={row.hero} />
      </div>
      <span className="font-extrabold tabular-nums" style={{ fontSize: u(valSize), paddingLeft: u(12), lineHeight: 1, color: 'var(--color-accent)' }}>
        <span className="sr-only">디지털 </span>
        {row.digText}
      </span>
      <div style={{ paddingLeft: u(6) }}>
        <ChangeBadge row={row} />
      </div>
    </div>
  )
}

export function ContrastTable() {
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="지표별 대비">
      <CanvasSectionTitle
        title="지표별 대비"
        sub={<span style={{ fontSize: u(16) }}>막대 길이는 같은 행 안에서만 비교합니다(행마다 단위가 다름)</span>}
        gapBelow={6}
      />
      {/* 열 머리 */}
      <div className="grid items-end border-b border-border text-muted" style={{ gridTemplateColumns: GRID, borderBottomWidth: u(1.5), paddingBottom: u(4), fontSize: u(16) }}>
        <span />
        <span className="col-span-2 text-right font-bold text-text" style={{ fontSize: u(18) }}>
          ◀ 전통 {c}
        </span>
        <span className="text-center">지표 · 단위</span>
        <span className="col-span-2 font-bold" style={{ fontSize: u(18), color: 'var(--color-accent)' }}>
          디지털 {d} ▶
        </span>
        <span className="text-center">변화</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {GROUPS.map(g => (
          <Fragment key={g.name}>
            <div className="flex items-center" style={{ height: u(26), marginTop: u(4), gap: u(10) }}>
              <span className="font-extrabold text-text" style={{ fontSize: u(17), letterSpacing: '0.02em' }}>
                {g.name}
              </span>
              <span aria-hidden className="flex-1 border-t border-dashed border-border" style={{ borderTopWidth: u(1.5) }} />
            </div>
            {g.rows.map(r => (
              <RowView key={r.no} row={r} />
            ))}
          </Fragment>
        ))}
      </div>
    </section>
  )
}
