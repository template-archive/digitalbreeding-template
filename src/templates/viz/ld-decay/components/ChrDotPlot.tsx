import { useMemo } from 'react'
import { EChart, selectionStroke, useChartTheme, type EChartsOption } from '@/charts'
import { CHROMS, GROUPS, kb0, type DecayResult, type GroupKey } from '../data'
import { GROUP_MARK, groupColor } from './colors'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Api = any

interface Props {
  decay: DecayResult
  /** 강조할 염색체(−1 = 없음) */
  chr: number
  group: GroupKey
  height: number
  onSelectChr: (ci: number) => void
}

/** 염색체별 LD 감소 거리(Cleveland 점 그림). 행 = 염색체, 점 = 집단, 세로 점선 = 12개 염색체 통합값 */
export function ChrDotPlot({ decay, chr, group, height, onSelectChr }: Props) {
  const t = useChartTheme()
  const ids = CHROMS.map(c => c.id)

  const { option, ariaLabel, fallbackTable } = useMemo(() => {
    const vals = decay.groups.map(g => g.chrFits.map(f => f.d02 ?? 0))
    const max = Math.max(...vals.flat())
    const xMax = Math.ceil(max / 100) * 100
    const label = (k: GroupKey) => GROUPS.find(g => g.key === k)!.label

    const series: NonNullable<EChartsOption['series']> = [
      {
        name: '선택 염색체',
        type: 'custom',
        silent: true,
        z: 0,
        data: chr >= 0 ? [[0, chr]] : [],
        renderItem: (_p: Api, api: Api) => {
          const c = api.coord([0, api.value(1)]) as [number, number]
          const band = (api.size([0, 1]) as number[])[1]!
          const right = api.coord([xMax, 0])[0] as number
          // 선택 행: 강조색 틴트(집단 색 파랑과 겹침) 대신 옅은 중립 바탕 + 공통 선택 표시(표면색 후광 → 글자색 선)
          const sel = selectionStroke(t)
          const shape = { x: c[0] + 1, y: c[1] - band / 2 + 1, width: right - c[0] - 2, height: band - 2, r: 3 }
          return {
            type: 'group',
            children: [
              { type: 'rect', shape, style: { fill: t.text, opacity: 0.05 } },
              { type: 'rect', shape, style: { fill: 'transparent', stroke: sel.haloColor, lineWidth: sel.haloWidth } },
              { type: 'rect', shape, style: { fill: 'transparent', stroke: sel.lineColor, lineWidth: sel.lineWidth } },
            ],
          }
        },
      },
      {
        name: '범위',
        type: 'custom',
        silent: true,
        z: 1,
        data: ids.map((_, ci) => {
          const row = vals.map(v => v[ci]!)
          return [Math.min(...row), Math.max(...row), ci]
        }),
        encode: { x: [0, 1], y: 2 },
        renderItem: (_p: Api, api: Api) => {
          const a = api.coord([api.value(0), api.value(2)]) as [number, number]
          const b = api.coord([api.value(1), api.value(2)]) as [number, number]
          return { type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: t.border, lineWidth: 2 } }
        },
      },
    ]
    decay.groups.forEach((g, k) => {
      const color = groupColor(t, g.key)
      const sel = g.key === group
      const mark = GROUP_MARK[g.key]
      series.push({
        name: label(g.key),
        type: 'scatter',
        symbol: mark.symbol,
        symbolSize: sel ? 11 : 8,
        z: sel ? 4 : 3,
        // 빈 원(아우스): 속을 비워 겹친 점이 가려지지 않게, 테두리 1.5px = Legend 'ring' 견본
        itemStyle: mark.hollow
          ? { color: 'transparent', borderColor: color, borderWidth: 1.5, opacity: sel ? 1 : 0.85 }
          : { color, borderColor: t.surface, borderWidth: 1, opacity: sel ? 1 : 0.85 },
        data: vals[k]!.map((v, ci) => [v, ci]),
        tooltip: { formatter: (p: unknown) => { const v = (p as { value: number[] }).value; return `${ids[v[1]!]} · ${label(g.key)} · d₀.₂ ${kb0(v[0]!)} kb(통합 ${kb0(g.fit.d02)} kb)` } },
        markLine: {
          symbol: 'none',
          silent: true,
          label: { show: false },
          lineStyle: { color, type: 'dotted', width: sel ? 1.6 : 1, opacity: sel ? 0.95 : 0.6 },
          data: [{ xAxis: g.fit.d02 ?? 0 }],
        },
      })
    })

    const option: EChartsOption = {
      grid: { left: 48, right: 14, top: 8, bottom: 38, containLabel: false },
      tooltip: { trigger: 'item', confine: true },
      xAxis: { type: 'value', min: 0, max: xMax, name: 'LD 감소 거리 d₀.₂(kb)', nameLocation: 'middle', nameGap: 24 },
      yAxis: {
        type: 'category',
        data: ids,
        inverse: true,
        axisTick: { show: false },
        triggerEvent: true,
        axisLabel: {
          formatter: (v: string) => (chr >= 0 && v === ids[chr] ? `{sel|${v}}` : v),
          rich: { sel: { fontWeight: 700, color: t.text, fontSize: 11 } },
        },
      },
      series,
    } as EChartsOption

    const tej = decay.groups[1]!
    const ariaLabel = `염색체별 LD 감소 거리: 12개 염색체 모두에서 온대 자포니카가 가장 길다(${kb0(Math.min(...vals[1]!))}~${kb0(Math.max(...vals[1]!))} kb, 통합 ${kb0(tej.fit.d02)} kb). 인디카는 ${kb0(Math.min(...vals[3]!))}~${kb0(Math.max(...vals[3]!))} kb.`
    const fallbackTable = {
      columns: ['염색체', ...decay.groups.map(g => `${label(g.key)}(kb)`)],
      rows: ids.map((id, ci) => [id, ...vals.map(v => kb0(v[ci]!))]),
    }
    return { option, ariaLabel, fallbackTable }
  }, [decay, chr, group, t, ids])

  const onEvents = useMemo(
    () => ({
      click: (p: unknown) => {
        const q = p as { componentType?: string; value?: unknown; data?: unknown }
        if (q.componentType === 'yAxis' && typeof q.value === 'string') onSelectChr(ids.indexOf(q.value))
        else if (Array.isArray(q.value) && typeof q.value[1] === 'number') onSelectChr(q.value[1] as number)
      },
    }),
    [onSelectChr, ids],
  )

  return <EChart option={option} height={height} ariaLabel={ariaLabel} fallbackTable={fallbackTable} onEvents={onEvents} />
}
