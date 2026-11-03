import { useMemo } from 'react'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { FACTORS, FACTOR_LABEL, FACTOR_NAME, SHARE_MIN_DELTA, dG, lmdiRange, sumContribution, type Year } from '../data'
import { n, sg } from './fmt'

interface Step {
  name: string
  kind: 'total' | 'pos' | 'neg'
  base: number
  size: number
  value: number
  share: number | null
}

/** 기간 분해의 계단(시작 ΔG → i → r → σA → L → 종료 ΔG) */
export function waterfallSteps(start: Year, end: Year) {
  const c = lmdiRange(start, end)
  const delta = dG(end) - dG(start)
  const showShare = Math.abs(delta) >= SHARE_MIN_DELTA
  const steps: Step[] = [{ name: `${start} ΔG`, kind: 'total', base: 0, size: dG(start), value: dG(start), share: null }]
  let run = dG(start)
  for (const f of FACTORS) {
    const v = c[f]
    steps.push({ name: FACTOR_LABEL[f], kind: v >= 0 ? 'pos' : 'neg', base: v >= 0 ? run : run + v, size: Math.abs(v), value: v, share: showShare ? (v / delta) * 100 : null })
    run += v
  }
  steps.push({ name: `${end} ΔG`, kind: 'total', base: 0, size: dG(end), value: dG(end), share: null })
  return { steps, contribution: c, delta, showShare }
}

/** G. ΔG 변화의 요소별 기여(폭포). 양수 = 위로, 음수 = 다른 색 + − 부호 */
export function WaterfallChart({ start, end, height }: { start: Year; end: Year; height: number }) {
  const theme = useChartTheme()
  const { steps, contribution, delta, showShare } = useMemo(() => waterfallSteps(start, end), [start, end])

  const option = useMemo<EChartsOption>(() => {
    const color = (k: Step['kind']) => (k === 'total' ? theme.textMuted : k === 'pos' ? theme.positive : theme.warning)
    return {
      grid: { left: 8, right: 8, top: 34, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const list = params as { dataIndex: number }[]
          const s = steps[list[0]?.dataIndex ?? 0]
          if (!s) return ''
          if (s.kind === 'total') return `<b>${s.name}</b><br/>${n(s.value, 2)} kg/10a/년`
          const f = FACTORS[(list[0]?.dataIndex ?? 1) - 1]!
          return [`<b>${FACTOR_NAME[f]}</b> 기여`, `${sg(s.value, 2)} kg/10a/년`, s.share === null ? `비중 미표시(|ΔG 변화| < ${SHARE_MIN_DELTA})` : `비중 ${(s.share < 0 ? sg(s.share, 1) : n(s.share, 1))}%`].join('<br/>')
        },
      },
      xAxis: { type: 'category', data: steps.map(s => s.name), axisLabel: { interval: 0 } },
      yAxis: { type: 'value', min: 0, name: 'kg/10a/년', nameTextStyle: { align: 'left' } },
      series: [
        { name: '기준', type: 'bar', stack: 'w', silent: true, itemStyle: { color: 'transparent' }, tooltip: { show: false }, data: steps.map(s => s.base) },
        {
          name: '기여',
          type: 'bar',
          stack: 'w',
          barMaxWidth: 40,
          data: steps.map(s => ({
            value: s.size,
            itemStyle: { color: color(s.kind), borderRadius: 2 },
            label: {
              show: true,
              position: 'top' as const,
              fontSize: 11,
              lineHeight: 13,
              color: theme.text,
              fontWeight: s.kind === 'total' ? 700 : 600,
              formatter: s.kind === 'total' ? n(s.value, 2) : `${sg(s.value, 2)}${s.share !== null ? `\n${(s.share < 0 ? sg(s.share, 1) : n(s.share, 1))}%` : ''}`,
            },
          })),
        },
      ],
    } as EChartsOption
  }, [steps, theme])

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`${start}→${end} 쌀 수량 ΔG 변화 ${sg(delta, 2)} kg/10a/년(${n(dG(start), 2)} → ${n(dG(end), 2)}) = ${FACTORS.map(f => `${FACTOR_LABEL[f]} ${sg(contribution[f], 2)}${showShare ? `(${sg((contribution[f] / delta) * 100, 1)}%)` : ''}`).join(', ')}. 잔차 ${n(Math.abs(delta - sumContribution(contribution)), 2)}.`}
      fallbackTable={{
        columns: ['단계', '값 (kg/10a/년)', '비중 (%)'],
        rows: steps.map(s => [s.name, s.kind === 'total' ? n(s.value, 2) : sg(s.value, 2), s.share === null ? '—' : (s.share < 0 ? sg(s.share, 1) : n(s.share, 1))]),
      }}
    />
  )
}
