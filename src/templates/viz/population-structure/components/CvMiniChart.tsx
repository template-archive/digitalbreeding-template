import { useMemo } from 'react'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { BEST_K, CV_ERROR, K_VALUES, type KValue } from '../data'

/** ADMIXTURE 교차 검증 오차 미니 선 그래프(K = 2~6). 최소 K를 강조하고 현재 K를 표시한다. */
export function CvMiniChart({ currentK }: { currentK: KValue }) {
  const theme = useChartTheme()
  const option = useMemo<EChartsOption>(
    () => ({
      grid: { left: 22, right: 10, top: 8, bottom: 20, containLabel: false },
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const [k, v] = (p as { value: [number, number] }).value
          return `K = ${k} · CV 오차 ${v.toFixed(4)}${k === BEST_K ? ' · 최소' : ''}`
        },
      },
      xAxis: {
        type: 'value',
        min: 1.7,
        max: 6.3,
        interval: 1,
        splitLine: { show: false },
        axisLine: { show: true },
        // K 눈금은 정수 2~6에만(min 1.7에서 시작하는 기본 눈금은 1.7, 2.7…라 라벨이 비었다)
        axisTick: { customValues: [...K_VALUES] },
        axisLabel: { fontSize: 11, margin: 4, customValues: [...K_VALUES], formatter: (v: number) => String(v) },
      },
      yAxis: { type: 'value', min: 0.46, max: 0.52, show: false },
      series: [
        {
          type: 'line',
          lineStyle: { color: theme.textMuted, width: 1.5 },
          symbolSize: 5,
          data: K_VALUES.map(k => ({
            value: [k, CV_ERROR[k]],
            symbolSize: k === BEST_K ? 9 : k === currentK ? 7 : 5,
            itemStyle: {
              color: k === BEST_K || k === currentK ? theme.text : theme.surface,
              borderColor: k === BEST_K ? theme.text : theme.textMuted,
              borderWidth: 1.5,
            },
          })),
        },
      ],
    }),
    [theme, currentK],
  )
  return (
    <div className="flex items-center gap-2">
      <div className="text-right text-[11px] leading-tight text-muted">
        <div className="font-semibold text-text">CV 오차 최소 K={BEST_K}</div>
        <div className="tabular-nums">{CV_ERROR[BEST_K].toFixed(4)}</div>
      </div>
      <div className="w-[150px]">
        <EChart
          option={option}
          height={72}
          ariaLabel={`ADMIXTURE 5겹 교차 검증 오차는 K = ${BEST_K}에서 최소 ${CV_ERROR[BEST_K]}이다.`}
          fallbackTable={{ columns: ['K', 'CV 오차'], rows: K_VALUES.map(k => [k, CV_ERROR[k].toFixed(4)]) }}
        />
      </div>
    </div>
  )
}
