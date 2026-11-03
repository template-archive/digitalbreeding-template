import { useMemo } from 'react'
import { EChart, hMarkLine, useChartTheme, vMarkLine, type EChartsOption } from '@/charts'
import { formatFixed, formatNumber } from '@/lib/format'
import {
  EXTRA,
  GRID,
  MODELS,
  N_MAX,
  N_MIN,
  N_PLAN_2027,
  N_STAR,
  N_STAR_ROUND,
  N_TRAIN,
  PLAN_YEAR,
  RETRAIN_LABEL,
  R_PLAN_2027,
  R_TARGET,
  TRAIN_N,
  YEARS,
  R,
  curve,
  curveSd,
  fmt3,
  type ModelKey,
  type TraitDef,
} from '../data'

const n2 = (v: number) => formatFixed(v, 2)
const nN = (v: number) => formatNumber(v, { digits: 0 })

/** C. 훈련 집단 크기별 학습 곡선 */
export function LearningCurveChart({ trait, visible, height, compact }: { trait: TraitDef; visible: ModelKey[]; height: number; compact: boolean }) {
  const theme = useChartTheme()
  const isYield = trait.key === 'yield'
  const shown = MODELS.filter(m => visible.includes(m))

  const option = useMemo<EChartsOption>(() => {
    const xTicks: number[] = compact ? [N_MIN, GRID[3], N_TRAIN, N_MAX] : [...GRID, ...EXTRA]
    const series: unknown[] = []
    const gblupOn = shown.includes('GBLUP')
    const gColor = theme.categorical[0]!

    if (gblupOn) {
      // ±SD 띠(GBLUP, 실측 구간) — 다각형 하나로 그린다
      const upper = GRID.map(n => [n, Math.min(1, curve(trait, 'GBLUP', n) + curveSd(trait, 'GBLUP', n))])
      const lower = GRID.map(n => [n, Math.max(0, curve(trait, 'GBLUP', n) - curveSd(trait, 'GBLUP', n))])
      series.push({
        name: 'GBLUP ±SD',
        type: 'custom',
        silent: true,
        z: 1,
        data: [[0]],
        tooltip: { show: false },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderItem: (_p: any, api: any) => ({
          type: 'polygon',
          shape: { points: [...upper, ...lower.slice().reverse()].map(pt => api.coord(pt)) },
          style: { fill: gColor, opacity: 0.16 },
        }),
      })
    }

    for (const m of shown) {
      const color = theme.categorical[MODELS.indexOf(m)]!
      const isOp = m === 'GBLUP'
      const marks: unknown[] = []
      if (isOp) {
        marks.push(vMarkLine(N_TRAIN, `현재 ${nN(N_TRAIN)}`, theme.textMuted, { line: 'solid', width: 1 }))
        // 라벨은 '목표 도달' 콜아웃 하나로 모은다(세로 라벨이 1,850~2,150 구간에 몰려 겹쳤다)
        marks.push(vMarkLine(N_PLAN_2027, isYield ? null : `${PLAN_YEAR} 계획 ${nN(N_PLAN_2027)}`, theme.textMuted, { line: 'dotted', width: 1, position: 'insideEndTop' }))
        if (isYield) {
          marks.push(hMarkLine(R_TARGET, `목표 r ${n2(R_TARGET)}`, theme.warning, { line: 'dashed', position: 'insideStartTop' }))
        }
      }
      series.push({
        name: m,
        type: 'line',
        data: GRID.map(n => [n, curve(trait, m, n)]),
        symbol: 'circle',
        symbolSize: isOp ? 6 : 4,
        lineStyle: { width: isOp ? 2.5 : 1.6, color },
        itemStyle: { color },
        z: isOp ? 4 : 3,
        ...(marks.length ? { markLine: { symbol: 'none', silent: true, data: marks } } : {}),
      })
      if (isOp) {
        series.push({
          name: `${m} 외삽`,
          type: 'line',
          data: [N_TRAIN, ...EXTRA].map(n => [n, curve(trait, m, n)]),
          symbol: 'emptyCircle',
          symbolSize: 5,
          lineStyle: { width: 2, type: 'dashed', color },
          itemStyle: { color },
          z: 4,
        })
      }
    }

    if (isYield && gblupOn) {
      // 연도별 운영 모델 점
      series.push({
        name: '연도별 운영 모델',
        type: 'scatter',
        data: YEARS.map(y => ({ value: [TRAIN_N[y], R[y]], year: y })),
        symbol: 'diamond',
        symbolSize: 10,
        itemStyle: { color: theme.surface, borderColor: theme.text, borderWidth: 1.5 },
        label: {
          show: !compact,
          formatter: (p: { data: { year: number } }) => String(p.data.year),
          position: 'bottom',
          distance: 4,
          fontSize: 11,
          color: theme.textMuted,
        },
        z: 6,
      })
      // 목표 도달 N*
      series.push({
        name: '목표 도달',
        type: 'scatter',
        data: [[N_STAR, R_TARGET]],
        symbol: 'circle',
        symbolSize: 9,
        itemStyle: { color: theme.warning, borderColor: theme.surface, borderWidth: 1.5 },
        // 콜아웃: 곡선 아래 빈 자리에 목표 도달과 2027 계획을 한 상자로
        label: {
          show: true,
          formatter: `목표 도달 약 ${nN(N_STAR_ROUND)}계통\n2027 계획 ${nN(N_PLAN_2027)} → 예상 r ${n2(R_PLAN_2027)}`,
          position: 'bottom',
          align: 'right',
          offset: [compact ? 52 : 64, 34],
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 15,
          color: theme.text,
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 4,
          padding: [3, 6],
        },
        z: 7,
      })
      // 2027 계획 예상 r
      series.push({
        name: `${PLAN_YEAR} 계획`,
        type: 'scatter',
        data: [[N_PLAN_2027, R_PLAN_2027]],
        symbol: 'circle',
        symbolSize: 7,
        itemStyle: { color: theme.surface, borderColor: gColor, borderWidth: 2 },
        z: 7,
      })
    }

    return {
      grid: { left: 8, right: 18, top: 28, bottom: 26, containLabel: true },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (p: unknown) => {
          const q = p as { seriesName: string; value: [number, number]; data: { year?: number } | [number, number] }
          if (q.seriesName === '연도별 운영 모델') {
            const y = (q.data as { year: number }).year as (typeof YEARS)[number]
            return `${RETRAIN_LABEL[y]} 재학습 운영 모델 · N ${nN(TRAIN_N[y])} · r ${n2(R[y])}<br/><span style="opacity:.7">경험적 적합 기준점: 학습 곡선(Me·a)을 이 점들에 맞춤(독립 검증 아님)</span>`
          }
          if (q.seriesName === '목표 도달') {
            return `목표 r ${n2(R_TARGET)} 도달 훈련 집단 약 ${nN(N_STAR_ROUND)}계통(+${nN(N_STAR_ROUND - N_TRAIN)})<br/>학습 곡선 외삽(추정)`
          }
          const n = Math.round(q.value[0])
          const lines = [`<b>훈련 집단 ${nN(n)}계통</b>${n > N_TRAIN ? ' · 외삽(추정)' : ''}`]
          const models = n > N_TRAIN ? (['GBLUP'] as ModelKey[]) : shown
          for (const m of models) {
            const color = theme.categorical[MODELS.indexOf(m)]
            lines.push(
              `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin-right:4px"></span>${m} r ${n2(curve(trait, m, n))} ± ${fmt3(curveSd(trait, m, n))}`,
            )
          }
          if (n <= N_TRAIN) lines.push('<span style="opacity:.7">2026 훈련 집단 부분 표본 교차 검증(경험적 적합)</span>')
          return lines.join('<br/>')
        },
      },
      xAxis: {
        type: 'value',
        min: N_MIN - 100,
        max: N_MAX,
        name: '훈련 집단 크기(계통)',
        nameLocation: 'middle',
        nameGap: 24,
        // 눈금을 실제 계산 지점(GRID·외삽)에 맞춰 시작점 N = 300을 축에서 읽게 한다
        axisTick: { customValues: xTicks },
        axisLabel: { customValues: xTicks, hideOverlap: true, formatter: (v: number) => nN(v) },
        splitLine: { show: false },
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
      series: series as EChartsOption['series'],
    }
  }, [trait, shown, theme, isYield, compact])

  const r1850 = curve(trait, 'GBLUP', N_TRAIN)
  const r2500 = curve(trait, 'GBLUP', N_MAX)
  const ariaLabel = isYield
    ? `쌀 수량 GBLUP 학습 곡선: 훈련 집단 ${nN(N_TRAIN)}계통에서 r ${n2(r1850)}, 목표 ${n2(R_TARGET)}에는 약 ${nN(N_STAR_ROUND)}계통에서 도달, ${PLAN_YEAR} 계획 ${nN(N_PLAN_2027)}계통이면 예상 r ${n2(R_PLAN_2027)}. 연도별 운영 모델 r 5개가 곡선에서 0.01 이내.`
    : `${trait.name} GBLUP 학습 곡선: 훈련 집단 ${nN(N_TRAIN)}계통에서 r ${n2(r1850)}, ${nN(N_MAX)}계통 외삽 시 ${n2(r2500)}.`

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={ariaLabel}
      fallbackTable={{
        columns: ['훈련 집단(계통)', ...MODELS.map(m => `${m} r ± SD`)],
        rows: [...GRID, ...EXTRA].map(n => [
          n > N_TRAIN ? `${nN(n)}(외삽)` : nN(n),
          ...MODELS.map(m => (n > N_TRAIN && m !== 'GBLUP' ? '—' : `${n2(curve(trait, m, n))} ± ${fmt3(curveSd(trait, m, n))}`)),
        ]),
      }}
    />
  )
}
