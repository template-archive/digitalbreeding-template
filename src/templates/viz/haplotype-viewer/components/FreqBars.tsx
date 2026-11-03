/**
 * 하플로타입 빈도 100% 누적 가로 막대(5개 하위 집단 + 패널 전체 + 육종 계통 67).
 * 표적 하플로타입은 강조색 명도 단계, 그 밖은 중립 명도 단계, 미정은 빗금. 범주를 누르면 격자 강조.
 */
import { useMemo } from 'react'
import { EChart, type ChartTheme } from '@/charts'
import { hatchPattern } from '@/design-system'
import { formatNumber } from '@/lib/format'
import { ROWSETS, SUBPOP_LABEL, catCounts, type HapData, type LocusResult, type RowSet } from '../data'

export const rowsetLabel = (set: RowSet, n: number) =>
  set === 'ALL' ? `패널 전체 ${formatNumber(n)}` : set === 'BREED' ? `육종 계통 ${n}` : `${SUBPOP_LABEL[set]} ${n}`

/** 패널 전체와 육종 계통 사이 구분선: 빈 범주를 하나 넣고 그 가운데에 선을 긋는다 */
const SEP_AT = 6
const SPACER = ' '
const withSpacer = <T,>(xs: T[], v: T): T[] => [...xs.slice(0, SEP_AT), v, ...xs.slice(SEP_AT)]
const setIndex = (di: number) => (di < SEP_AT ? di : di - 1)

export const pct1 = (a: number, n: number) => ((100 * a) / n).toFixed(1)

interface Props {
  L: LocusResult
  data: HapData
  theme: ChartTheme
  hapColors: Record<string, string | null>
  highlightHap: string | null
  onPick: (hap: string) => void
  height: number
  narrow: boolean
}

/** 막대 안 라벨을 그리는 최소 비율(%). 라벨 폭보다 좁은 구간에서 글자가 100% 선 밖으로 나갔다 */
export const freqLabelMin = (narrow: boolean) => (narrow ? 22 : 16)

export function FreqBars({ L, data, theme, hapColors, highlightHap, onPick, height, narrow }: Props) {
  const hatch = useMemo(() => hatchPattern(theme), [theme])
  const sets = useMemo(() => ROWSETS.map(set => ({ set, ...catCounts(L, data, set) })), [L, data])
  const cats = L.cats
  const labels = sets.map(s => rowsetLabel(s.set, s.n))
  const targetNames = new Set(L.named.filter(h => h.target).map(h => h.name))

  const option = useMemo(() => {
    const series = cats.map((c, k) => {
      const col = hapColors[c]
      const color = col ?? (hatch ? { image: hatch, repeat: 'repeat' as const } : theme.surface2)
      const dim = highlightHap != null && highlightHap !== c
      return {
        name: c,
        type: 'bar' as const,
        stack: 'f',
        barWidth: narrow ? 18 : 20,
        cursor: 'pointer',
        itemStyle: { color, borderColor: theme.surface, borderWidth: 1, borderRadius: 0, opacity: dim ? 0.25 : 1 },
        emphasis: { disabled: true },
        label: {
          show: true,
          position: 'inside' as const,
          fontSize: 11,
          fontWeight: 600,
          color: col && targetNames.has(c) && L.named.find(h => h.name === c) === L.repTarget ? theme.surface : theme.text,
          formatter: (raw: unknown) => {
            const p = raw as { value: number }
            return p.value >= freqLabelMin(narrow) ? `${c} ${p.value.toFixed(1)}%` : ''
          },
        },
        data: withSpacer<number | null>(sets.map(s => Number(pct1(s.counts[k]!, s.n))), null),
        markLine:
          k === 0
            ? { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: theme.textMuted, type: 'solid' as const, width: 1 }, data: [{ yAxis: SPACER }] }
            : undefined,
      }
    })
    return {
      grid: { left: 4, right: 12, top: 8, bottom: 30, containLabel: true },
      xAxis: { type: 'value' as const, min: 0, max: 100, interval: 25, name: '계통 비율(%)', nameLocation: 'middle' as const, nameGap: 22, axisLabel: { formatter: '{value}' } },
      yAxis: { type: 'category' as const, inverse: true, data: withSpacer(labels, SPACER), axisTick: { show: false }, axisLabel: { color: theme.text, fontSize: 11.5 } },
      tooltip: {
        trigger: 'item' as const,
        formatter: (raw: unknown) => {
          const p = raw as { seriesName: string; dataIndex: number; value: number }
          const si = setIndex(p.dataIndex)
          const s = sets[si]!
          const k = cats.indexOf(p.seriesName)
          const star = targetNames.has(p.seriesName) ? '(표적)' : ''
          return `${labels[si]}<br/>${p.seriesName}${star} ${s.counts[k]}계통 · ${p.value.toFixed(1)}%`
        },
      },
      series,
    }
  }, [cats, hapColors, hatch, theme, highlightHap, narrow, sets, labels, L, targetNames])

  const all = sets.find(s => s.set === 'ALL')!
  const tgt = [...targetNames]
  const aria = `${L.def.key} 하플로타입 빈도. 패널 전체 ${cats
    .map((c, k) => `${c}${targetNames.has(c) ? '(표적)' : ''} ${pct1(all.counts[k]!, all.n)}%`)
    .join(', ')}. 표적 하플로타입 ${tgt.join('·')}.`

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={aria}
      fallbackTable={{
        columns: ['계통 집합', ...cats.map(c => (targetNames.has(c) ? `${c}(표적)` : c))],
        rows: sets.map((s, i) => [labels[i]!, ...s.counts.map(v => `${pct1(v, s.n)}%`)]),
      }}
      onEvents={{
        click: (p: unknown) => {
          const name = (p as { seriesName?: string }).seriesName
          if (name) onPick(name)
        },
      }}
    />
  )
}
