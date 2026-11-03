import { useMemo } from 'react'
import { EChart, errorBarSeries, useChartTheme, useNarrowCategoryAxis, type EChartsOption } from '@/charts'
import { formatNumber } from '@/lib/format'
import { CV_REPS, SQRT_H2_LINE_MEAN, type TraitAccuracy } from '../data'

const n2 = (v: number) => formatNumber(v, { digits: 2 })

// ECharts custom series의 renderItem API 타입은 공개 export가 없어 느슨하게 둔다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Api = any

/** F. 형질별 예측 정확도 — 막대(평균) + ±SD 오차 막대 + 교차 검증 반복값 점 */
export function TraitAccuracyChart({ traits, year, height }: { traits: TraitAccuracy[]; year: number; height: number }) {
  const theme = useChartTheme()
  // 좁은 화면(형질당 폭이 좁을 때)에서는 x축 라벨을 기울여 겹침을 막는다
  const { ref: wrapRef, narrow } = useNarrowCategoryAxis(traits.length, 80)

  const option = useMemo<EChartsOption>(() => {
    const names = traits.map(t => t.name)
    const dots = traits.flatMap((t, i) => t.folds.map((v, k) => [i, v, k]))
    return {
      grid: { left: 8, right: 12, top: 28, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const list = params as { dataIndex: number }[]
          const t = traits[list[0]?.dataIndex ?? 0]
          if (!t) return ''
          const lines = [
            `<b>${t.name}</b>${t.isYield ? ' (ΔG의 r)' : ''}`,
            `예측 정확도 r ${n2(t.mean)} ± ${n2(t.sd)} (SD)`,
            `교차 검증 반복 ${CV_REPS}회 · 범위 ${n2(t.min)}~${n2(t.max)}`,
          ]
          if (t.isYield) lines.push(`예측 능력 corr(GEBV, y) = r × √h²(${n2(SQRT_H2_LINE_MEAN)}) = ${n2(t.mean * SQRT_H2_LINE_MEAN)}`)
          return lines.join('<br/>')
        },
      },
      xAxis: {
        type: 'category',
        data: names,
        axisLabel: narrow
          ? { interval: 0, fontSize: 11, rotate: 35, margin: 8 }
          : { interval: 0, fontSize: 11, width: 64, overflow: 'break', lineHeight: 13 },
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
          name: '평균 r',
          type: 'bar',
          barMaxWidth: 40,
          data: traits.map(t => ({
            value: t.mean,
            itemStyle: { color: t.isYield ? theme.accent : theme.categorical[0], opacity: t.isYield ? 1 : 0.4 },
          })),
        },
        {
          // 값 라벨 전용 계열: 막대 안 라벨은 막대 opacity를 물려받아 다크에서 흐렸다. 반복값 점 맨 위에 둔다
          name: '평균 r 값',
          type: 'scatter',
          symbolSize: 0,
          silent: true,
          z: 6,
          tooltip: { show: false },
          data: traits.map((t, i) => [i, t.max, t.mean]),
          label: {
            show: true,
            position: 'top',
            distance: 4,
            fontSize: 11,
            fontWeight: 700,
            color: theme.text,
            formatter: (p: unknown) => n2((p as { value: number[] }).value[2]),
          },
        },
        {
          name: '교차 검증 반복값',
          type: 'custom',
          silent: true,
          z: 4,
          data: dots,
          renderItem: (_params: Api, api: Api) => {
            const i = api.value(0) as number
            const v = api.value(1) as number
            const k = api.value(2) as number
            const band = api.size([1, 0])[0] as number
            const spread = Math.min(band * 0.5, 30)
            // 결정적 지터: 반복 번호로 좌우 위치를 정한다
            const off = ((((k * 37) % CV_REPS) / (CV_REPS - 1)) - 0.5) * spread
            const [x, y] = api.coord([i, v]) as [number, number]
            return { type: 'circle', shape: { cx: x + off, cy: y, r: 1.6 }, style: { fill: theme.text, opacity: 0.28 } }
          },
        },
        errorBarSeries({
          name: '±SD',
          bar: false,
          error: { color: theme.text, lineWidth: 1.5, cap: 6 },
          series: { silent: true, z: 5 },
          data: traits.map((t, i) => ({ index: i, lo: Math.max(0, t.mean - t.sd), hi: Math.min(1, t.mean + t.sd) })),
        }),
      ],
    }
  }, [traits, theme, narrow])

  const y = traits.find(t => t.isYield)
  const best = traits.reduce((a, b) => (b.mean > a.mean ? b : a), traits[0])
  const worst = traits.reduce((a, b) => (b.mean < a.mean ? b : a), traits[0])

  return (
    <div ref={wrapRef}>
      <EChart
        option={option}
        height={height}
        ariaLabel={`${year}년 형질별 GS 예측 정확도: 쌀 수량 ${y ? n2(y.mean) : '–'}(ΔG 식의 r), 가장 높은 형질 ${best?.name} ${best ? n2(best.mean) : ''}, 가장 낮은 형질 ${worst?.name} ${worst ? n2(worst.mean) : ''}.`}
        fallbackTable={{
          columns: ['형질', '평균 r', '교차 검증 SD', '최소', '최대', '반복 수'],
          rows: traits.map(t => [t.name, n2(t.mean), n2(t.sd), n2(t.min), n2(t.max), CV_REPS]),
        }}
      />
    </div>
  )
}
