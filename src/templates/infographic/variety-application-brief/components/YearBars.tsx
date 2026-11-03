import { u } from '@/design-system'
import { CHECK, LINE, MET, TRIAL, f1, yearIndex } from '../data'
import { V_COLOR } from './style'

/**
 * 머리 오른쪽 도식: MET 연도별 쌀 수량(출원 계통 vs 대비 품종) 가로 막대 + 연도별 지수.
 * 막대는 0부터. 빗금은 흑백 인쇄 대비 구분. viewBox 단위 = 캔버스 논리 px.
 */
export const YEAR_W = 420
export const YEAR_H = 98
const X0 = 50
const X1 = 262
const MAX = 700
const ROW0 = 28
const ROW_H = 36
const BAR_H = 13
const px = (v: number) => X0 + (v / MAX) * (X1 - X0)
const C_COLOR = 'var(--viz-chr-b)'

export function YearBars() {
  const label = `MET 연도별 쌀 수량: ${TRIAL.years.map((y, i) => `${y}년 ${LINE.id} ${f1(MET.yearMeans[i]!)}, ${CHECK.name} ${f1(MET.checkYearMeans[i]!)} kg/10a, 지수 ${f1(yearIndex[i]!)}%`).join('. ')}`
  return (
    <svg viewBox={`0 0 ${YEAR_W} ${YEAR_H}`} role="img" aria-label={label} style={{ width: u(YEAR_W), height: u(YEAR_H), display: 'block' }}>
      <defs>
        <pattern id="vab-check-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" style={{ stroke: 'var(--color-surface)', strokeWidth: 2, strokeOpacity: 0.75 }} />
        </pattern>
      </defs>
      <text x={0} y={15} style={{ fill: 'var(--color-text)', fontSize: 16, fontWeight: 700 }}>
        연도별 쌀 수량
        <tspan dx={6} style={{ fill: 'var(--color-text-muted)', fontSize: 15, fontWeight: 400 }}>
          kg/10a · 막대 0부터
        </tspan>
      </text>
      <text x={YEAR_W} y={15} textAnchor="end" style={{ fill: 'var(--color-text-muted)', fontSize: 15 }}>
        지수
      </text>
      {TRIAL.years.map((y, i) => {
        const top = ROW0 + i * ROW_H
        const v = MET.yearMeans[i]!
        const c = MET.checkYearMeans[i]!
        return (
          <g key={y} className="tabular-nums">
            <text x={0} y={top + BAR_H + 2} dy="0.35em" style={{ fill: 'var(--color-text)', fontSize: 16, fontWeight: 700 }}>
              {y}
            </text>
            <rect x={X0} y={top} width={px(v) - X0} height={BAR_H} rx={2} style={{ fill: V_COLOR }} />
            <text x={px(v) + 6} y={top + BAR_H / 2} dy="0.35em" style={{ fill: V_COLOR, fontSize: 15, fontWeight: 700 }}>
              {f1(v)}
            </text>
            <rect x={X0} y={top + BAR_H + 3} width={px(c) - X0} height={BAR_H} rx={2} style={{ fill: C_COLOR }} />
            <rect x={X0} y={top + BAR_H + 3} width={px(c) - X0} height={BAR_H} rx={2} fill="url(#vab-check-hatch)" />
            <text x={px(c) + 6} y={top + BAR_H * 1.5 + 3} dy="0.35em" style={{ fill: 'var(--color-text-muted)', fontSize: 15 }}>
              {f1(c)}
              <tspan dx={5}>{CHECK.name}</tspan>
            </text>
            <text x={YEAR_W} y={top + BAR_H + 2} dy="0.35em" textAnchor="end" style={{ fill: V_COLOR, fontSize: 21, fontWeight: 800 }}>
              {f1(yearIndex[i]!)}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}
