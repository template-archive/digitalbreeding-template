import { useMemo } from 'react'
import { EChart, errorBarSeries, useChartTheme, useNarrowCategoryAxis, type EChartsOption } from '@/charts'
import { formatFixed } from '@/lib/format'
import { CELLS, CV_REPS, MODELS, REC_BY_TRAIT, TRAITS, fmt3, fmtSigned3, type ModelKey, type TraitKey } from '../data'

export type Metric = 'accuracy' | 'ability'

const n2 = (v: number) => formatFixed(v, 2)

// ECharts custom series renderItem API는 공개 타입이 없어 느슨하게 둔다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Api = any

/** 셀 값: 정확도면 r ± SD, 예측 능력이면 r·√h² ± SD·√h² */
function cellValue(trait: TraitKey, model: ModelKey, metric: Metric) {
  const c = CELLS[trait][model]
  const k = metric === 'accuracy' ? 1 : c.predAbility / c.mean
  return { v: c.mean * k, sd: c.sd * k }
}

/** A. 형질 × 모델 예측 정확도 — 묶음 막대(custom) + ±SD 오차 막대 + '권장' 표식 */
export function AccuracyChart({
  metric,
  visible,
  selected,
  horizontal,
  height,
}: {
  metric: Metric
  visible: ModelKey[]
  selected: TraitKey
  horizontal: boolean
  height: number
}) {
  const theme = useChartTheme()
  const { ref, narrow } = useNarrowCategoryAxis(TRAITS.length, 96)
  const shown = MODELS.filter(m => visible.includes(m))
  const selIdx = TRAITS.findIndex(t => t.key === selected)
  const axisName = metric === 'accuracy' ? '예측 정확도 r' : '예측 능력 r·√h²'

  const option = useMemo<EChartsOption>(() => {
    const names = TRAITS.map(t => t.name)
    const k = shown.length
    const catAxis = {
      type: 'category' as const,
      data: names,
      inverse: horizontal,
      axisLabel: horizontal
        ? { interval: 0, fontSize: 11, width: 72, overflow: 'break' as const }
        : narrow
          ? { interval: 0, fontSize: 11, rotate: 30, margin: 8 }
          : { interval: 0, fontSize: 11, width: 84, overflow: 'break' as const, lineHeight: 13 },
    }
    const valAxis = {
      type: 'value' as const,
      min: 0,
      max: 1,
      interval: 0.2,
      name: axisName,
      nameLocation: (horizontal ? 'middle' : 'end') as 'middle' | 'end',
      nameGap: horizontal ? 24 : 10,
      nameTextStyle: horizontal ? {} : { align: 'left' as const },
      axisLabel: { formatter: (v: number) => v.toFixed(1) },
    }
    const coord = (api: Api, idx: number, v: number) => api.coord(horizontal ? [v, idx] : [idx, v]) as [number, number]
    const bandOf = (api: Api) => (horizontal ? (api.size([0, 1]) as number[])[1]! : (api.size([1, 0]) as number[])[0]!)

    const background = {
      name: '선택 형질',
      type: 'custom' as const,
      silent: true,
      z: 0,
      data: [[selIdx]],
      renderItem: (_p: Api, api: Api) => {
        const idx = api.value(0) as number
        const band = bandOf(api)
        const c = coord(api, idx, 0)
        const far = coord(api, idx, 1)
        // 선택 형질 띠: 강조색(범주 1색과 같은 파랑) 대신 중립 회색
        const style = { fill: theme.text, opacity: 0.06 }
        return horizontal
          ? { type: 'rect', shape: { x: c[0], y: c[1] - band / 2, width: far[0] - c[0], height: band }, style }
          : { type: 'rect', shape: { x: c[0] - band / 2, y: far[1], width: band, height: c[1] - far[1] }, style }
      },
      tooltip: { show: false },
    }

    const modelSeries = shown.map((m, j) =>
      errorBarSeries({
        name: m,
        horizontal,
        bar: { color: theme.categorical[MODELS.indexOf(m)]!, opacity: m === 'GBLUP' ? 1 : 0.82 },
        group: { index: j, count: k },
        error: { color: theme.text },
        marker: { text: '권장', color: theme.text, fontSize: 11 },
        series: { z: 3 },
        data: TRAITS.map((t, i) => {
          const { v, sd } = cellValue(t.key, m, metric)
          return { index: i, value: v, lo: Math.max(0, v - sd), hi: Math.min(1, v + sd), marker: REC_BY_TRAIT[t.key].rec === m }
        }),
      }),
    )

    return {
      grid: horizontal ? { left: 8, right: 22, top: 8, bottom: 28, containLabel: true } : { left: 8, right: 12, top: 30, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        confine: true,
        formatter: (params: unknown) => {
          const list = params as { dataIndex: number }[]
          const t = TRAITS[list[0]?.dataIndex ?? 0]
          if (!t) return ''
          const rec = REC_BY_TRAIT[t.key]
          const rows = shown.map(m => {
            const c = CELLS[t.key][m]
            const d = rec.diffs.find(x => x.model === m)
            const color = theme.categorical[MODELS.indexOf(m)]
            return [
              `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin-right:4px"></span><b>${m}</b>${rec.rec === m ? ' · 권장' : ''}`,
              `&nbsp;&nbsp;r ${n2(c.mean)} ± ${fmt3(c.sd)} · 범위 ${n2(c.min)}~${n2(c.max)}`,
              `&nbsp;&nbsp;예측 능력 ${n2(c.predAbility)}${d ? ` · GBLUP 대비 Δr ${fmtSigned3(d.delta)}` : ''}`,
            ].join('<br/>')
          })
          return [`<b>${t.name}</b> · h² ${n2(t.h2)} · 분할 ${CV_REPS}개`, ...rows].join('<br/>')
        },
      },
      xAxis: horizontal ? valAxis : catAxis,
      yAxis: horizontal ? catAxis : valAxis,
      series: [background, ...modelSeries] as EChartsOption['series'],
    }
  }, [shown, theme, narrow, horizontal, metric, selIdx, axisName])

  const y = CELLS.yield.GBLUP
  const metricWord = metric === 'accuracy' ? '예측 정확도' : '예측 능력'
  const yv = cellValue('yield', 'GBLUP', metric).v
  const ariaLabel = `형질 6개 × 모델 ${shown.length}개 ${metricWord}. 쌀 수량 GBLUP ${n2(yv)}(반복 범위 ${n2(y.min)}~${n2(y.max)}). ${TRAITS.map(t => {
    const r = REC_BY_TRAIT[t.key]
    return `${t.name} 권장 ${r.rec}`
  }).join(', ')}.`

  return (
    <div ref={ref} className="h-full">
      <EChart
        option={option}
        height={height}
        ariaLabel={ariaLabel}
        fallbackTable={{
          columns: ['형질', ...shown.map(m => `${m} ${metricWord} ± SD`), '권장'],
          rows: TRAITS.map(t => [
            t.name,
            ...shown.map(m => {
              const { v, sd } = cellValue(t.key, m, metric)
              return `${n2(v)} ± ${fmt3(sd)}`
            }),
            REC_BY_TRAIT[t.key].rec,
          ]),
        }}
      />
    </div>
  )
}
