import { BC6_THEORY, GENS, f1, jitter } from '../data'
import { HERO_COLOR } from './style'

/**
 * 세대별 반복친 게놈 회복률 점 그래프(정적 SVG, y 60~100%).
 * 작은 점 = 6K 분석 개체, 짧은 가로선 = 평균, ◆ = 선발 개체, ◇ = 이론값, 점선 = 기존 BC6 이론.
 * viewBox 단위 = 캔버스 논리 px.
 */
export const DOTS_W = 568
export const DOTS_H = 244
const M = { l: 58, r: 34, t: 30, b: 46 }
const Y0 = 60
const Y1 = 100
const PW = DOTS_W - M.l - M.r
const PH = DOTS_H - M.t - M.b
const y = (v: number) => M.t + ((Y1 - v) / (Y1 - Y0)) * PH
const band = PW / GENS.length
const cx = (i: number) => M.l + band * (i + 0.5)
const diamond = (x: number, yy: number, r: number) => `M ${x} ${yy - r} L ${x + r} ${yy} L ${x} ${yy + r} L ${x - r} ${yy} Z`

const TXT = { fill: 'var(--color-text)', fontSize: 16 }
const MUTED = { fill: 'var(--color-text-muted)', fontSize: 16 }
/** 기준 점선 위 값 라벨: 바탕색 후광으로 점선이 숫자를 가르지 않게 한다 */
const HALO = { stroke: 'var(--color-bg)', strokeWidth: 5, strokeLinejoin: 'round', paintOrder: 'stroke' } as const
const DOT_OFF = -band * 0.14 // 개체 점 무리 중심
const SPREAD = band * 0.34
const MARK_OFF = band * 0.2 // ◆·◇ 열

export function RecoveryDots() {
  const ticks = [60, 70, 80, 90, 100]
  return (
    <svg viewBox={`0 0 ${DOTS_W} ${DOTS_H}`} width="100%" height="100%" aria-hidden style={{ display: 'block' }}>
      {/* 범례 */}
      <g transform={`translate(${M.l}, 10)`}>
        <circle cx={5} cy={0} r={4} style={{ fill: 'var(--color-text-muted)', fillOpacity: 0.55 }} />
        <text x={14} y={0} dy="0.35em" style={MUTED}>
          6K 분석 개체
        </text>
        <line x1={118} x2={138} y1={0} y2={0} style={{ stroke: 'var(--color-text)', strokeWidth: 2.5 }} />
        <text x={144} y={0} dy="0.35em" style={MUTED}>
          평균
        </text>
        <path d={diamond(190, 0, 7)} style={{ fill: HERO_COLOR }} />
        <text x={202} y={0} dy="0.35em" style={MUTED}>
          선발 개체
        </text>
        <path d={diamond(286, 0, 6)} style={{ fill: 'var(--color-surface)', stroke: 'var(--color-text-muted)', strokeWidth: 1.8 }} />
        <text x={298} y={0} dy="0.35em" style={MUTED}>
          이론값
        </text>
      </g>
      {/* 축 */}
      {ticks.map(t => (
        <g key={t}>
          <line x1={M.l} x2={M.l + PW} y1={y(t)} y2={y(t)} style={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
          <text x={M.l - 6} y={y(t)} dy="0.35em" textAnchor="end" style={MUTED}>
            {t}
          </text>
        </g>
      ))}
      <text transform={`translate(14, ${M.t + PH / 2}) rotate(-90)`} textAnchor="middle" style={MUTED}>
        반복친 게놈 회복률(%)
      </text>
      {/* 기존 BC6 이론선: 라벨은 BC1F1 열 아래쪽 빈 곳 */}
      <line x1={M.l} x2={M.l + PW} y1={y(BC6_THEORY)} y2={y(BC6_THEORY)} style={{ stroke: 'var(--color-text)', strokeWidth: 1.5, strokeDasharray: '5 4' }} />
      <text x={M.l + 6} y={y(BC6_THEORY) + 18} style={{ ...TXT, fontWeight: 700 }}>
        기존 BC6 이론 {f1(BC6_THEORY)}%
      </text>
      {GENS.map((g, i) => {
        const x = cx(i)
        const px = x + DOT_OFF
        const mx = x + MARK_OFF
        return (
          <g key={g.gen}>
            {g.chip.map((p, k) => (
              <circle key={p.id} cx={px + jitter(k) * SPREAD} cy={y(p.rpg)} r={3} style={{ fill: 'var(--color-text-muted)', fillOpacity: 0.45 }} />
            ))}
            <line x1={px - SPREAD / 2 - 5} x2={px + SPREAD / 2 + 5} y1={y(g.chipMean)} y2={y(g.chipMean)} style={{ stroke: 'var(--color-text)', strokeWidth: 2.5 }} />
            <path d={diamond(mx, y(g.theory), 6)} style={{ fill: 'var(--color-surface)', stroke: 'var(--color-text-muted)', strokeWidth: 1.8 }} />
            <text x={mx + 10} y={y(g.theory)} dy="0.35em" style={{ ...MUTED, ...HALO }}>
              {g.theory}
            </text>
            <path d={diamond(mx, y(g.best.rpg), 7.5)} style={{ fill: HERO_COLOR, stroke: 'var(--color-surface)', strokeWidth: 1.5 }} />
            <text x={mx + 10} y={y(g.best.rpg)} dy="0.35em" style={{ fill: HERO_COLOR, fontSize: 16, fontWeight: 800, ...HALO }}>
              {f1(g.best.rpg)}
            </text>
            <text x={x} y={M.t + PH + 20} textAnchor="middle" style={{ ...TXT, fontWeight: 700 }}>
              {g.gen} <tspan style={{ fontWeight: 400, fill: 'var(--color-text-muted)' }}>n = {g.chipN}</tspan>
            </text>
            <text x={x} y={M.t + PH + 39} textAnchor="middle" style={TXT}>
              평균 {f1(g.chipMean)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
