import { useMemo } from 'react'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { useMediaQuery } from '@/design-system'
import { formatNumber } from '@/lib/format'
import { PIPELINE, STAGES, passRates, stageTargets, type Year } from '../data'

const int = (v: number) => formatNumber(v, { digits: 0 })
const pct1 = (v: number) => `${formatNumber(v, { digits: 1 })}%`

/** G. 파이프라인 깔때기 — 로그 축 가로 막대(위→아래 단계 순) */
export function PipelineChart({ year, height }: { year: Year; height: number }) {
  const theme = useChartTheme()
  const narrow = useMediaQuery('(max-width: 639px)')
  const counts = PIPELINE[year]
  const rates = passRates(year)
  const targets = stageTargets(year)
  const below = counts.map((c, i) => targets[i] !== null && c < (targets[i] as number))

  const option = useMemo<EChartsOption>(() => {
    const cats = STAGES.map(s => `${s.no} ${s.short}`)
    return {
      grid: narrow ? { left: 4, right: 44, top: 6, bottom: 26, containLabel: true } : { left: 8, right: 104, top: 8, bottom: 26, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const i = (params as { dataIndex: number }[])[0]?.dataIndex ?? 0
          const t = targets[i]
          const prevTarget = i > 0 ? targets[i - 1] : null
          const lines = [`<b>${STAGES[i].no} ${STAGES[i].name}</b>`, `계통 수 ${int(counts[i])}`]
          if (rates[i] !== null) lines.push(`같은 해 단계 수 비 ${pct1(rates[i] as number)}`)
          if (t !== null) {
            lines.push(`목표 ${int(t)}계통${counts[i] < t ? ` · 미달 ${int(t - counts[i])}계통` : ' · 달성'}`)
            if (i > 0 && prevTarget !== null) lines.push(`목표 비 ${pct1((t / counts[i - 1]) * 100)}`)
          }
          return lines.join('<br/>')
        },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: cats,
        // 좁은 화면: 단계 이름이 왼쪽을 차지해 막대가 60px로 줄어 막대 위 줄로 옮긴다(아래 '단계 이름' 계열)
        axisLabel: narrow ? { show: false } : { fontSize: 11, color: theme.text },
        axisTick: { show: false },
      },
      xAxis: {
        type: 'log',
        logBase: 10,
        min: 1,
        max: 10000,
        name: '계통 수(로그 축)',
        nameLocation: 'middle',
        nameGap: 22,
        axisLabel: { formatter: (v: number) => (narrow && ![1, 100, 10000].includes(v) ? '' : int(v)) },
      },
      series: [
        {
          name: '계통 수',
          type: 'bar',
          barMaxWidth: narrow ? 14 : 22,
          data: counts.map((c, i) => ({
            value: c,
            itemStyle: { color: below[i] ? theme.negative : theme.categorical[0], borderRadius: [0, 3, 3, 0] },
          })),
          label: {
            show: true,
            position: 'right',
            distance: 20,
            fontSize: 11,
            color: theme.text,
            formatter: (p: unknown) => {
              const i = (p as { dataIndex: number }).dataIndex
              return `${int(counts[i])} · ${rates[i] === null ? '기준' : pct1(rates[i] as number)}`
            },
          },
        },
        {
          name: '목표',
          type: 'scatter',
          symbol: 'diamond',
          symbolSize: 11,
          z: 5,
          itemStyle: { color: theme.surface, borderColor: theme.text, borderWidth: 1.5 },
          data: targets.flatMap((t, i) => (t === null ? [] : [[t, i]])),
          tooltip: { show: false },
        },
        ...(narrow
          ? [
              {
                name: '단계 이름',
                type: 'scatter' as const,
                symbolSize: 0,
                silent: true,
                tooltip: { show: false },
                data: cats.map((_, i) => [1, i]),
                label: {
                  show: true,
                  position: 'right' as const,
                  distance: 0,
                  offset: [0, -16] as [number, number],
                  fontSize: 11,
                  color: theme.text,
                  formatter: (p: unknown) => cats[(p as { dataIndex: number }).dataIndex],
                },
              },
            ]
          : []),
      ],
    }
  }, [counts, rates, targets, below, theme, narrow])

  const belowNames = STAGES.flatMap((s, i) => (below[i] ? [`${s.name} ${int(counts[i])}계통(목표 ${int(targets[i] as number)})`] : []))

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`${year}년 품종 개발 파이프라인: ${STAGES.map((s, i) => `${s.short} ${int(counts[i])}`).join(' → ')}계통. ${belowNames.length ? `목표 미달 단계: ${belowNames.join(', ')}.` : '모든 단계가 목표 이상이다.'}`}
      fallbackTable={{
        columns: ['단계', '계통 수', '같은 해 단계 수 비', '목표'],
        rows: STAGES.map((s, i) => [`${s.no} ${s.name}`, int(counts[i]), rates[i] === null ? '–' : pct1(rates[i] as number), targets[i] === null ? '–' : int(targets[i] as number)]),
      }}
    />
  )
}
