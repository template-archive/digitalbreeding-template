import { useMemo } from 'react'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { MONTH_LABELS, type Env } from '../data'
import { f1, n0, pct0, s0, s1 } from './fmt'

export type MonthlyMode = 'temp' | 'pr' | 'sun'
export const MONTHLY_MODES: { value: MonthlyMode; label: string }[] = [
  { value: 'temp', label: '기온' },
  { value: 'pr', label: '강수량' },
  { value: 'sun', label: '일조시간' },
]

interface Props {
  env: Env
  mode: MonthlyMode
  height: number
}

const UNIT: Record<MonthlyMode, string> = { temp: '°C', pr: 'mm', sun: 'h' }

/** 실측·평년 쌍과 편차 문구(편차는 원값 차를 한 번 반올림) */
function pair(env: Env, mode: MonthlyMode, m: number) {
  const r = env.monthly[m]!
  if (mode === 'temp') return { v: r.t, n: r.tN, text: `실측 ${f1(r.t)} °C · 평년 ${f1(r.tN)} °C · 편차 ${s1(r.t - r.tN)}` }
  if (mode === 'pr') return { v: r.pr, n: r.prN, text: `실측 ${n0(r.pr)} mm · 평년 ${n0(r.prN)} mm · 평년의 ${pct0((100 * r.pr) / r.prN)}` }
  return { v: r.sun, n: r.sunN, text: `실측 ${n0(r.sun)} h · 평년 ${n0(r.sunN)} h · 편차 ${s0(r.sun - r.sunN)} h` }
}

export function monthlyColor(theme: ReturnType<typeof useChartTheme>, mode: MonthlyMode) {
  return mode === 'temp' ? theme.negative : mode === 'pr' ? theme.categorical[0]! : theme.categorical[1]!
}

/** D 월별 추이: 기온 = 실측 선 + 평년 점선, 강수·일조 = 실측 막대 + 평년 점선 */
export function MonthlyChart({ env, mode, height }: Props) {
  const theme = useChartTheme()
  const color = monthlyColor(theme, mode)
  const rows = useMemo(() => MONTH_LABELS.map((_, m) => pair(env, mode, m)), [env, mode])

  const option = useMemo<EChartsOption>(() => {
    const unit = UNIT[mode]
    const actual =
      mode === 'temp'
        ? { type: 'line' as const, name: '실측', data: rows.map(r => r.v), itemStyle: { color }, lineStyle: { color, width: 2.5 }, symbolSize: 7, z: 3 }
        : { type: 'bar' as const, name: '실측', data: rows.map(r => r.v), itemStyle: { color }, barMaxWidth: 28, z: 2 }
    return {
      animation: false,
      grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: MONTH_LABELS },
      yAxis: {
        type: 'value',
        name: unit,
        scale: mode === 'temp',
        nameTextStyle: { align: 'right' },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (ps: unknown) => {
          const arr = ps as { dataIndex: number }[]
          const i = arr[0]?.dataIndex ?? 0
          return `<b>${env.site.short} ${env.year} ${MONTH_LABELS[i]}</b><br/>${rows[i]!.text}`
        },
      },
      series: [
        actual,
        {
          type: 'line',
          name: '평년',
          data: rows.map(r => r.n),
          itemStyle: { color: theme.textMuted },
          lineStyle: { color: theme.textMuted, type: 'dashed', width: 1.5 },
          symbol: 'emptyCircle',
          symbolSize: 6,
          z: 4,
        },
      ],
    }
  }, [env, mode, theme, color, rows])

  const label = MONTHLY_MODES.find(m => m.value === mode)!.label
  const maxDev = rows.reduce((best, r, i) => (Math.abs(r.v - r.n) > Math.abs(rows[best]!.v - rows[best]!.n) ? i : best), 0)
  const aria = `${env.site.name} ${env.year} 월별 ${label}. 평년과 차이가 가장 큰 달은 ${MONTH_LABELS[maxDev]}: ${rows[maxDev]!.text}.`
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={aria}
      fallbackTable={{ columns: ['월', `실측(${UNIT[mode]})`, `평년(${UNIT[mode]})`], rows: rows.map((r, i) => [MONTH_LABELS[i]!, mode === 'temp' ? f1(r.v) : n0(r.v), mode === 'temp' ? f1(r.n) : n0(r.n)]) }}
    />
  )
}
