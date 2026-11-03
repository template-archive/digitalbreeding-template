import { useMemo } from 'react'
import { EChart, stripeDecal, useChartTheme, useNarrowCategoryAxis, type EChartsOption } from '@/charts'
import { CURRENT_MONTH, MONTHLY, MONTHLY_TARGET, OCT_PROGRESS_TARGET, PLATFORMS, PLATFORM_KEYS, TOTAL_SAMPLES, YEAR, type Month } from '../data'
import { int, pct1, platformColor } from './shared'

const cats = MONTHLY.map(m => `${m.month}월`)

/** B. 월별 처리량 — 플랫폼 누적 막대 + 월 목표선, 10월은 빗금(진행 중) */
export function MonthlyThroughputChart({ height, selected, onSelect }: { height: number; selected: Month | null; onSelect: (m: Month) => void }) {
  const theme = useChartTheme()
  const { ref, narrow } = useNarrowCategoryAxis(MONTHLY.length, 44)

  const option = useMemo<EChartsOption>(() => {
    const isCur = (i: number) => MONTHLY[i].month === CURRENT_MONTH
    const dim = (i: number) => selected !== null && MONTHLY[i].month !== selected
    return {
      grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const i = (params as { dataIndex: number }[])[0]?.dataIndex ?? 0
          const r = MONTHLY[i]
          const lines = [`<b>${r.month}월${isCur(i) ? ' · 진행 중(10/23)' : ''}</b>`]
          for (const k of PLATFORM_KEYS) {
            if (r.samples[k]) lines.push(`${PLATFORMS[k].name} ${int(r.samples[k])}샘플 · 플레이트 ${r.plates[k]}장`)
          }
          lines.push(`합계 <b>${int(r.total)}</b>샘플 · ${isCur(i) ? `진도 목표 ${int(r.target)}` : `목표 ${int(r.target)}`} 대비 ${pct1((r.total / r.target) * 100)}`)
          return lines.join('<br/>')
        },
      },
      xAxis: {
        type: 'category',
        data: cats,
        axisLabel: {
          interval: 0,
          color: theme.textMuted,
          formatter: (v: string) => (v === `${CURRENT_MONTH}월` ? `${v}\n진행 중` : v),
        },
      },
      yAxis: { type: 'value', min: 0, max: 2000, name: '샘플 수', nameTextStyle: { align: 'left' }, axisLabel: { formatter: (v: number) => int(v) } },
      series: [
        ...PLATFORM_KEYS.map((k, si) => {
          const color = platformColor(theme, k)
          return {
            name: PLATFORMS[k].name,
            type: 'bar' as const,
            stack: 'total',
            barMaxWidth: 38,
            cursor: 'pointer',
            itemStyle: { borderRadius: 0 },
            data: MONTHLY.map((r, i) => ({
              value: r.samples[k],
              itemStyle: {
                color,
                opacity: dim(i) ? 0.3 : isCur(i) ? 0.75 : 1,
                ...(isCur(i)
                  ? { decal: stripeDecal(theme.surface, 4) }
                  : {}),
              },
            })),
            ...(si === 0
              ? {
                  markLine: {
                    silent: true,
                    symbol: 'none',
                    lineStyle: { color: theme.text, type: 'dashed' as const, width: 1.5 },
                    label: { formatter: `월 목표 ${int(MONTHLY_TARGET)}`, position: 'insideEndTop' as const, color: theme.text, fontSize: 11 },
                    data: [{ yAxis: MONTHLY_TARGET }],
                  },
                }
              : {}),
          }
        }),
        {
          name: '진도 목표',
          type: 'scatter',
          symbol: 'rect',
          // 좁은 화면은 막대 폭보다 넓은 표식·라벨이 옆 달 막대를 침범한다. 값은 카드 각주에 있어 라벨을 뺀다
          symbolSize: [narrow ? 20 : 34, 3],
          silent: true,
          z: 6,
          itemStyle: { color: theme.text },
          label: { show: !narrow, position: 'top', distance: 2, formatter: `진도 ${int(OCT_PROGRESS_TARGET)}`, fontSize: 11, color: theme.text },
          data: [[cats.length - 1, OCT_PROGRESS_TARGET]],
          tooltip: { show: false },
        },
        {
          name: '합계',
          type: 'scatter',
          symbolSize: 0,
          silent: true,
          // 목표선 바로 아래(목표 −160 이내) 값은 라벨을 목표선 위로 올려 점선과 겹치지 않게 한다. [x, 라벨 기준 y, 실제 합계]
          data: MONTHLY.map((r, i) => [i, r.total < MONTHLY_TARGET && r.total >= MONTHLY_TARGET - 160 ? MONTHLY_TARGET : r.total, r.total]),
          label: { show: !narrow, position: 'top', distance: 4, fontSize: 11, color: theme.text, formatter: (p: unknown) => int(((p as { value: number[] }).value)[2]) },
          tooltip: { show: false },
        },
      ],
    }
  }, [theme, selected, narrow])

  const below = MONTHLY.filter(r => r.month !== CURRENT_MONTH && r.total < MONTHLY_TARGET).map(r => `${r.month}월`)
  const oct = MONTHLY[MONTHLY.length - 1]

  return (
    <div ref={ref} className="h-full">
    <EChart
      option={option}
      height={height}
      onEvents={{
        click: (p: unknown) => {
          const { dataIndex, seriesType } = p as { dataIndex?: number; seriesType?: string }
          if (seriesType === 'bar' && typeof dataIndex === 'number') onSelect(MONTHLY[dataIndex].month)
        },
      }}
      ariaLabel={`${YEAR}년 1~${CURRENT_MONTH}월 처리량 누계 ${int(TOTAL_SAMPLES)}샘플. 월 목표 ${int(MONTHLY_TARGET)}에 못 미친 달은 ${below.join(', ')}이고, 진행 중인 ${CURRENT_MONTH}월은 ${int(oct.total)}샘플로 진도 목표 ${int(OCT_PROGRESS_TARGET)}의 ${pct1((oct.total / OCT_PROGRESS_TARGET) * 100)}다.`}
      fallbackTable={{
        columns: ['월', ...PLATFORM_KEYS.map(k => PLATFORMS[k].name), '합계', '목표'],
        rows: MONTHLY.map(r => [`${r.month}월${r.month === CURRENT_MONTH ? '(진행 중)' : ''}`, ...PLATFORM_KEYS.map(k => int(r.samples[k])), int(r.total), int(r.target)]),
      }}
    />
    </div>
  )
}
