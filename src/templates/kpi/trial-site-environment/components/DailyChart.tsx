import { useMemo } from 'react'
import { EChart, hMarkLine, useChartTheme, vMarkLine, type EChartsOption } from '@/charts'
import { COLD_T, HEAT_STERILE_T, HEAT_T, mmdd, WIN_HALF, type Env } from '../data'
import { f1 } from './fmt'

interface Props {
  env: Env
  height: number
}

/**
 * E 일별 기온(5/1~10/31): 최고·최저 띠 + 평균선, 기준선 33·35·17 °C, 출수 ±15일 음영, 이앙·출수·수확 세로선.
 * 다이아몬드 = 최고 ≥ 35 °C(5~10월 전체), 원 = 출수 ±15일 안 최저 ≤ 17 °C(5·10월의 일상적 저온은 표시하지 않음). ▲▼는 증감 전용이라 쓰지 않는다
 */
export function DailyChart({ env, height }: Props) {
  const theme = useChartTheme()
  const days = env.days
  const lo = env.hd - WIN_HALF
  const hi = env.hd + WIN_HALF
  const { hot, hotIn, cold, coldPre } = useMemo(() => {
    const hot = days.filter(d => d.tmax >= HEAT_STERILE_T)
    const cold = days.filter(d => d.k >= lo && d.k <= hi && d.tmin <= COLD_T)
    return { hot, hotIn: hot.filter(d => d.k >= lo && d.k <= hi), cold, coldPre: cold.filter(d => d.k <= env.hd) }
  }, [days, lo, hi, env.hd])

  const option = useMemo<EChartsOption>(() => {
    const cats = days.map(d => mmdd(d.k))
    const bandColor = theme.categorical[0]!
    // 17 °C 라벨은 일평균선·최고~최저 띠와 같은 높이를 지나므로 표면색 배경을 깔아 가려지지 않게 한다
    const coldBase = hMarkLine(COLD_T, `${COLD_T} °C 장해형 냉해`, theme.info, { line: 'dashed', position: 'insideStartTop' })
    const coldLine = {
      ...coldBase,
      label: { ...coldBase.label, backgroundColor: theme.surface, padding: [1, 4], borderRadius: 3, borderColor: theme.info, borderWidth: 1 },
    }
    return {
      animation: false,
      grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: cats,
        boundaryGap: false,
        axisLabel: { interval: (i: number) => cats[i]!.endsWith('-01'), formatter: (v: string) => `${Number(v.slice(0, 2))}월` },
      },
      yAxis: { type: 'value', name: '°C', min: 0, max: 40, interval: 10 },
      tooltip: {
        trigger: 'axis',
        formatter: (ps: unknown) => {
          const i = (ps as { dataIndex: number }[])[0]?.dataIndex ?? 0
          const d = days[i]!
          return [
            `<b>${env.year}-${mmdd(d.k)}</b>`,
            `최고 ${f1(d.tmax)} · 평균 ${f1(d.tmean)} · 최저 ${f1(d.tmin)} °C`,
            `강수 ${f1(d.pr)} mm · 일조 ${f1(d.sun)} h`,
          ].join('<br/>')
        },
      },
      series: [
        { type: 'line', name: '최저', stack: 'band', data: days.map(d => d.tmin), symbol: 'none', lineStyle: { opacity: 0 }, silent: true },
        {
          type: 'line',
          name: '최고~최저',
          stack: 'band',
          data: days.map(d => d.tmax - d.tmin),
          symbol: 'none',
          lineStyle: { opacity: 0 },
          areaStyle: { color: bandColor, opacity: 0.22 },
          silent: true,
          markArea: {
            silent: true,
            itemStyle: { color: theme.warning, opacity: 0.12 },
            label: { show: true, position: 'insideTop', color: theme.text, fontSize: 11, formatter: `출수 ±${WIN_HALF}일` },
            data: [[{ xAxis: cats[lo]! }, { xAxis: cats[hi]! }]],
          },
        },
        {
          type: 'line',
          name: '평균',
          data: days.map(d => d.tmean),
          symbol: 'none',
          lineStyle: { color: theme.text, width: 1.5 },
          itemStyle: { color: theme.text },
          markLine: {
            symbol: 'none',
            silent: true,
            data: [
              hMarkLine(HEAT_STERILE_T, `${HEAT_STERILE_T} °C 고온 불임`, theme.negative, { line: 'dashed', position: 'insideStartTop' }),
              hMarkLine(HEAT_T, `${HEAT_T} °C 폭염`, theme.warning, { line: 'dashed', position: 'insideStartBottom', width: 1 }),
              coldLine,
              vMarkLine(cats[env.tp]!, `이앙 ${cats[env.tp]}`, theme.textMuted, { line: 'dotted', width: 1 }),
              vMarkLine(cats[env.hd]!, `출수 ${cats[env.hd]}`, theme.text, { line: 'solid', width: 1.5 }),
              vMarkLine(cats[env.hv]!, `수확 ${cats[env.hv]}`, theme.textMuted, { line: 'dotted', width: 1 }),
            ],
          },
        },
        {
          type: 'scatter',
          name: `최고 ≥ ${HEAT_STERILE_T} °C`,
          data: hot.map(d => [cats[d.k]!, d.tmax]),
          symbol: 'diamond',
          symbolSize: 10,
          itemStyle: { color: theme.negative, borderColor: theme.surface, borderWidth: 1 },
          z: 5,
          tooltip: { show: false },
        },
        {
          type: 'scatter',
          name: `최저 ≤ ${COLD_T} °C`,
          data: cold.map(d => [cats[d.k]!, d.tmin]),
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: { color: theme.info, borderColor: theme.surface, borderWidth: 1 },
          z: 5,
          tooltip: { show: false },
        },
      ],
    }
  }, [env, days, theme, lo, hi, hot, cold])

  const aria = `${env.site.name} ${env.year} 일별 기온. 출수 ${mmdd(env.hd)} ±${WIN_HALF}일 안에 최고 ≥ ${HEAT_STERILE_T} °C ${hotIn.length}일(5~10월 전체 ${hot.length}일), 최고 ≥ ${HEAT_T} °C ${env.heat}일, 출수 전 ${WIN_HALF}일 안 최저 ≤ ${COLD_T} °C ${coldPre.length}일(±${WIN_HALF}일 ${cold.length}일).`
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={aria}
      fallbackTable={{
        columns: ['날짜', '최고(°C)', '평균(°C)', '최저(°C)'],
        rows: days.filter(d => d.k >= lo && d.k <= hi).map(d => [mmdd(d.k), f1(d.tmax), f1(d.tmean), f1(d.tmin)]),
      }}
    />
  )
}

export function dailyCounts(env: Env) {
  const lo = env.hd - WIN_HALF
  const hi = env.hd + WIN_HALF
  const hot = env.days.filter(d => d.tmax >= HEAT_STERILE_T)
  return { hotAll: hot.length, hotIn: hot.filter(d => d.k >= lo && d.k <= hi).length }
}
