import { useChartTheme, metZoneColor } from '@/charts'
import { CHECK, SITES, ZONES, f1, s1, siteChange, siteIndex, sitesOf, zoneLabel, type Site } from '../data'

/**
 * 지역 8곳 수량 증감(%) 가로 발산 막대. 0 = 대비 품종(가람솔). 권역별로 묶어 정렬(중부 5 → 남부 2 → 중북부 1).
 * 막대 끝 라벨 = 지수 · 차(kg/10a). 정적 SVG(인쇄용).
 */
export const BARS_W = 350
const NAME_X = 18
const X_MIN = -1
const X_MAX = 12
const PX0 = 84
const PX1 = 236
const px = (pct: number) => PX0 + ((pct - X_MIN) / (X_MAX - X_MIN)) * (PX1 - PX0)
const ROW = 21
const HEAD = 20
const GROUP_GAP = 4
const TOP = 2
const BAR_H = 14

type Row = { kind: 'head'; zone: (typeof ZONES)[number]; y: number } | { kind: 'site'; s: Site; y: number }

function layout() {
  const rows: Row[] = []
  let y = TOP
  ZONES.forEach((z, gi) => {
    if (gi > 0) y += GROUP_GAP
    rows.push({ kind: 'head', zone: z, y })
    y += HEAD
    sitesOf(z.key).forEach(s => {
      rows.push({ kind: 'site', s, y })
      y += ROW
    })
  })
  return { rows, bottom: y }
}
const L = layout()
export const BARS_H = L.bottom + 4 + 36
/** 권역별 지역 행 세로 구간(머리글 행 제외) */
const SEGMENTS = ZONES.map(z => {
  const ys = L.rows.filter((r): r is Extract<Row, { kind: 'site' }> => r.kind === 'site' && r.s.zone === z.key).map(r => r.y)
  return { y1: Math.min(...ys) - 1, y2: Math.max(...ys) + ROW + 1 }
})

export function SiteBars() {
  const theme = useChartTheme()
  const axisY = L.bottom + 4
  const ticks = [0, 4, 8, 12]
  const summary = SITES.map(s => `${s.site} ${f1(siteIndex(s))}%(${s1(s.v - s.c)} kg/10a)`).join(', ')
  return (
    <svg viewBox={`0 0 ${BARS_W} ${BARS_H}`} width="100%" style={{ display: 'block', height: 'auto' }} role="img" aria-label={`지역별 수량 증감(대비 품종 ${CHECK.name} = 0): ${summary}. ${SITES.length}곳 모두 대비 품종보다 많음.`}>
      {/* 눈금·0선은 지역 행 구간에만 그린다(권역 머리글 "중북부지(철원)" 등이 축선과 겹치지 않게) */}
      {SEGMENTS.map((seg, si) =>
        ticks.map(t => (
          <line key={`${si}-${t}`} x1={px(t)} x2={px(t)} y1={seg.y1} y2={si === SEGMENTS.length - 1 ? axisY : seg.y2} style={{ stroke: t === 0 ? 'var(--color-text)' : 'var(--color-border)', strokeWidth: t === 0 ? 1.75 : 1, strokeDasharray: t === 0 ? undefined : '3 4' }} />
        )),
      )}
      {L.rows.map(r => {
        if (r.kind === 'head') {
          const color = metZoneColor(theme, r.zone.key)
          return (
            <g key={r.zone.key}>
              <rect x={0} y={r.y + 4} width={11} height={11} rx={2} style={{ fill: color }} />
              <text x={NAME_X - 2} y={r.y + 10} dy="0.35em" style={{ fill: 'var(--color-text)', fontSize: 15.5, fontWeight: 800 }}>
                {zoneLabel(r.zone.key)}
              </text>
            </g>
          )
        }
        const s = r.s
        const ch = siteChange(s)
        const x0 = px(0)
        const x1 = px(ch)
        const cy = r.y + ROW / 2
        return (
          <g key={s.site}>
            <text x={NAME_X} y={cy} dy="0.35em" style={{ fill: 'var(--color-text)', fontSize: 15.5 }}>
              {s.site}
            </text>
            <rect x={Math.min(x0, x1)} y={cy - BAR_H / 2} width={Math.abs(x1 - x0)} height={BAR_H} rx={2} style={{ fill: metZoneColor(theme, s.zone) }} />
            <text x={(ch >= 0 ? x1 : x0) + 6} y={cy} dy="0.35em" style={{ fill: 'var(--color-text)', fontSize: 15.5, fontWeight: 700 }}>
              {f1(siteIndex(s))}% · {s1(s.v - s.c)}
            </text>
          </g>
        )
      })}
      {ticks
        .filter(t => t !== 0)
        .map(t => (
          <text key={t} x={px(t)} y={axisY + 15} textAnchor="middle" style={{ fill: 'var(--color-text-muted)', fontSize: 15.5 }}>
            +{t}%
          </text>
        ))}
      <text x={px(0)} y={axisY + 15} textAnchor="middle" style={{ fill: 'var(--color-text)', fontSize: 15.5, fontWeight: 700 }}>
        0
      </text>
      <text x={px(0)} y={axisY + 32} textAnchor="start" dx={-2} style={{ fill: 'var(--color-text)', fontSize: 15.5, fontWeight: 700 }}>
        ↑ 0 = 대비 품종({CHECK.name})
      </text>
    </svg>
  )
}
