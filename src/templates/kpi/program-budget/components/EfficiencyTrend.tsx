import { useMemo } from 'react'
import { EChart, gsIntroLine, stripeDecal, useChartTheme, type EChartsOption } from '@/charts'
import { CPG_REALIZED, FY, GS_START, NEXT_FY, PER_LINE_KEYS, REALIZED_PERIOD, T2019, T2026, T2027, TREND, type TrendRow } from '../data'
import { man, n, perLineColor } from './fmt'

const LABELS = TREND.map(t => t.label)
const GS_IDX = TREND.findIndex(t => t.year === GS_START)

function tipHtml(t: TrendRow): string {
  const comps = PER_LINE_KEYS.filter(k => t.comps[k.key] !== undefined).map(k => `${k.label} ${n(t.comps[k.key]!)}`)
  return [
    `<b>${t.label}${t.plan ? '(추정)' : ''}</b>`,
    `계통당 선발 평가비 ${n(t.perLine)}만 원 = ${comps.join(' + ')}`,
    `비교 기준 직접비 ${man(t.annual)}만 원(${n(t.annual / 1e4, 2)}억)`,
    `${t.plan ? '계획' : '예측'} ΔG ${n(t.dG, 2)} kg/10a/년`,
    `개량 1 kg/10a당 ${man(t.cpg)}만 원`,
  ].join('<br/>')
}

/** D-좌. 계통당 선발 평가비(구성 요소 누적 막대) */
export function PerLineChart({ height, narrow }: { height: number; narrow: boolean }) {
  const theme = useChartTheme()
  const option = useMemo<EChartsOption>(() => {
    const keys = PER_LINE_KEYS
    const series = keys.map((k, ki) => ({
      name: k.label,
      type: 'bar' as const,
      stack: 'perLine',
      barWidth: narrow ? '62%' : '56%',
      data: TREND.map(t => {
        const v = t.comps[k.key]
        if (v === undefined) return null
        return {
          value: v,
          itemStyle: {
            color: perLineColor(theme, k.key),
            borderRadius: 0,
            ...(t.plan ? { decal: stripeDecal(theme.surface, 3), opacity: 0.85 } : {}),
          },
        }
      }),
      ...(ki === 0
        ? {
            markLine: { symbol: 'none', silent: true, data: [gsIntroLine(theme, GS_IDX)] },
          }
        : {}),
    }))
    // 막대 위 합계 라벨(투명 시리즈)
    const total = {
      name: '합계',
      type: 'bar' as const,
      stack: 'perLine',
      z: 6,
      data: TREND.map(() => 0.0001),
      itemStyle: { color: 'transparent' },
      label: {
        show: true,
        position: 'top' as const,
        formatter: (p: { dataIndex: number }) => n(TREND[p.dataIndex]!.perLine),
        color: theme.text,
        fontWeight: 700,
        fontSize: narrow ? 11 : 12,
        // GS 도입선이 2022 값 라벨을 가르지 않게 카드 배경색 상자를 깐다
        backgroundColor: theme.surface,
        padding: [1, 3],
        borderRadius: 2,
      },
      tooltip: { show: false },
      silent: true,
    }
    return {
      grid: { left: 4, right: 8, top: 36, bottom: 4, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps: unknown) => tipHtml(TREND[(ps as { dataIndex: number }[])[0]!.dataIndex]!) },
      xAxis: { type: 'category', data: LABELS, axisLabel: { interval: 0, fontSize: 11, formatter: (v: string) => (narrow ? v.replace(/^20/, "'") : v) } },
      yAxis: { type: 'value', min: 0, max: 9, interval: 3, name: '만 원/계통', nameTextStyle: { align: 'left', padding: [0, 0, 0, -4] } },
      series: [...series, total],
    } as EChartsOption
  }, [theme, narrow])
  const peak = TREND.filter(t => !t.plan).reduce((a, b) => (b.perLine > a.perLine ? b : a))
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`계통당 선발 평가비: ${T2019.year} ${n(T2019.perLine)}만 원에서 GS를 도입한 ${GS_START}년 ${n(peak.perLine)}만 원으로 정점, 유전형 분석 단가가 내려 ${T2026.year} ${n(T2026.perLine)}만 원, ${T2027.label} ${n(T2027.perLine)}만 원입니다.`}
      fallbackTable={{
        columns: ['연도', ...PER_LINE_KEYS.map(k => k.label), '합계(만 원/계통)'],
        rows: TREND.map(t => [t.label, ...PER_LINE_KEYS.map(k => (t.comps[k.key] === undefined ? '—' : n(t.comps[k.key]!))), n(t.perLine)]),
      }}
    />
  )
}

/** D-우. 개량 1 kg/10a당 연간 직접비(예측 선 + 2027안 점선 + 실현 기준 마름모) */
export function CostPerGainChart({ height, narrow }: { height: number; narrow: boolean }) {
  const theme = useChartTheme()
  const option = useMemo<EChartsOption>(() => {
    const c = theme.categorical[0]!
    const realC = theme.categorical[1]!
    const lastActual = TREND.length - 2
    const label = (show: (i: number) => boolean) => ({
      show: true,
      formatter: (p: { dataIndex: number; value: number }) => (show(p.dataIndex) ? man(p.value) : ''),
      position: 'top' as const,
      color: theme.text,
      fontSize: 11,
      fontWeight: 600,
      backgroundColor: theme.surface,
      padding: [1, 3],
      borderRadius: 2,
    })
    return {
      grid: { left: 4, right: 12, top: 36, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        formatter: (ps: unknown) => {
          const arr = ps as { dataIndex: number; seriesName: string; value: number | null }[]
          const t = TREND[arr[0]!.dataIndex]!
          const real = arr.find(p => p.seriesName === '실현 추세 기준' && p.value != null)
          return tipHtml(t) + (real ? `<br/>실현 추세 기준 ${man(real.value!)}만 원` : '')
        },
      },
      xAxis: { type: 'category', data: LABELS, boundaryGap: true, axisLabel: { interval: 0, fontSize: 11, formatter: (v: string) => (narrow ? v.replace(/^20/, "'") : v) } },
      yAxis: { type: 'value', min: 0, max: 4000, interval: 1000, name: '만 원/(kg/10a)', nameTextStyle: { align: 'left', padding: [0, 0, 0, -4] } },
      series: [
        {
          name: '예측 ΔG 기준',
          type: 'line',
          data: TREND.map((t, i) => (i <= lastActual ? Math.round(t.cpg * 10) / 10 : null)),
          lineStyle: { color: c, width: 2.5 },
          itemStyle: { color: c },
          symbolSize: 6,
          // 좁은 화면: 2025·2026·2027안 라벨이 서로 겹쳐 2025를 빼고 2027안은 점 아래로
          label: label(i => !narrow || i === lastActual || (i % 2 === 0 && i < lastActual - 1)),
          z: 3,
        },
        {
          name: `${NEXT_FY}안(계획 ΔG)`,
          type: 'line',
          data: TREND.map((t, i) => (i >= lastActual ? Math.round(t.cpg * 10) / 10 : null)),
          lineStyle: { color: c, width: 2, type: 'dashed' },
          itemStyle: { color: theme.surface, borderColor: c, borderWidth: 2 },
          symbolSize: 7,
          label: { ...label(i => i === lastActual + 1), position: narrow ? ('bottom' as const) : ('top' as const) },
          // 값 라벨 상자가 선을 덮도록 라벨 계열보다 낮은 z 계열에 둔다
          markLine: { symbol: 'none', silent: true, data: [gsIntroLine(theme, GS_IDX)] },
          z: 2,
        },
        {
          name: '실현 추세 기준',
          type: 'scatter',
          symbol: 'diamond',
          symbolSize: 13,
          data: TREND.map(t => (t.year === T2019.year ? CPG_REALIZED[2019] : t.year === FY ? CPG_REALIZED[FY] : null)),
          itemStyle: { color: realC, borderColor: theme.surface, borderWidth: 1 },
          label: {
            show: true,
            position: 'right',
            formatter: (p: { value: number }) => man(p.value),
            color: theme.text,
            fontSize: 11,
            fontWeight: 600,
          },
          z: 4,
        },
      ],
    } as EChartsOption
  }, [theme, narrow])
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`개량 1 kg/10a당 연간 직접비(예측 ΔG 기준): ${T2019.year} ${man(T2019.cpg)}만 원 → ${T2026.year} ${man(T2026.cpg)}만 원, ${T2027.label} ${man(T2027.cpg)}만 원(계획). 실현 추세 기준은 ${man(CPG_REALIZED[2019])}만 원 → ${man(CPG_REALIZED[2026])}만 원입니다.`}
      fallbackTable={{
        columns: ['연도', '비교 기준 직접비(만 원)', 'ΔG(kg/10a/년)', '개량 1 kg/10a당(만 원, 예측)', '실현 추세 기준(만 원)'],
        rows: TREND.map(t => [
          t.label,
          man(t.annual),
          `${n(t.dG, 2)}${t.plan ? '(계획)' : ''}`,
          man(t.cpg),
          t.year === T2019.year ? man(CPG_REALIZED[2019]) : t.year === FY ? man(CPG_REALIZED[FY]) : '—',
        ]),
      }}
    />
  )
}

export const REALIZED_LEGEND = `실현 추세 기준(기간 기울기: 전통 ${REALIZED_PERIOD.conventional} · GS ${REALIZED_PERIOD.gs})`
