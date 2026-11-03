import { useMemo } from 'react'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { formatFixed } from '@/lib/format'
import { LINES, N, TRAITS, dirText, f2, fmtGebvVal, fmtInt, josa, ols, type TraitDef } from '../data'

export type ScatterKind = 'gebv' | 'pheno'

interface Props {
  kind: ScatterKind
  a: number
  b: number
  /** 산점도 r(부제와 같은 값) */
  r: number
  height: number
}

function axisName(t: TraitDef, kind: ScatterKind): string {
  const base = kind === 'gebv' ? `${t.sent} GEBV` : t.sent
  const unit = t.key === 'blast' ? '점' : t.unit
  return t.d !== 0 || t.key === 'blast' ? `${base} (${unit}, ${dirText(t)})` : `${base} (${unit})`
}

/** 쌍 산점도(1,850점, large 모드) + OLS 회귀선 */
export function PairScatter({ kind, a, b, r, height }: Props) {
  const theme = useChartTheme()
  const tx = TRAITS[a]!
  const ty = TRAITS[b]!
  const src = kind === 'gebv' ? LINES.gebv : LINES.pheno

  const option = useMemo<EChartsOption>(() => {
    const xs = src[a]!
    const ys = src[b]!
    const data: [number, number, number][] = new Array(N)
    let x0 = Infinity
    let x1 = -Infinity
    for (let n = 0; n < N; n++) {
      data[n] = [xs[n]!, ys[n]!, n]
      if (xs[n]! < x0) x0 = xs[n]!
      if (xs[n]! > x1) x1 = xs[n]!
    }
    const fit = ols(xs, ys)
    const fmtV = (t: number, v: number) => (kind === 'gebv' ? fmtGebvVal(t, v) : formatFixed(v, TRAITS[t]!.dp))
    return {
      animation: false,
      grid: { left: 30, right: 16, top: 12, bottom: 30, containLabel: true },
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const v = (p as { value?: [number, number, number] }).value
          if (!v || v.length < 3) return ''
          const label = kind === 'gebv' ? ' GEBV ' : ' '
          return `<b>${LINES.names[v[2]]}</b><br/>${tx.short}${label}${fmtV(a, v[0])}<br/>${ty.short}${label}${fmtV(b, v[1])}`
        },
      },
      xAxis: {
        type: 'value',
        scale: true,
        name: axisName(tx, kind),
        nameLocation: 'middle',
        nameGap: 24,
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: true,
        name: axisName(ty, kind),
        nameLocation: 'middle',
        nameGap: 34,
        nameRotate: 90,
      },
      series: [
        {
          name: kind === 'gebv' ? 'GEBV' : '표현형',
          type: 'scatter',
          large: true,
          largeThreshold: 1000,
          symbolSize: 4,
          itemStyle: { color: kind === 'gebv' ? theme.accent : theme.categorical[1], opacity: 0.38 },
          data,
        },
        {
          name: 'OLS 회귀선',
          type: 'line',
          silent: true,
          symbol: 'none',
          lineStyle: { color: theme.text, width: 2 },
          data: [
            [x0, fit.icpt + fit.slope * x0],
            [x1, fit.icpt + fit.slope * x1],
          ],
          z: 5,
        },
      ],
    }
  }, [src, a, b, kind, theme, tx, ty])

  const what = kind === 'gebv' ? 'GEBV' : '계통 평균 표현형'
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`${josa(tx.sent, '와과')} ${ty.sent}의 ${what} 산점도(${fmtInt(N)}계통). 상관 r = ${f2(r)}, 회귀선 기울기 ${r >= 0 ? '양' : '음'}의 방향.`}
      fallbackTable={{
        columns: ['항목', '값'],
        rows: [
          ['계통 수', fmtInt(N)],
          ['Pearson r', f2(r)],
          ['x', axisName(tx, kind)],
          ['y', axisName(ty, kind)],
        ],
      }}
    />
  )
}
