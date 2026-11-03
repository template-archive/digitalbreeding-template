import { useChartTheme } from '@/charts'
import { L, SAVED, SAVED_PCT, STAGES, TOTAL, BASIS, type Stage, type Track } from '../data'
import { stageColor } from './stageColor'

/**
 * 기간 비교 타임라인: 전통·디지털 가로 누적 막대 2줄, 공통 x축 0~12년.
 * 정적 SVG(인쇄 선명도). 좌표는 viewBox 논리 픽셀이며 부모 너비에 맞춰 비례 축소된다.
 */
export const TIMELINE_W = 968
const W = TIMELINE_W
const H = 196
const X0 = 112 // 막대 시작(0년)
const X_MAX_YEAR = 12
const PX_PER_YEAR = (950 - X0) / X_MAX_YEAR
const x = (yr: number) => X0 + yr * PX_PER_YEAR

const ROWS: Record<Track, { y: number; label: string; sub: string }> = {
  conventional: { y: 20, label: '전통', sub: `${BASIS.conventional}년 공정` },
  digital: { y: 76, label: '디지털', sub: `${BASIS.digital}년 설계값` },
}
const BAR_H = 40
const AXIS_Y = 164

interface Seg {
  stage: Stage
  start: number
  len: number
}

function segments(k: Track): Seg[] {
  let acc = 0
  const out: Seg[] = []
  for (const s of STAGES) {
    const len = s[k]
    if (len == null) continue
    out.push({ stage: s, start: acc, len })
    acc = Math.round((acc + len) * 10) / 10
  }
  return out
}

function NumChip({ cx, cy, id }: { cx: number; cy: number; id: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={13} style={{ fill: 'var(--color-surface)', stroke: 'var(--color-text)', strokeWidth: 1.25 }} />
      <text x={cx} y={cy} dy="0.36em" textAnchor="middle" style={{ fill: 'var(--color-text)', fontSize: 16, fontWeight: 700 }}>
        {id}
      </text>
    </g>
  )
}

function Bar({ k, dark }: { k: Track; dark: boolean }) {
  const row = ROWS[k]
  const segs = segments(k)
  const y = row.y
  const conventional = k === 'conventional'
  const small = segs.filter(s => s.len < 0.5)
  // 0.1~0.2년 구간은 막대 아래 지시선으로 번호를 단다. 좁은 간격이라 좌우로 펼친다.
  const spread = (i: number) => (i - (small.length - 1) / 2) * 34
  const total = TOTAL[k]
  const lYears = L[k]
  return (
    <g>
      <text x={0} y={y + 18} style={{ fill: 'var(--color-text)', fontSize: 22, fontWeight: 700 }}>
        {row.label}
      </text>
      <text x={0} y={y + 40} style={{ fill: 'var(--color-text-muted)', fontSize: 16 }}>
        {row.sub}
      </text>
      {segs.map(s => (
        <g key={s.stage.id}>
          <rect
            x={x(s.start)}
            y={y}
            width={s.len * PX_PER_YEAR}
            height={BAR_H}
            style={{ fill: stageColor(s.stage.id), fillOpacity: conventional ? (dark ? 0.78 : 0.42) : 1, stroke: 'var(--color-surface)', strokeWidth: 2 }}
          />
          {conventional && <rect x={x(s.start)} y={y} width={s.len * PX_PER_YEAR} height={BAR_H} fill="url(#dbp-hatch)" />}
          {s.len >= 0.5 && <NumChip cx={x(s.start + s.len / 2)} cy={y + BAR_H / 2} id={s.stage.id} />}
        </g>
      ))}
      {small.map((s, i) => {
        const sx = x(s.start + s.len / 2)
        const lx = sx + spread(i)
        return (
          <g key={`lead-${s.stage.id}`}>
            <polyline
              points={`${sx},${y + BAR_H} ${sx},${y + BAR_H + 6} ${lx},${y + BAR_H + 16}`}
              style={{ fill: 'none', stroke: 'var(--color-text-muted)', strokeWidth: 1.25 }}
            />
            <NumChip cx={lx} cy={y + BAR_H + 29} id={s.stage.id} />
          </g>
        )
      })}
      {/* 세대 간격(L) 눈금 */}
      <line x1={x(lYears)} x2={x(lYears)} y1={y - 8} y2={y + BAR_H + 4} style={{ stroke: 'var(--color-text)', strokeWidth: 2.5, strokeDasharray: '5 3' }} />
      <text x={x(lYears) + 6} y={y - 1} style={{ fill: 'var(--color-text)', fontSize: 16, fontWeight: 700 }}>
        {`L ${lYears.toFixed(1)}년`}
      </text>
      {/* 막대 끝 라벨 */}
      <text x={x(total) + 12} y={y + BAR_H / 2} dy="0.36em" style={{ fill: 'var(--color-text)', fontSize: 26, fontWeight: 800 }}>
        {`${total.toFixed(1)}년`}
      </text>
    </g>
  )
}

export function DurationTimeline() {
  // 다크 표면에서는 42% 채움이 탁해져 채움을 올리고 빗금을 옅게 한다(빗금 선이 표면색이라 어두운 줄이 된다)
  const dark = useChartTheme().mode === 'dark'
  const dEnd = x(TOTAL.digital)
  const cEnd = x(TOTAL.conventional)
  const by = ROWS.digital.y + BAR_H / 2
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`품종 개발 기간 비교: 전통 ${TOTAL.conventional.toFixed(1)}년, 디지털 ${TOTAL.digital.toFixed(1)}년, ${SAVED.toFixed(1)}년(${SAVED_PCT.toFixed(1)}%) 단축. 세대 간격 L은 전통 ${L.conventional.toFixed(1)}년, 디지털 ${L.digital.toFixed(1)}년.`} style={{ display: 'block', fontFamily: 'inherit' }}>
      <defs>
        <pattern id="dbp-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" style={{ stroke: 'var(--color-surface)', strokeWidth: 3, strokeOpacity: dark ? 0.45 : 0.75 }} />
        </pattern>
      </defs>
      {/* 눈금 격자 */}
      {Array.from({ length: X_MAX_YEAR + 1 }, (_, yr) => (
        <g key={yr}>
          <line x1={x(yr)} x2={x(yr)} y1={14} y2={AXIS_Y} style={{ stroke: 'var(--color-border)', strokeWidth: yr === 0 ? 2 : 1 }} />
          <text x={x(yr)} y={AXIS_Y + 22} textAnchor="middle" style={{ fill: 'var(--color-text-muted)', fontSize: 16 }}>
            {yr === X_MAX_YEAR ? `${yr}년` : yr}
          </text>
        </g>
      ))}
      <line x1={X0} x2={x(X_MAX_YEAR)} y1={AXIS_Y} y2={AXIS_Y} style={{ stroke: 'var(--color-text-muted)', strokeWidth: 1.5 }} />
      <Bar k="conventional" dark={dark} />
      <Bar k="digital" dark={dark} />
      {/* 단축 괄호: 디지털 끝 → 전통 끝 */}
      <g>
        <line x1={dEnd + 84} x2={cEnd} y1={by} y2={by} style={{ stroke: 'var(--color-positive)', strokeWidth: 2, strokeDasharray: '6 4' }} />
        <line x1={cEnd} x2={cEnd} y1={ROWS.conventional.y + BAR_H + 2} y2={by + 10} style={{ stroke: 'var(--color-positive)', strokeWidth: 2 }} />
        <line x1={cEnd - 8} x2={cEnd} y1={by + 10} y2={by + 10} style={{ stroke: 'var(--color-positive)', strokeWidth: 2 }} />
        <text x={(dEnd + 84 + cEnd) / 2} y={by - 10} textAnchor="middle" style={{ fill: 'var(--color-positive)', fontSize: 22, fontWeight: 800 }}>
          {`−${SAVED.toFixed(1)}년(−${SAVED_PCT.toFixed(1)}%)`}
        </text>
      </g>
    </svg>
  )
}

