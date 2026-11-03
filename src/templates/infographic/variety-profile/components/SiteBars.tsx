import { formatSigned } from '@/lib/format'
import { CHECK, SITES, ZONES, siteChange, siteIndex, zoneIndex, zoneSiteCount, type Site } from '../data'
import { f1, useZoneColor } from './style'

/**
 * 지역 8곳 수량 증감(%) 가로 발산 막대. 0 = 대비 품종. 권역별로 묶어 정렬(중부 → 남부 → 중북부).
 * 정적 SVG — 좌표는 viewBox 논리 픽셀.
 */
const W = 724
const NAME_X = 22
const X_MIN = -4
const X_MAX = 14
const PX0 = 118
const PX1 = 600
const px = (pct: number) => PX0 + ((pct - X_MIN) / (X_MAX - X_MIN)) * (PX1 - PX0)
const ROW = 20
const HEAD = 21
const GROUP_GAP = 6
const TOP = 4
const BAR_H = 14

type Row = { kind: 'head'; zone: (typeof ZONES)[number]; y: number } | { kind: 'site'; s: Site; y: number }

function layout() {
  const rows: Row[] = []
  let y = TOP
  ZONES.forEach((z, gi) => {
    if (gi > 0) y += GROUP_GAP
    rows.push({ kind: 'head', zone: z, y })
    y += HEAD
    SITES.filter(s => s.zone === z).forEach(s => {
      rows.push({ kind: 'site', s, y })
      y += ROW
    })
  })
  return { rows, bottom: y }
}

export function SiteBars() {
  const zoneColor = useZoneColor()
  const { rows, bottom } = layout()
  const axisY = bottom + 4
  const H = axisY + 40
  const ticks = [-4, 0, 4, 8, 12]
  const summary = SITES.map(s => `${s.site} ${f1(siteIndex(s))}%`).join(', ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img" aria-label={`지역별 수량 지수(대비 품종 = 100): ${summary}`}>
      {/* 격자: 지역 행 구간에만 그린다(권역 머리글 "5개 지역 · 권역 111.5%"가 0선과 겹치지 않게) */}
      {ZONES.map((z, zi) => {
        const ys = rows.filter((r): r is Extract<Row, { kind: 'site' }> => r.kind === 'site' && r.s.zone === z).map(r => r.y)
        const y1 = Math.min(...ys) - 1
        const y2 = zi === ZONES.length - 1 ? axisY : Math.max(...ys) + ROW + 1
        return ticks.map(t => (
          <line key={`${z}-${t}`} x1={px(t)} x2={px(t)} y1={y1} y2={y2} style={{ stroke: t === 0 ? 'var(--color-text)' : 'var(--color-border)', strokeWidth: t === 0 ? 1.75 : 1, strokeDasharray: t === 0 ? undefined : '3 4' }} />
        ))
      })}

      {rows.map(r => {
        if (r.kind === 'head') {
          const zi = zoneIndex(r.zone)
          return (
            <g key={r.zone}>
              <rect x={0} y={r.y + 4} width={12} height={12} rx={2} style={{ fill: zoneColor(r.zone) }} />
              <text x={NAME_X - 4} y={r.y + 10} dy="0.35em" style={{ fill: 'var(--color-text)', fontSize: 16, fontWeight: 800 }}>
                {r.zone}
                <tspan style={{ fill: 'var(--color-text-muted)', fontWeight: 500, fontSize: 15 }}>
                  {`  ${zoneSiteCount(r.zone)}개 지역 · 권역 ${f1(zi)}%`}
                </tspan>
              </text>
            </g>
          )
        }
        const s = r.s
        const ch = siteChange(s)
        const x0 = px(0)
        const x1 = px(ch)
        const cy = r.y + ROW / 2
        const label = `${f1(siteIndex(s))}% · ${formatSigned(s.v - s.c)}`
        // 음수 막대는 라벨을 0선 오른쪽에 둬서 지역 이름과 겹치지 않게 한다
        const lx = ch >= 0 ? x1 + 6 : x0 + 6
        return (
          <g key={s.site}>
            <text x={NAME_X} y={cy} dy="0.35em" style={{ fill: 'var(--color-text)', fontSize: 15 }}>
              {s.site}
            </text>
            <rect x={Math.min(x0, x1)} y={cy - BAR_H / 2} width={Math.abs(x1 - x0)} height={BAR_H} rx={2} style={{ fill: zoneColor(s.zone) }} />
            <text x={lx} y={cy} dy="0.35em" style={{ fill: 'var(--color-text)', fontSize: 15, fontWeight: 700 }}>
              {label}
            </text>
          </g>
        )
      })}

      {/* 축 */}
      {ticks
        .filter(t => t !== 0)
        .map(t => (
          <text key={t} x={px(t)} y={axisY + 14} textAnchor="middle" style={{ fill: 'var(--color-text-muted)', fontSize: 15 }}>
            {formatSigned(t)}%
          </text>
        ))}
      <text x={px(0)} y={axisY + 14} textAnchor="middle" style={{ fill: 'var(--color-text)', fontSize: 15, fontWeight: 700 }}>
        0 = 대비 품종({CHECK.name})
      </text>
      <text x={PX1} y={axisY + 34} textAnchor="end" style={{ fill: 'var(--color-text-muted)', fontSize: 15 }}>
        수량 증감(%, 2024~2025 평균) · 막대 끝 = 지수 · 차(kg/10a)
      </text>
    </svg>
  )
}

/** 지역 막대 SVG의 논리 높이(레이아웃 계산용) */
export const SITE_BARS_SIZE = (() => {
  const { bottom } = layout()
  return { w: W, h: bottom + 4 + 40 }
})()
