import { u } from '@/design-system'
import { BASE, DG_TARGET_PCT, GS_START, YEAR, YEARS, dGpct, f2 } from '../data'

/**
 * ΔG 연도별 추이(정적 SVG, 툴팁 없음). viewBox 단위 = 캔버스 논리 px.
 * y는 0에서 시작(0~2.5 %/년). 2022 GS 도입 점선, 2026 잠정 속 빈 마커, 목표 2.44 짧은 점선.
 */
export function TrendChart({ width, height }: { width: number; height: number }) {
  const m = { l: 44, r: 104, t: 26, b: 28 }
  const pw = width - m.l - m.r
  const ph = height - m.t - m.b
  const yMax = 2.5
  const x = (i: number) => m.l + (pw * i) / (YEARS.length - 1)
  const y = (v: number) => m.t + ph * (1 - v / yMax)
  const pts = YEARS.map((yr, i) => ({ yr, v: dGpct(yr), px: x(i), py: y(dGpct(yr)) }))
  const gsX = x(YEARS.indexOf(GS_START))
  const last = pts[pts.length - 1]
  const first = pts[0]
  const ticks = [0, 0.5, 1, 1.5, 2, 2.5]
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p.px},${p.py}`).join(' ')
  const tY = y(DG_TARGET_PCT)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: u(width), height: u(height), display: 'block' }} aria-hidden>
      {/* 축 제목 */}
      <text x={0} y={14} fontSize={15} fontWeight={700} fill="var(--color-text-muted)">
        %/년
      </text>
      {/* 격자 + y 눈금 */}
      {ticks.map(t => (
        <g key={t}>
          <line x1={m.l} x2={m.l + pw} y1={y(t)} y2={y(t)} stroke="var(--color-border)" strokeWidth={t === 0 ? 1.6 : 1} />
          <text x={m.l - 10} y={y(t) + 5} fontSize={15} textAnchor="end" fill="var(--color-text-muted)" className="tabular-nums">
            {t.toFixed(1)}
          </text>
        </g>
      ))}
      {/* GS 도입 이전 구간 옅은 배경 */}
      <rect x={m.l} y={m.t} width={gsX - m.l} height={ph} fill="var(--color-surface-2)" opacity={0.7} />
      <text x={m.l + 8} y={m.t + 18} fontSize={15} fill="var(--color-text-muted)">
        GS 도입 전
      </text>
      {/* GS 도입 점선 */}
      <line x1={gsX} x2={gsX} y1={m.t - 6} y2={m.t + ph} stroke="var(--color-text)" strokeWidth={1.5} strokeDasharray="5 4" />
      <text x={gsX + 6} y={m.t - 10} fontSize={15} fontWeight={700} fill="var(--color-text)">
        {GS_START} GS 도입
      </text>
      {/* 목표 2.44: 2026 위치 짧은 가로 점선 */}
      <line x1={last.px - 26} x2={last.px + 26} y1={tY} y2={tY} stroke="var(--color-warning)" strokeWidth={2.5} strokeDasharray="6 4" />
      <text x={last.px + 32} y={tY + 1} fontSize={15} fontWeight={700} fill="var(--color-warning)">
        목표 {f2(DG_TARGET_PCT)}
      </text>
      {/* 선 */}
      <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth={3} strokeLinejoin="round" />
      {pts.map(p =>
        p.yr === YEAR ? (
          <circle key={p.yr} cx={p.px} cy={p.py} r={6.5} fill="var(--color-bg)" stroke="var(--color-accent)" strokeWidth={3} />
        ) : (
          <circle key={p.yr} cx={p.px} cy={p.py} r={4.5} fill="var(--color-accent)" />
        ),
      )}
      {/* 값 라벨: 2019, 2026(잠정) */}
      <text x={first.px + 8} y={first.py + 22} fontSize={15} fontWeight={700} textAnchor="start" fill="var(--color-text)" className="tabular-nums">
        {f2(first.v)}
      </text>
      <text x={last.px + 12} y={last.py + 24} fontSize={15} fontWeight={800} fill="var(--color-accent)" className="tabular-nums">
        {f2(last.v)}(잠정)
      </text>
      {/* x 눈금 */}
      {pts.map(p => (
        <text key={p.yr} x={p.px} y={height - 8} fontSize={15} textAnchor="middle" fill={p.yr === YEAR || p.yr === BASE ? 'var(--color-text)' : 'var(--color-text-muted)'} fontWeight={p.yr === YEAR ? 700 : 400} className="tabular-nums">
          {p.yr}
        </text>
      ))}
    </svg>
  )
}
