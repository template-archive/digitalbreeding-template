import { useMemo } from 'react'
import { EChart, hMarkLine, useChartTheme, vMarkLine, type EChartsOption } from '@/charts'
import { Legend, useMediaQuery } from '@/design-system'
import { formatNumber, formatPercent } from '@/lib/format'
import { AS_OF, COHORT_CAT, COHORT_LABEL, TOTAL_CAP, fmtD, type CohortKey, type WeekPoint } from '../data'

const ORDER: CohortKey[] = ['CR25', 'CR26', 'PARENT']

/** E. 주별 셀 점유 추이(코호트 누적) */
export function OccupancyChart({ weeks, avg90 }: { weeks: WeekPoint[]; avg90: number }) {
  const theme = useChartTheme()
  // 390px: 플롯 폭이 좁아 월 라벨이 붙으므로 분기 첫 달(1·4·7·10월)만 쓴다
  const narrow = useMediaQuery('(max-width: 639px)')
  const color = (c: CohortKey) => theme.categorical[COHORT_CAT[c]]!
  const todayIdx = weeks.reduce((a, w, i) => (w.date <= AS_OF ? i : a), 0)
  const max = weeks.reduce((a, w) => (w.total > a.total ? w : a))
  const min = weeks.reduce((a, w) => (w.total < a.total ? w : a))
  const option = useMemo<EChartsOption>(
    () => ({
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        formatter: (ps: unknown) => {
          const i = (ps as { dataIndex: number }[])[0]!.dataIndex
          const w = weeks[i]!
          return [
            `<b>${w.date}(월)</b>`,
            ...ORDER.map(c => `${COHORT_LABEL[c]} ${formatNumber(w.byCohort[c])}셀`),
            `합계 ${formatNumber(w.total)} / ${formatNumber(TOTAL_CAP)}셀(${formatPercent(w.total / TOTAL_CAP, 1)})`,
            `빈 베드 ${w.emptyBeds}개`,
          ].join('<br/>')
        },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: weeks.map(w => w.date),
        axisLabel: {
          color: theme.textMuted,
          fontSize: 11,
          formatter: (v: string, i: number) => {
            const m = Number(v.slice(5, 7))
            const first = v.slice(8) <= '07' || i === 0
            if (!first || (narrow && i !== 0 && (m - 1) % 3 !== 0)) return ''
            return m === 1 || i === 0 ? `${v.slice(0, 4)}년 ${m}월` : `${m}월`
          },
          interval: 0,
          hideOverlap: true,
        },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: TOTAL_CAP,
        interval: 1000,
        name: '셀',
        nameTextStyle: { color: theme.textMuted, fontSize: 11, align: 'right' },
        axisLabel: { color: theme.textMuted, fontSize: 11, formatter: (v: number) => formatNumber(v) },
        splitLine: { lineStyle: { color: theme.border, type: 'dashed' } },
      },
      series: ORDER.map((c, k) => ({
        name: COHORT_LABEL[c],
        type: 'line',
        stack: 'cells',
        step: 'end',
        symbol: 'none',
        lineStyle: { width: 1, color: color(c) },
        itemStyle: { color: color(c) },
        areaStyle: { color: color(c), opacity: 0.55 },
        data: weeks.map(w => w.byCohort[c]),
        ...(k === 0
          ? {
              markLine: {
                symbol: 'none',
                silent: true,
                data: [
                  hMarkLine(TOTAL_CAP, `수용량 ${formatNumber(TOTAL_CAP)}셀`, theme.negative, { line: 'dashed', position: 'insideEndBottom' }),
                  vMarkLine(todayIdx, `오늘 ${fmtD(AS_OF)}`, theme.text, { width: 2, position: 'end' }),
                ],
              },
            }
          : {}),
      })),
    }) as EChartsOption,
    [weeks, theme, todayIdx, narrow],
  )
  const aria = `주별 셀 점유: 최대 ${max.date} ${formatNumber(max.total)}셀(빈 베드 ${max.emptyBeds}), 최소 ${min.date} ${formatNumber(min.total)}셀(빈 베드 ${min.emptyBeds}). 수용량 ${formatNumber(TOTAL_CAP)}셀을 넘는 주는 없고, 향후 90일 평균 점유율은 ${avg90.toFixed(1)}%입니다.`
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Legend items={[...ORDER.map(c => ({ label: COHORT_LABEL[c], color: color(c) })), { label: '수용량', color: theme.negative, shape: 'dashed' as const }]} />
        <span className="text-xs tabular-nums text-muted">
          최대 {fmtD(max.date)} 주 {formatNumber(max.total)}셀 · 최소 {fmtD(min.date)} 주 {formatNumber(min.total)}셀
        </span>
      </div>
      <EChart
        option={option}
        height={240}
        ariaLabel={aria}
        fallbackTable={{
          columns: ['주(월요일)', ...ORDER.map(c => COHORT_LABEL[c]), '합계', '빈 베드'],
          rows: weeks.map(w => [w.date, ...ORDER.map(c => w.byCohort[c]), w.total, w.emptyBeds]),
        }}
      />
    </div>
  )
}
