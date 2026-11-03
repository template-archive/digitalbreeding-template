import { CONVENTIONAL, CONV_MONTHS, CROSS, MABC_GENS, MABC_MONTHS, SAVED, SCHEDULE } from '../data'
import { HERO_COLOR, tint } from './style'

/**
 * 기간 비교 타임라인(공통 x축 0~48개월, 0부터).
 * 기존: 8세대 × 6개월 칸. MABC: 교배일부터 각 세대 종자 수확일까지 실제 기간 칸(끝 라벨은 달력 월 차 20개월).
 */
export const TIME_W = 552
export const TIME_H = 134
const M = { l: 8, r: 66, t: 24 }
const PW = TIME_W - M.l - M.r
const x = (m: number) => M.l + (m / CONV_MONTHS) * PW
const ROW_H = 26
const ROW1 = M.t
const ROW2 = M.t + 52

const DAY_MS = 86400000
const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / DAY_MS
const MONTH_DAYS = 365.25 / 12

const MUTED = { fill: 'var(--color-text-muted)', fontSize: 16 }
const TXT = { fill: 'var(--color-text)', fontSize: 16 }

/** 칸 라벨: F1, 여교배 횟수(1~), 마지막 자식 세대 F2 */
const CONV_LABELS = ['F1', ...Array.from({ length: CONVENTIONAL.generations - 2 }, (_, i) => `${i + 1}`), 'F2']
/** MABC 세대 칸: F1·BC1F1·BC2F1·BC3F1·BC3F2의 종자 수확일 경계 */
const MABC_CELLS = SCHEDULE.slice(1, 1 + MABC_GENS).map((s, i, arr) => {
  const start = i === 0 ? 0 : days(CROSS.crossedAt, arr[i - 1].seed!) / MONTH_DAYS
  const end = days(CROSS.crossedAt, s.seed!) / MONTH_DAYS
  const label = s.gen === 'F1' ? 'F1' : s.gen === 'BC3F2' ? 'F2' : s.gen.replace(/^BC(\d)F1$/, '$1')
  return { start, end, label }
})

export function TimeCompare() {
  return (
    <svg viewBox={`0 0 ${TIME_W} ${TIME_H}`} width="100%" height="100%" aria-hidden style={{ display: 'block' }}>
      <text x={M.l} y={ROW1 - 8} style={{ ...TXT, fontWeight: 700 }}>
        기존 여교배 · {CONVENTIONAL.label}까지 {CONVENTIONAL.generations}세대 × {CONVENTIONAL.monthsPerGen}개월
      </text>
      {CONV_LABELS.map((lab, i) => (
        <g key={i}>
          <rect
            x={x(i * CONVENTIONAL.monthsPerGen) + 1}
            y={ROW1}
            width={x(CONVENTIONAL.monthsPerGen) - x(0) - 2}
            height={ROW_H}
            rx={3}
            style={{ fill: 'var(--color-surface-2)', stroke: 'var(--color-text-muted)', strokeWidth: 1 }}
          />
          <text x={x((i + 0.5) * CONVENTIONAL.monthsPerGen)} y={ROW1 + ROW_H / 2} dy="0.35em" textAnchor="middle" style={MUTED}>
            {lab}
          </text>
        </g>
      ))}
      <text x={x(CONV_MONTHS) + 6} y={ROW1 + ROW_H / 2} dy="0.35em" style={{ ...TXT, fontWeight: 800 }}>
        {CONV_MONTHS}개월
      </text>

      <text x={M.l} y={ROW2 - 8} style={{ fill: HERO_COLOR, fontSize: 16, fontWeight: 800 }}>
        MABC(이 사례) · BC3F2까지 {MABC_GENS}세대 · 칸 숫자 = 여교배 횟수
      </text>
      {MABC_CELLS.map((c, i) => (
        <g key={i}>
          <rect x={x(c.start) + 1} y={ROW2} width={x(c.end) - x(c.start) - 2} height={ROW_H} rx={3} style={{ fill: tint(HERO_COLOR, 24), stroke: HERO_COLOR, strokeWidth: 1.2 }} />
          <text x={(x(c.start) + x(c.end)) / 2} y={ROW2 + ROW_H / 2} dy="0.35em" textAnchor="middle" style={{ ...TXT, fontWeight: 700 }}>
            {c.label}
          </text>
        </g>
      ))}
      {/* 단축 구간 */}
      <rect
        x={x(MABC_MONTHS) + 3}
        y={ROW2 + 2}
        width={x(CONV_MONTHS) - x(MABC_MONTHS) - 3}
        height={ROW_H - 4}
        rx={3}
        style={{ fill: 'none', stroke: 'var(--color-positive)', strokeWidth: 1.5, strokeDasharray: '4 3' }}
      />
      <text x={(x(MABC_MONTHS) + x(CONV_MONTHS)) / 2} y={ROW2 + ROW_H / 2} dy="0.35em" textAnchor="middle" style={{ fill: 'var(--color-positive)', fontSize: 17, fontWeight: 800 }}>
        {SAVED.months}개월 단축
      </text>
      <text x={x(CONV_MONTHS) + 6} y={ROW2 + ROW_H / 2} dy="0.35em" style={{ fill: HERO_COLOR, fontSize: 16, fontWeight: 800 }}>
        {MABC_MONTHS}개월
      </text>
      {/* x축 */}
      <line x1={x(0)} x2={x(CONV_MONTHS)} y1={ROW2 + ROW_H + 8} y2={ROW2 + ROW_H + 8} style={{ stroke: 'var(--color-text-muted)', strokeWidth: 1 }} />
      {[0, 12, 24, 36, 48].map(t => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={ROW2 + ROW_H + 8} y2={ROW2 + ROW_H + 12} style={{ stroke: 'var(--color-text-muted)', strokeWidth: 1 }} />
          <text x={x(t)} y={ROW2 + ROW_H + 27} textAnchor="middle" style={MUTED}>
            {t}
          </text>
        </g>
      ))}
      <text x={x(CONV_MONTHS) + 6} y={ROW2 + ROW_H + 27} style={MUTED}>
        개월
      </text>
    </svg>
  )
}
