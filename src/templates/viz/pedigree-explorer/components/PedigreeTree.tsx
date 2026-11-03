import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { selectionStroke, useChartTheme } from '@/charts'
import { KIND_LABEL, NODES, NO_GENO_REASON, YEAR_LABEL, instances, loopEndKeys, type Depth, type Instance, type Loop } from '../data'
import { activePaths, fmtGebv, loopColor, useScrollToLoop } from './style'

/** 노드·간격 규격. 폭이 모자라면 한 단계씩 줄인다(390px은 compact: 4열이 한 화면, 행 간격 44px = 터치 영역) */
interface Metrics {
  compact: boolean
  nodeW: number
  nodeH: number
  gapMin: number
  row: number
  padR: number
}
const WIDE: Metrics = { compact: false, nodeW: 136, nodeH: 42, gapMin: 46, row: 54, padR: 14 }
const MID: Metrics = { compact: false, nodeW: 112, nodeH: 42, gapMin: 28, row: 54, padR: 14 }
const COMPACT: Metrics = { compact: true, nodeW: 70, nodeH: 34, gapMin: 8, row: 44, padR: 8 }
/** 이 폭 아래는 MID로도 3세대가 들어가지 않는다 */
const COMPACT_BELOW = 520
/** 열 간격 상한: 컨테이너 폭에 맞춰 gapMin~GAP_MAX 사이로 늘린다(모자라면 gapMin 고정 + 가로 스크롤) */
const GAP_MAX = 180
const HEAD = 30

const COL_HEAD = ['기준 계통', '1세대(부모)', '2세대(조부모)', '3세대', '4세대', '5세대']
const COL_HEAD_SHORT = ['기준', '1세대', '2세대', '3세대', '4세대', '5세대']

function metricsFor(boxW: number, depth: Depth): Metrics {
  const need = (m: Metrics) => (depth + 1) * m.nodeW + depth * m.gapMin + m.padR
  if (boxW === 0 || boxW >= need(WIDE)) return WIDE
  return boxW >= need(MID) || boxW >= COMPACT_BELOW ? MID : COMPACT
}

interface Props {
  root: string
  depth: Depth
  loops: Loop[]
  highlight: boolean
  /** 표·범례에서 강조 중인 루프 번호 */
  activeLoop: number | null
  /** 이 루프의 공통 조상 노드로 스크롤(390px에서 표 번호를 눌렀을 때) */
  scrollLoop: number | null
  selectedId: string | null
  onSelect: (id: string, el: Element) => void
}

interface Placed extends Instance {
  x: number
  cy: number
}

export function PedigreeTree({ root, depth, loops, highlight, activeLoop, scrollLoop, selectedId, onSelect }: Props) {
  const ss = selectionStroke(useChartTheme())
  const [hover, setHover] = useState<string | null>(null)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [boxW, setBoxW] = useState(0)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBoxW(Math.floor(e!.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useScrollToLoop(boxRef, scrollLoop, depth)

  const m = metricsFor(boxW, depth)
  const { compact, nodeW: NODE_W, nodeH: NODE_H, row: ROW, padR: PAD_R } = m
  const gap = Math.round(Math.min(GAP_MAX, Math.max(m.gapMin, (boxW - PAD_R - (depth + 1) * NODE_W) / depth)))
  const PITCH = NODE_W + gap

  const { nodes, leaves, counts } = useMemo(() => {
    const { out, leaves, rootY } = instances(root, depth)
    const all: Instance[] = [{ id: root, g: 0, path: '', truncated: false, y: rootY }, ...out]
    const nodes: Placed[] = all.map(i => ({
      ...i,
      x: i.g * PITCH,
      cy: HEAD + i.y * ROW + ROW / 2,
    }))
    const counts = new Map<string, number>()
    for (const i of out) counts.set(i.id, (counts.get(i.id) ?? 0) + 1)
    return { nodes, leaves, counts }
  }, [root, depth, PITCH, ROW])

  const byKey = useMemo(() => new Map(nodes.map(n => [n.path, n])), [nodes])
  // 루프 색·배지는 경로쌍 끝 인스턴스(path 키)에만 — 개체 ID로 칠하지 않는다
  const loopIndex = useMemo(() => loopEndKeys(loops), [loops])
  const active = useMemo(() => activePaths(loops, activeLoop), [activeLoop, loops])

  const width = depth * PITCH + NODE_W + PAD_R
  const height = HEAD + Math.max(1, leaves) * ROW
  const focusOrder = [...nodes].sort((a, b) => a.g - b.g || a.y - b.y)
  const hovered = hover !== null ? byKey.get(hover) : undefined

  const onKey = (e: KeyboardEvent<SVGGElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(id, e.currentTarget)
    }
  }

  return (
    <div ref={boxRef} className="w-full">
      <div className="relative" style={{ width, minWidth: width }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block select-none"
          role="group"
          aria-label={`${NODES[root]!.name ?? root} 계통도, ${depth}세대까지 조상 ${nodes.length - 1}개 인스턴스`}
        >
          {/* 열 머리 */}
          {(compact ? COL_HEAD_SHORT : COL_HEAD).slice(0, depth + 1).map((h, g) => (
            <g key={h} aria-hidden="true">
              <text x={g * PITCH} y={14} className="fill-muted" fontSize={compact ? 11 : 11.5} fontWeight={600}>
                {h}
              </text>
              <line x1={g * PITCH} x2={g * PITCH + NODE_W} y1={21} y2={21} className="stroke-border" strokeWidth={1} />
            </g>
          ))}

          {/* 간선: 자식 오른쪽 → 부모 왼쪽. 모본 실선(위), 부본 점선(아래) */}
          <g aria-hidden="true">
            {nodes
              .filter(n => n.g > 0)
              .map(n => {
                const child = byKey.get(n.path.slice(0, -1))!
                const isDam = n.path.endsWith('D')
                const x1 = child.x + NODE_W
                const y1 = child.cy + (isDam ? -1 : 1) * (compact ? 4 : 6)
                const x2 = n.x
                const mid = compact ? x1 + 4 : x1 + gap / 2 - 4
                const on = active?.has(n.path)
                const loopI = activeLoop ?? -1
                const dim = active !== null && !on
                return (
                  <g key={`e${n.path}`} opacity={dim ? 0.18 : 1}>
                    <path
                      d={`M${x1},${y1} H${mid} V${n.cy} H${x2}`}
                      fill="none"
                      className={on ? undefined : 'stroke-muted'}
                      style={on ? { stroke: loopColor(loopI) } : undefined}
                      strokeWidth={on ? 2.5 : 1.25}
                      strokeDasharray={isDam ? undefined : '4 3'}
                    />
                    <text x={x2 - (compact ? 5 : 9)} y={n.cy - 4} textAnchor="middle" fontSize={11} fontWeight={700} className={on ? 'fill-text' : 'fill-muted'}>
                      {isDam ? '♀' : '♂'}
                    </text>
                  </g>
                )
              })}
          </g>

          {/* 노드(Tab 순서: 세대 → 위에서 아래) */}
          {focusOrder.map(n => {
            const p = NODES[n.id]!
            const isRoot = n.g === 0
            const li = highlight ? loopIndex.get(n.path) : undefined
            const isLoop = li !== undefined
            const cnt = counts.get(n.id) ?? 0
            const repeated = cnt > 1
            const dim = active !== null && !active.has(n.path)
            const sel = selectedId === n.id
            const y = n.cy - NODE_H / 2
            const title = p.name ?? p.id
            const sub = p.kind === 'V' ? p.id : p.kind === 'L' ? `계통 · ${p.year}` : p.kind === 'G' ? `도입 · ${p.year}` : '기록 없음'
            // compact: 둘째 줄 하나에 보조 글자 + 꼬리표. 꼬리표가 있으면 긴 보조 글자를 줄인다
            const tagged = repeated || n.truncated
            const subShort =
              n.truncated && repeated
                ? `×${cnt}`
                : p.kind === 'V'
                  ? tagged
                    ? String(p.year)
                    : p.id
                  : p.kind === 'L'
                    ? String(p.year)
                    : p.kind === 'G'
                      ? tagged
                        ? String(p.year)
                        : `도입 ${p.year}`
                      : tagged
                        ? '기초'
                        : '기록 없음'
            const tagShort = n.truncated ? '＋상위' : repeated ? `×${cnt}` : null
            const rx = p.kind === 'V' ? 8 : p.kind === 'L' ? 1.5 : 4
            const fillCls = p.kind === 'V' ? 'fill-accent/10' : p.kind === 'B' ? 'fill-surface-2' : 'fill-surface'
            const strokeCls = isLoop ? undefined : isRoot ? 'stroke-accent' : p.kind === 'V' ? 'stroke-accent/60' : p.kind === 'B' ? 'stroke-border' : 'stroke-muted'
            const textX = compact ? 5 : 9
            const aria = [
              `${n.g === 0 ? '기준 계통' : `${n.g}세대 ${n.path.endsWith('D') ? '모본' : '부본'}`}`,
              p.name ? `${p.name}(${p.id})` : p.id,
              KIND_LABEL[p.kind],
              `${YEAR_LABEL[p.kind]} ${p.year}`,
              isLoop ? `근연 루프 ${li! + 1}의 공통 조상` : '',
              repeated ? `이 계통도에서 ${cnt}번 등장` : '',
              n.truncated ? '상위 계보 더 있음' : '',
            ]
              .filter(Boolean)
              .join(', ')
            return (
              <g
                key={`n${n.path}`}
                transform={`translate(${n.x},${y})`}
                tabIndex={0}
                role="button"
                aria-pressed={sel}
                data-loop-end={isLoop ? li : undefined}
                opacity={dim ? 0.25 : 1}
                className="cursor-pointer outline-none"
                onClick={e => onSelect(n.id, e.currentTarget)}
                onKeyDown={e => onKey(e, n.id)}
                onMouseEnter={() => setHover(n.path)}
                onMouseLeave={() => setHover(h => (h === n.path ? null : h))}
                onFocus={() => setFocusKey(n.path)}
                onBlur={() => setFocusKey(k => (k === n.path ? null : k))}
              >
                <desc>{aria}</desc>
                {/* 누르는 영역: 보이는 노드보다 넓게(행 간격 전체, 터치 44px) */}
                {compact && <rect x={-gap / 2} y={-(ROW - NODE_H) / 2} width={NODE_W + gap} height={ROW} fill="transparent" />}
                {/* 선택 = 데이터 위 선택 규격(표면색 후광 → 글자색 선, selectionStroke). 키보드 포커스는 강조색 점선 링 */}
                {sel && (
                  <>
                    <rect x={-4} y={-4} width={NODE_W + 8} height={NODE_H + 8} rx={rx + 3} fill="none" stroke={ss.haloColor} strokeWidth={ss.haloWidth} />
                    <rect x={-4} y={-4} width={NODE_W + 8} height={NODE_H + 8} rx={rx + 3} fill="none" stroke={ss.lineColor} strokeWidth={ss.lineWidth} />
                  </>
                )}
                {!sel && focusKey === n.path && (
                  <rect x={-4} y={-4} width={NODE_W + 8} height={NODE_H + 8} rx={rx + 3} fill="none" className="stroke-accent" strokeWidth={2} strokeDasharray="3 2" />
                )}
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={rx}
                  className={`${fillCls} ${strokeCls ?? ''}`}
                  style={isLoop ? { stroke: loopColor(li!) } : undefined}
                  strokeWidth={isLoop || isRoot ? 2.5 : 1.25}
                  strokeDasharray={p.kind === 'G' && !isLoop ? '4 3' : undefined}
                />
                {compact ? (
                  <>
                    <text x={textX} y={14} fontSize={11} fontWeight={700} className="fill-text">
                      {title}
                    </text>
                    <text x={textX} y={27} fontSize={11} className="fill-muted">
                      {subShort}
                    </text>
                    {tagShort && (
                      <text x={NODE_W - 4} y={27} textAnchor="end" fontSize={11} fontWeight={700} className={n.truncated ? 'fill-accent' : isLoop ? 'fill-text' : 'fill-muted'}>
                        {tagShort}
                      </text>
                    )}
                  </>
                ) : (
                  <>
                    <text x={textX} y={17} fontSize={12.5} fontWeight={700} className="fill-text">
                      {title}
                    </text>
                    <text x={textX} y={33} fontSize={11} className="fill-muted">
                      {sub}
                    </text>
                    {repeated && (
                      <text x={NODE_W - 8} y={17} textAnchor="end" fontSize={11.5} fontWeight={700} className={isLoop ? 'fill-text' : 'fill-muted'}>
                        ×{cnt}
                      </text>
                    )}
                    {n.truncated && (
                      <text x={NODE_W - 8} y={33} textAnchor="end" fontSize={11} fontWeight={700} className="fill-accent">
                        ＋상위
                      </text>
                    )}
                  </>
                )}
                {isLoop && (
                  <g transform={compact ? `translate(${NODE_W - 1},-3)` : `translate(${NODE_W - 2},0)`}>
                    <circle r={8.5} className="fill-surface" style={{ stroke: loopColor(li!) }} strokeWidth={2} />
                    <text y={3.9} textAnchor="middle" fontSize={11} fontWeight={800} className="fill-text">
                      {li! + 1}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>

        {hovered && (
          <NodeTip
            n={hovered}
            nodeW={NODE_W}
            nodeH={NODE_H}
            right={hovered.x + 270 > width}
            count={hovered.g === 0 ? 0 : (counts.get(hovered.id) ?? 0)}
            loopI={highlight ? loopIndex.get(hovered.path) : undefined}
          />
        )}
      </div>
    </div>
  )
}

function NodeTip({ n, nodeW, nodeH, count, loopI, right }: { n: Placed; nodeW: number; nodeH: number; count: number; loopI: number | undefined; right: boolean }) {
  const p = NODES[n.id]!
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 w-max max-w-64 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs leading-relaxed text-text shadow-2"
      style={
        right
          ? {
              left: n.x + nodeW - 8,
              top: n.cy + nodeH / 2 + 6,
              transform: 'translateX(-100%)',
            }
          : { left: n.x + 8, top: n.cy + nodeH / 2 + 6 }
      }
    >
      <div className="font-semibold">
        {p.id}
        {p.name ? `(${p.name})` : ''}
      </div>
      <div className="text-muted">
        {KIND_LABEL[p.kind]} · {YEAR_LABEL[p.kind]} {p.year}
      </div>
      <div className="tabular-nums">GEBV {p.gebv === null ? NO_GENO_REASON : `${fmtGebv(p.gebv)} kg/10a (r² ${p.r2!.toFixed(2)})`}</div>
      <div className="text-muted">{n.g === 0 ? '기준 계통' : `이 계통도에서 ×${count}`}</div>
      {loopI !== undefined && <div className="font-semibold">근연 루프 {loopI + 1}의 공통 조상</div>}
    </div>
  )
}
