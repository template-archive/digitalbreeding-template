import { useMemo } from 'react'
import { EChart, gsIntroLine, hMarkLine, useChartTheme, type EChartsOption } from '@/charts'
import { GS_START, I, L, R, SIGMA_A, componentIndex, dG, type IndexKey, type Year } from '../data'
import { axisYear, n, yearLabel } from './fmt'

export const INDEX_SERIES: { key: IndexKey; name: string; legend: string }[] = [
  { key: 'i', name: '선발 강도(i)', legend: '선발 강도(i)' },
  { key: 'r', name: '선발·예측 정확도(r)', legend: '선발·예측 정확도(r)' },
  { key: 'sigmaA', name: 'σA', legend: '상가적 유전 표준편차(σA)' },
  { key: 'invL', name: '1/L', legend: '세대 간격 역수(1/L) — 높을수록 ΔG에 유리' },
  { key: 'dG', name: 'ΔG', legend: 'ΔG 지수' },
]

const raw = (k: IndexKey, y: Year) =>
  k === 'i' ? n(I[y], 3) : k === 'r' ? n(R[y], 2) : k === 'sigmaA' ? `${n(SIGMA_A[y], 1)} kg/10a` : k === 'invL' ? `L ${n(L[y], 1)}년` : `${n(dG(y), 2)} kg/10a/년`

/** F. 구성 요소 지수(시작 연도 = 100) */
export function IndexChart({ years, height, colors }: { years: Year[]; height: number; colors: Record<IndexKey, string> }) {
  const theme = useChartTheme()
  const start = years[0]!
  const end = years[years.length - 1]!

  const option = useMemo<EChartsOption>(() => {
    const showGs = years.includes(GS_START as Year) && start < GS_START
    return {
      grid: { left: 36, right: 46, top: 16, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const list = params as { dataIndex: number }[]
          const y = years[list[0]?.dataIndex ?? 0]
          if (y === undefined) return ''
          const idx = componentIndex(start, y)
          return [
            `<b>${yearLabel(y)}</b> (${start} = 100)`,
            ...INDEX_SERIES.map(s => `<span style="color:${colors[s.key]}">●</span> ${s.name} ${n(idx[s.key], 1)} · ${raw(s.key, y)}${s.key === 'r' ? (y < GS_START ? ' (표현형 선발 정확도 √h²)' : ' (GS 예측 정확도)') : ''}`),
          ].join('<br/>')
        },
      },
      xAxis: { type: 'category', data: years.map(axisYear), boundaryGap: false, axisLabel: { lineHeight: 14 } },
      yAxis: { type: 'value', name: `지수(시작 연도 = 100)`, nameLocation: 'middle', nameGap: 40, min: (v: { min: number }) => Math.min(80, Math.floor(v.min / 20) * 20) },
      series: INDEX_SERIES.map(s => {
        const strong = s.key === 'dG'
        return {
          name: s.name,
          type: 'line' as const,
          symbol: 'circle',
          symbolSize: strong ? 6 : 4,
          z: strong ? 5 : 3,
          lineStyle: { color: colors[s.key], width: strong ? 3.5 : 1.75 },
          itemStyle: { color: colors[s.key] },
          endLabel: strong ? { show: true, formatter: (p: { value: number }) => n(p.value, 0), color: colors[s.key], fontSize: 11, fontWeight: 700 } : { show: false },
          data: years.map(y => componentIndex(start, y)[s.key]),
          ...(strong
            ? {
                markLine: {
                  symbol: 'none',
                  silent: true,
                  data: [
                    hMarkLine(100, null, theme.textMuted, { width: 1 }),
                    ...(showGs ? [gsIntroLine(theme, years.indexOf(GS_START as Year))] : []),
                  ],
                },
              }
            : {}),
        }
      }),
    } as EChartsOption
  }, [years, start, theme, colors])

  const idx = componentIndex(start, end)
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`구성 요소 지수 ${end}(${start}=100): ΔG ${n(idx.dG, 1)}, 세대 간격 역수 ${n(idx.invL, 1)}, 선발·예측 정확도 ${n(idx.r, 1)}, 선발 강도 ${n(idx.i, 1)}, σA ${n(idx.sigmaA, 1)}.`}
      fallbackTable={{
        columns: ['연도', ...INDEX_SERIES.map(s => s.name)],
        rows: years.map(y => {
          const v = componentIndex(start, y)
          return [yearLabel(y), ...INDEX_SERIES.map(s => n(v[s.key], 1))]
        }),
      }}
    />
  )
}
