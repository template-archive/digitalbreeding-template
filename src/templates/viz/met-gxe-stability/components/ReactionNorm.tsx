import { useMemo } from 'react'
import { Legend } from '@/design-system'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { formatFixed, formatSigned } from '@/lib/format'
import { CELL, ENVS, ENV_INDEX_RANGE, GENOTYPES, GENO_BY_ID, GRAND_MEAN } from '../data'
import { FEATURED_IDS, lineColor } from './colors'

export interface ReactionNormProps {
  selectedId: string
  onSelect: (id: string) => void
  height: number
  ariaLabel: string
}

const [I_MIN, I_MAX] = ENV_INDEX_RANGE
const X_PAD = 4

export function reactionLegendIds(selectedId: string): string[] {
  return FEATURED_IDS.includes(selectedId) ? FEATURED_IDS : [...FEATURED_IDS, selectedId]
}

export function ReactionNorm({ selectedId, onSelect, height, ariaLabel }: ReactionNormProps) {
  const theme = useChartTheme()
  const featured = useMemo(() => new Set(reactionLegendIds(selectedId)), [selectedId])

  const colorOf = (id: string) => lineColor(theme, id) ?? theme.accent

  const option = useMemo<EChartsOption>(() => {
    const x0 = Math.floor(I_MIN - X_PAD)
    const x1 = Math.ceil(I_MAX + X_PAD)
    const fit = (id: string) => {
      const g = GENO_BY_ID[id]!
      return [
        [x0, g.mean + g.b * x0],
        [x1, g.mean + g.b * x1],
      ]
    }
    const series: unknown[] = [
      {
        name: '기울기 1(전체 평균)',
        type: 'line',
        silent: true,
        z: 1,
        symbol: 'none',
        data: [
          [x0, GRAND_MEAN + x0],
          [x1, GRAND_MEAN + x1],
        ],
        lineStyle: { color: theme.textMuted, width: 1.5, type: 'dashed' },
        endLabel: { show: true, formatter: 'b = 1', color: theme.textMuted, fontSize: 11, fontWeight: 600 },
      },
    ]
    for (const g of GENOTYPES) {
      if (featured.has(g.id)) continue
      series.push({
        name: g.id,
        type: 'line',
        z: 2,
        symbol: 'none',
        triggerLineEvent: true,
        cursor: 'pointer',
        data: fit(g.id),
        lineStyle: { color: theme.textMuted, width: 1, opacity: 0.35 },
        emphasis: { lineStyle: { width: 2, opacity: 0.8 } },
        tooltip: { show: false },
      })
    }
    for (const id of featured) {
      const sel = id === selectedId
      series.push({
        name: id,
        type: 'line',
        z: sel ? 5 : 4,
        symbol: 'none',
        triggerLineEvent: true,
        cursor: 'pointer',
        data: fit(id),
        lineStyle: { color: colorOf(id), width: sel ? 3 : 1.8, opacity: sel ? 1 : 0.85 },
        tooltip: { show: false },
      })
    }
    // 선택 계통의 16개 환경 셀 평균
    const gi = GENOTYPES.findIndex(g => g.id === selectedId)
    series.push({
      name: `${selectedId} 실측`,
      type: 'scatter',
      z: 6,
      symbolSize: 7,
      itemStyle: { color: colorOf(selectedId), borderColor: theme.surface, borderWidth: 1 },
      data: ENVS.map(e => ({ name: e.label, value: [e.index, CELL[gi]![e.e]!] })),
    })

    return {
      grid: { left: 8, right: 40, top: 30, bottom: 30, containLabel: true },
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const q = p as { name: string; value: [number, number] }
          if (!Array.isArray(q.value)) return ''
          return `<b>${q.name}</b><br/>환경 지수 I ${formatSigned(q.value[0], 1)} · ${selectedId} ${formatFixed(q.value[1], 1)} kg/10a`
        },
      },
      xAxis: {
        type: 'value',
        min: x0,
        max: x1,
        name: '환경 지수 I(kg/10a, 환경 평균 − 전체 평균) →',
        nameLocation: 'middle',
        nameGap: 26,
        nameTextStyle: { fontSize: 12, fontWeight: 600, color: theme.text },
        // 축 끝값이 다음 눈금과 붙어 겹치므로(−70·−60) 끝값 눈금 라벨은 숨긴다
        axisLabel: { formatter: (v: number) => formatSigned(v, 0), showMinLabel: false, showMaxLabel: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: true,
        name: '쌀 수량(kg/10a)',
        nameTextStyle: { fontSize: 12, fontWeight: 600, color: theme.text, align: 'left' },
      },
      series: [
        ...series,
      ] as EChartsOption['series'],
    }
  }, [theme, featured, selectedId])

  const legend = [...featured].map(id => {
    const g = GENO_BY_ID[id]!
    return { label: `${g.name ?? g.id} b ${formatFixed(g.b, 2)}`, color: colorOf(id), shape: 'line' as const }
  })

  return (
    <div className="flex h-full flex-col">
      <Legend items={[...legend, { label: '기울기 1 기준(전체 평균)', color: theme.textMuted, shape: 'dashed' as const }]} className="mb-1.5" />
      <div className="min-h-0 flex-1">
        <EChart
          option={option}
          height={height}
          ariaLabel={ariaLabel}
          onEvents={{
            click: (p: unknown) => {
              const q = p as { seriesName?: string; seriesType?: string }
              if (q.seriesType === 'line' && q.seriesName && GENO_BY_ID[q.seriesName]) onSelect(q.seriesName)
            },
          }}
          fallbackTable={{
            columns: ['계통', '반응 기울기 b', 'R²', '2년 평균(kg/10a)'],
            rows: GENOTYPES.map(g => [g.label, formatFixed(g.b, 2), formatFixed(g.r2, 2), formatFixed(g.mean, 1)]),
          }}
        />
      </div>
    </div>
  )
}
