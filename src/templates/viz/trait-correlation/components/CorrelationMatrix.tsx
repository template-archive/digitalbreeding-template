import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { selectionStroke, useChartTheme, type ChartTheme } from '@/charts'
import {
  H_MIN_DENDRO,
  CUT_H,
  N,
  TRAITS,
  f2,
  fmtInt,
  fmtP,
  groupLabel,
  pairOf,
  stars,
  type Clustering,
  type DendroNode,
} from '../data'

interface Props {
  /** 표시 순서(TRAITS 인덱스) */
  order: number[]
  /** 군집 정렬이면 덴드로그램·묶음 경계 */
  clustering: Clustering | null
  showSE: boolean
  dimNs: boolean
  /** 선택 쌍(TRAITS 인덱스) */
  selected: [number, number]
  onSelect: (a: number, b: number) => void
  width: number
}

// ---------------- 색 ----------------

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const toHex = (c: [number, number, number]) => `#${c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`

/** 발산 척도 −1~1 고정, 0 = 가운데 색(토큰 --viz-div-*) */
export function divergingColor(theme: ChartTheme, v: number): string {
  const stops = theme.diverging
  const pos = ((Math.max(-1, Math.min(1, v)) + 1) / 2) * (stops.length - 1)
  const k = Math.min(stops.length - 2, Math.floor(pos))
  const a = hexToRgb(stops[k]!)
  const b = hexToRgb(stops[k + 1]!)
  if (!a || !b) return stops[Math.round(pos)]!
  const t = pos - k
  return toHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t])
}
function luminance(hex: string): number {
  const c = hexToRgb(hex)
  if (!c) return 0.5
  const [r, g, b] = c.map(v => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number]
  return (x + 0.05) / (y + 0.05)
}
/** 셀 배경에서 대비가 더 큰 글자색(text / surface) */
const inkOn = (theme: ChartTheme, fill: string) => (contrast(theme.text, fill) >= contrast(theme.surface, fill) ? theme.text : theme.surface)

// ---------------- 배치 ----------------

interface Layout {
  narrow: boolean
  cell: number
  dl: number // 왼쪽 덴드로그램 폭
  rh: number // 행 머리 폭
  dt: number // 위 덴드로그램 높이
  gb: number // 묶음 띠 높이
  ch: number // 열 머리 높이
  x0: number
  y0: number
  w: number
  h: number
}

function layoutOf(width: number, k: number, cluster: boolean): Layout {
  const narrow = width < 640
  const dl = cluster && !narrow ? 60 : 0
  // 좁은 화면 행 머리 46px(형질 약칭 3자 11px + 여백): 390px에서 셀 32px로 8열이 한 화면에 들어간다
  const rh = narrow ? 46 : 104
  const dt = cluster ? (narrow ? 40 : 60) : 0
  const gb = cluster ? 20 : 0
  const ch = 34
  const cell = Math.max(30, Math.min(84, Math.floor((width - dl - rh - 6) / k)))
  const x0 = dl + rh
  const y0 = dt + gb + ch
  return { narrow, cell, dl, rh, dt, gb, ch, x0, y0, w: x0 + k * cell + 4, h: y0 + k * cell + 4 }
}

const H_MIN = H_MIN_DENDRO
/** 위 덴드로그램 높이 축 거리 눈금(H_MIN부터 확대해 그리므로 0에서 시작하지 않음을 밝힘) */
const H_TICKS = [0.5, CUT_H, 0.9]

/** 덴드로그램 선분(위: 세로 방향 높이, 왼쪽: 가로 방향 높이) */
function dendroSegments(root: DendroNode, pos: Map<number, number>, hMax: number) {
  const segs: { a: [number, number]; b: [number, number] }[] = []
  // 좌표: c = 잎 축(셀 단위, 중심), s = 높이 축(0 잎 쪽 ~ 1 뿌리)
  const sOf = (h: number) => (h <= H_MIN ? 0 : (h - H_MIN) / (hMax - H_MIN))
  const walk = (n: DendroNode): { c: number; s: number } => {
    if (!n.children) return { c: pos.get(n.order[0]!)! + 0.5, s: 0 }
    const L = walk(n.children[0])
    const R = walk(n.children[1])
    const s = sOf(n.h)
    segs.push({ a: [L.c, L.s], b: [L.c, s] })
    segs.push({ a: [R.c, R.s], b: [R.c, s] })
    segs.push({ a: [L.c, s], b: [R.c, s] })
    return { c: (L.c + R.c) / 2, s }
  }
  walk(root)
  const ticks = H_TICKS.filter(h => h > H_MIN && h <= hMax).map(h => ({ h, s: sOf(h) }))
  return { segs, cutS: sOf(CUT_H), ticks }
}

export function cellAria(a: number, b: number, upper: boolean): string {
  const q = pairOf(a, b)
  const name = `${TRAITS[Math.min(a, b)]!.label}–${TRAITS[Math.max(a, b)]!.label}`
  if (upper) return `${name} 유전 상관 ${f2(q.rg)}, 표준오차 ${f2(q.se)}, ${q.pg < 0.05 ? `유의(${fmtP(q.pg)})` : '유의하지 않음'}`
  return `${name} 표현형 상관 ${f2(q.rp)}, ${q.pp < 0.05 ? `유의(${fmtP(q.pp)})` : '유의하지 않음'}`
}

/** 8 × 8 형질 상관 행렬(SVG). 상삼각 rG, 하삼각 rP, 대각 h². 군집 정렬이면 위·왼쪽 UPGMA 덴드로그램과 h = 0.75 묶음 경계 */
export function CorrelationMatrix({ order, clustering, showSE, dimNs, selected, onSelect, width }: Props) {
  const theme = useChartTheme()
  const k = order.length
  const L = layoutOf(width, k, clustering !== null)
  const pos = useMemo(() => new Map(order.map((t, i) => [t, i])), [order])
  const [focus, setFocus] = useState<[number, number]>(() => {
    const r = pos.get(selected[0]) ?? 0
    const c = pos.get(selected[1]) ?? 1
    return [Math.min(r, c), Math.max(r, c)]
  })
  const [hasFocus, setHasFocus] = useState(false)
  const [tip, setTip] = useState<[number, number] | null>(null)
  const cellRefs = useRef(new Map<string, SVGRectElement>())

  const fr = Math.min(focus[0], k - 1)
  const fc = Math.min(focus[1], k - 1)
  const seSmall = showSE && !L.narrow
  const valFont = L.cell >= 64 ? 14 : L.cell >= 48 ? 12 : 11
  const ss = selectionStroke(theme)
  const selTraits = new Set(selected)

  const dendro = useMemo(() => {
    if (!clustering) return null
    const hMax = clustering.root.h
    return dendroSegments(clustering.root, pos, hMax)
  }, [clustering, pos])

  const moveFocus = (r: number, c: number) => {
    const nr = Math.max(0, Math.min(k - 1, r))
    const nc = Math.max(0, Math.min(k - 1, c))
    setFocus([nr, nc])
    setTip([nr, nc])
    cellRefs.current.get(`${nr}-${nc}`)?.focus()
  }
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const map: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    const d = map[e.key]
    if (d) {
      e.preventDefault()
      moveFocus(fr + d[0], fc + d[1])
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (fr !== fc) onSelect(order[fr]!, order[fc]!)
    } else if (e.key === 'Escape') setTip(null)
  }

  const selR = pos.get(selected[0])
  const selC = pos.get(selected[1])
  const cx = (c: number) => L.x0 + c * L.cell
  const cy = (r: number) => L.y0 + r * L.cell

  const groups = clustering ? clustering.groups.filter(g => g.length >= 2) : []

  // 툴팁 내용
  const tipNode = (() => {
    if (!tip) return null
    const [r, c] = tip
    if (r >= k || c >= k) return null
    const a = order[r]!
    const b = order[c]!
    let lines: string[]
    if (r === c) {
      const t = TRAITS[a]!
      lines = [`${t.label}${t.key === 'blast' ? '(발병 지수, 낮을수록 저항)' : ''}`, `h² ${f2(t.h2)} (2026 REML) · GBLUP r ${f2(t.r)}`]
    } else {
      const q = pairOf(a, b)
      const name = `${TRAITS[q.a]!.short}–${TRAITS[q.b]!.short}`
      lines =
        r < c
          ? [name, `유전 상관 ${f2(q.rg)} ± ${f2(q.se)} (Robertson 근사)`, `95% CI ${f2(q.rgLo)}~${f2(q.rgHi)} · ${fmtP(q.pg)}`]
          : [name, `표현형 상관 ${f2(q.rp)}`, `95% CI ${f2(q.rpLo)}~${f2(q.rpHi)} · ${fmtP(q.pp)} · n = ${fmtInt(N)}`]
      if (q.a === TRAITS.findIndex(t => t.key === 'blast') || q.b === TRAITS.findIndex(t => t.key === 'blast'))
        lines.push('도열병 = 발병 지수(낮을수록 저항)')
    }
    const left = cx(c) + L.cell + 6
    const flip = left + 230 > L.w
    return (
      <div
        role="tooltip"
        className="pointer-events-none absolute z-10 w-max max-w-[240px] rounded-md border border-border bg-surface px-2.5 py-2 text-xs text-text shadow-2"
        style={{ top: cy(r), ...(flip ? { right: Math.max(0, L.w - cx(c) + 6) } : { left }) }}
      >
        <p className="font-semibold">{lines[0]}</p>
        {lines.slice(1).map((l, i) => (
          <p key={i} className="tabular-nums text-muted">
            {l}
          </p>
        ))}
      </div>
    )
  })()

  return (
    <div className="relative" style={{ width: L.w }} onMouseLeave={() => setTip(null)}>
      <svg
        width={L.w}
        height={L.h}
        role="group"
        aria-label={`형질 ${k}개 상관 행렬. 상삼각 유전 상관, 하삼각 표현형 상관, 대각 유전력. 화살표 키로 셀 이동, Enter로 쌍 선택`}
        onKeyDown={onKey}
        onFocus={() => setHasFocus(true)}
        onBlur={() => setHasFocus(false)}
        className="select-none"
        style={{ fontFamily: theme.fontFamily }}
      >
        {/* 위 덴드로그램 */}
        {dendro && (
          <g aria-hidden="true">
            {dendro.segs.map((s, i) => {
              const y = (v: number) => L.dt - 4 - v * (L.dt - 10)
              return (
                <line
                  key={`t${i}`}
                  x1={L.x0 + s.a[0] * L.cell}
                  y1={y(s.a[1])}
                  x2={L.x0 + s.b[0] * L.cell}
                  y2={y(s.b[1])}
                  stroke={theme.textMuted}
                  strokeWidth={1.3}
                />
              )
            })}
            <line
              x1={L.x0 - 4}
              x2={L.x0 + k * L.cell}
              y1={L.dt - 4 - dendro.cutS * (L.dt - 10)}
              y2={L.dt - 4 - dendro.cutS * (L.dt - 10)}
              stroke={theme.accent}
              strokeDasharray="4 3"
              strokeWidth={1.2}
            />
            {/* 높이 축: 거리 1 − |rG|, H_MIN부터 */}
            <line x1={L.x0 - 6} x2={L.x0 - 6} y1={L.dt - 4} y2={6} stroke={theme.border} strokeWidth={1} />
            {dendro.ticks.map(t => {
              const ty = L.dt - 4 - t.s * (L.dt - 10)
              const cut = t.h === CUT_H
              return (
                <g key={t.h}>
                  <line x1={L.x0 - 10} x2={L.x0 - 6} y1={ty} y2={ty} stroke={cut ? theme.accent : theme.border} strokeWidth={1} />
                  <text
                    x={L.x0 - 12}
                    y={ty + 3.5}
                    textAnchor="end"
                    fontSize={11}
                    fill={cut ? theme.accent : theme.textMuted}
                    fontWeight={cut ? 600 : 400}
                    className="tabular-nums"
                  >
                    {cut ? `h ${f2(t.h)}` : f2(t.h)}
                  </text>
                </g>
              )
            })}
            {!L.narrow && (
              <text x={L.x0 - 52} y={L.dt / 2 - 3} textAnchor="end" fontSize={11} fill={theme.textMuted}>
                <tspan x={L.x0 - 52}>거리 1 − |rG|</tspan>
                <tspan x={L.x0 - 52} dy={13}>
                  {f2(H_MIN)}부터
                </tspan>
              </text>
            )}
          </g>
        )}
        {/* 왼쪽 덴드로그램 */}
        {dendro && L.dl > 0 && (
          <g aria-hidden="true">
            {dendro.segs.map((s, i) => {
              const x = (v: number) => L.dl - 4 - v * (L.dl - 10)
              return (
                <line
                  key={`l${i}`}
                  x1={x(s.a[1])}
                  y1={L.y0 + s.a[0] * L.cell}
                  x2={x(s.b[1])}
                  y2={L.y0 + s.b[0] * L.cell}
                  stroke={theme.textMuted}
                  strokeWidth={1.3}
                />
              )
            })}
            <line
              y1={L.y0}
              y2={L.y0 + k * L.cell}
              x1={L.dl - 4 - dendro.cutS * (L.dl - 10)}
              x2={L.dl - 4 - dendro.cutS * (L.dl - 10)}
              stroke={theme.accent}
              strokeDasharray="4 3"
              strokeWidth={1.2}
            />
          </g>
        )}
        {/* 묶음 띠 */}
        {clustering && (
          <g aria-hidden="true">
            {groups.map(g => {
              const ps = g.map(t => pos.get(t)!)
              const a = Math.min(...ps)
              const b = Math.max(...ps) + 1
              const label = groupLabel(g)
              const y = L.dt + L.gb - 6
              return (
                <g key={g.join('-')}>
                  <path
                    d={`M${cx(a) + 3},${y + 4} V${y} H${cx(b) - 3} V${y + 4}`}
                    fill="none"
                    stroke={theme.text}
                    strokeWidth={1.5}
                  />
                  {label && (
                    <text x={(cx(a) + cx(b)) / 2} y={y - 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={theme.text}>
                      {label}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        )}
        {/* 열 머리 */}
        <g aria-hidden="true">
          {order.map((t, c) => {
            const tr = TRAITS[t]!
            const x = cx(c) + L.cell / 2
            return (
              <g key={`ch${t}`}>
                <text x={x} y={L.y0 - (tr.key === 'blast' && L.cell >= 56 ? 18 : 8)} textAnchor="middle" fontSize={L.narrow ? 11 : 12} fontWeight={selTraits.has(t) ? 800 : 600} fill={theme.text}>
                  {/* 좁은 칸(31px)에 세 글자가 붙어 보여 열 머리만 두 글자로 줄인다. 행 머리는 전체 이름 */}
                  {L.narrow ? tr.short.slice(0, 2) : tr.short}
                </text>
                {tr.key === 'blast' && L.cell >= 56 && (
                  <text x={x} y={L.y0 - 5} textAnchor="middle" fontSize={11} fill={theme.textMuted}>
                    지수↓저항
                  </text>
                )}
              </g>
            )
          })}
        </g>
        {/* 행 머리 */}
        <g aria-hidden="true">
          {order.map((t, r) => {
            const tr = TRAITS[t]!
            const y = cy(r) + L.cell / 2
            const x = L.x0 - 8
            return (
              <g key={`rh${t}`}>
                <text x={x} y={tr.key === 'blast' ? y - 2 : y + 4} textAnchor="end" fontSize={L.narrow ? 11 : 12.5} fontWeight={selTraits.has(t) ? 800 : 600} fill={theme.text}>
                  {L.narrow ? tr.short : tr.label === '밥맛(식미치)' ? '밥맛' : tr.short === '이삭수' ? '주당 이삭수' : tr.short}
                </text>
                {tr.key === 'blast' && (
                  <text x={x} y={y + 11} textAnchor="end" fontSize={11} fill={theme.textMuted}>
                    {L.narrow ? '↓저항' : '(발병 지수 ↓ 저항)'}
                  </text>
                )}
              </g>
            )
          })}
        </g>
        {/* 셀 */}
        {order.map((a, r) =>
          order.map((b, c) => {
            const x = cx(c)
            const y = cy(r)
            const key = `${r}-${c}`
            const focused = r === fr && c === fc
            const common = {
              ref: (el: SVGRectElement | null) => {
                if (el) cellRefs.current.set(key, el)
                else cellRefs.current.delete(key)
              },
              x: x + 1,
              y: y + 1,
              width: L.cell - 2,
              height: L.cell - 2,
              rx: 3,
              tabIndex: focused ? 0 : -1,
              onMouseEnter: () => setTip([r, c]),
              onFocus: () => {
                setFocus([r, c])
                setTip([r, c])
              },
              onBlur: () => setTip(null),
              style: { outline: 'none' },
            }
            if (r === c) {
              const t = TRAITS[a]!
              return (
                <g key={key}>
                  <rect {...common} fill={theme.surface2} stroke={theme.border} role="img" aria-label={`${t.label} 협의 유전력 h² ${f2(t.h2)}`} />
                  <text x={x + L.cell / 2} y={y + L.cell / 2 + (L.narrow ? 4 : 1)} textAnchor="middle" fontSize={valFont} fontStyle="italic" fill={theme.text} pointerEvents="none">
                    {f2(t.h2)}
                  </text>
                  {!L.narrow && (
                    <text x={x + L.cell / 2} y={y + L.cell / 2 + valFont} textAnchor="middle" fontSize={11} fontStyle="italic" fill={theme.textMuted} pointerEvents="none">
                      h²
                    </text>
                  )}
                </g>
              )
            }
            const upper = r < c
            const q = pairOf(a, b)
            const v = upper ? q.rg : q.rp
            const p = upper ? q.pg : q.pp
            const ns = p >= 0.05
            const dim = dimNs && ns
            const fill = divergingColor(theme, v)
            const ink = dim ? theme.textMuted : inkOn(theme, fill)
            const st = stars(p)
            const showSeLine = upper && seSmall
            const midY = y + L.cell / 2
            const valY = L.narrow ? midY + 1 : showSeLine ? midY - 2 : midY + 4
            return (
              <g key={key} className="cursor-pointer" onClick={() => onSelect(a, b)}>
                <rect {...common} fill={fill} fillOpacity={dim ? 0.3 : 1} stroke={dim ? theme.border : 'none'} strokeDasharray={dim ? '3 2' : undefined} role="button" aria-label={cellAria(a, b, upper)} aria-pressed={(selR === r && selC === c) || (selR === c && selC === r)} />
                <text x={x + L.cell / 2} y={valY} textAnchor="middle" fontSize={valFont} fontWeight={ns ? 400 : 700} fill={ink} pointerEvents="none" className="tabular-nums">
                  {f2(v)}
                  {!L.narrow && st && <tspan fontSize={Math.max(11, valFont - 2)}>{st}</tspan>}
                </text>
                {L.narrow && st && (
                  <text x={x + L.cell / 2} y={valY + 10} textAnchor="middle" fontSize={11} fontWeight={700} fill={ink} pointerEvents="none">
                    {st}
                  </text>
                )}
                {showSeLine && (
                  <text x={x + L.cell / 2} y={midY + valFont} textAnchor="middle" fontSize={11} fill={ink} pointerEvents="none">
                    ±{f2(q.se)}
                  </text>
                )}
              </g>
            )
          }),
        )}
        {/* 묶음 경계(대각 블록): 구조선은 선택 표시와 다른 모양 — muted 1.5px 점선(visual-language 「데이터 위 선택 표시」) */}
        {groups.map(g => {
          const ps = g.map(t => pos.get(t)!)
          const a = Math.min(...ps)
          const n = g.length
          return (
            <rect
              key={`gb${g.join('-')}`}
              x={cx(a)}
              y={cy(a)}
              width={n * L.cell}
              height={n * L.cell}
              fill="none"
              stroke={theme.textMuted}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              rx={4}
              pointerEvents="none"
              aria-hidden="true"
            />
          )
        })}
        {/* 선택 셀 + 대칭 셀 */}
        {selR !== undefined && selC !== undefined && selR !== selC && (
          <g pointerEvents="none" aria-hidden="true">
            {[
              [selR, selC],
              [selC, selR],
            ].map(([r, c]) => (
              <g key={`sel${r}-${c}`}>
                <rect x={cx(c!) + 1.5} y={cy(r!) + 1.5} width={L.cell - 3} height={L.cell - 3} rx={3} fill="none" stroke={ss.haloColor} strokeWidth={ss.haloWidth} />
                <rect x={cx(c!) + 1.5} y={cy(r!) + 1.5} width={L.cell - 3} height={L.cell - 3} rx={3} fill="none" stroke={ss.lineColor} strokeWidth={ss.lineWidth} />
              </g>
            ))}
          </g>
        )}
        {/* 키보드 포커스 링 */}
        {hasFocus && (
          <rect
            x={cx(fc) - 1}
            y={cy(fr) - 1}
            width={L.cell + 2}
            height={L.cell + 2}
            rx={4}
            fill="none"
            stroke={theme.accent}
            strokeWidth={2}
            strokeDasharray="4 2"
            pointerEvents="none"
            aria-hidden="true"
          />
        )}
      </svg>
      {tipNode}
    </div>
  )
}

/** 행렬 범례: 세 구역 + 발산 척도 −1~1 + 별 */
export function MatrixLegend() {
  const ticks = [-1, -0.5, 0, 0.5, 1]
  return (
    <div className="flex flex-col gap-3 text-xs text-muted sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-6">
      <div className="flex items-center gap-2">
        <svg width={34} height={34} viewBox="0 0 34 34" aria-hidden="true" className="shrink-0">
          <path d="M2 2 H32 V32 Z" fill="var(--viz-div-pos-2)" />
          <path d="M2 2 V32 H32 Z" fill="var(--viz-div-neg-1)" />
          <line x1="2" y1="2" x2="32" y2="32" stroke="var(--color-surface)" strokeWidth={5} />
          <rect x="1" y="1" width="32" height="32" rx="3" fill="none" stroke="var(--color-border)" />
        </svg>
        <p className="leading-snug text-text">
          <b>상삼각</b> = 유전 상관 rG · <b>하삼각</b> = 표현형 상관 rP
          <br />
          <b>대각</b> = 협의 유전력 h²(<i>기울임</i>)
        </p>
      </div>
      <figure className="w-full max-w-[260px]" aria-label="색 척도: 상관 계수 −1(파랑)부터 0(중간색)을 지나 1(주황·빨강)까지 고정">
        <figcaption className="mb-1 font-semibold text-text">상관 계수 (−1~1 고정, 0 = 중간색)</figcaption>
        <div
          className="h-3 rounded-sm border border-border"
          style={{
            background:
              'linear-gradient(to right, var(--viz-div-neg-3), var(--viz-div-neg-2), var(--viz-div-neg-1), var(--viz-div-0), var(--viz-div-pos-1), var(--viz-div-pos-2), var(--viz-div-pos-3))',
          }}
          aria-hidden="true"
        />
        <div className="relative mt-0.5 h-4 tabular-nums" aria-hidden="true">
          {ticks.map((t, i) => (
            <span
              key={t}
              className="absolute"
              style={{ left: `${((t + 1) / 2) * 100}%`, transform: i === 0 ? 'none' : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}
            >
              {f2(t)}
            </span>
          ))}
        </div>
      </figure>
      <p className="leading-snug">
        <span className="font-semibold text-text">*** </span>p &lt; 0.001 · <span className="font-semibold text-text">** </span>&lt; 0.01 ·{' '}
        <span className="font-semibold text-text">* </span>&lt; 0.05
        <br />
        점선 테두리·흐린 셀 = 비유의(p ≥ 0.05, 별 없음) · 회색 점선 상자 = 군집 묶음 · 진한 테두리 = 선택 쌍
      </p>
    </div>
  )
}
