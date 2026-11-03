import { useMemo } from 'react'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { MONTHLY, PLATFORMS, PLATFORM_KEYS, TAT_MEAN, TAT_TARGET, round1 } from '../data'
import { d1, platformColor } from './shared'

const cats = MONTHLY.map(m => `${m.month}월`)

/** E. 플랫폼별 월 평균 처리 소요 시간(TAT) — 처리 없는 달은 끊김, 플랫폼별 목표 점선 */
export function TatTrendChart({ height }: { height: number }) {
  const theme = useChartTheme()

  const option = useMemo<EChartsOption>(
    () => ({
      grid: { left: 8, right: 84, top: 24, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const i = (params as { dataIndex: number }[])[0]?.dataIndex ?? 0
          const r = MONTHLY[i]
          const lines = [`<b>${r.month}월</b>`]
          for (const k of PLATFORM_KEYS) {
            const t = r.tat[k]
            if (t === null) continue
            const over = round1(t) > TAT_TARGET[k]
            lines.push(`${PLATFORMS[k].name} ${d1(t)}일 · 플레이트 ${r.plates[k]}장 · 목표 ≤ ${TAT_TARGET[k]}일${over ? ' <b>초과</b>' : ''}`)
          }
          if (lines.length === 1) lines.push('처리 없음')
          return lines.join('<br/>')
        },
      },
      xAxis: { type: 'category', data: cats, boundaryGap: true, axisLabel: { interval: 0 } },
      yAxis: { type: 'value', min: 0, max: 24, interval: 4, name: '일', nameTextStyle: { align: 'right' } },
      series: PLATFORM_KEYS.map(k => {
        const color = platformColor(theme, k)
        return {
          name: PLATFORMS[k].name,
          type: 'line' as const,
          connectNulls: false,
          showSymbol: true,
          symbolSize: 6,
          lineStyle: { color, width: 2 },
          itemStyle: { color },
          data: MONTHLY.map(r => {
            const t = r.tat[k]
            if (t === null) return null
            const v = round1(t)
            return v > TAT_TARGET[k]
              ? { value: v, symbol: 'circle', symbolSize: 11, itemStyle: { color: theme.surface, borderColor: theme.negative, borderWidth: 2 } } // ▲는 증감 전용이라 빈 원(범례 ring)
              : { value: v }
          }),
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color, type: 'dashed' as const, width: 1.2, opacity: 0.9 },
            label: { formatter: `${k} 목표 ${TAT_TARGET[k]}일`, position: 'end' as const, color: theme.textMuted, fontSize: 11 },
            data: [{ yAxis: TAT_TARGET[k] }],
          },
        }
      }),
    }),
    [theme],
  )

  const over = PLATFORM_KEYS.flatMap(k => MONTHLY.filter(r => r.tat[k] !== null && round1(r.tat[k] as number) > TAT_TARGET[k]).map(r => `${k} ${r.month}월 ${d1(r.tat[k] as number)}일`))

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`기간 평균 처리 소요 시간(TAT)은 6K ${d1(TAT_MEAN['6K'])}일(목표 14일), KASP ${d1(TAT_MEAN.KASP)}일(목표 7일), GBS ${d1(TAT_MEAN.GBS)}일(목표 21일)이다. 목표를 넘은 달: ${over.join(', ')}.`}
      fallbackTable={{
        columns: ['월', ...PLATFORM_KEYS.map(k => `${PLATFORMS[k].name} TAT(일)`)],
        rows: MONTHLY.map(r => [`${r.month}월`, ...PLATFORM_KEYS.map(k => (r.tat[k] === null ? '처리 없음' : d1(r.tat[k] as number)))]),
      }}
    />
  )
}
