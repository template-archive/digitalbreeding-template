import { useMemo } from 'react'
import { EChart, useChartTheme, type ChartTheme, type EChartsOption } from '@/charts'
import { REASONS, REASON_DESC, REASON_LABEL, allocTotal, cohortTransitions, int, pct1, sortedReasons, type Cohort, type Reason } from '../data'

/** 사유 색: 범주형 팔레트 고정 인덱스(기타는 회청 cat[7]) */
export function reasonColor(theme: Pick<ChartTheme, 'categorical'>, r: Reason): string {
  const idx: Record<Reason, number> = { yield: 0, blast: 1, heading: 2, quality: 3, lodging: 4, stability: 5, other: 7 }
  return theme.categorical[idx[r]] ?? theme.categorical[0]
}

/** H. 탈락 사유 — 끝난 전환별 100% 가로 누적 막대 */
export function ReasonBars({ cohort, height }: { cohort: Cohort; height: number }) {
  const theme = useChartTheme()
  const rows = useMemo(() => cohortTransitions(cohort).filter(t => t.done && t.alloc), [cohort])

  const option = useMemo<EChartsOption>(() => {
    const cats = rows.map(t => `${t.label}\n{b|${t.basis}}`)
    return {
      grid: { left: 8, right: 8, top: 6, bottom: 24, containLabel: true },
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const q = p as { dataIndex: number; seriesIndex: number }
          const t = rows[q.dataIndex]
          const r = REASONS[q.seriesIndex]
          const n = t.alloc?.[r] ?? 0
          const total = t.drop ?? 1
          return `<b>${t.label}</b> · 탈락 ${int(total)}<br/>${REASON_LABEL[r]} ${int(n)} (${pct1((n / total) * 100)})<br/><span style="opacity:.75">${REASON_DESC[r]}</span>`
        },
      },
      xAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: (v: number) => `${v}%` }, splitNumber: 4 },
      yAxis: [
        {
          type: 'category',
          inverse: true,
          data: cats,
          axisTick: { show: false },
          axisLabel: { color: theme.text, fontSize: 12, lineHeight: 15, rich: { b: { color: theme.textMuted, fontSize: 11 } } },
        },
        {
          type: 'category',
          inverse: true,
          position: 'right',
          data: rows.map(t => `탈락 ${int(t.drop ?? 0)}`),
          axisTick: { show: false },
          axisLine: { show: false },
          axisLabel: { color: theme.text, fontSize: 12, fontWeight: 600 },
        },
      ],
      series: REASONS.map(r => ({
        name: REASON_LABEL[r],
        type: 'bar' as const,
        stack: 'all',
        barWidth: 18,
        itemStyle: { color: reasonColor(theme, r), borderColor: theme.surface, borderWidth: 1, borderRadius: 0 },
        label: {
          show: true,
          position: 'inside' as const,
          fontSize: 11,
          color: theme.surface,
          fontWeight: 600,
          formatter: (p: unknown) => {
            const q = p as { dataIndex: number; value: number | null }
            return q.value != null && q.value >= 8 ? int(rows[q.dataIndex].alloc?.[r] ?? 0) : ''
          },
        },
        // 쓰이지 않은 사유(0)는 그리지 않는다
        data: rows.map(t => {
          const n = t.alloc?.[r] ?? 0
          return n > 0 ? (n / (t.drop as number)) * 100 : null
        }),
      })),
    }
  }, [rows, theme])

  const top = rows[0]
  const topReason = top?.alloc ? sortedReasons(top.alloc)[0] : null
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`${cohort} 코호트 탈락 사유: ${rows
        .map(t => {
          const s = t.alloc ? sortedReasons(t.alloc)[0] : null
          return `${t.label} 탈락 ${int(t.drop ?? 0)}${s ? `, 최다 ${REASON_LABEL[s.r]} ${int(s.n)}` : ''}`
        })
        .join('; ')}.${topReason && top ? ` 가장 많이 빠진 사유는 ${REASON_LABEL[topReason.r]}(${pct1((topReason.n / (top.drop as number)) * 100)}).` : ''}`}
      fallbackTable={{
        columns: ['전환', '탈락', ...REASONS.map(r => REASON_LABEL[r])],
        rows: rows.map(t => [`${t.label}(${t.basis})`, int(allocTotal(t.alloc ?? {})), ...REASONS.map(r => int(t.alloc?.[r] ?? 0))]),
      }}
    />
  )
}
