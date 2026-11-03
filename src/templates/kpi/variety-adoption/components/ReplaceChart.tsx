import { useMemo } from 'react'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { CENTRAL, CUR, GARAMSOL, OLD_MAIN_CENTRAL, REPLACE_YEARS, garamsolCentral, replaceRate } from '../data'
import { ha, pc } from './fmt'

const YEARS = REPLACE_YEARS as readonly number[]

/** F. 가람솔 대체율 — 위: 대체율 선(0~100%), 아래: 중부 3도 면적 누적 막대 */
export function ReplaceChart({ height }: { height: number }) {
  const theme = useChartTheme()
  const option = useMemo<EChartsOption>(() => {
    const main = theme.categorical[0]!
    const old = theme.categorical[7]!
    const cats = YEARS.map(String)
    return {
      grid: [
        // top 22면 축 이름 '대체율(%)' 윗부분이 캔버스 밖으로 잘린다
        { left: 8, right: 16, top: 32, height: '36%', containLabel: true },
        { left: 8, right: 16, top: '58%', bottom: 4, containLabel: true },
      ],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow', link: [{ xAxisIndex: 'all' }] },
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          const y = YEARS[i]!
          return [
            `<b>${y}${y === CUR ? ' (추정)' : ''} · 중부 3도</b>`,
            `대체율 <b>${pc(replaceRate(y), 1)}</b>`,
            `${GARAMSOL.name} ${ha(garamsolCentral(y))} ha`,
            `구 주력 중만생 품종 ${ha(OLD_MAIN_CENTRAL[y]!)} ha`,
          ].join('<br/>')
        },
      },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      xAxis: [
        { type: 'category', gridIndex: 0, data: cats, axisLabel: { show: false }, axisTick: { show: false } },
        { type: 'category', gridIndex: 1, data: cats },
      ],
      yAxis: [
        { type: 'value', gridIndex: 0, min: 0, max: 100, interval: 50, name: '대체율(%)', nameTextStyle: { align: 'left' }, axisLabel: { formatter: (v: number) => `${v}%` } },
        { type: 'value', gridIndex: 1, min: 0, axisLabel: { formatter: (v: number) => ha(v) } },
      ],
      series: [
        {
          name: '대체율',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { color: main, width: 2.5 },
          itemStyle: { color: main },
          areaStyle: { color: main, opacity: 0.08 },
          data: YEARS.map(y => ({
            value: replaceRate(y),
            label: { show: y >= 2023, position: 'top', formatter: pc(replaceRate(y), 1), color: y === CUR ? theme.text : theme.textMuted, fontSize: y === CUR ? 12 : 11, fontWeight: y === CUR ? 700 : 500 },
          })),
        },
        {
          name: GARAMSOL.name,
          type: 'bar',
          stack: 'c',
          xAxisIndex: 1,
          yAxisIndex: 1,
          barMaxWidth: 28,
          itemStyle: { color: main, borderRadius: 0 },
          data: YEARS.map(y => garamsolCentral(y)),
        },
        {
          name: '구 주력 품종',
          type: 'bar',
          stack: 'c',
          xAxisIndex: 1,
          yAxisIndex: 1,
          barMaxWidth: 28,
          itemStyle: { color: old, opacity: 0.55, borderRadius: [2, 2, 0, 0] },
          data: YEARS.map(y => OLD_MAIN_CENTRAL[y]!),
        },
      ],
    } as EChartsOption
  }, [theme])
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`중부 3도(${CENTRAL.join('·')})에서 ${GARAMSOL.name} 대체율은 ${YEARS.filter(y => y >= 2023)
        .map(y => `${y} ${pc(replaceRate(y), 1)}`)
        .join(', ')}로 올랐고, 구 주력 중만생 품종 면적은 ${ha(OLD_MAIN_CENTRAL[YEARS[0]!]!)} ha에서 ${ha(OLD_MAIN_CENTRAL[CUR]!)} ha로 줄었습니다.`}
      fallbackTable={{
        columns: ['연도', '대체율', `${GARAMSOL.name} 중부 3도(ha)`, '구 주력 품종(ha)'],
        rows: YEARS.map(y => [String(y), pc(replaceRate(y), 1), ha(garamsolCentral(y)), ha(OLD_MAIN_CENTRAL[y]!)]),
      }}
    />
  )
}
