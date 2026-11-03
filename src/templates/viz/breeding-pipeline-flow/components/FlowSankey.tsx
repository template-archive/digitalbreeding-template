import { useMemo } from 'react'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { hatchPattern } from '@/design-system'
import {
  FILED_2026,
  PENDING,
  REASON_LABEL,
  cohortCounts,
  cohortStages,
  cohortTransitions,
  flowSentence,
  int,
  lastStageIndex,
  pct1,
  pctSurv,
  sortedReasons,
  survival,
  type Cohort,
} from '../data'

/**
 * 코호트 계통 흐름 생키.
 * 공통 registry에 SankeyChart가 없어(템플릿은 echarts.use 금지) custom 시리즈로 노드·리본을 직접 그린다.
 * 선형 값: 노드 높이·리본 폭 = 계통 수 × 배율. 아주 작은 값은 최소 1.5px로 보이게 한다.
 */

type NodeKind = 'stage' | 'drop' | 'pending' | 'info'
interface FlowNode {
  id: string
  col: number
  kind: NodeKind
  value: number
  /** 한 줄 라벨(넓은 화면) */
  label: string
  /** 두 줄 라벨(좁은 화면) */
  label2: [string, string]
  tooltip: string
}
interface FlowLink {
  source: string
  target: string
  value: number
  kind: 'pass' | 'drop' | 'pending'
  tooltip: string
}
interface FlowModel {
  nodes: FlowNode[]
  links: FlowLink[]
  cols: number
}

export function buildFlow(G: Cohort, from: number): FlowModel {
  const st = cohortStages(G)
  const c = cohortCounts(G)
  const last = lastStageIndex(G)
  const trs = cohortTransitions(G)
  const nodes: FlowNode[] = []
  const links: FlowLink[] = []
  const stageName = (k: number) => `${st[k].short} ${st[k].yearLabel}`
  for (let k = from; k <= last; k++) {
    const col = k - from
    const filed = G === 2022 && k === 6
    const label = filed ? `${FILED_2026.name} 출원 ${FILED_2026.date}` : `${st[k].no} ${stageName(k)} · ${int(c[k])}`
    nodes.push({
      id: `s${k}`,
      col,
      kind: 'stage',
      value: c[k],
      label,
      label2: filed ? [`${st[k].no} ${FILED_2026.name} 출원`, FILED_2026.date] : [`${st[k].no} ${st[k].short}`, `${st[k].yearLabel} · ${int(c[k])}`],
      tooltip: `<b>${st[k].no} ${st[k].name} ${st[k].yearLabel}</b><br/>${int(c[k])}계통${k > 0 ? `<br/>누적 생존율 ${int(c[0])} 중 ${int(c[k])} · ${pctSurv(survival(G, k))}` : ''}${filed ? `<br/>${FILED_2026.name}(${FILED_2026.line}) 품종보호 출원 ${FILED_2026.date}` : ''}`,
    })
    if (k > from) {
      const tr = trs[k - 1]
      const dropN = tr.drop ?? 0
      // T6(품종 선정 심의)는 탈락 대신 "선정 제외"
      const dropWord = tr.key === 'T6' ? '선정 제외' : '탈락'
      nodes.push({
        id: `d${k}`,
        col,
        kind: 'drop',
        value: dropN,
        label: `${dropWord} ${int(dropN)}`,
        label2: [dropWord, int(dropN)],
        tooltip: `<b>${tr.label} ${dropWord} ${int(dropN)}계통</b><br/>판정 근거: ${tr.basis}`,
      })
      const pass = `${stageName(k - 1)} → ${stageName(k)}`
      links.push({ source: `s${k - 1}`, target: `s${k}`, value: c[k], kind: 'pass', tooltip: `<b>${pass}</b> · ${int(c[k])}계통 · 진급률 ${pct1(tr.rate ?? 0)}` })
      const reasons = tr.alloc ? sortedReasons(tr.alloc) : []
      links.push({
        source: `s${k - 1}`,
        target: `d${k}`,
        value: dropN,
        kind: 'drop',
        tooltip:
          `<b>${stageName(k - 1)} → ${dropWord}</b> · ${int(dropN)}계통 (${tr.basis})<br/>` +
          reasons.map(x => `${REASON_LABEL[x.r]} ${int(x.n)} (${pct1((x.n / dropN) * 100)})`).join('<br/>'),
      })
    }
  }
  const pend = PENDING[G]
  if (pend.length) {
    const col = last - from + 1
    pend.forEach((p, i) => {
      const id = `p${i}`
      nodes.push({
        id,
        col,
        kind: p.kind,
        value: p.value,
        label: p.label,
        label2: p.label.includes(' · ') ? (p.label.split(' · ').length > 2 ? [p.label.split(' · ').slice(0, 2).join(' · '), p.label.split(' · ').slice(2).join(' · ')] : (p.label.split(' · ') as [string, string])) : [p.label, ''],
        tooltip: `<b>${p.label}</b><br/>${p.detail}`,
      })
      links.push({ source: `s${last}`, target: id, value: p.value, kind: 'pending', tooltip: `<b>${stageName(last)} → ${p.label}</b><br/>${p.detail}` })
    })
  }
  return { nodes, links, cols: Math.max(...nodes.map(n => n.col)) + 1 }
}

/**
 * '출원 예정' 노드 채움: 단계색(강조색) 위 표면색 사선(공통 stripeBg·stripeDecal과 같은 모양, 주기 4.2px).
 * 같은 그림에서 info 파랑을 다른 계열로 쓰지 않기 위해(시각 언어 「accent와 info를 한 그림의 다른 계열로 쓰지 않음」)
 * '예정'을 색이 아니라 빗금으로 구분한다. custom 시리즈 rect는 decal을 받지 않아 캔버스 패턴으로 그린다.
 */
function stripePattern(color: string, surface: string): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const size = 6
  const cv = document.createElement('canvas')
  cv.width = size
  cv.height = size
  const ctx = cv.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = color
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = surface
  ctx.lineWidth = 1.4
  ctx.beginPath()
  for (let o = -size; o <= size * 2; o += size) {
    ctx.moveTo(o, size)
    ctx.lineTo(o + size, 0)
  }
  ctx.stroke()
  return cv
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const NODE_W = 12
const MIN_H = 1.5
const TOP = 40
const BOTTOM = 8
const DROP_GAP = 20
const PEND_GAP = 36

function layout(m: FlowModel, W: number, H: number, rightPad: number) {
  const usable = H - TOP - BOTTOM - DROP_GAP
  const maxTotal = Math.max(...Array.from({ length: m.cols }, (_, col) => m.nodes.filter(n => n.col === col).reduce((s, n) => s + n.value, 0)))
  const scale = usable / maxTotal
  const left = 4
  const step = m.cols > 1 ? (W - left - rightPad - NODE_W) / (m.cols - 1) : 0
  const rects = new Map<string, Rect>()
  for (let col = 0; col < m.cols; col++) {
    const x = left + col * step
    let y = TOP
    const colNodes = m.nodes.filter(n => n.col === col)
    for (const n of colNodes) {
      const h = Math.max(MIN_H, n.value * scale)
      if (n.kind === 'drop') y += DROP_GAP
      else if (n.kind === 'pending' && colNodes.some(o => o.kind === 'info')) y += PEND_GAP
      rects.set(n.id, { x, y, w: NODE_W, h })
      y += h
    }
  }
  // 리본: 출발 노드 위에서부터 쌓고, 도착 노드는 들어오는 리본 하나
  const outOff = new Map<string, number>()
  const inOff = new Map<string, number>()
  const ribbons = m.links.map(l => {
    const s = rects.get(l.source) as Rect
    const t = rects.get(l.target) as Rect
    const w = Math.max(1, l.value * scale)
    const so = outOff.get(l.source) ?? 0
    const to = inOff.get(l.target) ?? 0
    outOff.set(l.source, so + w)
    inOff.set(l.target, to + w)
    return { x0: s.x + s.w, y0: s.y + so, x1: t.x, y1: t.y + to, w }
  })
  return { rects, ribbons, step }
}

/** 3차 베지어 리본을 다각형으로(위 경계 → 아래 경계 역순) */
function ribbonPoints(r: { x0: number; y0: number; x1: number; y1: number; w: number }): number[][] {
  const N = 20
  const mx = (r.x0 + r.x1) / 2
  const bez = (t: number, a: number, b: number) => {
    const u = 1 - t
    // 제어점: (x0, a) (mx, a) (mx, b) (x1, b)
    return { x: u * u * u * r.x0 + 3 * u * u * t * mx + 3 * u * t * t * mx + t * t * t * r.x1, y: u * u * u * a + 3 * u * u * t * a + 3 * u * t * t * b + t * t * t * b }
  }
  const top: number[][] = []
  const bottom: number[][] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const p = bez(t, r.y0, r.y1)
    top.push([p.x, p.y])
    const q = bez(t, r.y0 + r.w, r.y1 + r.w)
    bottom.push([q.x, q.y])
  }
  return [...top, ...bottom.reverse()]
}

export function FlowSankey({ cohort, from, height, ariaPrefix }: { cohort: Cohort; from: number; height: number; ariaPrefix: string }) {
  const theme = useChartTheme()
  const model = useMemo(() => buildFlow(cohort, from), [cohort, from])
  const hatch = useMemo(() => hatchPattern(theme), [theme])
  const planned = useMemo(() => stripePattern(theme.accent, theme.surface), [theme])

  const option = useMemo<EChartsOption>(() => {
    const items = [...model.links.map(l => ({ type: 'link' as const, l })), ...model.nodes.map(n => ({ type: 'node' as const, n }))]
    let cache: { W: number; H: number; L: ReturnType<typeof layout>; narrow: boolean } | null = null
    const getLayout = (W: number, H: number) => {
      if (!cache || cache.W !== W || cache.H !== H) {
        const narrow = W / model.cols < 150
        const rightPad = narrow ? 150 : 190
        cache = { W, H, L: layout(model, W, H, rightPad), narrow }
      }
      return cache
    }
    const font = (size: number, weight = 400) => `${weight} ${size}px ${theme.fontFamily}`
    const nodeFill = (k: NodeKind) =>
      k === 'stage'
        ? theme.accent
        : k === 'drop'
          ? theme.textMuted
          : k === 'info'
            ? planned
              ? { image: planned, repeat: 'repeat' as const }
              : theme.accent
            : hatch
              ? { image: hatch, repeat: 'repeat' as const }
              : theme.surface2
    return {
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (p: unknown) => {
          const it = items[(p as { dataIndex: number }).dataIndex]
          return it ? (it.type === 'link' ? it.l.tooltip : it.n.tooltip) : ''
        },
      },
      series: [
        {
          type: 'custom',
          coordinateSystem: 'none',
          data: items.map((_, i) => i),
          animation: false,
          renderItem: ((params: { dataIndex: number }, api: { getWidth: () => number; getHeight: () => number }) => {
            const { L, narrow } = getLayout(api.getWidth(), api.getHeight())
            const it = items[params.dataIndex]
            if (it.type === 'link') {
              const idx = model.links.indexOf(it.l)
              const r = L.ribbons[idx]
              const color = it.l.kind === 'pass' ? theme.accent : theme.textMuted
              return {
                type: 'polygon',
                shape: { points: ribbonPoints(r) },
                style: { fill: color, opacity: it.l.kind === 'pass' ? 0.32 : it.l.kind === 'drop' ? 0.16 : 0.22 },
                emphasis: { style: { opacity: 0.55 } },
              }
            }
            const n = it.n
            const rect = L.rects.get(n.id) as Rect
            const lastCol = n.col === model.cols - 1
            const children: unknown[] = [
              {
                type: 'rect',
                shape: { x: rect.x, y: rect.y, width: rect.w, height: rect.h, r: 1 },
                style: { fill: nodeFill(n.kind), stroke: n.kind === 'pending' ? theme.textMuted : n.kind === 'info' ? theme.accent : undefined, lineWidth: n.kind === 'pending' || n.kind === 'info' ? 1 : 0 },
              },
            ]
            const color = n.kind === 'drop' ? theme.textMuted : theme.text
            const weight = n.kind === 'stage' ? 600 : 500
            if (n.kind === 'stage' && !lastCol) {
              // 단계 라벨: 노드 위, 왼쪽 정렬
              if (narrow) {
                children.push(
                  { type: 'text', silent: true, style: { x: rect.x, y: rect.y - 18, text: n.label2[0], fill: theme.textMuted, font: font(11), align: 'left', verticalAlign: 'bottom' } },
                  { type: 'text', silent: true, style: { x: rect.x, y: rect.y - 4, text: n.label2[1], fill: color, font: font(12, 700), align: 'left', verticalAlign: 'bottom' } },
                )
              } else {
                children.push({ type: 'text', silent: true, style: { x: rect.x, y: rect.y - 6, text: n.label, fill: color, font: font(12, weight), align: 'left', verticalAlign: 'bottom' } })
              }
            } else {
              // 탈락·마지막 열 노드: 노드 오른쪽, 세로 가운데
              const cy = rect.y + Math.min(rect.h / 2, 60)
              // 좁은 화면: 중간 열 탈락 노드와 대기·예정 노드만 두 줄. 마지막 열 단계·탈락 노드는 한 줄(서로 겹치지 않게)
              const twoLine = narrow && !!n.label2[1] && (n.kind === 'pending' || n.kind === 'info' || (n.kind === 'drop' && !lastCol))
              const text = twoLine ? `${n.label2[0]}\n${n.label2[1]}` : n.label
              children.push({ type: 'text', silent: true, style: { x: rect.x + rect.w + 6, y: cy, text, fill: color, font: font(n.kind === 'drop' ? 11 : 12, weight), align: 'left', verticalAlign: 'middle', lineHeight: 14 } })
            }
            return { type: 'group', children }
          }) as unknown,
        },
      ],
    } as EChartsOption
  }, [model, theme, hatch, planned])

  const c = cohortCounts(cohort)
  const st = cohortStages(cohort)
  const trs = cohortTransitions(cohort)
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`${ariaPrefix}${flowSentence(cohort)}`}
      fallbackTable={{
        columns: ['단계', '계통 수', '진급률(코호트)', '탈락'],
        rows: c.slice(from, lastStageIndex(cohort) + 1).map((n, i) => {
          const k = from + i
          const tr = k > 0 ? trs[k - 1] : null
          return [`${st[k].no} ${st[k].name} ${st[k].yearLabel}`, int(n), tr?.rate != null ? pct1(tr.rate) : '–', tr?.drop != null ? int(tr.drop) : '–']
        }),
      }}
    />
  )
}
