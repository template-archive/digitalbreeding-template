import { useMemo } from 'react'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { formatFixed, formatNumber } from '@/lib/format'
import { FORWARD, FORWARD_NEXT, RETRAIN_LABEL, R, R_T, TRAIN_N, YEARS, type Year } from '../data'

const n2 = (v: number) => formatFixed(v, 2)
const nN = (v: number) => formatNumber(v, { digits: 0 })

/** D. 쌀 수량 정확도 연도별 추이(GBLUP, 매년 2월 재학습) */
export function TrendChart({ height, compact }: { height: number; compact: boolean }) {
  const theme = useChartTheme()

  const option = useMemo<EChartsOption>(() => {
    const cats = YEARS.map(String)
    const cvColor = theme.categorical[0]!
    return {
      grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        confine: true,
        formatter: (params: unknown) => {
          const list = params as { dataIndex: number }[]
          const y = YEARS[list[0]?.dataIndex ?? 0]!
          const f = FORWARD[y]
          const ach = (R[y] / R_T[y]) * 100
          return [
            `<b>${y}년</b> · ${RETRAIN_LABEL[y]} 재학습`,
            `훈련 집단 ${nN(TRAIN_N[y])}계통`,
            `CV 정확도 r ${n2(R[y])} · 목표 ${n2(R_T[y])} · 달성률 ${formatFixed(ach, 1)}%`,
            f !== undefined ? `전진 검증 ${n2(f)} · CV − 전진 ${n2(R[y] - f)}` : `전진 검증: ${FORWARD_NEXT} 산출 예정`,
          ].join('<br/>')
        },
      },
      xAxis: {
        type: 'category',
        data: cats,
        boundaryGap: true,
        // 데스크톱: 연도 아래 둘째 줄에 훈련 집단 N(계통). 좁은 화면은 연도만
        axisLabel: compact
          ? undefined
          : {
              formatter: (v: string) => `{y|${v}}\n{n|N ${nN(TRAIN_N[Number(v) as Year])}}`,
              rich: {
                y: { fontSize: 11, color: theme.textMuted, lineHeight: 16 },
                n: { fontSize: 11, color: theme.textMuted, lineHeight: 14 },
              },
            },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 1,
        interval: 0.2,
        name: '예측 정확도 r',
        nameLocation: 'end',
        nameGap: 10,
        nameTextStyle: { align: 'left' },
        axisLabel: { formatter: (v: number) => v.toFixed(1) },
      },
      series: [
        {
          name: '목표 r',
          type: 'line',
          step: 'middle',
          data: YEARS.map(y => R_T[y]),
          symbol: 'none',
          lineStyle: { type: 'dashed', width: 1.5, color: theme.warning },
          itemStyle: { color: theme.warning },
          z: 2,
        },
        {
          name: 'CV 정확도',
          type: 'line',
          data: YEARS.map(y => R[y]),
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { width: 2.5, color: cvColor },
          itemStyle: { color: cvColor },
          label: {
            show: true,
            position: 'top',
            fontSize: 11,
            fontWeight: 600,
            color: theme.text,
            formatter: (p: unknown) => n2((p as { value: number }).value),
          },
          z: 4,
        },
        {
          name: '전진 검증',
          type: 'line',
          data: YEARS.map(y => FORWARD[y] ?? null),
          connectNulls: false,
          symbol: 'emptyCircle',
          symbolSize: 6,
          lineStyle: { width: 2, type: 'dashed', color: theme.categorical[1] },
          itemStyle: { color: theme.categorical[1] },
          label: {
            show: true,
            position: 'bottom',
            fontSize: 11,
            color: theme.textMuted,
            formatter: (p: unknown) => {
              const v = (p as { value: number | null }).value
              return v == null ? '' : n2(v)
            },
          },
          z: 3,
        },
      ],
    }
  }, [theme, compact])

  const fy = YEARS.filter(y => FORWARD[y] !== undefined)
  const last = YEARS[YEARS.length - 1]!
  const ariaLabel = `쌀 수량 GBLUP 교차 검증 정확도 ${YEARS[0]} ${n2(R[YEARS[0]])}에서 ${last} ${n2(R[last])}로 상승, ${last} 목표 ${n2(R_T[last])} 대비 ${formatFixed((R[last] / R_T[last]) * 100, 1)}%. 전진 검증은 ${fy.map(y => n2(FORWARD[y]!)).join(', ')}(${fy[0]}~${fy[fy.length - 1]})이고 ${last}년 값은 ${FORWARD_NEXT} 산출 예정.`

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={ariaLabel}
      fallbackTable={{
        columns: ['연도', '재학습', '훈련 집단', 'CV r', '목표', '달성률', '전진 검증', 'CV − 전진'],
        rows: YEARS.map(y => {
          const f = FORWARD[y]
          return [
            y,
            RETRAIN_LABEL[y],
            nN(TRAIN_N[y]),
            n2(R[y]),
            n2(R_T[y]),
            `${formatFixed((R[y] / R_T[y]) * 100, 1)}%`,
            f !== undefined ? n2(f) : `${FORWARD_NEXT} 산출 예정`,
            f !== undefined ? n2(R[y] - f) : '—',
          ]
        }),
      }}
    />
  )
}
