import { formatSigned } from '@/lib/format'
import { CHECK, VARIETY, YIELD_BY_YEAR, diff, index, traitOf, yearIndex } from '../data'
import { C_COLOR, V_COLOR, f1 } from './style'

/**
 * 쌀 수량 원값 막대 2개(대비 품종 → 신품종) + 연차별 지수 2행. y축은 0부터(0~700 kg/10a).
 * 큰 숫자·표와 겹치는 막대 크기를 줄이고 그 자리에 연차 재현성을 보인다.
 * 정적 SVG — 좌표는 viewBox 논리 픽셀이며 부모 크기에 맞춰 비례 축소된다.
 */
const W = 310
const H = 372
const X0 = 42
const Y_TOP = 62
const Y_BASE = 250
const Y_MAX = 700
const y = (v: number) => Y_BASE - (v / Y_MAX) * (Y_BASE - Y_TOP)
const BAR_W = 72
const CX = { c: 104, v: 206 }
/** 연차별 지수 표 */
const ROW_TOP = 322
const ROW_H = 24

export function YieldBars() {
  const t = traitOf('yield')
  const idx = index(t)!
  const d = diff(t)
  const ticks = [0, 200, 400, 600]
  const yv = y(t.v)
  const yc = y(t.c)
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      role="img"
      aria-label={`쌀 수량: ${VARIETY.name} ${t.v} kg/10a, 대비 품종 ${CHECK.name} ${t.c} kg/10a, ${formatSigned(d)} kg/10a(${f1(idx)}%). 연차별 지수 ${YIELD_BY_YEAR.map(r => `${r.year}년 ${f1(yearIndex(r))}%`).join(', ')}`}
    >
      <defs>
        <pattern id="vp-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" style={{ stroke: 'var(--color-surface)', strokeWidth: 2.5, strokeOpacity: 0.7 }} />
        </pattern>
      </defs>
      <text x={0} y={18} style={{ fill: 'var(--color-text)', fontSize: 17, fontWeight: 700 }}>
        쌀 수량
        <tspan dx={8} style={{ fill: 'var(--color-text-muted)', fontSize: 15, fontWeight: 400 }}>
          (kg/10a · 축 0부터)
        </tspan>
      </text>

      {ticks.map(v => (
        <g key={v}>
          <line x1={X0} x2={W - 6} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--color-border)', strokeWidth: v === 0 ? 1.5 : 1 }} />
          <text x={X0 - 7} y={y(v)} dy="0.35em" textAnchor="end" style={{ fill: 'var(--color-text-muted)', fontSize: 15 }}>
            {v}
          </text>
        </g>
      ))}

      {/* 대비 품종 */}
      <rect x={CX.c - BAR_W / 2} y={yc} width={BAR_W} height={Y_BASE - yc} rx={3} style={{ fill: C_COLOR }} />
      <rect x={CX.c - BAR_W / 2} y={yc} width={BAR_W} height={Y_BASE - yc} rx={3} fill="url(#vp-hatch)" />
      <text x={CX.c} y={yc - 8} textAnchor="middle" style={{ fill: 'var(--color-text)', fontSize: 20, fontWeight: 700 }}>
        {t.c}
      </text>

      {/* 대비 수준 점선(+45 차이를 보이게) */}
      <line x1={CX.c - BAR_W / 2} x2={CX.v + BAR_W / 2 + 18} y1={yc} y2={yc} style={{ stroke: 'var(--color-text-muted)', strokeWidth: 1.5, strokeDasharray: '5 4' }} />

      {/* 신품종 */}
      <rect x={CX.v - BAR_W / 2} y={yv} width={BAR_W} height={Y_BASE - yv} rx={3} style={{ fill: V_COLOR }} />
      <text x={CX.v} y={yv - 8} textAnchor="middle" style={{ fill: 'var(--color-text)', fontSize: 22, fontWeight: 800 }}>
        {t.v}
      </text>
      <text x={CX.v} y={yv - 32} textAnchor="middle" style={{ fill: V_COLOR, fontSize: 18, fontWeight: 800 }}>
        {f1(idx)}%
      </text>

      {/* 차이 괄호 */}
      <path d={`M${CX.v + BAR_W / 2 + 6} ${yv} h7 V${yc} h-7`} style={{ fill: 'none', stroke: V_COLOR, strokeWidth: 2 }} />
      <text x={CX.v + BAR_W / 2 + 17} y={(yv + yc) / 2} dy="0.35em" style={{ fill: V_COLOR, fontSize: 15, fontWeight: 700 }}>
        {formatSigned(d)}
      </text>

      {/* 품종 이름(흑백 인쇄 대비 문자 라벨) */}
      <text x={CX.c} y={Y_BASE + 20} textAnchor="middle" style={{ fill: 'var(--color-text)', fontSize: 16, fontWeight: 700 }}>
        {CHECK.name}
        <tspan dx={4} style={{ fill: 'var(--color-text-muted)', fontSize: 15, fontWeight: 400 }}>
          대비
        </tspan>
      </text>
      <text x={CX.v} y={Y_BASE + 20} textAnchor="middle" style={{ fill: 'var(--color-text)', fontSize: 16, fontWeight: 800 }}>
        {VARIETY.name}
        <tspan dx={4} style={{ fill: 'var(--color-text-muted)', fontSize: 15, fontWeight: 400 }}>
          신품종
        </tspan>
      </text>

      {/* 연차별 지수: 같은 방향으로 재현되는지 */}
      <line x1={0} x2={W - 6} y1={ROW_TOP - 24} y2={ROW_TOP - 24} style={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
      <text x={0} y={ROW_TOP - 6} style={{ fill: 'var(--color-text-muted)', fontSize: 15 }}>
        연차별 {CHECK.name} → {VARIETY.name}
      </text>
      <text x={W - 6} y={ROW_TOP - 6} textAnchor="end" style={{ fill: 'var(--color-text-muted)', fontSize: 15 }}>
        지수
      </text>
      {YIELD_BY_YEAR.map((r, i) => (
        <g key={r.year} className="tabular-nums">
          <text x={0} y={ROW_TOP + 14 + i * ROW_H} style={{ fill: 'var(--color-text)', fontSize: 16, fontWeight: 700 }}>
            {r.year}
          </text>
          <text x={62} y={ROW_TOP + 14 + i * ROW_H} style={{ fill: 'var(--color-text)', fontSize: 16 }}>
            {r.c} → {r.v}
          </text>
          <text x={W - 6} y={ROW_TOP + 14 + i * ROW_H} textAnchor="end" style={{ fill: V_COLOR, fontSize: 17, fontWeight: 800 }}>
            {f1(yearIndex(r))}%
          </text>
        </g>
      ))}
    </svg>
  )
}
