import { useMemo } from 'react'
import { EChart, gsIntroLine, hMarkLine, useChartTheme, type EChartsOption } from '@/charts'
import { useMediaQuery } from '@/design-system'
import { FIRST_YEAR, GS_START, N_COHORT, TREND, dGTrait, dGpct, type PeriodStats, type Segment, type Year } from '../data'
import { axisYear, n, pctOfMu, sg, span, tv, yearLabel } from './fmt'

/** 회귀선 라벨 문구(실현 기울기 — 예측 ΔG와 구분해 'ΔG' 기호를 쓰지 않는다). 수량은 %/년 병기 */
/** 표현형이 예비 시험(관찰 포장) 값인 첫 코호트 */
const PRELIM_PHENO_FROM = 2024

export function slopeLabel(s: Segment, stats: PeriodStats) {
  const t = stats.trait
  const name = s.kind === 'gs' ? 'GS' : '전통'
  const unit = `${t.unit}/년`
  return t.key === 'yield' ? `${name} 실현 ${n(s.slope, 1)} ${unit}(${n(pctOfMu(s.slope), 2)}%/년)` : `${name} 실현 ${sg(s.slope, t.digits)} ${unit}`
}

/** C. 유전적 추세(점) + 전통·GS 회귀선 + 표현형 추세(점선) */
export function TrendChart({ stats, showPheno, height, colors }: { stats: PeriodStats; showPheno: boolean; height: number; colors: { genetic: string; trad: string; gs: string; pheno: string } }) {
  const theme = useChartTheme()
  // 좁은 화면에서는 회귀선 라벨이 잘리므로 숨기고 기울기를 범례(HTML)에 싣는다
  const narrow = useMediaQuery('(max-width: 639px)')
  const { trait: t, years, trad, gs } = stats
  const G = TREND[t.key].G
  const P = TREND[t.key].P

  const option = useMemo<EChartsOption>(() => {
    const reg = (s: Segment | null, color: string) => {
      if (!s) return null
      const last = s.cohorts[s.cohorts.length - 1]
      const up = s.slope >= 0
      return {
        name: s.kind === 'gs' ? 'GS 회귀' : '전통 회귀',
        type: 'line' as const,
        // 라벨은 심볼에 붙으므로 심볼을 두고 크기를 0으로(끝점만 작은 점)
        symbol: 'circle',
        symbolSize: 0,
        showSymbol: true,
        showAllSymbol: true,
        z: 3,
        // 넓은 반투명 띠: GS 구간에서 유전적 추세 선과 거의 겹쳐, 같은 굵기면 두 선이 구분되지 않는다
        lineStyle: { color, width: 7, opacity: 0.32, cap: 'round' as const },
        itemStyle: { color },
        connectNulls: false,
        tooltip: { show: false },
        data: years.map(y =>
          s.cohorts.includes(y)
            ? y === last
              ? {
                  value: s.intercept + s.slope * y,
                  symbolSize: 6,
                  label: {
                    show: !narrow,
                    position: up ? ('top' as const) : ('bottom' as const),
                    align: 'right' as const,
                    distance: 10,
                    formatter: slopeLabel(s, stats),
                    color,
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: theme.surface,
                    padding: [2, 4],
                    borderRadius: 3,
                  },
                }
              : s.intercept + s.slope * y
            : null,
        ),
      }
    }
    const showGsLine = years.includes(GS_START as Year) && stats.end >= GS_START
    return {
      grid: { left: 36, right: 20, top: 30, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const list = params as { dataIndex: number }[]
          const y = years[list[0]?.dataIndex ?? 0]
          if (y === undefined) return ''
          const pred = dGTrait(t, y)
          const lines = [
            `<b>${yearLabel(y)} 코호트</b> · ${n(N_COHORT[y], 0)}계통`,
            `유전적 추세 ${sg(G[y], t.digits)} ${t.unit}`,
            `표현형 ${sg(P[y], t.digits)} ${t.unit} (환경 효과 포함${y >= PRELIM_PHENO_FROM ? ' · 예비 시험 값' : ''})`,
            t.key === 'yield'
              ? `그해 예측 ΔG ${n(pred, 1)} kg/10a/년 · ${n(dGpct(y), 2)}%/년`
              : `그해 예측 상관 반응 ${sg(pred, t.digits + 1)} ${t.unit}/년`,
          ]
          return lines.join('<br/>')
        },
      },
      xAxis: { type: 'category', data: years.map(axisYear), boundaryGap: false, axisLabel: { lineHeight: 14 } },
      yAxis: {
        type: 'value',
        name: `${FIRST_YEAR} 코호트 대비 편차 (${t.unit})`,
        nameLocation: 'middle',
        nameGap: 44,
        axisLabel: { formatter: (v: number) => n(v, t.digits >= 2 ? t.digits - 1 : 0) },
      },
      series: [
        {
          name: '유전적 추세',
          type: 'line',
          z: 4,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { color: colors.genetic, width: 1.5 },
          itemStyle: { color: colors.genetic },
          data: years.map(y => G[y]),
          markLine: {
            symbol: 'none',
            silent: true,
            data: [
              // 왼쪽은 추세·회귀 띠가 지나가 오른쪽 끝, 추세 반대쪽에 둔다
              hMarkLine(0, `${FIRST_YEAR} 코호트`, theme.textMuted, { width: 1, position: stats.cumulative >= 0 ? 'insideEndBottom' : 'insideEndTop', fontWeight: 'normal' }),
              ...(showGsLine ? [gsIntroLine(theme, years.indexOf(GS_START as Year))] : []),
            ],
          },
        },
        ...[reg(trad, colors.trad), reg(gs, colors.gs)].filter(s => s !== null),
        ...(showPheno
          ? [
              {
                name: '표현형 추세',
                type: 'line' as const,
                z: 2,
                symbol: 'emptyCircle',
                symbolSize: 7,
                lineStyle: { color: colors.pheno, width: 1.5, type: 'dashed' as const },
                itemStyle: { color: colors.pheno, borderColor: colors.pheno, borderWidth: 1.5 },
                data: years.map(y => P[y]),
              },
            ]
          : []),
      ],
    } as EChartsOption
  }, [years, theme, t, G, P, trad, gs, colors, showPheno, stats, narrow])

  const parts = [gs ? slopeLabel(gs, stats) : null, trad ? slopeLabel(trad, stats) : null].filter(Boolean).join(', ')
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`${t.label} 유전적 추세(${span(years)} 코호트, ${FIRST_YEAR} 코호트 대비): ${parts}. 누적 ${tv(t, stats.cumulative)} ${t.unit}. 표현형 기울기 ${sg(stats.phenoSlope, t.digits)} ${t.unit}/년(환경 효과 포함).`}
      fallbackTable={{
        columns: ['코호트', '계통 수', `유전적 추세 (${t.unit})`, `표현형 (${t.unit})`],
        rows: years.map(y => [yearLabel(y), N_COHORT[y], sg(G[y], t.digits), sg(P[y], t.digits)]),
      }}
    />
  )
}
