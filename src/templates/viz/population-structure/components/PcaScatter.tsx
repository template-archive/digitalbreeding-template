import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { GROUP_ORDER, GROUPS, LINE_BY_ID, LINES, PC_RANGE, PVE, type GroupKey, type Line } from '../data'
import { groupColor } from './colors'

export type PcPair = '12' | '13' | '23'
/** off = 드래그해도 선택하지 않음(390px 기본: 세로 드래그가 페이지 스크롤로 간다) */
export type BrushMode = 'off' | 'rect' | 'lasso'

/** 그리드 여백(px). containLabel을 끄고 고정해 브러시 픽셀 → 데이터 변환을 정확히 한다 */
const GRID = { left: 58, right: 18, top: 14, bottom: 46 }

const pcIndex = (pair: PcPair): [number, number] => [Number(pair[0]) - 1, Number(pair[1]) - 1]
export const pcAxisTitle = (k: number) => `PC${k + 1} (${PVE[k]!.toFixed(1)}%)`
const f4 = (v: number) => v.toFixed(4)

type Pt = { x: number; y: number }

function inPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!
    const b = poly[j]!
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export interface PcaScatterProps {
  pair: PcPair
  mode: BrushMode
  hidden: ReadonlySet<GroupKey>
  selected: ReadonlySet<string>
  onBrush: (ids: string[]) => void
  height: number | string
  narrow: boolean
  ariaLabel: string
}

/** PCA 산점도 + 로컬 브러시(사각형·자유형). 점 위 툴팁은 그대로 동작하고, 드래그하면 선택 영역을 그린다. */
export function PcaScatter({ pair, mode, hidden, selected, onBrush, height, narrow, ariaLabel }: PcaScatterProps) {
  const theme = useChartTheme()
  const [xi, yi] = pcIndex(pair)
  const [xMin, xMax] = PC_RANGE[xi]!
  const [yMin, yMax] = PC_RANGE[yi]!
  const wrapRef = useRef<HTMLDivElement>(null)
  const [path, setPath] = useState<Pt[] | null>(null)
  const startRef = useRef<Pt | null>(null)
  const hasSel = selected.size > 0

  const option = useMemo<EChartsOption>(() => {
    const series = GROUP_ORDER.filter(g => !hidden.has(g)).map(g => {
      const color = groupColor(theme, g)
      const members = LINES.filter(l => l.group === g)
      return {
        type: 'scatter' as const,
        name: GROUPS[g].label,
        z: g === 'ADM' ? 2 : 3,
        symbolSize: narrow ? 5 : 6.5,
        itemStyle: { color, opacity: hasSel ? 0.22 : 0.78 },
        emphasis: { scale: 1.6, itemStyle: { opacity: 1, borderColor: theme.text, borderWidth: 1 } },
        data: members.map(l => {
          const isSel = hasSel && selected.has(l.id)
          const labeled = l.anchor && l.name !== null
          return {
            name: l.id,
            value: [l.pc[xi]!, l.pc[yi]!],
            symbolSize: labeled ? (narrow ? 8 : 9) : undefined,
            itemStyle: isSel
              ? { opacity: 0.95, borderColor: theme.text, borderWidth: 0.6 }
              : labeled
                ? { opacity: hasSel ? 0.5 : 1, borderColor: theme.surface, borderWidth: 1.5 }
                : undefined,
            label: labeled
              ? {
                  show: true,
                  formatter: l.name!,
                  position: 'right' as const,
                  distance: 4,
                  color: theme.text,
                  fontSize: 11,
                  fontWeight: 600,
                  textBorderColor: theme.surface,
                  textBorderWidth: 3,
                }
              : undefined,
          }
        }),
      }
    })
    return {
      grid: { ...GRID, containLabel: false },
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const l = LINE_BY_ID.get((p as { name: string }).name)
          if (!l) return ''
          const head = `<b>${l.id}${l.name ? ` ${l.name}` : ''}</b> · ${GROUPS[l.group].label}`
          const body = `Q(K=4) ${l.maxQ.toFixed(3)} · PC${xi + 1} ${f4(l.pc[xi]!)} · PC${yi + 1} ${f4(l.pc[yi]!)}`
          return `${head}<br/>${body}${l.anchor && l.note ? `<br/><span style="color:${theme.textMuted}">${l.note}</span>` : ''}`
        },
      },
      xAxis: {
        type: 'value',
        min: xMin,
        max: xMax,
        interval: 0.04,
        name: pcAxisTitle(xi),
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { fontSize: 12, fontWeight: 600, color: theme.text },
        axisLabel: { formatter: (v: number) => v.toFixed(2) },
        splitLine: { show: true },
      },
      yAxis: {
        type: 'value',
        min: yMin,
        max: yMax,
        interval: 0.04,
        name: pcAxisTitle(yi),
        nameLocation: 'middle',
        nameGap: 42,
        nameTextStyle: { fontSize: 12, fontWeight: 600, color: theme.text },
        axisLabel: { formatter: (v: number) => v.toFixed(2) },
      },
      labelLayout: { hideOverlap: true },
      series: [
        ...series,
        {
          // 원점 기준선(고유벡터 평균 0)
          type: 'line',
          data: [],
          silent: true,
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: false },
            lineStyle: { color: theme.textMuted, type: 'solid', width: 1, opacity: 0.5 },
            data: [{ xAxis: 0 }, { yAxis: 0 }],
          },
        },
      ],
    }
  }, [theme, hidden, selected, hasSel, xi, yi, xMin, xMax, yMin, yMax, narrow])

  const local = (e: ReactPointerEvent): Pt => {
    const r = wrapRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const inGrid = (p: Pt) => {
    const r = wrapRef.current!.getBoundingClientRect()
    return p.x >= GRID.left && p.x <= r.width - GRID.right && p.y >= GRID.top && p.y <= r.height - GRID.bottom
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || mode === 'off') return
    const p = local(e)
    if (!inGrid(p)) return
    startRef.current = p
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = startRef.current
    if (!s) return
    const p = local(e)
    if (mode === 'rect') setPath([s, p])
    else setPath(prev => (prev ? [...prev, p] : [s, p]))
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = startRef.current
    startRef.current = null
    if (!s || !path) {
      setPath(null)
      return
    }
    const end = local(e)
    const pts = mode === 'rect' ? [s, end] : [...path, end]
    setPath(null)
    const xs = pts.map(p => p.x)
    const ys = pts.map(p => p.y)
    if (Math.max(...xs) - Math.min(...xs) < 4 && Math.max(...ys) - Math.min(...ys) < 4) return
    const r = wrapRef.current!.getBoundingClientRect()
    const w = r.width - GRID.left - GRID.right
    const h = r.height - GRID.top - GRID.bottom
    const toPx = (l: Line): Pt => ({
      x: GRID.left + ((l.pc[xi]! - xMin) / (xMax - xMin)) * w,
      y: GRID.top + ((yMax - l.pc[yi]!) / (yMax - yMin)) * h,
    })
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)]
    const [y0, y1] = [Math.min(...ys), Math.max(...ys)]
    const hit = (p: Pt) => (mode === 'rect' ? p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 : inPolygon(p, pts))
    onBrush(LINES.filter(l => !hidden.has(l.group) && hit(toPx(l))).map(l => l.id))
  }

  const shape =
    path && path.length >= 2
      ? mode === 'rect'
        ? (() => {
            const [a, b] = [path[0]!, path[path.length - 1]!]
            return <rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(a.x - b.x)} height={Math.abs(a.y - b.y)} />
          })()
        : <polygon points={path.map(p => `${p.x},${p.y}`).join(' ')} />
      : null

  return (
    <div
      ref={wrapRef}
      className={`relative h-full w-full select-none ${mode === 'off' ? '' : 'cursor-crosshair'}`}
      style={{ touchAction: mode === 'off' ? 'pan-y' : 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        startRef.current = null
        setPath(null)
      }}
    >
      <EChart
        option={option}
        height={height}
        ariaLabel={ariaLabel}
        fallbackTable={{
          columns: ['하위 집단', '계통 수', `PC${xi + 1} 중심`, `PC${yi + 1} 중심`],
          rows: GROUP_ORDER.map(g => {
            const m = LINES.filter(l => l.group === g)
            const mean = (k: number) => m.reduce((a, l) => a + l.pc[k]!, 0) / m.length
            return [GROUPS[g].label, m.length, f4(mean(xi)), f4(mean(yi))]
          }),
        }}
      />
      {shape && (
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full fill-accent/10 stroke-accent" strokeWidth={1.5} strokeDasharray="4 3">
          {shape}
        </svg>
      )}
    </div>
  )
}
