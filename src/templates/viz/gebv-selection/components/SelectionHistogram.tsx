import { useMemo } from 'react'
import { EChart, histogramSeries, useChartTheme, type EChartsOption } from '@/charts'
import { histogram, kde, type Mode, type SelectionResult } from '../data'
import { formatSigned } from '@/lib/format'

interface Props {
  result: SelectionResult
  mode: Mode
  selectedName: string | null
  height: number
  /** 좁은 화면: 평균·선발 평균·S 주석을 차트 위 한 줄 캡션으로 옮겨 겹침을 피한다 */
  compact?: boolean
}

const CAPTION_H = 22

/** 선발 기준 값(수량 GEBV 또는 지수 I)의 누적 막대 히스토그램 + KDE + 기준선·평균선·선발 차 S */
export function SelectionHistogram({ result, mode, selectedName, height, compact = false }: Props) {
  const theme = useChartTheme()
  const isYield = mode === 'yield'
  const width = isYield ? 4 : 0.1
  const digits = isYield ? 1 : 2
  const unit = isYield ? ' kg/10a' : ''
  const binDigits = isYield ? 0 : 1

  const { bins, curve, maxCount } = useMemo(() => {
    const b = histogram(result.ranked, width)
    const lo = b[0]!.x0
    const hi = b[b.length - 1]!.x1
    const c = kde(
      result.ranked.map(r => r.value),
      width,
      lo,
      hi,
    )
    return { bins: b, curve: c, maxCount: Math.max(...b.map(x => x.sel + x.unsel), ...c.map(p => p[1])) }
  }, [result, width])

  const pTxt = `${Math.round(result.p * 100)}%`
  const S = result.valueSelMean - result.valueMean
  const sel = selectedName ? result.byName.get(selectedName) : undefined
  const selBin = sel ? bins.find(b => sel.value >= b.x0 && sel.value < b.x1) ?? bins[bins.length - 1] : undefined

  const yMax = Math.ceil((maxCount * 1.62) / 10) * 10
  const option = useMemo<EChartsOption>(() => {
    const muted = theme.textMuted
    const binLabel = (x0: number, x1: number) => `${formatSigned(x0, binDigits)} ~ ${formatSigned(x1, binDigits)}${unit}`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tip = (p: any) => {
      const v = p.value as number[]
      return `${binLabel(v[0]!, v[1]!)} · 선발 ${v[5]} · 비선발 ${v[4]}`
    }
    const vLine = (x: number, yTop: number, label: string, color: string, type: 'solid' | 'dashed', w: number, show = true) => [
      { coord: [x, 0], symbol: 'none', lineStyle: { color, type, width: w }, label: { show, position: 'end' as const, formatter: label, color, fontSize: 11, fontWeight: 600 } },
      { coord: [x, yTop], symbol: 'none', label: { show, position: 'end' as const, formatter: label, color, fontSize: 11, fontWeight: 600 } },
    ]
    const bracketY = maxCount * 1.2
    return {
      animation: false,
      grid: { left: 44, right: 28, top: 28, bottom: 44 },
      tooltip: { trigger: 'item', confine: true },
      xAxis: {
        type: 'value',
        min: bins[0]!.x0,
        max: bins[bins.length - 1]!.x1,
        name: isYield ? '수량 GEBV (kg/10a)' : '다형질 선발 지수 I (SD 단위)',
        nameLocation: 'middle',
        nameGap: 26,
        splitLine: { show: false },
        axisLabel: { formatter: (v: number) => formatSigned(v, isYield ? 0 : 1) },
      },
      yAxis: { type: 'value', name: '계통 수', nameLocation: 'middle', nameGap: 32, max: yMax, minInterval: 1 },
      series: [
        // 행 = [x0, x1, y0, y1, 비선발, 선발] — 툴팁은 v[4]·v[5]를 읽는다
        histogramSeries({
          name: '비선발',
          bins,
          y1: b => b.unsel,
          color: muted,
          opacity: 0.4,
          extra: b => [b.unsel, b.sel],
          series: { tooltip: { formatter: tip }, z: 2 },
        }),
        histogramSeries({
          name: '선발',
          bins,
          y0: b => b.unsel,
          y1: b => b.unsel + b.sel,
          color: theme.accent,
          opacity: 0.9,
          extra: b => [b.unsel, b.sel],
          series: { tooltip: { formatter: tip }, z: 3 },
        }),
        {
          name: '밀도(KDE)',
          type: 'line',
          data: curve,
          smooth: true,
          showSymbol: false,
          silent: true,
          lineStyle: { color: theme.text, width: 1.5, opacity: 0.55 },
          tooltip: { show: false },
          z: 4,
          markLine: {
            silent: true,
            symbol: 'none',
            animation: false,
            data: [
              vLine(result.cutoff, maxCount * 1.56, compact ? `기준 ${formatSigned(result.cutoff, digits)}` : `기준 ${formatSigned(result.cutoff, digits)} · 상위 ${pTxt}`, theme.text, 'solid', 2.5),
              vLine(result.valueMean, maxCount * 1.36, `평균 ${formatSigned(result.valueMean, digits)}`, muted, 'dashed', 1.5, !compact),
              vLine(result.valueSelMean, maxCount * 1.36, `선발 평균 ${formatSigned(result.valueSelMean, digits)}`, theme.accent, 'dashed', 1.5, !compact),
              [
                { coord: [result.valueMean, bracketY], symbol: 'arrow', symbolSize: 7, lineStyle: { color: theme.text, type: 'solid', width: 1 } },
                {
                  coord: [result.valueSelMean, bracketY],
                  symbol: 'arrow',
                  symbolSize: 7,
                  label: { show: !compact, position: 'middle' as const, formatter: `선발 차 S = ${formatSigned(S, digits).replace('+', '')}`, color: theme.text, fontSize: 11, fontWeight: 600 },
                },
              ],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ] as any,
          },
          markPoint:
            sel && selBin
              ? {
                  silent: true,
                  animation: false,
                  data: [
                    {
                      coord: [sel.value, selBin.sel + selBin.unsel],
                      symbol: 'triangle',
                      symbolRotate: 180,
                      symbolSize: 10,
                      symbolOffset: [0, -8],
                      itemStyle: { color: theme.text },
                      label: { show: true, position: 'top', formatter: sel.line.name, color: theme.text, fontSize: 11, distance: 4 },
                    },
                  ],
                }
              : undefined,
        },
      ],
    } as unknown as EChartsOption
  }, [theme, bins, curve, maxCount, yMax, result, isYield, digits, pTxt, S, sel, selBin, binDigits, unit, compact])

  const ariaLabel = `${isYield ? '수량 GEBV' : '다형질 선발 지수'} 분포: 600계통 중 상위 ${pTxt} ${result.nSel}계통 선발, 기준 ${formatSigned(result.cutoff, digits)}${unit}, 전체 평균 ${formatSigned(result.valueMean, digits)}, 선발 평균 ${formatSigned(result.valueSelMean, digits)}, 실현 선발 차 S = ${formatSigned(S, digits)}${unit}`
  const fallbackTable = {
    columns: ['구간', '선발', '비선발'],
    rows: bins.filter(b => b.sel + b.unsel > 0).map(b => [`${formatSigned(b.x0, binDigits)} ~ ${formatSigned(b.x1, binDigits)}`, b.sel, b.unsel]),
  }

  const chart = <EChart option={option} height={compact ? height - CAPTION_H : height} ariaLabel={ariaLabel} fallbackTable={fallbackTable} />
  if (!compact) return chart
  return (
    <div className="flex h-full flex-col">
      <p className="flex flex-wrap gap-x-2 text-[11px] font-semibold leading-[22px] tabular-nums" style={{ height: CAPTION_H }} aria-hidden="true">
        <span className="text-muted">평균 {formatSigned(result.valueMean, digits)}</span>
        <span className="text-accent">선발 평균 {formatSigned(result.valueSelMean, digits)}</span>
        <span className="text-text">S = {formatSigned(S, digits).replace('+', '')}</span>
      </p>
      {chart}
    </div>
  )
}
