import { useMemo } from 'react'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import type { PeriodStats } from '../data'
import { n } from './fmt'

/** D. 전통 vs GS: 예측 평균 ΔG(또는 상관 반응) vs 실현 기울기 묶음 막대(y축 0 포함). 실현 막대는 추세 차트 회귀선과 같은 색(주황 = 전통, 파랑 = GS), 범례는 ChartCard */
export function CompareBars({ stats, height, colors }: { stats: PeriodStats; height: number; colors: { pred: string; trad: string; gs: string } }) {
  const theme = useChartTheme()
  const t = stats.trait
  const d = t.key === 'yield' ? 1 : t.digits
  const segs = [stats.trad, stats.gs]
  const cats = ['전통 육종', 'GS']

  const option = useMemo<EChartsOption>(() => {
    const label = { show: true, position: 'top' as const, fontSize: 11, color: theme.text, formatter: (p: unknown) => n((p as { value: number }).value, d) }
    return {
      grid: { left: 8, right: 8, top: 30, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const list = params as { dataIndex: number; seriesName: string; value: number | null; marker: string }[]
          const s = segs[list[0]?.dataIndex ?? 0]
          if (!s) return `${cats[list[0]?.dataIndex ?? 0]}: 선택 기간에 코호트가 없습니다`
          return [
            `<b>${cats[list[0]!.dataIndex]}</b>`,
            ...list.map(p => `${p.marker}${p.seriesName} ${p.value === null ? '—' : n(p.value, d + 1)} ${t.unit}/년`),
            `실현율 ${n(s.realization, 1)}%`,
          ].join('<br/>')
        },
      },
      xAxis: { type: 'category', data: cats },
      yAxis: { type: 'value', name: `${t.unit}/년`, nameTextStyle: { align: 'left' }, axisLabel: { formatter: (v: number) => n(v, t.key === 'yield' ? 0 : t.digits) } },
      series: [
        { name: '예측 평균', type: 'bar', barMaxWidth: 28, itemStyle: { color: colors.pred }, label, data: segs.map(s => (s ? s.predMean : null)) },
        { name: '실현 기울기', type: 'bar', barMaxWidth: 28, label, data: segs.map((s, k) => (s ? { value: s.slope, itemStyle: { color: k === 0 ? colors.trad : colors.gs } } : null)) },
      ],
    } as EChartsOption
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, theme, colors, d])

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`${t.label} 예측 대비 실현: ${segs
        .map((s, k) => (s ? `${cats[k]} 예측 ${n(s.predMean, d + 1)}, 실현 ${n(s.slope, d + 1)} ${t.unit}/년(실현율 ${n(s.realization, 1)}%)` : `${cats[k]} 해당 코호트 없음`))
        .join(', ')}`}
      fallbackTable={{
        columns: ['구분', `예측 평균 (${t.unit}/년)`, `실현 기울기 (${t.unit}/년)`, '실현율 (%)'],
        rows: segs.map((s, k) => [cats[k]!, s ? n(s.predMean, d + 1) : '—', s ? n(s.slope, d + 1) : '—', s ? n(s.realization, 1) : '—']),
      }}
    />
  )
}
