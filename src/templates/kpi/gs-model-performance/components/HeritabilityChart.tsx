import { useMemo } from 'react'
import { EChart, selectionStroke, useChartTheme, type EChartsOption } from '@/charts'
import { formatFixed, formatSigned } from '@/lib/format'
import { REGRESSION, REG_X, TRAIT_BY_KEY, type TraitKey } from '../data'

const n2 = (v: number) => formatFixed(v, 2)

export const regressionLabel = () => `r = ${formatFixed(REGRESSION.intercept, 3)} + ${formatFixed(REGRESSION.slope, 3)}·h²`

/** E. 형질별 유전력(h²)과 예측 정확도(GBLUP) 산점도 + OLS 회귀선 */
export function HeritabilityChart({ selected, height }: { selected: TraitKey; height: number }) {
  const theme = useChartTheme()

  const option = useMemo<EChartsOption>(() => {
    const line = REG_X.map(x => [x, REGRESSION.intercept + REGRESSION.slope * x])
    const stroke = selectionStroke(theme)
    return {
      grid: { left: 8, right: 20, top: 28, bottom: 26, containLabel: true },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (p: unknown) => {
          const q = p as { seriesName: string; dataIndex: number }
          if (q.seriesName !== '형질') return ''
          const pt = REGRESSION.points[q.dataIndex]!
          return [
            `<b>${TRAIT_BY_KEY[pt.trait].name}</b>`,
            `h² ${n2(pt.h2)} · r ${n2(pt.r)}`,
            `예측 능력 ${n2(pt.predAbility)}`,
            `회귀 예측값 ${n2(pt.fit)} · 잔차 ${formatSigned(pt.resid, 2)}`,
          ].join('<br/>')
        },
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: 1,
        interval: 0.2,
        name: '협의 유전력 h²(훈련 집단 계통평균)',
        nameLocation: 'middle',
        nameGap: 24,
        axisLabel: { formatter: (v: number) => v.toFixed(1) },
        splitLine: { show: true, lineStyle: { color: theme.border, type: 'dashed', opacity: 0.5 } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 1,
        interval: 0.2,
        name: '예측 정확도 r(GBLUP)',
        nameLocation: 'end',
        nameGap: 10,
        nameTextStyle: { align: 'left' },
        axisLabel: { formatter: (v: number) => v.toFixed(1) },
      },
      series: [
        {
          name: '회귀선',
          type: 'line',
          data: line,
          symbol: 'none',
          silent: true,
          lineStyle: { width: 1.5, type: 'dashed', color: theme.textMuted },
          endLabel: { show: true, formatter: `R² = ${n2(REGRESSION.r2)}`, color: theme.textMuted, fontSize: 11, offset: [-4, -14] },
          z: 1,
        },
        {
          name: '형질',
          type: 'scatter',
          data: REGRESSION.points.map(pt => {
            const sel = pt.trait === selected
            return {
              value: [pt.h2, pt.r],
              symbolSize: sel ? 15 : 10,
              // 선택 형질: 같은 범주색 + 글자색 테두리(데이터 위 선택 표시 규칙, 강조색 쓰지 않음)
              itemStyle: {
                color: theme.categorical[0],
                opacity: sel ? 1 : 0.6,
                borderColor: sel ? stroke.lineColor : theme.surface,
                borderWidth: sel ? stroke.lineWidth : 1,
              },
              label: {
                show: true,
                formatter: TRAIT_BY_KEY[pt.trait].short,
                position: pt.trait === 'height' ? 'bottom' : 'top',
                distance: 6,
                fontSize: 11,
                fontWeight: sel ? 700 : 400,
                // 라벨이 점 opacity 0.6을 물려받아 흐렸다
                opacity: 1,
                color: sel ? theme.text : theme.textMuted,
              },
            }
          }),
          z: 3,
        },
      ],
    }
  }, [theme, selected])

  const y = REGRESSION.points.find(p => p.trait === 'yield')!
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`형질별 유전력과 GBLUP 예측 정확도: 회귀 ${regressionLabel()}, R² ${n2(REGRESSION.r2)}. 쌀 수량은 회귀선보다 ${formatSigned(y.resid, 2)} 높다.`}
      fallbackTable={{
        columns: ['형질', 'h²', 'r', '예측 능력', '회귀 예측값', '잔차'],
        rows: REGRESSION.points.map(pt => [TRAIT_BY_KEY[pt.trait].name, n2(pt.h2), n2(pt.r), n2(pt.predAbility), n2(pt.fit), formatSigned(pt.resid, 2)]),
      }}
    />
  )
}
