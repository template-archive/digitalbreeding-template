import { useMemo } from 'react'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { formatNumber } from '@/lib/format'
import { APPS, APP_TARGET, PROVISIONAL_YEAR, REGS, achHigher, type Year } from '../data'

/** H. 신품종 출원·등록 묶음 막대 + 출원 목표 계단 점선 */
export function ApplicationsChart({ years, height }: { years: Year[]; height: number }) {
  const theme = useChartTheme()
  const [cApp, cReg] = [theme.categorical[0], theme.categorical[1]]

  const option = useMemo<EChartsOption>(() => {
    const isProv = (y: Year) => y === PROVISIONAL_YEAR
    const maxV = Math.max(...years.map(y => Math.max(APPS[y], REGS[y], APP_TARGET[y])))
    return {
      grid: { left: 8, right: 12, top: 24, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const y = Number((params as { axisValue: string }[])[0]?.axisValue.slice(0, 4)) as Year
          return [
            `<b>${y}년${isProv(y) ? ' (10/23 기준 연중 누계)' : ''}</b>`,
            `출원 ${APPS[y]}건 · 목표 ${APP_TARGET[y]}건 · 달성률 ${formatNumber(achHigher(APPS[y], APP_TARGET[y]), { digits: 1 })}%`,
            `등록 ${REGS[y]}건`,
          ].join('<br/>')
        },
      },
      xAxis: { type: 'category', data: years.map(y => (isProv(y) ? `${y}\n(연중)` : String(y))), axisLabel: { lineHeight: 14 } },
      yAxis: { type: 'value', min: 0, max: Math.max(4, maxV + 1), minInterval: 1, interval: 1, name: '건', nameLocation: 'end', nameGap: 8 },
      series: [
        {
          name: '출원',
          type: 'bar',
          barMaxWidth: 22,
          itemStyle: { color: cApp },
          data: years.map(y => ({
            value: APPS[y],
            itemStyle: isProv(y) ? { color: cApp, opacity: 0.45, borderColor: cApp, borderWidth: 1.5, borderType: 'dashed' as const } : undefined,
          })),
          label: {
            show: true,
            position: 'top',
            fontSize: 11,
            color: theme.text,
            formatter: (p: unknown) => {
              const { dataIndex, value } = p as { dataIndex: number; value: number }
              return isProv(years[dataIndex]) ? `${value} 연중` : String(value)
            },
          },
        },
        {
          name: '등록',
          type: 'bar',
          barMaxWidth: 22,
          itemStyle: { color: cReg },
          data: years.map(y => ({ value: REGS[y], itemStyle: isProv(y) ? { color: cReg, opacity: 0.45 } : undefined })),
          label: { show: true, position: 'top', fontSize: 11, color: theme.textMuted },
        },
        {
          name: '출원 목표',
          type: 'line',
          step: 'middle',
          symbol: 'none',
          lineStyle: { color: theme.text, type: 'dashed', width: 1.5 },
          itemStyle: { color: theme.text },
          data: years.map(y => APP_TARGET[y]),
        },
      ],
    }
  }, [years, theme, cApp, cReg])

  const totalApps = years.reduce((s, y) => s + APPS[y], 0)
  const totalTarget = years.reduce((s, y) => s + APP_TARGET[y], 0)
  const totalRegs = years.reduce((s, y) => s + REGS[y], 0)

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`${years[0]}~${years[years.length - 1]} 신품종 출원 ${totalApps}건(목표 ${totalTarget}건), 등록 ${totalRegs}건. ${years.includes(PROVISIONAL_YEAR as Year) ? `${PROVISIONAL_YEAR}년은 연중 누계 ${APPS[PROVISIONAL_YEAR as Year]}건.` : ''}`}
      fallbackTable={{
        columns: ['연도', '출원(건)', '출원 목표(건)', '등록(건)'],
        rows: years.map(y => [y === PROVISIONAL_YEAR ? `${y}(연중)` : y, APPS[y], APP_TARGET[y], REGS[y]]),
      }}
    />
  )
}
