import { useMemo } from 'react'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { useMediaQuery } from '@/design-system'
import { formatNumber } from '@/lib/format'
import { GS_START, PROVISIONAL_YEAR, achHigher, dG, dGTarget, dGTargetPct, dGpct, rangeMeanPct, type Year } from '../data'

const n = (v: number, d: number) => formatNumber(v, { digits: d })

// ECharts custom series의 renderItem API 타입은 공개 export가 없어 느슨하게 둔다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Api = any

/** D. 연도별 ΔG(%/년) 막대 + 목표 계단선 + GS 도입 표식 + 범위 평균 */
export function GainChart({ years, height }: { years: Year[]; height: number }) {
  const theme = useChartTheme()
  const narrow = useMediaQuery('(max-width: 639px)')
  const start = years[0]
  const end = years[years.length - 1]
  const avg = rangeMeanPct(start, end)
  const avgLabel = `${start === end ? start : `${start}~${end}`} 평균 ${n(avg, 2)}%/년`

  const gsIndex = years.indexOf(GS_START as Year)

  const option = useMemo<EChartsOption>(() => {
    const bar = theme.categorical[0]
    return {
      // containLabel은 축 이름을 포함하지 않으므로 세로 축 제목 자리(약 20px)를 left에 따로 둔다
      grid: { left: 30, right: 16, top: 28, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const list = params as { dataIndex: number }[]
          // 잠정 연도의 범주 값은 줄바꿈과 '(잠정)'이 붙어 숫자로 바꿀 수 없으므로 인덱스로 연도를 찾는다
          const y = years[list[0]?.dataIndex ?? 0]
          if (y === undefined) return ''
          const a = achHigher(dG(y), dGTarget(y))
          return [
            `<b>${y}년${y === PROVISIONAL_YEAR ? ' (잠정)' : ''}</b>`,
            `ΔG ${n(dGpct(y), 2)}%/년 · ${n(dG(y), 2)} kg/10a/년`,
            `목표 ${n(dGTargetPct(y), 2)}%/년 · ${n(dGTarget(y), 2)} kg/10a/년`,
            `달성률 ${n(a, 1)}%`,
          ].join('<br/>')
        },
      },
      xAxis: {
        type: 'category',
        data: years.map(y => (y === PROVISIONAL_YEAR ? `${y}\n(잠정)` : String(y))),
        axisLabel: { lineHeight: 14 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        name: 'ΔG (%/년, 수량 기준)',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: { fontSize: 11, color: theme.textMuted },
        axisLabel: { formatter: (v: number) => v.toFixed(1) },
      },
      series: [
        {
          name: 'ΔG 실적',
          type: 'bar',
          barMaxWidth: 44,
          data: years.map(y => ({
            value: Number(dGpct(y).toFixed(4)),
            itemStyle: {
              color: bar,
              opacity: y < GS_START ? 0.45 : y === end ? 1 : 0.8,
            },
          })),
          markLine: {
            symbol: 'none',
            silent: true,
            data: [
              {
                yAxis: Number(avg.toFixed(4)),
                lineStyle: { color: theme.textMuted, type: 'dotted', width: 1.5 },
                // 좁은 화면은 값 라벨·목표선과 겹쳐 라벨을 범례 항목으로만 둔다
                label: narrow ? { show: false } : { formatter: avgLabel, position: 'insideStartTop', color: theme.text, fontSize: 11, fontWeight: 600, backgroundColor: theme.surface, padding: [1, 3] },
              },
            ],
          },
        },
        {
          name: 'ΔG 목표',
          type: 'line',
          step: 'middle',
          symbol: 'none',
          z: 5,
          lineStyle: { color: theme.text, type: 'dashed', width: 1.5 },
          itemStyle: { color: theme.text },
          data: years.map(y => Number(dGTargetPct(y).toFixed(4))),
        },
        // GS 도입 표식: markLine은 범주 가운데에만 놓여 2022 막대를 관통하므로 범주 왼쪽 경계에 직접 그린다
        ...(gsIndex >= 0
          ? [
              {
                name: 'GS 도입',
                type: 'custom' as const,
                silent: true,
                z: 6,
                tooltip: { show: false },
                data: [[gsIndex, 0]],
                renderItem: (params: Api, api: Api): Api => {
                  const box = params.coordSys as { x: number; y: number; height: number }
                  const x = (api.coord([gsIndex, 0])[0] as number) - (api.size([1, 0])[0] as number) / 2
                  return {
                    type: 'group',
                    children: [
                      { type: 'line', shape: { x1: x, y1: box.y - 18, x2: x, y2: box.y + box.height }, style: { stroke: theme.accent, lineWidth: 1.5, lineDash: [4, 3] } },
                      { type: 'text', style: { x: x + 5, y: box.y - 19, text: 'GS 도입', fill: theme.accent, fontSize: 11, fontWeight: 700 } },
                    ],
                  }
                },
              },
            ]
          : []),
        {
          // 값 라벨 전용 계열: 막대 라벨은 목표 계단선(z 5)·GS 도입선 아래에 깔려 겹치므로
          // 더 높은 z의 보이지 않는 점에 라벨을 달고 카드 배경색 상자를 깐다
          name: 'ΔG 값',
          type: 'scatter',
          symbolSize: 0,
          silent: true,
          z: 10,
          tooltip: { show: false },
          data: years.map(y => Number(dGpct(y).toFixed(4))),
          label: {
            show: true,
            position: 'top',
            distance: 6,
            color: theme.text,
            backgroundColor: theme.surface,
            padding: [1, 3],
            borderRadius: 2,
            fontSize: 11,
            fontWeight: 600,
            formatter: (p: unknown) => n((p as { value: number }).value, 2),
          },
        },
      ],
    }
  }, [years, theme, avg, avgLabel, end, narrow, gsIndex])

  const endTxt = `${end}년 ΔG ${n(dGpct(end), 2)}%/년(목표 ${n(dGTargetPct(end), 2)}%/년, 달성률 ${n(achHigher(dG(end), dGTarget(end)), 1)}%)`

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`연도별 연간 유전적 개량량: ${avgLabel}. ${endTxt}.${years.includes(GS_START as Year) && start < GS_START ? ` GS 도입 전 ${n(dGpct(start), 2)}%/년에서 크게 늘었다.` : ''}`}
      fallbackTable={{
        columns: ['연도', 'ΔG (%/년)', 'ΔG (kg/10a/년)', '목표 (%/년)', '달성률 (%)'],
        rows: years.map(y => [y, n(dGpct(y), 2), n(dG(y), 2), n(dGTargetPct(y), 2), n(achHigher(dG(y), dGTarget(y)), 1)]),
      }}
    />
  )
}
