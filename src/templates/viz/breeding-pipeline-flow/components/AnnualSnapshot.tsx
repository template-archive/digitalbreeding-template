import { useMemo } from 'react'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { ANNUAL_STAGES, CURRENT_YEAR, MET_INDEX, PIPELINE, PIPELINE_TARGET_2026, PRE_GS_YEAR, int, metAchievement, passRates, pct1 } from '../data'

const counts = PIPELINE[CURRENT_YEAR]
const pre = PIPELINE[PRE_GS_YEAR]
const rates = passRates(CURRENT_YEAR)
const preRates = passRates(PRE_GS_YEAR)
const targets = PIPELINE_TARGET_2026
const below = counts.map((c, i) => c < targets[i])

/** 로그 축 오른쪽 끝(세대 진전 후보 2,000이 들어가는 값) */
const X_MAX = 3000

/** C. 2026 연간 단계 현황 — 로그 축 점 그림(막대 길이는 로그에서 값에 비례하지 않는다) + 목표 ◇ + 2019 ○. 값은 오른쪽 열에 모은다 */
export function AnnualSnapshot({ height }: { height: number }) {
  const theme = useChartTheme()

  const option = useMemo<EChartsOption>(() => {
    return {
      grid: { left: 8, right: 216, top: 6, bottom: 30, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const i = (params as { dataIndex: number }[])[0]?.dataIndex ?? 0
          const s = ANNUAL_STAGES[i]
          const lines = [`<b>${s.no} ${s.name}</b>`, `${CURRENT_YEAR} ${int(counts[i])}계통 · 목표 ${int(targets[i])}${below[i] ? ` · 미달 ${int(targets[i] - counts[i])}` : ''}`]
          if (rates[i] !== null) lines.push(`통과율(같은 해 단계 수 비) ${pct1(rates[i] as number)}`)
          lines.push(`${PRE_GS_YEAR}(GS 도입 전) ${int(pre[i])}계통${preRates[i] !== null ? ` · ${pct1(preRates[i] as number)}` : ''}`)
          return lines.join('<br/>')
        },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: ANNUAL_STAGES.map(s => `${s.no} ${s.short}`),
        axisLabel: { fontSize: 12, color: theme.text },
        axisTick: { show: false },
        splitLine: { show: true, lineStyle: { color: theme.border, type: 'dashed' } },
      },
      xAxis: {
        type: 'log',
        logBase: 10,
        min: 1,
        max: X_MAX,
        name: '계통 수(로그 축)',
        nameLocation: 'middle',
        nameGap: 24,
        axisLabel: { formatter: (v: number) => int(v) },
      },
      series: [
        {
          name: `${CURRENT_YEAR} 계통 수`,
          type: 'scatter',
          symbolSize: 12,
          z: 6,
          data: counts.map((c, i) => ({ value: [c, i], itemStyle: { color: below[i] ? theme.warning : theme.accent, borderColor: theme.surface, borderWidth: 1 } })),
        },
        {
          // 값 열: 그리드 오른쪽 끝에 보이지 않는 기호 + 라벨(점 옆에 두면 ◇·○와 겹친다)
          name: '값',
          type: 'scatter',
          symbolSize: 0,
          silent: true,
          tooltip: { show: false },
          data: counts.map((_, i) => [X_MAX, i]),
          label: {
            show: true,
            position: 'right',
            distance: 10,
            fontSize: 12,
            color: theme.text,
            formatter: (p: unknown) => {
              const i = (p as { dataIndex: number }).dataIndex
              const base = rates[i] === null ? int(counts[i]) : `${int(counts[i])} · ${pct1(rates[i] as number)}`
              return below[i] ? `${base}  {w|목표 ${int(targets[i])} · ${pct1(i === MET_INDEX ? metAchievement() : (counts[i] / targets[i]) * 100)} 미달}` : base
            },
            rich: { w: { color: theme.text, fontWeight: 700, fontSize: 12, backgroundColor: theme.surface2, padding: [2, 4], borderRadius: 3 } },
          },
        },
        {
          name: '목표',
          type: 'scatter',
          symbol: 'diamond',
          symbolSize: 11,
          z: 5,
          itemStyle: { color: theme.surface, borderColor: theme.text, borderWidth: 1.5 },
          data: targets.map((t, i) => [t, i]),
          tooltip: { show: false },
        },
        {
          name: `${PRE_GS_YEAR}`,
          type: 'scatter',
          symbol: 'circle',
          symbolSize: 9,
          z: 4,
          itemStyle: { color: theme.surface, borderColor: theme.text, borderWidth: 1.5 },
          data: pre.map((v, i) => [v, i]),
          tooltip: { show: false },
        },
      ],
    }
  }, [theme])

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`${CURRENT_YEAR}년 단계 현황: ${ANNUAL_STAGES.map((s, i) => `${s.short} ${int(counts[i])}`).join(' → ')}계통. 통과율 ${rates
        .slice(1)
        .map(r => pct1(r as number))
        .join(' · ')}. MET ${counts[MET_INDEX]}계통으로 목표 ${targets[MET_INDEX]}의 ${pct1(metAchievement())}에 그쳐 미달.`}
      fallbackTable={{
        columns: ['단계', `${CURRENT_YEAR} 계통 수`, '통과율(같은 해 단계 수 비)', '목표', `${PRE_GS_YEAR} 계통 수`],
        rows: ANNUAL_STAGES.map((s, i) => [`${s.no} ${s.name}`, int(counts[i]), rates[i] === null ? '–' : pct1(rates[i] as number), int(targets[i]), int(pre[i])]),
      }}
    />
  )
}
