import { useMemo } from 'react'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { PANEL, type TraitResult } from '../data'

export interface QqChartProps {
  result: TraitResult
  /** 소수 2자리로 반올림한 λGC 표기(KPI와 같은 문자열) */
  lambdaText: string
  /** λ 제목 옆 제외 기준 표기. 예: 피크 ±1 Mb 제외, n=35,641 */
  lambdaNote: string
  sigLine: number
  height: number
  ariaLabel: string
}

interface CustomApi {
  coord: (v: [number, number]) => [number, number]
}

/** QQ 플롯: y = x 대각선, 95% 신뢰 띠(순위 통계량 Beta 근사), 좌상단 λGC */
export function QqChart({ result, lambdaText, lambdaNote, sigLine, height, ariaLabel }: QqChartProps) {
  const theme = useChartTheme()

  const option = useMemo<EChartsOption>(() => {
    const expMax = result.qq[0]?.exp ?? 5
    // 판정 구간(기대 0~3)이 보이게 x축은 기대 최댓값까지, y축은 관측 최댓값까지. y = x 선은 그대로 둔다
    const xMax = Math.ceil(expMax + 0.1)
    const yMax = Math.ceil(result.maxLogP + 0.5)
    // 강조색 = 리드 SNP(맨해튼과 같은 뜻). 나머지 유의 SNP는 잉크색 점
    const leadIds = new Set(result.leads.filter(l => l.logP >= sigLine).map(l => l.id))
    const upper = result.band.map(b => [b[0], b[2]] as [number, number])
    const lower = result.band.map(b => [b[0], b[1]] as [number, number])
    const polygon = [...upper, ...lower.reverse()]
    const below: number[][] = []
    const above: number[][] = []
    const lead: number[][] = []
    const belowIdx: number[] = []
    const aboveIdx: number[] = []
    const leadIdx: number[] = []
    for (const q of result.qq) {
      if (q.obs >= sigLine && leadIds.has(PANEL.snps[q.idx]?.id ?? '')) {
        lead.push([q.exp, q.obs])
        leadIdx.push(q.idx)
      } else if (q.obs >= sigLine) {
        above.push([q.exp, q.obs])
        aboveIdx.push(q.idx)
      } else {
        below.push([q.exp, q.obs])
        belowIdx.push(q.idx)
      }
    }
    const idxOf = [belowIdx, aboveIdx, leadIdx]
    return {
      title: {
        text: `λGC = ${lambdaText}`,
        subtext: lambdaNote,
        left: 60,
        top: 2,
        itemGap: 2,
        textStyle: { fontSize: 13, fontWeight: 600, color: theme.text },
        subtextStyle: { fontSize: 11, color: theme.textMuted },
      },
      grid: { left: 30, right: 16, top: 44, bottom: 28, containLabel: true },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (raw: unknown) => {
          const p = raw as { seriesIndex?: number; dataIndex?: number; value?: number[] }
          if (p.seriesIndex == null || p.seriesIndex < 2 || p.dataIndex == null || !p.value) return ''
          const i = idxOf[p.seriesIndex - 2]?.[p.dataIndex]
          const snp = i != null ? PANEL.snps[i] : undefined
          return `<div style="font-weight:600;margin-bottom:4px">${snp?.id ?? ''}</div>` +
            `<div>기대 −log10(p) <b style="font-variant-numeric:tabular-nums">${p.value[0]!.toFixed(2)}</b></div>` +
            `<div>관측 −log10(p) <b style="font-variant-numeric:tabular-nums">${p.value[1]!.toFixed(2)}</b></div>`
        },
      },
      xAxis: { type: 'value', name: '기대 −log10(p)', nameLocation: 'middle', nameGap: 26, min: 0, max: xMax, interval: 1 },
      yAxis: { type: 'value', name: '관측 −log10(p)', nameLocation: 'middle', nameGap: 30, min: 0, max: yMax, minInterval: 1 },
      series: [
        {
          type: 'custom',
          name: '95% 신뢰 띠',
          silent: true,
          z: 1,
          data: [0],
          renderItem: (_params: unknown, api: CustomApi) => ({
            type: 'polygon',
            shape: { points: polygon.map(pt => api.coord(pt)) },
            style: { fill: theme.textMuted, opacity: 0.18 },
          }),
        },
        {
          type: 'line',
          name: 'y = x',
          silent: true,
          symbol: 'none',
          z: 2,
          lineStyle: { color: theme.textMuted, width: 1 },
          data: [
            [0, 0],
            [xMax, xMax],
          ],
        },
        { type: 'scatter', name: 'SNP', symbolSize: 4, z: 3, itemStyle: { color: theme.chromosome[0] }, data: below },
        { type: 'scatter', name: '유의 SNP', symbolSize: 5, z: 4, itemStyle: { color: theme.text }, data: above },
        { type: 'scatter', name: '리드 SNP', symbolSize: 10, z: 5, symbol: 'diamond', itemStyle: { color: theme.accent, borderColor: theme.surface, borderWidth: 1 }, data: lead },
      ],
    } as EChartsOption
  }, [result, lambdaText, lambdaNote, sigLine, theme])

  return <EChart option={option} height={height} ariaLabel={ariaLabel} />
}
