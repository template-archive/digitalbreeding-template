import { useCallback, useMemo, type KeyboardEvent } from 'react'
import { EChart, selectionStroke, useChartTheme, type EChartsOption } from '@/charts'
import { KIN_LEVEL_LABEL } from '@/lib/genomics'
import {
  CLUSTER_CUT,
  DENDRO,
  DENDRO_MAX,
  DENDRO_MIN,
  GROUPS,
  GROUP_SIZE,
  LINES,
  N,
  PAIR_BY_KEY,
  SCALE_MAX,
  SUMMARY,
  fmt2,
  fmt3,
  fmtHet,
  grm,
  pairKey,
  relDescription,
  type SortKey,
} from '../data'

export interface Cell {
  /** 행 계통 idx */
  row: number
  /** 열 계통 idx */
  col: number
}

interface Props {
  order: number[]
  sort: SortKey
  showDiag: boolean
  selected: Cell
  onSelect: (c: Cell) => void
  /** 컨테이너 폭(px) */
  width: number
}

interface Layout {
  narrow: boolean
  cell: number
  labels: boolean
  dendro: boolean
  dendroW: number
  left: number
  top: number
  chartW: number
  chartH: number
  band: number
}

const LABEL_W = 60
const BAND = 8

export function computeLayout(width: number, sort: SortKey): Layout {
  const narrow = width > 0 && width < 640
  if (narrow) {
    const band = 6
    const left = band + 6
    const top = band + 6
    // 한 화면에 들어오게 폭에 맞춘다(390px 5px). 정확한 쌍 선택은 계통 1·2 선택과 근연 쌍 목록이 맡는다
    const cell = Math.max(4, Math.min(6, Math.floor((width - left - 6) / N)))
    return { narrow, cell, labels: false, dendro: false, dendroW: 0, left, top, chartW: left + N * cell + 6, chartH: top + N * cell + 6, band }
  }
  const dendro = sort === 'cluster'
  const dendroW = dendro ? 104 : 0
  const avail = Math.max(width, 400)
  const fit = (labelW: number) => {
    const left = (dendro ? dendroW + 10 : 0) + labelW + BAND + 6
    const cell = Math.floor((avail - left - 8) / N)
    return { left, cell }
  }
  let { left, cell } = fit(LABEL_W)
  let labels = true
  // 계통명 라벨은 11px(글자 하한) — 셀이 11px 이상일 때만 보인다(더 좁으면 라벨 없이 셀을 키움, 이름은 툴팁·표)
  if (cell < 11) {
    labels = false
    ;({ left, cell } = fit(0))
  }
  cell = Math.max(6, Math.min(11, cell))
  const top = (labels ? LABEL_W : 0) + BAND + 6 + (dendro ? 26 : 0)
  const bottom = dendro ? 44 : 10
  return { narrow, cell, labels, dendro, dendroW, left, top, chartW: left + N * cell + 8, chartH: top + N * cell + bottom, band: BAND }
}

/** 60 × 60 GRM 히트맵 + 그룹 색 띠 + (군집 순) UPGMA 덴드로그램. 하나의 ECharts 인스턴스로 그려 행 정렬이 픽셀 단위로 맞는다. */
export function KinshipHeatmap({ order, sort, showDiag, selected, onSelect, width }: Props) {
  const t = useChartTheme()
  const L = useMemo(() => computeLayout(width, sort), [width, sort])
  const pos = useMemo(() => new Map(order.map((idx, k) => [idx, k])), [order])
  const groupColor = useMemo(
    () => ({ A: t.categorical[0]!, B: t.categorical[1]!, C: t.categorical[2]! }),
    [t],
  )

  const option = useMemo<EChartsOption>(() => {
    const names = order.map(i => LINES[i]!.name)
    const side = N * L.cell
    const heat: number[][] = []
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        if (r === c) continue
        const G = grm(order[r]!, order[c]!)
        heat.push([c, r, Math.max(0, Math.min(SCALE_MAX, G)), G])
      }
    const sel = selectionStroke(t)
    const selR = pos.get(selected.row) ?? 0
    const selC = pos.get(selected.col) ?? 0
    const fontSize = 11

    const grids: NonNullable<EChartsOption['grid']> = [{ left: L.left, top: L.top, width: side, height: side, containLabel: false }]
    const xAxes: NonNullable<EChartsOption['xAxis']> = [
      {
        type: 'category',
        gridIndex: 0,
        data: names,
        position: 'top',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: L.labels, interval: 0, rotate: 90, fontSize, margin: L.band + 6, color: t.textMuted },
      },
    ]
    const yAxes: NonNullable<EChartsOption['yAxis']> = [
      {
        type: 'category',
        gridIndex: 0,
        data: names,
        inverse: true,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: L.labels, interval: 0, fontSize, margin: L.band + 6, color: t.textMuted },
      },
    ]

    const series: NonNullable<EChartsOption['series']> = []
    series.push({
      name: 'G',
      type: 'heatmap',
      xAxisIndex: 0,
      yAxisIndex: 0,
      data: heat,
      itemStyle: { borderWidth: 0 },
      emphasis: { itemStyle: { borderColor: t.text, borderWidth: 1 } },
      progressive: 0,
      cursor: 'pointer',
    })

    // 대각: 기본 마스킹(중립 빗금), 토글 시 진한 중립색 + 테두리. 색 척도 밖.
    series.push({
      name: 'diag',
      type: 'custom',
      xAxisIndex: 0,
      yAxisIndex: 0,
      data: order.map((_, k) => [k, k]),
      cursor: 'pointer',
      z: 3,
      renderItem: (_p, api) => {
        const k = api.value(0) as number
        const [cx, cy] = api.coord([k, k]) as [number, number]
        const s = L.cell
        const x = cx - s / 2
        const y = cy - s / 2
        if (showDiag)
          return { type: 'rect', shape: { x: x + 0.5, y: y + 0.5, width: s - 1, height: s - 1 }, style: { fill: t.textMuted, stroke: t.text, lineWidth: 1 } }
        return {
          type: 'group',
          children: [
            { type: 'rect', shape: { x, y, width: s, height: s }, style: { fill: t.surface2 } },
            { type: 'line', shape: { x1: x, y1: y + s, x2: x + s, y2: y }, style: { stroke: t.textMuted, lineWidth: 1 } },
          ],
        }
      },
      tooltip: {
        formatter: (p: unknown) => {
          const k = (p as { dataIndex: number }).dataIndex
          const c = LINES[order[k]!]!
          return `<b>${c.name}</b> · 자기 관계<br/>G = 1 + F = ${fmt3(1 + c.F)}<br/>F ${fmt3(c.F)} · 잔여 이형접합도 ${fmtHet(c.het)}<br/><span style="color:${t.textMuted}">대각은 색 척도에서 제외</span>`
        },
      },
    })

    // 그룹 색 띠(행 왼쪽·열 위)
    series.push({
      name: 'band',
      type: 'custom',
      xAxisIndex: 0,
      yAxisIndex: 0,
      silent: true,
      clip: false,
      tooltip: { show: false },
      data: order.map((_, k) => [k, k]),
      renderItem: (_p, api) => {
        const k = api.value(0) as number
        const [cx, cy] = api.coord([k, k]) as [number, number]
        const s = L.cell
        const fill = groupColor[LINES[order[k]!]!.group]
        return {
          type: 'group',
          children: [
            { type: 'rect', shape: { x: L.left - L.band - 2, y: cy - s / 2, width: L.band, height: s }, style: { fill } },
            { type: 'rect', shape: { x: cx - s / 2, y: L.top - L.band - 2, width: s, height: L.band }, style: { fill } },
          ],
        }
      },
    })

    // 그룹 순: 그룹 경계선
    if (sort === 'group') {
      const cuts: number[] = []
      let acc = 0
      for (const g of GROUPS.slice(0, -1)) {
        acc += GROUP_SIZE[g]
        cuts.push(acc)
      }
      series.push({
        name: 'groupLines',
        type: 'custom',
        xAxisIndex: 0,
        yAxisIndex: 0,
        silent: true,
        clip: false,
        z: 4,
        tooltip: { show: false },
        data: [[0, 0]],
        renderItem: () => ({
          type: 'group',
          children: cuts.flatMap(k => {
            const v = L.top + k * L.cell
            const h = L.left + k * L.cell
            const style = { stroke: t.text, lineWidth: 1.5 }
            return [
              { type: 'line' as const, shape: { x1: L.left - L.band - 2, y1: v, x2: L.left + side, y2: v }, style },
              { type: 'line' as const, shape: { x1: h, y1: L.top - L.band - 2, x2: h, y2: L.top + side }, style },
            ]
          }),
        }),
      })
    }

    // 선택 셀(P, Q)와 대칭 셀(Q, P)
    series.push({
      name: 'sel',
      type: 'custom',
      xAxisIndex: 0,
      yAxisIndex: 0,
      silent: true,
      z: 5,
      tooltip: { show: false },
      data: selR === selC ? [[selC, selR]] : [[selC, selR], [selR, selC]],
      renderItem: (_p, api) => {
        const [cx, cy] = api.coord([api.value(0), api.value(1)]) as [number, number]
        const s = L.cell
        // 공통 선택 표시(selectionStroke): 표면색 후광 → 글자색 선(강조색은 순차 척도 진한 끝과 같은 계열이라 쓰지 않는다)
        const shape = { x: cx - s / 2 - 1.5, y: cy - s / 2 - 1.5, width: s + 3, height: s + 3 }
        return {
          type: 'group',
          children: [
            { type: 'rect', shape, style: { fill: 'transparent', stroke: sel.haloColor, lineWidth: sel.haloWidth } },
            { type: 'rect', shape, style: { fill: 'transparent', stroke: sel.lineColor, lineWidth: sel.lineWidth } },
          ],
        }
      },
    })

    if (L.dendro) {
      grids.push({ left: 6, top: L.top, width: L.dendroW, height: side, containLabel: false })
      xAxes.push({
        type: 'value',
        gridIndex: 1,
        min: DENDRO_MIN,
        max: DENDRO_MAX,
        inverse: true,
        interval: 0.2,
        position: 'bottom',
        splitLine: { show: false },
        axisLine: { show: true, lineStyle: { color: t.border } },
        axisTick: { show: true, lineStyle: { color: t.border } },
        axisLabel: { fontSize: 11, color: t.textMuted, formatter: (v: number) => v.toFixed(1), showMaxLabel: false },
        name: '평균 거리 1 − f̄ (UPGMA)',
        nameLocation: 'middle',
        nameGap: 24,
        nameTextStyle: { fontSize: 11, color: t.textMuted },
      })
      yAxes.push({ type: 'category', gridIndex: 1, data: names, inverse: true, show: false })
      const segs = DENDRO.segs
      series.push({
        name: 'dendro',
        type: 'custom',
        xAxisIndex: 1,
        yAxisIndex: 1,
        silent: true,
        clip: false,
        tooltip: { show: false },
        data: [[0, 0]],
        renderItem: (_p, api) => {
          const pt = (x: number, y: number) => api.coord([x, y]) as [number, number]
          const [cutX, top] = pt(CLUSTER_CUT, 0)
          const children: unknown[] = segs.map(s => {
            const [x1, y1] = pt(s.x0, s.y0)
            const [x2, y2] = pt(s.x1, s.y1)
            return { type: 'line', shape: { x1, y1, x2, y2 }, style: { stroke: t.textMuted, lineWidth: 1 } }
          })
          const y0 = top - L.cell / 2
          children.push({ type: 'line', shape: { x1: cutX, y1: y0 - 4, x2: cutX, y2: y0 + side }, style: { stroke: t.accent, lineWidth: 1.25, lineDash: [4, 3] } })
          children.push({
            type: 'text',
            style: { x: cutX, y: y0 - 8, text: '근연 군집 기준\nf̄ = 0.25', fill: t.accent, fontSize: 11, fontWeight: 600, align: 'center', verticalAlign: 'bottom', lineHeight: 13 },
          })
          return { type: 'group', children } as never
        },
      })
    }

    return {
      animation: false,
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      visualMap: {
        type: 'continuous',
        min: 0,
        max: SCALE_MAX,
        dimension: 2,
        seriesIndex: 0,
        show: false,
        inRange: { color: t.sequential },
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (p: unknown) => {
          const v = (p as { value: number[] }).value
          const P = LINES[order[v[1]!]!]!
          const Q = LINES[order[v[0]!]!]!
          const pair = PAIR_BY_KEY.get(pairKey(P.idx, Q.idx))!
          const neg = v[3]! < 0 ? ` <span style="color:${t.textMuted}">(척도 최저색 표시)</span>` : ''
          return `<b>${P.name} × ${Q.name}</b><br/>G ${fmt2(v[3]!)}${neg} · f ${fmt2(pair.f)}(= G/2)<br/>${pair.level === 'ok' ? '정상' : KIN_LEVEL_LABEL[pair.level]} · ${relDescription(P, Q)}`
        },
      },
      series,
    }
  }, [order, L, t, groupColor, pos, selected, showDiag, sort])

  const onEvents = useMemo(
    () => ({
      click: (raw: unknown) => {
        const p = raw as { seriesName?: string; value?: number[]; dataIndex: number }
        if (p.seriesName === 'G' && p.value) onSelect({ row: order[p.value[1]!]!, col: order[p.value[0]!]! })
        else if (p.seriesName === 'diag') onSelect({ row: order[p.dataIndex]!, col: order[p.dataIndex]! })
      },
    }),
    [order, onSelect],
  )

  const onKey = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      let r = pos.get(selected.row) ?? 0
      let c = pos.get(selected.col) ?? 0
      if (e.key === 'ArrowRight') c++
      else if (e.key === 'ArrowLeft') c--
      else if (e.key === 'ArrowDown') r++
      else if (e.key === 'ArrowUp') r--
      else if (e.key === 'Home') c = 0
      else if (e.key === 'End') c = N - 1
      else return
      e.preventDefault()
      r = Math.max(0, Math.min(N - 1, r))
      c = Math.max(0, Math.min(N - 1, c))
      onSelect({ row: order[r]!, col: order[c]! })
    },
    [pos, selected, order, onSelect],
  )

  const ariaLabel = `60 × 60 유전체 관계 행렬(${sort === 'cluster' ? '군집 순' : sort === 'gebv' ? 'GEBV 순' : '그룹 순'}), 강한 근연 ${SUMMARY.warn}쌍, 근연 주의 ${SUMMARY.caution}쌍. 대각은 색 척도에서 제외. 같은 정보를 아래 근연 쌍 표가 글로 제공합니다.`

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label="히트맵 셀 탐색: 화살표 키로 선택 셀을 옮깁니다"
      onKeyDown={onKey}
      className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent"
      style={{ width: L.chartW }}
    >
      <EChart option={option} height={L.chartH} ariaLabel={ariaLabel} onEvents={onEvents} />
    </div>
  )
}
