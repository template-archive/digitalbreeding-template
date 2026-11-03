import { useMemo } from 'react'
import { EChart, hMarkLine, useChartTheme, type EChartsOption } from '@/charts'
import { formatNumber } from '@/lib/format'
import { DECAY, GROUPS, R2_CUT, fitValue, kb0, type DecayFit, type DecayResult, type GroupKey, type Bin } from '../data'
import { groupColor } from './colors'

interface Props {
  decay: DecayResult
  /** −1 = 12개 염색체 통합 */
  chr: number
  group: GroupKey
  showRaw: boolean
  height: number
  ariaLabel: string
  fallbackTable: { columns: string[]; rows: (string | number)[][] }
}

const GRID = { left: 44, right: 14, top: 14, bottom: 40 }
/** x축 끝(kb). 판정 구간(0~200 kb)이 그림 왼쪽에 몰리지 않게 1 Mb 창 전체가 아니라 앞 절반만 그린다 */
export const DECAY_X_MAX = 500
/** 집단 곡선 선 모양(색만으로 구분하지 않게). 범례 Legend shape와 같은 쌍 */
export const LINE_DASHED: Record<GroupKey, boolean> = { ALL: false, TEJ: false, TRJ: true, IND: false, AUS: true }

/** 그 염색체(또는 통합)의 집단별 구간·적합 */
export function decaySlice(decay: DecayResult, chr: number): { key: GroupKey; bins: Bin[]; fit: DecayFit }[] {
  return decay.groups.map(g => ({ key: g.key, bins: chr < 0 ? g.bins : g.chrBins[chr]!, fit: chr < 0 ? g.fit : g.chrFits[chr]! }))
}

/** LD 감소 곡선: 10 kb 구간 평균(점) + 적합 곡선(선) + r² = 0.2 기준선. 교차 거리는 그림 안 라벨 대신 범례에 적고(라벨 4개가 좁은 구간에 겹쳤다), 선택 집단만 그림에 라벨을 둔다 */
export function DecayChart({ decay, chr, group, showRaw, height, ariaLabel, fallbackTable }: Props) {
  const t = useChartTheme()

  const option = useMemo<EChartsOption>(() => {
    const slice = decaySlice(decay, chr)
    // 그리는 순서: 선택 집단을 맨 위(z)로
    const order = [...slice].sort((a, b) => (a.key === group ? 1 : 0) - (b.key === group ? 1 : 0))
    const crosses = slice.filter(s => s.fit.d02 != null).map(s => ({ key: s.key, d: s.fit.d02! }))

    const label = (k: GroupKey) => GROUPS.find(g => g.key === k)!.label
    const series: NonNullable<EChartsOption['series']> = []

    if (showRaw) {
      const raw = decay.groups.find(g => g.key === group)!.raw
      series.push({
        name: '쌍별 r²',
        type: 'scatter',
        silent: true,
        symbolSize: 2.5,
        z: 0,
        itemStyle: { color: t.textMuted, opacity: 0.28 },
        data: raw.filter(p => chr < 0 || p[2] === chr).map(p => [p[0], p[1]]),
        large: true,
      })
    }

    for (const s of order) {
      const sel = s.key === group
      const color = groupColor(t, s.key)
      const fitLine: number[][] = []
      for (let k = 0; k <= 200; k++) {
        const d = (k * DECAY_X_MAX) / 200
        fitLine.push([d, fitValue(s.fit, d)])
      }
      series.push({
        name: label(s.key),
        type: 'scatter',
        symbolSize: sel ? 5 : 3.5,
        z: sel ? 4 : 2,
        itemStyle: { color, opacity: sel ? 0.85 : 0.45 },
        data: s.bins.flatMap((b, i) => (b.n && b.d <= DECAY_X_MAX ? [[b.d, b.r, i, b.n]] : [])),
        tooltip: {
          formatter: (p: unknown) => {
            const v = (p as { value: number[] }).value
            const i = v[2]!
            return `${label(s.key)} · ${i * DECAY.binKb}~${(i + 1) * DECAY.binKb} kb · 평균 r² ${v[1]!.toFixed(3)} · 쌍 ${formatNumber(v[3]!)}개`
          },
        },
      })
      const d02 = s.fit.d02
      series.push({
        name: label(s.key),
        type: 'line',
        showSymbol: false,
        silent: true,
        z: sel ? 5 : 3,
        lineStyle: { color, width: sel ? 3 : 1.5, opacity: sel ? 1 : 0.7, type: LINE_DASHED[s.key] ? 'dashed' : 'solid' },
        itemStyle: { color },
        data: fitLine,
        markLine:
          d02 != null
            ? {
                symbol: 'none',
                silent: true,
                data: [
                  [
                    { coord: [d02, 0], lineStyle: { color, type: 'dotted', width: sel ? 1.6 : 1.1, opacity: sel ? 1 : 0.7 }, label: { show: false } },
                    { coord: [d02, R2_CUT] },
                  ],
                  ...(s.key === 'ALL' ? [{ ...hMarkLine(R2_CUT, `r² = ${R2_CUT}`, t.textMuted, { line: 'dashed', width: 1.2 }) }] : []),
                ] as never,
              }
            : undefined,
      })
    }

    // 교차점 표식. 선택 집단만 kb 라벨(나머지 값은 범례)
    series.push({
      name: '교차 거리',
      type: 'scatter',
      z: 8,
      silent: true,
      symbolSize: 7,
      data: crosses.map(c => {
        const color = groupColor(t, c.key)
        const sel = c.key === group
        return {
          value: [c.d, R2_CUT],
          itemStyle: { color, borderColor: t.surface, borderWidth: 1.5 },
          label: {
            show: sel,
            position: 'top',
            distance: 6,
            formatter: `${kb0(c.d)} kb`,
            color: t.text,
            fontSize: 11,
            fontWeight: 700,
            backgroundColor: t.surface,
            borderRadius: 3,
            padding: [1, 3],
          },
        }
      }),
    })

    return {
      grid: { ...GRID, containLabel: false },
      tooltip: { trigger: 'item', confine: true },
      xAxis: {
        type: 'value',
        min: 0,
        max: DECAY_X_MAX,
        interval: 100,
        name: 'SNP 간 거리(kb)',
        nameLocation: 'middle',
        nameGap: 26,
        axisLabel: { formatter: (v: number) => formatNumber(v) },
      },
      yAxis: { type: 'value', min: 0, max: 1, interval: 0.2, name: 'r²', nameLocation: 'end', nameGap: 6, axisLabel: { formatter: (v: number) => v.toFixed(1) } },
      series,
    } as EChartsOption
  }, [decay, chr, group, showRaw, t])

  return <EChart option={option} height={height} ariaLabel={ariaLabel} fallbackTable={fallbackTable} />
}
