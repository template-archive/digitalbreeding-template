import { useMemo } from 'react'
import { EChart, hMarkLine, useChartTheme, vMarkLine, type EChartsOption } from '@/charts'
import { formatFixed } from '@/lib/format'
import { ASV_MEAN, GENOTYPES, GENO_BY_ID, GRAND_MEAN, N_G, UNSTABLE_REF, W_RULE } from '../data'
import { FEATURED_IDS, lineColor } from './colors'

export type StabilityMetric = 'w' | 'asv'

export const STAB_AXIS: Record<StabilityMetric, string> = {
  w: 'Wricke 생태가 W(%) ↑ 불안정',
  asv: 'AMMI 안정성 값 ASV ↑ 불안정',
}

export interface StabilityScatterProps {
  metric: StabilityMetric
  selectedId: string
  onSelect: (id: string) => void
  height: number
  narrow: boolean
  ariaLabel: string
}

const yOf = (metric: StabilityMetric, id: string) => {
  const g = GENO_BY_ID[id]!
  return metric === 'w' ? g.wPct : g.asv
}

export function StabilityScatter({ metric, selectedId, onSelect, height, narrow, ariaLabel }: StabilityScatterProps) {
  const theme = useChartTheme()

  const option = useMemo<EChartsOption>(() => {
    const yRef = metric === 'w' ? W_RULE : ASV_MEAN
    const ys = GENOTYPES.map(g => yOf(metric, g.id))
    const xs = GENOTYPES.map(g => g.mean)
    const xMin = Math.floor((Math.min(...xs) - 4) / 10) * 10
    const xMax = Math.ceil((Math.max(...xs) + 4) / 10) * 10
    const yMax = Math.ceil(Math.max(...ys) + 1)
    const labeled = new Set([...FEATURED_IDS, selectedId])
    const fmtY = (v: number) => formatFixed(v, metric === 'w' ? 1 : 2)
    const refLabel = metric === 'w' ? `W 평균 ${formatFixed(W_RULE, 1)}% (= 100/${N_G})` : `ASV 평균 ${formatFixed(ASV_MEAN, 2)}`

    return {
      grid: { left: 8, right: 18, top: 26, bottom: 30, containLabel: true },
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const g = GENO_BY_ID[(p as { name: string }).name]
          if (!g) return ''
          return `<b>${g.label}</b><br/>2년 평균 ${formatFixed(g.mean, 1)} kg/10a (${g.rank}위)<br/>W ${formatFixed(g.wPct, 1)}% (${g.wRank}위) · ASV ${formatFixed(g.asv, 2)} (${g.asvRank}위)`
        },
      },
      xAxis: {
        type: 'value',
        min: xMin,
        max: xMax,
        name: '2년 평균 쌀 수량(kg/10a) →',
        nameLocation: 'middle',
        nameGap: 26,
        nameTextStyle: { fontSize: 12, fontWeight: 600, color: theme.text },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: yMax,
        name: STAB_AXIS[metric],
        nameTextStyle: { fontSize: 12, fontWeight: 600, color: theme.text, align: 'left' },
        // 끝값이 다음 눈금과 붙어 겹치므로(12·13) 위 끝 눈금 라벨은 숨긴다
        axisLabel: { formatter: (v: number) => formatFixed(v, 0), showMaxLabel: false },
      },
      series: [
        {
          name: '사분면',
          type: 'scatter',
          data: [],
          silent: true,
          markArea: {
            silent: true,
            itemStyle: { color: theme.positive, opacity: theme.mode === 'dark' ? 0.12 : 0.07 },
            label: { show: true, position: 'insideBottomRight', color: theme.positive, fontSize: 12, fontWeight: 700, distance: 8 },
            data: [[{ name: '고수량·안정', coord: [GRAND_MEAN, 0] }, { coord: [xMax, yRef] }]],
          },
          markLine: {
            symbol: 'none',
            silent: true,
            data: [
              vMarkLine(GRAND_MEAN, `전체 평균 ${formatFixed(GRAND_MEAN, 1)}`, theme.textMuted, { line: 'dashed', width: 1 }),
              hMarkLine(yRef, refLabel, theme.textMuted, { line: 'dashed', width: 1, position: 'insideStartTop' }),
            ],
          },
        },
        {
          name: '계통',
          type: 'scatter',
          cursor: 'pointer',
          data: GENOTYPES.map(g => {
            const c = lineColor(theme, g.id)
            const sel = g.id === selectedId
            const y = yOf(metric, g.id)
            return {
              name: g.id,
              value: [g.mean, y],
              symbol: g.role === 'check' ? 'diamond' : 'circle',
              symbolSize: sel ? 14 : c ? 10 : 7,
              itemStyle: {
                color: c ?? theme.textMuted,
                opacity: c ? 1 : 0.7,
                borderColor: sel ? theme.text : theme.surface,
                borderWidth: sel ? 2.5 : 1,
              },
              label: labeled.has(g.id)
                ? {
                    show: true,
                    formatter: `${g.name ?? g.id}${narrow ? '' : ` ${fmtY(y)}`}`,
                    position: g.id === UNSTABLE_REF || g.mean > xMax - 12 ? 'left' : 'right',
                    distance: 5,
                    color: theme.text,
                    fontSize: 11,
                    fontWeight: 600,
                    textBorderColor: theme.surface,
                    textBorderWidth: 3,
                  }
                : undefined,
            }
          }),
        },
      ] as EChartsOption['series'],
    }
  }, [theme, metric, selectedId, narrow])

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={ariaLabel}
      onEvents={{
        click: (p: unknown) => {
          const id = (p as { name?: string; seriesName?: string }).name
          if (id && GENO_BY_ID[id]) onSelect(id)
        },
      }}
      fallbackTable={{
        columns: ['계통', '2년 평균(kg/10a)', 'W(%)', 'ASV'],
        rows: GENOTYPES.map(g => [g.label, formatFixed(g.mean, 1), formatFixed(g.wPct, 1), formatFixed(g.asv, 2)]),
      }}
    />
  )
}
