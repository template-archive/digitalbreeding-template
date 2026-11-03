import { formatNumber } from '@/lib/format'
import { AS_OF, AS_OF_T, CONVENTIONAL_YEARS, GS2022, TIMELINE, VARIETY, devYears, rankPct, savedYears } from '../data'
import { V_COLOR, f1 } from './style'

/**
 * 개발 이력 가로 타임라인(2019~2028, 1년 눈금). 단계 구간 막대 + 이정표.
 * 2022 GS 선발 강조, 2026-06-09 출원 굵은 표식, 기준일 세로 점선, 2027~2028 재배심사 점선(예정), 교배~출원 "7년" 괄호.
 */
const W = 1144
const H = 178
const X0 = 22
const X1 = W - 22
const Y_FROM = 2019
const Y_TO = 2029
const x = (t: number) => X0 + ((t - Y_FROM) / (Y_TO - Y_FROM)) * (X1 - X0)

const LANE_Y = 82 // 단계 막대 중심
const BAR_H = 22
const AXIS_Y = 132

/** 겹치는 선 위에서도 읽히게 배경색 테두리 */
const HALO = { stroke: 'var(--color-bg)', strokeWidth: 4, paintOrder: 'stroke' } as const

const byN = (n: number) => TIMELINE.find(m => m.n === n)!

function Diamond({ t, r = 9, fill = V_COLOR }: { t: number; r?: number; fill?: string }) {
  const cx = x(t)
  return <path d={`M${cx} ${LANE_Y - r} L${cx + r} ${LANE_Y} L${cx} ${LANE_Y + r} L${cx - r} ${LANE_Y} z`} style={{ fill, stroke: 'var(--color-surface)', strokeWidth: 2 }} />
}

export function DevTimeline() {
  const cross = byN(1)
  const gs = byN(3)
  const review = byN(7)
  const filed = byN(8)
  const phases = TIMELINE.filter(m => m.end != null)
  const label = `개발 이력: ${TIMELINE.map(m => `${m.period} ${m.label}`).join(', ')}. 교배부터 출원까지 ${devYears}년.`
  const phaseLabel: Record<number, string> = {
    2: '세대 진전 F1~F5(SSD, 연 2세대)',
    4: 'PYT',
    5: 'AYT',
    6: 'MET 8개 지역 × 2년',
    9: '재배심사(예정)',
  }
  const gsX = x(gs.start)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img" aria-label={label}>
      {/* 연 눈금 격자 */}
      {Array.from({ length: Y_TO - Y_FROM + 1 }, (_, i) => Y_FROM + i).map(yr => (
        <g key={yr}>
          <line x1={x(yr)} x2={x(yr)} y1={LANE_Y - 18} y2={AXIS_Y} style={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
          {yr < Y_TO && (
            <text x={x(yr + 0.5)} y={AXIS_Y + 18} textAnchor="middle" style={{ fill: 'var(--color-text-muted)', fontSize: 15, fontWeight: 600 }}>
              {yr}
            </text>
          )}
        </g>
      ))}
      <line x1={X0} x2={X1} y1={AXIS_Y} y2={AXIS_Y} style={{ stroke: 'var(--color-text-muted)', strokeWidth: 1.25 }} />

      {/* 단계 구간 막대 */}
      {phases.map(m => {
        const w = x(m.end!) - x(m.start)
        return (
          <g key={m.n}>
            <rect
              x={x(m.start)}
              y={LANE_Y - BAR_H / 2}
              width={w}
              height={BAR_H}
              rx={4}
              style={
                m.planned
                  ? { fill: 'none', stroke: 'var(--color-text-muted)', strokeWidth: 1.75, strokeDasharray: '6 4' }
                  : { fill: V_COLOR, fillOpacity: 0.28, stroke: V_COLOR, strokeWidth: 1.25 }
              }
            />
            <text
              x={x(m.start) + w / 2 - (m.n === 6 ? 24 : 0)}
              y={m.planned ? LANE_Y : LANE_Y + BAR_H / 2 + 18}
              dy={m.planned ? '0.35em' : undefined}
              textAnchor="middle"
              style={{ fill: m.planned ? 'var(--color-text-muted)' : 'var(--color-text)', fontSize: 15, fontWeight: 600 }}
            >
              {phaseLabel[m.n]}
            </text>
          </g>
        )
      })}

      {/* 기준일 세로 점선 */}
      <line x1={x(AS_OF_T)} x2={x(AS_OF_T)} y1={8} y2={AXIS_Y} style={{ stroke: 'var(--color-text-muted)', strokeWidth: 1.5, strokeDasharray: '4 3' }} />
      <text x={x(AS_OF_T) + 6} y={18} style={{ fill: 'var(--color-text-muted)', fontSize: 15, fontWeight: 700, ...HALO }}>
        기준일 {AS_OF}
      </text>

      {/* 이정표: 교배 */}
      <Diamond t={cross.start} />
      <text x={x(cross.start) - 8} y={LANE_Y - 22} style={{ fill: 'var(--color-text)', fontSize: 15, fontWeight: 700 }}>
        교배 {cross.period}
      </text>

      {/* 이정표: GS 1차 선발(강조) */}
      <line x1={gsX} x2={gsX} y1={LANE_Y - 14} y2={56} style={{ stroke: V_COLOR, strokeWidth: 2 }} />
      <circle cx={gsX} cy={LANE_Y} r={12.5} style={{ fill: V_COLOR, stroke: 'var(--color-surface)', strokeWidth: 2.5 }} />
      <text x={gsX} y={LANE_Y} dy="0.36em" textAnchor="middle" style={{ fill: 'var(--color-accent-contrast)', fontSize: 15, fontWeight: 800 }}>
        GS
      </text>
      <rect x={gsX - 124} y={4} width={432} height={52} rx={8} style={{ fill: 'var(--color-surface)', stroke: V_COLOR, strokeWidth: 2 }} />
      <text x={gsX - 110} y={25} style={{ fill: V_COLOR, fontSize: 16, fontWeight: 800 }}>
        {GS2022.year} 유전체 선발(GS) 1차 선발 · 수량 GEBV +{f1(GS2022.gebv)} kg/10a
      </text>
      <text x={gsX - 110} y={46} style={{ fill: 'var(--color-text)', fontSize: 15 }}>
        {formatNumber(GS2022.candidates)}계통 중 {GS2022.rank}위(상위 {f1(rankPct)}%) → {formatNumber(GS2022.selected)}계통 선발 · 예측 정확도 {GS2022.r.toFixed(2)}
      </text>

      {/* 이정표: 품종 선정 심의 */}
      <Diamond t={review.start} r={7} fill="var(--color-text-muted)" />
      <text x={x(review.start)} y={LANE_Y + BAR_H / 2 + 18} textAnchor="middle" style={{ fill: 'var(--color-text)', fontSize: 15, ...HALO }}>
        선정 심의
      </text>

      {/* 이정표: 품종보호 출원(굵게) */}
      <line x1={x(filed.start)} x2={x(filed.start)} y1={LANE_Y - 28} y2={LANE_Y + 20} style={{ stroke: 'var(--color-text)', strokeWidth: 3 }} />
      <Diamond t={filed.start} r={11} fill="var(--color-text)" />
      <text x={x(filed.start) - 16} y={LANE_Y - 22} textAnchor="end" style={{ fill: 'var(--color-text)', fontSize: 15, fontWeight: 800, ...HALO }}>
        출원 {VARIETY.filedAt}
      </text>

      {/* 교배~출원 괄호 */}
      <path
        d={`M${x(cross.start)} ${AXIS_Y + 24} v8 H${x(filed.start)} v-8`}
        style={{ fill: 'none', stroke: V_COLOR, strokeWidth: 2 }}
      />
      <rect x={(x(cross.start) + x(filed.start)) / 2 - 250} y={AXIS_Y + 24} width={500} height={22} style={{ fill: 'var(--color-bg)' }} />
      <text x={(x(cross.start) + x(filed.start)) / 2} y={AXIS_Y + 40} textAnchor="middle" style={{ fill: V_COLOR, fontSize: 16, fontWeight: 800 }}>
        개발 {devYears}년({VARIETY.crossYear} 교배 → {VARIETY.filedAt.slice(0, 4)} 출원) · 전통 {f1(CONVENTIONAL_YEARS)}년보다 {f1(savedYears)}년 짧음
      </text>
    </svg>
  )
}
