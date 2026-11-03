import { useMemo } from 'react'
import { useElementWidth } from '@/design-system'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { formatFixed } from '@/lib/format'
import {
  GENOTYPES,
  GENO_BY_ID,
  GGE_PC,
  HULL_IDS,
  MEGA_BY_WINNER,
  MEGA_ENVS,
  N_G,
  SITES,
  SITE2,
  SITE_SCORES,
  SITE_WINNER_IDS,
  SITE_YEAR_TOP_IDS,
  YEARS,
  UNSTABLE_REF,
  type Pt,
} from '../data'
import { lineColor, megaColor } from './colors'

/** 그리드 여백(px). containLabel을 끄고 고정해야 x·y 1단위 픽셀 길이를 같게 맞출 수 있다 */
const GRID = { left: 40, right: 14, top: 12, bottom: 42 }
const TICK = 2

export const ggeAxisTitle = (k: 0 | 1) => `PC${k + 1} (${formatFixed(GGE_PC[k], 1)}%)`

const norm = (p: Pt): Pt => {
  const l = Math.hypot(p[0], p[1]) || 1
  return [p[0] / l, p[1] / l]
}

/** 다각형 변마다 원점에서 내린 수선의 방향(변 k = 꼭짓점 k → k+1) */
const HULL_PTS: Pt[] = HULL_IDS.map(id => GENO_BY_ID[id]!.gge)
const RAYS: Pt[] = HULL_PTS.map((p, k) => {
  const q = HULL_PTS[(k + 1) % HULL_PTS.length]!
  const d: Pt = [q[0] - p[0], q[1] - p[1]]
  const t = -(p[0] * d[0] + p[1] * d[1]) / (d[0] * d[0] + d[1] * d[1])
  return norm([p[0] + t * d[0], p[1] + t * d[1]])
})

/** 데이터 범위(유전자형 점 + 지역 벡터 끝) */
const EXTENT = (() => {
  const pts = [...GENOTYPES.map(g => g.gge), ...SITE_SCORES]
  const pad = 1.2
  return {
    x: [Math.min(...pts.map(p => p[0])) - pad, Math.max(...pts.map(p => p[0])) + pad] as Pt,
    y: [Math.min(...pts.map(p => p[1])) - pad, Math.max(...pts.map(p => p[1])) + pad] as Pt,
  }
})()

/** 그리드 픽셀 크기에 맞춰 x·y 범위를 넓혀 1단위 길이를 같게 한다 */
function equalRanges(width: number, height: number) {
  const w = Math.max(width - GRID.left - GRID.right, 50)
  const h = Math.max(height - GRID.top - GRID.bottom, 50)
  const dx = EXTENT.x[1] - EXTENT.x[0]
  const dy = EXTENT.y[1] - EXTENT.y[0]
  const s = Math.min(w / dx, h / dy) // px / 단위
  const cx = (EXTENT.x[0] + EXTENT.x[1]) / 2
  const cy = (EXTENT.y[0] + EXTENT.y[1]) / 2
  const hx = w / s / 2
  const hy = h / s / 2
  return { x: [cx - hx, cx + hx] as Pt, y: [cy - hy, cy + hy] as Pt, pxPerUnit: s }
}

type Box = [number, number, number, number]
/** 글자 폭 근사: 한글·CJK는 글자 크기, 그 밖은 0.6배 */
const textW = (t: string, fs: number) => [...t].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? fs : fs * 0.6), 0) + 2
const overlapArea = (a: Box, b: Box) =>
  Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]))
const ALWAYS_LABELED = new Set([...HULL_IDS, UNSTABLE_REF, 'YR07-0231', 'YR13-0819'])

/** 지역별 연도 실측 1위 문구: "2025·2026 모두 YR20-0527" 또는 "2025 A · 2026 B" */
export function siteYearTopText(j: number): string {
  const tops = SITE_YEAR_TOP_IDS[j]!
  return tops.every(id => id === tops[0]) ? `${YEARS.join('·')} 모두 ${tops[0]}` : YEARS.map((y, t) => `${y} ${tops[t]}`).join(' · ')
}

export interface GgeBiplotProps {
  selectedId: string
  onSelect: (id: string) => void
  showSectors: boolean
  showAllLabels: boolean
  height: number
  ariaLabel: string
}

export function GgeBiplot({ selectedId, onSelect, showSectors, showAllLabels, height, ariaLabel }: GgeBiplotProps) {
  const theme = useChartTheme()
  const { ref, width } = useElementWidth()

  const option = useMemo<EChartsOption | null>(() => {
    if (width <= 0) return null
    const rng = equalRanges(width, height)
    const R = 4 * Math.max(...rng.x.map(Math.abs), ...rng.y.map(Math.abs))
    const series: unknown[] = []

    // ---- 라벨 위치 피하기(그리드 안 픽셀 좌표에서 탐욕 배치) ----
    const plotW = Math.max(width - GRID.left - GRID.right, 50)
    const plotH = Math.max(height - GRID.top - GRID.bottom, 50)
    const toPx = (p: Pt): Pt => [(p[0] - rng.x[0]) * rng.pxPerUnit, (rng.y[1] - p[1]) * rng.pxPerUnit]
    const radius = (g: (typeof GENOTYPES)[number]) => (g.id === selectedId ? 13 : lineColor(theme, g.id) ? 10 : g.isVertex ? 8 : 6.5) / 2
    const placed: Box[] = []
    GENOTYPES.forEach(g => {
      const [x, y] = toPx(g.gge)
      const r = radius(g) + 1
      placed.push([x - r, y - r, x + r, y + r])
    })
    SITE_SCORES.forEach(p => {
      const [x, y] = toPx(p)
      placed.push([x - 5, y - 5, x + 5, y + 5])
    })
    const cost = (b: Box, extra: Box[] = []) =>
      (b[0] < 0 || b[1] < 0 || b[2] > plotW || b[3] > plotH ? 1e6 : 0) +
      placed.reduce((s, o) => s + overlapArea(b, o), 0) +
      extra.reduce((s, o) => s + 0.5 * overlapArea(b, o), 0)

    // 지역 라벨(정리 회차 3): 화살표 끝 + 단위 벡터 × 8 px에 벡터 바깥쪽으로 정렬해 놓는다.
    // 다른 지역 라벨·유전자형 마커(반경 + 2 px)·유전자형 라벨 추정 상자와 겹치면 벡터 수직 방향으로
    // 라벨 높이만큼 민다(최대 3회, 양쪽 중 겹침이 적은 쪽). 밀린 라벨은 1px 지시선으로 화살표 끝과 잇는다.
    const SITE_FS = 11
    const SITE_H = SITE_FS + 6 // 글자 + padding [1, 3] + 여유
    const markerBoxes: Box[] = GENOTYPES.map(g => {
      const [x, y] = toPx(g.gge)
      const r = radius(g) + 2
      return [x - r, y - r, x + r, y + r]
    })
    // 유전자형 라벨 추정 상자: 기본 쪽(오른쪽, PC1 < −0.5면 왼쪽)에 놓인다고 가정
    // 좁은 그림(390px): 늘 표시할 라벨을 다각형 꼭짓점·선택 계통으로 줄이고, 자리를 찾아도 겹치는 라벨은 숨긴다(툴팁·선택 때 보인다)
    const narrowPlot = width < 460
    const wantsLabel = (g: (typeof GENOTYPES)[number]) => g.id === selectedId || showAllLabels || (narrowPlot ? g.isVertex : ALWAYS_LABELED.has(g.id))
    const genoEstBoxes: Box[] = GENOTYPES.filter(wantsLabel).map(g => {
      const fs = 11 // 글자 하한 11px(강조 라벨은 굵기로 구분)
      const w = textW(g.name ?? g.id, fs)
      const h = fs + 4
      const [x, y] = toPx(g.gge)
      const d = radius(g) + 4
      return g.gge[0] < -0.5 ? [x - d - w, y - h / 2, x - d, y + h / 2] : [x + d, y - h / 2, x + d + w, y + h / 2]
    })
    const siteBoxes: Box[] = []
    const siteCost = (b: Box) =>
      (b[0] < 0 || b[1] < 0 || b[2] > plotW || b[3] > plotH ? 1e6 : 0) +
      [...siteBoxes, ...markerBoxes].reduce((acc, o) => acc + overlapArea(b, o), 0) +
      genoEstBoxes.reduce((acc, o) => acc + 0.5 * overlapArea(b, o), 0)
    /** 지역 j → 라벨 중심의 화살표 끝 기준 오프셋(px)과 밀림 여부 */
    const siteLabel = new Map<number, { offset: [number, number]; moved: boolean }>()
    SITES.map((_, j) => j)
      .sort((a, b) => Math.hypot(...SITE_SCORES[b]!) - Math.hypot(...SITE_SCORES[a]!))
      .forEach(j => {
        const [tx, ty] = toPx(SITE_SCORES[j]!)
        const [ox, oy] = toPx([0, 0])
        const len = Math.hypot(tx - ox, ty - oy) || 1
        const ux = (tx - ox) / len
        const uy = (ty - oy) / len
        const w = textW(SITES[j]!.short, SITE_FS) + 6
        // 사분면별 정렬: 라벨 상자가 앵커에서 벡터 바깥쪽으로 펼쳐지게 중심을 옮긴다
        const cx0 = ux * 8 + (ux >= 0 ? w / 2 : -w / 2) * Math.min(1, Math.abs(ux) * 2)
        const cy0 = uy * 8 + (uy >= 0 ? SITE_H / 2 : -SITE_H / 2) * Math.min(1, Math.abs(uy) * 2)
        const boxAt = (dx: number, dy: number): Box => [tx + dx - w / 2, ty + dy - SITE_H / 2, tx + dx + w / 2, ty + dy + SITE_H / 2]
        let best = { offset: [cx0, cy0] as [number, number], cost: siteCost(boxAt(cx0, cy0)) }
        if (best.cost > 0) {
          // 적게 미는 쪽을 먼저: 1칸(양쪽) → 2칸 → 3칸
          search: for (let step = 1; step <= 3; step++) {
            for (const side of [1, -1]) {
              const dx = cx0 + side * -uy * SITE_H * step
              const dy = cy0 + side * ux * SITE_H * step
              const c = siteCost(boxAt(dx, dy))
              if (c < best.cost) best = { offset: [dx, dy], cost: c }
              if (c === 0) break search
            }
          }
        }
        siteLabel.set(j, { offset: best.offset, moved: best.offset[0] !== cx0 || best.offset[1] !== cy0 })
        siteBoxes.push(boxAt(...best.offset))
      })
    placed.push(...siteBoxes)

    // 유전자형 라벨: 기본 쪽 → 반대쪽 → 위 → 아래 중 겹침이 없는 첫 자리(없으면 겹침이 가장 적은 자리)
    const genoLabelPos = new Map<string, string>()
    const labeledGenos = GENOTYPES.filter(wantsLabel).sort(
      (a, b) => Number(b.id === selectedId) - Number(a.id === selectedId) || Number(ALWAYS_LABELED.has(b.id)) - Number(ALWAYS_LABELED.has(a.id)),
    )
    labeledGenos.forEach(g => {
      const fs = 11
      const text = g.name ?? g.id
      const w = textW(text, fs)
      const h = fs + 4
      const [x, y] = toPx(g.gge)
      const d = radius(g) + 4
      const boxes: Record<string, Box> = {
        right: [x + d, y - h / 2, x + d + w, y + h / 2],
        left: [x - d - w, y - h / 2, x - d, y + h / 2],
        top: [x - w / 2, y - d - h, x + w / 2, y - d],
        bottom: [x - w / 2, y + d, x + w / 2, y + d + h],
      }
      const first = g.gge[0] < -0.5 ? 'left' : 'right'
      const order = [first, first === 'left' ? 'right' : 'left', 'top', 'bottom']
      let best = order[0]!
      let bestCost = Infinity
      for (const pos of order) {
        const c = cost(boxes[pos]!)
        if (c < bestCost) {
          best = pos
          bestCost = c
        }
        if (c === 0) break
      }
      if (narrowPlot && bestCost > 0 && g.id !== selectedId && !showAllLabels) return
      genoLabelPos.set(g.id, best)
      placed.push(boxes[best]!)
    })

    if (showSectors) {
      // 지역이 든 구역(메가 환경)만 옅게 칠한다
      const wedges = MEGA_ENVS.map(m => {
        const k = HULL_IDS.indexOf(m.winnerId)
        const a = RAYS[(k - 1 + RAYS.length) % RAYS.length]!
        const b = RAYS[k]!
        const mid = norm([a[0] + b[0], a[1] + b[1]])
        return { pts: [[0, 0], [a[0] * R, a[1] * R], [mid[0] * R, mid[1] * R], [b[0] * R, b[1] * R]] as Pt[], color: megaColor(theme, m) }
      })
      series.push({
        name: '메가 환경 구역',
        type: 'custom',
        silent: true,
        clip: true,
        z: 0,
        data: [[0]],
        tooltip: { show: false },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderItem: (_p: any, api: any) => ({
          type: 'group',
          children: wedges.map(w => ({
            type: 'polygon',
            shape: { points: w.pts.map(p => api.coord(p)) },
            style: { fill: w.color, opacity: theme.mode === 'dark' ? 0.14 : 0.09 },
          })),
        }),
      })
      series.push({
        name: '구역 경계(수선)',
        type: 'custom',
        silent: true,
        clip: true,
        z: 1,
        data: [[0]],
        tooltip: { show: false },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderItem: (_p: any, api: any) => ({
          type: 'group',
          children: RAYS.map(r => {
            const [x1, y1] = api.coord([0, 0]) as number[]
            const [x2, y2] = api.coord([r[0] * R, r[1] * R]) as number[]
            return { type: 'line', shape: { x1, y1, x2, y2 }, style: { stroke: theme.textMuted, lineWidth: 1, lineDash: [4, 3] } }
          }),
        }),
      })
    }

    // which-won-where 다각형
    series.push({
      name: '다각형',
      type: 'line',
      silent: true,
      z: 2,
      symbol: 'none',
      data: [...HULL_PTS, HULL_PTS[0]!],
      lineStyle: { color: theme.text, width: 1.3, opacity: 0.7 },
      markLine: {
        silent: true,
        symbol: 'none',
        label: { show: false },
        lineStyle: { color: theme.textMuted, type: 'solid', width: 1, opacity: 0.45 },
        data: [{ xAxis: 0 }, { yAxis: 0 }],
      },
    })

    // 지역 벡터(원점 → 지역 점수, 끝에 화살표)
    SITES.forEach((_s, j) => {
      const [x, y] = SITE_SCORES[j]!
      const mega = MEGA_BY_WINNER[SITE_WINNER_IDS[j]!]!
      const color = megaColor(theme, mega)
      const deg = (Math.atan2(y, x) * 180) / Math.PI
      series.push({
        name: `site:${j}`,
        type: 'line',
        z: 3,
        data: [
          { value: [0, 0], symbol: 'none' },
          {
            value: [x, y],
            name: `site:${j}`,
            symbol: 'arrow',
            symbolSize: 9,
            symbolRotate: deg - 90,
          },
        ],
        showSymbol: true,
        lineStyle: { color, width: 1.6 },
        itemStyle: { color },
        emphasis: { lineStyle: { width: 2.4 } },
      })
    })

    // 유전자형 점
    series.push({
      name: '유전자형',
      type: 'scatter',
      z: 5,
      cursor: 'pointer',
      data: GENOTYPES.map(g => {
        const c = lineColor(theme, g.id)
        const sel = g.id === selectedId
        const pos = genoLabelPos.get(g.id)
        const strong = ALWAYS_LABELED.has(g.id) || sel
        return {
          name: `geno:${g.id}`,
          value: g.gge,
          symbol: g.role === 'check' ? 'diamond' : 'circle',
          symbolSize: sel ? 13 : c ? 10 : g.isVertex ? 8 : 6.5,
          itemStyle: {
            color: c ?? theme.textMuted,
            opacity: c || g.isVertex ? 1 : 0.75,
            borderColor: sel ? theme.text : theme.surface,
            borderWidth: sel ? 2.5 : 1,
          },
          label: pos
            ? {
                show: true,
                formatter: g.name ?? g.id,
                position: pos,
                distance: 4,
                color: strong ? theme.text : theme.textMuted,
                fontSize: 11,
                fontWeight: strong ? 600 : 400,
                textBorderColor: theme.surface,
                textBorderWidth: 3,
              }
            : undefined,
        }
      }),
      emphasis: { scale: 1.3 },
    })

    // 밀린 지역 라벨의 지시선(1px): 화살표 끝 → 라벨 상자 가장자리 쪽 중심
    const leaders = SITES.map((_, j) => j).filter(j => siteLabel.get(j)!.moved)
    if (leaders.length) {
      series.push({
        name: '지역 라벨 지시선',
        type: 'custom',
        silent: true,
        z: 6,
        data: [[0]],
        tooltip: { show: false },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderItem: (_p: any, api: any) => ({
          type: 'group',
          children: leaders.map(j => {
            const [x1, y1] = api.coord(SITE_SCORES[j]!) as number[]
            const [dx, dy] = siteLabel.get(j)!.offset
            return { type: 'line', shape: { x1, y1, x2: x1! + dx, y2: y1! + dy }, style: { stroke: theme.textMuted, lineWidth: 1 } }
          }),
        }),
      })
    }

    // 지역 라벨 레이어: 유전자형 점보다 위, 표면색 배경
    series.push({
      name: '지역 라벨',
      type: 'scatter',
      silent: true,
      z: 7,
      symbolSize: 1,
      itemStyle: { color: 'transparent' },
      tooltip: { show: false },
      data: SITES.map((s, j) => ({
        value: SITE_SCORES[j]!,
        label: {
          show: true,
          formatter: s.short,
          position: 'inside',
          offset: siteLabel.get(j)!.offset,
          align: 'center',
          verticalAlign: 'middle',
          color: theme.text,
          fontSize: SITE_FS,
          fontWeight: 700,
          backgroundColor: theme.surface,
          padding: [1, 3],
          borderRadius: 2,
        },
      })),
    })

    return {
      grid: { ...GRID, containLabel: false },
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const name = (p as { name?: string }).name ?? ''
          if (name.startsWith('geno:')) {
            const g = GENO_BY_ID[name.slice(5)]!
            const sector = MEGA_BY_WINNER[g.sectorId]
            return `<b>${g.label}</b><br/>2년 평균 ${formatFixed(g.mean, 1)} kg/10a · 지수 ${formatFixed(g.index, 1)}%<br/>구역: ${sector ? `${sector.label}(승자 ${sector.winnerId})` : `지역 없는 구역(${g.sectorId})`}`
          }
          if (name.startsWith('site:')) {
            const j = Number(name.slice(5))
            const s = SITES[j]!
            const m = MEGA_BY_WINNER[SITE_WINNER_IDS[j]!]!
            const avg = SITE2.reduce((a, r) => a + r[j]!, 0) / SITE2.length
            return `<b>${s.name}</b><br/>2년 평균(${N_G} 유전자형) ${formatFixed(avg, 1)} kg/10a<br/>메가 환경: ${m.label} · 승자 ${m.winnerId}<br/>연도별 실측 1위: ${siteYearTopText(j)}`
          }
          return ''
        },
      },
      xAxis: {
        type: 'value',
        min: rng.x[0],
        max: rng.x[1],
        interval: TICK,
        name: ggeAxisTitle(0),
        nameLocation: 'middle',
        nameGap: 26,
        nameTextStyle: { fontSize: 12, fontWeight: 600, color: theme.text },
        axisLabel: { showMinLabel: false, showMaxLabel: false, formatter: (v: number) => formatFixed(v, 0) },
        splitLine: { show: true },
      },
      yAxis: {
        type: 'value',
        min: rng.y[0],
        max: rng.y[1],
        interval: TICK,
        name: ggeAxisTitle(1),
        nameLocation: 'middle',
        nameGap: 26,
        nameTextStyle: { fontSize: 12, fontWeight: 600, color: theme.text },
        axisLabel: { showMinLabel: false, showMaxLabel: false, formatter: (v: number) => formatFixed(v, 0) },
      },
      series: series as EChartsOption['series'],
    }
  }, [theme, width, height, selectedId, showSectors, showAllLabels])

  return (
    <div ref={ref} className="h-full w-full" data-gge-equal-aspect="true">
      {option && (
        <EChart
          option={option}
          height={height}
          ariaLabel={ariaLabel}
          onEvents={{
            click: (p: unknown) => {
              const name = (p as { name?: string }).name ?? ''
              if (name.startsWith('geno:')) onSelect(name.slice(5))
            },
          }}
          fallbackTable={{
            columns: ['계통', 'PC1', 'PC2', '구역'],
            rows: GENOTYPES.map(g => [
              g.label,
              formatFixed(g.gge[0], 2),
              formatFixed(g.gge[1], 2),
              MEGA_BY_WINNER[g.sectorId]?.label ?? `지역 없는 구역(${g.sectorId})`,
            ]),
          }}
        />
      )}
    </div>
  )
}
