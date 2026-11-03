import { useMemo } from 'react'
import { EChart, selectionSymbolSeries, useChartTheme, type EChartsOption } from '@/charts'
import { PANEL, SUGGESTIVE, type Lead, type TraitResult } from '../data'
import { leadLabel, snpTooltip } from './format'

export interface ManhattanChartProps {
  result: TraitResult
  sigLine: number
  /** 유의선 라벨에 쓰는 기준 설명. 예: 0.05/36,420 */
  sigDesc: string
  /** 좁은 화면(390px 등): 기준선 라벨을 짧게 */
  compact?: boolean
  /** null이면 전체 유전체, 값이 있으면 해당 염색체 확대 */
  zoomChr: string | null
  selectedLeadId: string | null
  onZoom: (chr: string) => void
  height: number
  ariaLabel: string
  fallbackTable?: { columns: string[]; rows: (string | number)[][] }
}

interface ItemParams {
  seriesIndex?: number
  dataIndex?: number
}

/**
 * 맨해튼 플롯. 전체 유전체(누적 위치, 염색체 교대 2색)와 염색체 확대(위치 Mb, QTL 구간 음영)를 같은 EChart로 그린다.
 * 대용량(3.6만 점)이라 SNP 시리즈는 large 모드, 리드 SNP만 별도 시리즈로 라벨을 단다.
 */
export function ManhattanChart({ result, sigLine, sigDesc, compact = false, zoomChr, selectedLeadId, onZoom, height, ariaLabel, fallbackTable }: ManhattanChartProps) {
  const theme = useChartTheme()
  const { snps, chrOffsets, totalMb } = PANEL
  const zoom = zoomChr ? chrOffsets.find(c => c.chr === zoomChr) ?? null : null

  // 시리즈 dataIndex → PANEL 인덱스 매핑
  const layout = useMemo(() => {
    const { logP } = result
    if (!zoom) {
      const odd: number[][] = []
      const even: number[][] = []
      const oddIdx: number[] = []
      const evenIdx: number[] = []
      for (let i = 0; i < snps.length; i++) {
        const s = snps[i]!
        if (s.chrNum % 2 === 1) {
          odd.push([s.cumPos, logP[i]!])
          oddIdx.push(i)
        } else {
          even.push([s.cumPos, logP[i]!])
          evenIdx.push(i)
        }
      }
      return { mode: 'full' as const, seriesData: [odd, even], seriesIdx: [oddIdx, evenIdx], leads: result.leads }
    }
    const data: number[][] = []
    const idx: number[] = []
    for (let i = zoom.from; i < zoom.to; i++) {
      data.push([snps[i]!.posMb, logP[i]!])
      idx.push(i)
    }
    return { mode: 'zoom' as const, seriesData: [data], seriesIdx: [idx], leads: result.leads.filter(l => l.chr === zoom.chr) }
  }, [result, zoom, snps])

  const option = useMemo<EChartsOption>(() => {
    const [chrA, chrB] = theme.chromosome
    const yMax = Math.ceil(Math.max(result.maxLogP, sigLine) + 1)
    // 기준선 라벨은 점 위에 읽히도록 표면색 바탕을 깔고, 리드 SNP 시리즈(z 5)에 붙여 SNP 점보다 위에 그린다.
    // 좁은 화면에서는 유의선 라벨을 짧게 줄인다(기준 설명은 범례·토글에 있음).
    const lineLabelBox = { backgroundColor: theme.surface, padding: [1, 4], borderRadius: 3 }
    const markLine = {
      silent: true,
      symbol: 'none',
      animation: false,
      data: [
        {
          yAxis: sigLine,
          lineStyle: { color: theme.threshold, type: 'solid' as const, width: 1.5 },
          label: { formatter: compact ? `유의 ${sigLine.toFixed(2)}` : `유의선 ${sigLine.toFixed(2)} (${sigDesc})`, position: 'insideEndTop' as const, color: theme.threshold, fontWeight: 600, fontSize: 11, ...lineLabelBox },
        },
        {
          yAxis: SUGGESTIVE,
          lineStyle: { color: theme.textMuted, type: 'dashed' as const, width: 1 },
          label: { formatter: compact ? `제안 ${SUGGESTIVE.toFixed(2)}` : `제안선 ${SUGGESTIVE.toFixed(2)}`, position: 'insideEndBottom' as const, color: theme.textMuted, fontSize: 11, ...lineLabelBox },
        },
      ],
    }

    const leadsData = layout.leads.map(l => {
      const sig = l.logP >= sigLine
      const selected = l.id === selectedLeadId
      const x = layout.mode === 'full' ? snps[l.idx]!.cumPos : l.posMb
      // 전체 보기에서는 유의 좌위만 라벨, 확대 보기에서는 모든 리드 SNP 라벨
      const showLabel = layout.mode === 'zoom' || sig
      return {
        value: [x, l.logP],
        symbolSize: selected ? 16 : sig ? 11 : 8,
        itemStyle: {
          color: sig ? theme.accent : theme.surface,
          borderColor: theme.accent,
          borderWidth: 1.5,
        },
        label: { show: showLabel },
      }
    })

    const leadSeries = {
      type: 'scatter' as const,
      name: '리드 SNP',
      symbol: 'diamond',
      z: 5,
      data: leadsData,
      label: {
        position: 'top' as const,
        distance: 6,
        color: theme.text,
        fontSize: 11,
        fontWeight: 600,
        fontStyle: 'italic' as const,
        formatter: (p: { dataIndex: number }) => leadLabel(layout.leads[p.dataIndex]!),
      },
      labelLayout: { hideOverlap: true },
      emphasis: { scale: 1.2 },
      markLine,
    }

    // 선택 리드 SNP: 공통 선택 표시(표면색 후광 → 글자색 선을 같은 다이아몬드에 두 번, selectionSymbolSeries).
    // 리드 시리즈 뒤에 두어(인덱스가 리드 시리즈 다음) 툴팁 판정에 영향이 없고, silent라 클릭은 아래 점이 받는다
    const selIdx = layout.leads.findIndex(l => l.id === selectedLeadId)
    const selSeries = selectionSymbolSeries(theme, { value: selIdx >= 0 ? leadsData[selIdx]!.value : null, symbol: 'diamond', symbolSize: 16, z: 6 })

    const tooltip = {
      trigger: 'item' as const,
      confine: true,
      formatter: (raw: unknown) => {
        const p = raw as ItemParams
        if (p.seriesIndex == null || p.dataIndex == null) return ''
        const leadSeriesIndex = layout.seriesData.length
        if (p.seriesIndex === leadSeriesIndex) {
          const l = layout.leads[p.dataIndex]!
          return snpTooltip(snps[l.idx]!, l.logP, l)
        }
        const i = layout.seriesIdx[p.seriesIndex]?.[p.dataIndex]
        if (i == null) return ''
        const lead = result.leads.find(l => l.idx === i)
        return snpTooltip(snps[i]!, result.logP[i]!, lead)
      },
    }

    const yAxis = {
      type: 'value' as const,
      name: '−log10(p)',
      nameLocation: 'end' as const,
      nameGap: 10,
      nameTextStyle: { align: 'left' as const },
      min: 0,
      max: yMax,
      minInterval: 1,
    }

    if (layout.mode === 'full') {
      const mids = chrOffsets.map(c => c.mid)
      return {
        grid: { left: 8, right: 16, top: 36, bottom: 28, containLabel: true },
        tooltip,
        xAxis: {
          type: 'value',
          name: '염색체',
          nameLocation: 'middle',
          nameGap: 26,
          min: 0,
          max: totalMb,
          splitLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            customValues: mids,
            formatter: (v: number) => {
              const c = chrOffsets.reduce((a, b) => (Math.abs(b.mid - v) < Math.abs(a.mid - v) ? b : a))
              return String(c.chrNum)
            },
          },
        },
        yAxis,
        series: [
          { type: 'scatter', name: '홀수 염색체', large: true, progressive: 0, symbolSize: 3.5, itemStyle: { color: chrA }, data: layout.seriesData[0] },
          { type: 'scatter', name: '짝수 염색체', large: true, progressive: 0, symbolSize: 3.5, itemStyle: { color: chrB }, data: layout.seriesData[1] },
          leadSeries,
          ...selSeries,
        ],
      } as EChartsOption
    }

    const z = zoom!
    const color = z.chrNum % 2 === 1 ? chrA : chrB
    return {
      grid: { left: 8, right: 16, top: 36, bottom: 62, containLabel: true },
      tooltip,
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
        { type: 'slider', xAxisIndex: 0, filterMode: 'none', height: 16, bottom: 4, showDetail: false },
      ],
      xAxis: {
        type: 'value',
        name: `${z.chr} 위치(Mb)`,
        nameLocation: 'middle',
        nameGap: 26,
        min: 0,
        max: z.lengthMb,
        splitLine: { show: false },
      },
      yAxis,
      series: [
        {
          type: 'scatter',
          name: z.chr,
          large: true,
          progressive: 0,
          symbolSize: 4.5,
          itemStyle: { color },
          data: layout.seriesData[0],
          markArea: {
            silent: true,
            itemStyle: { color: theme.accent, opacity: 0.1 },
            label: { show: false },
            data: layout.leads.map(l => [{ xAxis: l.qtlStart }, { xAxis: l.qtlEnd }]),
          },
        },
        leadSeries,
        ...selSeries,
      ],
    } as EChartsOption
  }, [theme, layout, result, sigLine, sigDesc, compact, selectedLeadId, snps, chrOffsets, totalMb, zoom])

  const onEvents = useMemo(
    () => ({
      click: (raw: unknown) => {
        if (layout.mode !== 'full') return
        const p = raw as ItemParams
        if (p.seriesIndex == null || p.dataIndex == null) return
        let i: number | undefined
        if (p.seriesIndex === layout.seriesData.length) i = (layout.leads[p.dataIndex] as Lead | undefined)?.idx
        else i = layout.seriesIdx[p.seriesIndex]?.[p.dataIndex]
        if (i != null) onZoom(snps[i]!.chr)
      },
    }),
    [layout, onZoom, snps],
  )

  return <EChart option={option} height={height} ariaLabel={ariaLabel} fallbackTable={fallbackTable} onEvents={onEvents} />
}
