import { useMemo } from 'react'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { ANNUAL_STAGES, CURRENT_YEAR, PRE_GS_YEAR, passRates, pct1 } from '../data'

export const PRE_LABEL = `${PRE_GS_YEAR}(GS 도입 전, 표현형 계통 선발)`
export const POST_LABEL = `${CURRENT_YEAR}(GS 도입 후)`

const a = passRates(PRE_GS_YEAR).slice(1) as number[]
const b = passRates(CURRENT_YEAR).slice(1) as number[]
const cats = ANNUAL_STAGES.slice(1).map((s, i) => `${ANNUAL_STAGES[i].no}→${s.no} ${s.short}`)

/** K. GS 도입 전후 횡단 통과율 — 묶은 가로 막대 */
export function GsCompare({ height }: { height: number }) {
  const theme = useChartTheme()

  const option = useMemo<EChartsOption>(
    () => ({
      grid: { left: 8, right: 48, top: 6, bottom: 24, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const i = (params as { dataIndex: number }[])[0]?.dataIndex ?? 0
          return `<b>${cats[i]}</b><br/>${PRE_GS_YEAR} ${pct1(a[i])}<br/>${CURRENT_YEAR} ${pct1(b[i])}`
        },
      },
      xAxis: { type: 'value', min: 0, max: 60, axisLabel: { formatter: (v: number) => `${v}%` } },
      yAxis: { type: 'category', inverse: true, data: cats, axisTick: { show: false }, axisLabel: { color: theme.text, fontSize: 12 } },
      series: [
        {
          name: PRE_LABEL,
          type: 'bar',
          barWidth: 9,
          barGap: '30%',
          itemStyle: { color: theme.textMuted, borderRadius: [0, 2, 2, 0] },
          label: { show: true, position: 'right', fontSize: 11, color: theme.textMuted, formatter: (p: unknown) => pct1((p as { value: number }).value) },
          data: a,
        },
        {
          name: POST_LABEL,
          type: 'bar',
          barWidth: 9,
          itemStyle: { color: theme.accent, borderRadius: [0, 2, 2, 0] },
          label: { show: true, position: 'right', fontSize: 11, color: theme.text, fontWeight: 600, formatter: (p: unknown) => pct1((p as { value: number }).value) },
          data: b,
        },
      ],
    }),
    [theme],
  )

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`GS 도입 전후 통과율(같은 해 단계 수 비): ${cats.map((c, i) => `${c} ${pct1(a[i])} → ${pct1(b[i])}`).join(', ')}.`}
      fallbackTable={{ columns: ['전환', `${PRE_GS_YEAR}`, `${CURRENT_YEAR}`], rows: cats.map((c, i) => [c, pct1(a[i]), pct1(b[i])]) }}
    />
  )
}
