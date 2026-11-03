import { useMemo } from 'react'
import { EChart, histogramSeries, useChartTheme, type EChartsOption } from '@/charts'
import { useMediaQuery } from '@/design-system'
import { BELOW_THRESHOLD_6K, CALL_RATES_6K, CALL_RATE_THRESHOLD, HIST_6K, MEAN_CALL_RATE_6K } from '../data'
import { d1, int, pct1 } from './shared'

const LOG_MAX = 3000
const LIN_MAX = 1300
/** 기준 미달 구간. 선형 축에서는 1~2px라 보이지 않아 왼쪽 빈 곳에 같은 구간을 확대해 그린다(명세 C: 꼬리 확대 삽입, 기본 선형) */
const TAIL = HIST_6K.filter(b => b.hi <= CALL_RATE_THRESHOLD)
const TAIL_MAX = Math.max(...TAIL.map(b => b.count))
const tailBins = TAIL.map(b => ({ x0: b.lo, x1: b.hi, count: b.count, cumPct: b.cumPct }))

/** C. 6K 콜레이트 분포 — 0.5%p 구간 히스토그램, QC 기준선·평균선 */
export function CallRateHistogram({ height, log, onSelectBelow }: { height: number; log: boolean; onSelectBelow: () => void }) {
  const theme = useChartTheme()
  const narrow = useMediaQuery('(max-width: 639px)')
  const mean = MEAN_CALL_RATE_6K

  const option = useMemo<EChartsOption>(() => {
    const base = log ? 1 : 0
    const top = log ? LOG_MAX : LIN_MAX
    const mainGrid = { left: 8, right: 20, top: 30, bottom: 24, containLabel: true }
    const mainX = {
      type: 'value' as const,
      min: 85,
      max: 100,
      interval: 2.5,
      name: '샘플 콜레이트(%)',
      nameLocation: 'middle' as const,
      nameGap: 24,
      axisLabel: { formatter: (v: number) => String(v) },
      splitLine: { show: false },
    }
    const mainY = log
      ? { type: 'log' as const, logBase: 10, min: 1, max: LOG_MAX, name: '샘플 수(로그 축)', nameTextStyle: { align: 'left' as const }, axisLabel: { formatter: (v: number) => int(v) } }
      : { type: 'value' as const, min: 0, max: LIN_MAX, name: '샘플 수', nameTextStyle: { align: 'left' as const }, axisLabel: { formatter: (v: number) => int(v) } }
    const tailX = { gridIndex: 1, type: 'value' as const, min: 85, max: CALL_RATE_THRESHOLD, interval: 2.5, axisLabel: { fontSize: 11, formatter: (v: number) => String(v) }, splitLine: { show: false } }
    const tailY = { gridIndex: 1, type: 'value' as const, min: 0, max: TAIL_MAX, minInterval: 1, splitNumber: 2, axisLabel: { fontSize: 11 } }
    return {
      // 좁은 화면은 삽입 그래프의 라벨이 위쪽 QC·평균 라벨과 겹치므로 삽입 위치를 내린다
      grid: log ? mainGrid : [mainGrid, { left: 78, width: '46%', top: narrow ? 84 : 62, height: 104 }],
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          // 행 = [x0, x1, y0, y1(샘플 수), 누적 비율]
          const v = (p as { value?: number[] }).value
          if (!v || v.length < 5) return ''
          const [lo, hi, , c, cum] = v
          return `${d1(lo)}–${d1(hi)}%: <b>${int(c)}</b>샘플(누적 ${pct1(cum)})${lo < CALL_RATE_THRESHOLD ? '<br/>QC 기준 미달 · 누르면 실패 목록 필터' : ''}`
        },
      },
      xAxis: log ? mainX : [mainX, tailX],
      yAxis: log ? mainY : [mainY, tailY],
      series: [
        histogramSeries({
          name: '샘플 수',
          bins: HIST_6K.map(b => ({ x0: b.lo, x1: b.hi, count: b.count, cumPct: b.cumPct })),
          y1: b => b.count,
          baseline: base,
          color: b => (b.x0 < CALL_RATE_THRESHOLD ? theme.warning : theme.categorical[0]!),
          cursor: b => (b.x0 < CALL_RATE_THRESHOLD ? 'pointer' : 'default'),
          extra: b => [b.cumPct],
          series: { z: 2 },
        }),
        ...(log
          ? []
          : [
              histogramSeries({
                name: '기준 미달 구간 확대',
                bins: tailBins,
                y1: b => b.count,
                color: theme.warning,
                cursor: () => 'pointer',
                extra: b => [b.cumPct],
                series: { z: 3, xAxisIndex: 1, yAxisIndex: 1 },
              }),
            ]),
        {
          name: 'QC 기준',
          type: 'line',
          silent: true,
          symbol: 'none',
          z: 4,
          lineStyle: { color: theme.negative, width: 1.5, type: 'solid' },
          data: [
            [CALL_RATE_THRESHOLD, base],
            [CALL_RATE_THRESHOLD, top],
          ],
          endLabel: { show: true, formatter: `QC 기준 ${CALL_RATE_THRESHOLD}%`, color: theme.text, fontSize: 11, fontWeight: 600, align: 'right', offset: [-10, 10] },
          tooltip: { show: false },
        },
        {
          name: '평균',
          type: 'line',
          silent: true,
          symbol: 'none',
          z: 4,
          lineStyle: { color: theme.text, width: 1, type: 'dashed' },
          data: [
            [mean, base],
            [mean, top],
          ],
          endLabel: { show: true, formatter: `평균 ${d1(mean)}%`, color: theme.text, fontSize: 11, align: 'right', offset: [-10, 10] },
          tooltip: { show: false },
        },
        {
          name: '기준 미달 라벨',
          type: 'scatter',
          silent: true,
          symbolSize: 0,
          ...(log ? {} : { xAxisIndex: 1, yAxisIndex: 1 }),
          data: [log ? [90, 400] : [85, TAIL_MAX]],
          label: {
            show: true,
            position: log ? 'inside' : 'right',
            distance: 0,
            offset: log ? [0, 0] : [0, -14],
            formatter: `기준 미달 ${int(BELOW_THRESHOLD_6K)}샘플${log ? '' : narrow ? ' · 확대' : ' · 구간 확대'}`,
            color: theme.text,
            fontSize: narrow ? 11 : 12,
            fontWeight: 700,
          },
          tooltip: { show: false },
        },
      ],
    }
  }, [theme, log, mean, narrow])

  const peak = HIST_6K.reduce((a, b) => (b.count > a.count ? b : a))

  return (
    <EChart
      option={option}
      height={height}
      renderer="svg"
      onEvents={{
        click: (p: unknown) => {
          const { value, seriesType } = p as { value?: number[]; seriesType?: string }
          if (seriesType === 'custom' && value && value[0] < CALL_RATE_THRESHOLD) onSelectBelow()
        },
      }}
      ariaLabel={`6K SNP 칩 ${int(CALL_RATES_6K.length)}샘플의 1차 분석 콜레이트 평균은 ${d1(mean)}%이고 ${d1(peak.lo)}–${d1(peak.hi)}% 구간에 ${int(peak.count)}샘플이 몰려 있다. QC 기준 ${CALL_RATE_THRESHOLD}% 미만은 ${int(BELOW_THRESHOLD_6K)}샘플이다.`}
      fallbackTable={{
        columns: ['구간(%)', '샘플 수', '누적 비율'],
        rows: HIST_6K.filter(b => b.count > 0).map(b => [`${d1(b.lo)}–${d1(b.hi)}`, int(b.count), pct1(b.cumPct)]),
      }}
    />
  )
}
