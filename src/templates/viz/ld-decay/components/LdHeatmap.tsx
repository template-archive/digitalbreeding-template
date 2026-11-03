import { useMemo } from 'react'
import { EChart, selectionStroke, useChartTheme, type EChartsOption } from '@/charts'
import { formatNumber } from '@/lib/format'
import { PRESETS, QTL_HALF_KB, TRAIT_SHORT, blockSpanKb, type PresetView, type PresetWindow } from '../data'
import { hatchPattern } from '@/design-system'

// ECharts custom series renderItem API는 공개 타입이 없어 느슨하게 둔다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Api = any

/** 위치 트랙 높이(px). 삼각형은 그 아래에서 시작한다 */
export const TRACK_H = 112
const PAD = 10
const BOTTOM = 14
/** 트랙 세로 배치(차트 위쪽 기준 px) */
const Y = { label: 11, markTop: 17, axis: 33, tickLabel: 45, bracket: 60, gene: 73, connTop: 82 }
/**
 * 표시 깊이: 삼각형 위쪽 비율만 그린다(Haploview식 절단). 아래쪽 먼 거리 쌍은 옅은 색 면적만 차지해 셀이 작아졌다.
 * SNP 순서 간격이 전체의 이 비율 안인 쌍만 그린다
 */
export const DEPTH_RATIO = 0.6

/** 컨테이너 폭에 맞춘 차트 높이: 마름모가 정사각형(45° 회전)이 되도록 삼각형 높이 = 폭/2 */
export function heatmapHeight(width: number): number {
  const W = Math.max(300, width) - PAD * 2
  return Math.round(TRACK_H + (W / 2) * DEPTH_RATIO + BOTTOM)
}

interface Props {
  win: PresetWindow
  view: PresetView
  /** 툴팁 표기 예: '전체 412계통' */
  groupText: string
  width: number
  height: number
  ariaLabel: string
  fallbackTable: { columns: string[]; rows: (string | number)[][] }
}

/** Haploview형 LD 히트맵(상삼각 i < j 셀을 45° 회전한 마름모) + 물리 위치 트랙 + 블록 외곽선 */
export function LdHeatmap({ win, view, groupText, width, height, ariaLabel, fallbackTable }: Props) {
  const t = useChartTheme()
  const hatch = useMemo(() => hatchPattern(t), [t])

  const option = useMemo<EChartsOption>(() => {
    const { snps, lo, hi, leadIdx } = win
    const preset = PRESETS[win.pi]!
    const lead = preset.planted
    const n = snps.length
    const W = Math.max(300, width) - PAD * 2
    const { R, ok } = view
    const poly: number[][] = []
    const mono: number[][] = []
    const maxY = (n / 2) * DEPTH_RATIO
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        if ((j - i) / 2 > maxY) continue
        const cell = [(i + j) / 2, (j - i) / 2, R[i * n + j]!, i, j]
        if (ok[i] && ok[j]) poly.push(cell)
        else mono.push(cell)
      }

    const physX = (cs: { x: number; width: number }, bp: number) => cs.x + ((bp - lo) / (hi - lo)) * cs.width
    const font = (size: number, weight = 400, italic = false) => `${italic ? 'italic ' : ''}${weight} ${size}px ${t.fontFamily}`

    const diamond = (api: Api) => {
      const c = api.coord([api.value(0), api.value(1)]) as [number, number]
      const hw = (api.size([1, 0]) as number[])[0]! / 2
      const hh = (api.size([0, 1]) as number[])[1]! / 2
      return { points: [[c[0], c[1] - hh], [c[0] + hw, c[1]], [c[0], c[1] + hh], [c[0] - hw, c[1]]] }
    }

    const leadBlockIdx = view.leadBlock ? view.blocks.indexOf(view.leadBlock) : -1
    const ss = selectionStroke(t)
    const step = W >= 420 ? 0.2 : 0.4
    const ticks: number[] = []
    for (let v = Math.ceil(lo / 1e6 / step - 1e-9) * step; v <= hi / 1e6 + 1e-9; v += step) ticks.push(Number(v.toFixed(2)))

    return {
      animation: false,
      grid: { left: PAD, right: PAD, top: TRACK_H, height: (W / 2) * DEPTH_RATIO, containLabel: false },
      xAxis: { type: 'value', min: -0.5, max: n - 0.5, show: false },
      yAxis: { type: 'value', min: 0, max: maxY, inverse: true, show: false },
      visualMap: { show: false, type: 'continuous', min: 0, max: 1, dimension: 2, seriesIndex: 0, inRange: { color: t.sequential } },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (p: unknown) => {
          const q = p as { seriesName: string; value: number[] }
          const v = q.value
          if (q.seriesName === 'r²' || q.seriesName === '단형') {
            const a = snps[v[3]!]!
            const b = snps[v[4]!]!
            const d = ((b.bp - a.bp) / 1000).toFixed(1)
            return q.seriesName === 'r²'
              ? `${a.id} × ${b.id} · 거리 ${d} kb · r² ${v[2]!.toFixed(3)} · ${groupText}`
              : `${a.id} × ${b.id} · 거리 ${d} kb · 집단 내 MAF < 0.05(계산 안 함)`
          }
          if (q.seriesName === '리드') {
            const k = v[1]!
            const pl = k === 0 ? lead : preset.others[k - 1]!
            const s = snps[k === 0 ? leadIdx : win.otherIdx[k - 1]!]!
            const base = `${s.id} · ${pl.chr}:${formatNumber(pl.bp)} · ${TRAIT_SHORT[pl.trait]} −log10 p ${pl.logP.toFixed(1)}`
            if (k === 0) return lead.gene && lead.geneBp != null ? `${base} · ${lead.gene} ${(Math.abs(lead.geneBp - lead.bp) / 1000).toFixed(1)} kb` : base
            const r = view.otherR2[k - 1]
            return `${base} · 리드와 r² ${r == null ? '계산 안 함' : r.toFixed(2)}`
          }
          return ''
        },
      },
      series: [
        {
          name: 'r²',
          type: 'custom',
          data: poly,
          encode: { x: 0, y: 1 },
          renderItem: (_p: Api, api: Api) => {
            const color = api.visual('color') as string
            return {
              type: 'polygon',
              shape: diamond(api),
              style: { fill: color, stroke: color, lineWidth: 0.4 },
              emphasis: { style: { stroke: t.text, lineWidth: 1.2 } },
            }
          },
        },
        {
          name: '단형',
          type: 'custom',
          data: mono,
          encode: { x: 0, y: 1 },
          renderItem: (_p: Api, api: Api) => ({
            type: 'polygon',
            shape: diamond(api),
            style: { fill: hatch ? { image: hatch, repeat: 'repeat' } : t.surface2, stroke: t.surface, lineWidth: 0.3 },
          }),
        },
        {
          name: '블록',
          type: 'custom',
          silent: true,
          z: 4,
          data: view.blocks.map((b, k) => [b.from, b.to, k === leadBlockIdx ? 1 : 0, k]),
          encode: { x: [0, 1] },
          renderItem: (_p: Api, api: Api) => {
            const from = api.value(0) as number
            const to = api.value(1) as number
            const isLead = api.value(2) === 1
            const k = api.value(3) as number
            const a = api.coord([from - 0.5, 0]) as [number, number]
            const b = api.coord([to + 0.5, 0]) as [number, number]
            const apex = api.coord([(from + to) / 2, (to - from) / 2 + 0.5]) as [number, number]
            const shape = { points: [a, b, apex] }
            // 리드 블록 = 데이터 위 선택 규격(표면색 후광 → 글자색 선), 다른 블록 = 구조선(muted). 강조색은 히트맵 파랑에 묻힌다
            const children: unknown[] = isLead
              ? [
                  { type: 'polygon', shape, style: { fill: 'none', stroke: ss.haloColor, lineWidth: ss.haloWidth, lineJoin: 'round' }, z2: 2 },
                  { type: 'polygon', shape, style: { fill: 'none', stroke: ss.lineColor, lineWidth: ss.lineWidth, lineJoin: 'round' }, z2: 3 },
                ]
              : [{ type: 'polygon', shape, style: { fill: 'none', stroke: t.textMuted, lineWidth: 1.5, lineJoin: 'round' }, z2: 1 }]
            // 라벨은 셀 위에 얹지 않고 삼각형 위 연결선 띠에 둔다. 리드 라벨 폭 안의 다른 블록 번호는 생략
            const blk = view.blocks[k]!
            const center = (a[0] + b[0]) / 2
            const leadBlk = leadBlockIdx >= 0 ? view.blocks[leadBlockIdx]! : null
            const leadCx = leadBlk ? ((api.coord([leadBlk.from - 0.5, 0]) as number[])[0]! + (api.coord([leadBlk.to + 0.5, 0]) as number[])[0]!) / 2 : null
            const text = isLead ? `B${k + 1} · 리드 블록 ${blockSpanKb(win, blk).toFixed(1)} kb` : `B${k + 1}`
            const clash = !isLead && leadCx !== null && Math.abs(center - leadCx) < 80
            if (isLead || (b[0] - a[0] >= 26 && !clash))
              children.push({
                type: 'text',
                z2: 4,
                style: {
                  text,
                  x: center,
                  y: a[1] - 3,
                  align: 'center',
                  verticalAlign: 'bottom',
                  font: font(11, isLead ? 700 : 500),
                  fill: isLead ? t.text : t.textMuted,
                  backgroundColor: t.surface,
                  padding: [0, 3],
                  borderRadius: 2,
                },
              })
            return { type: 'group', children }
          },
        },
        {
          name: '연결선',
          type: 'custom',
          silent: true,
          data: snps.map((s, i) => [i, s.bp, i === leadIdx ? 1 : 0, ok[i] ? 1 : 0]),
          encode: { x: 0 },
          renderItem: (p: Api, api: Api) => {
            const cs = p.coordSys as { x: number; y: number; width: number }
            const i = api.value(0) as number
            const isLead = api.value(2) === 1
            const px = physX(cs, api.value(1) as number)
            const ix = (api.coord([i, 0]) as [number, number])[0]
            const style = isLead ? { stroke: t.accent, lineWidth: 1.6, opacity: 1 } : { stroke: t.textMuted, lineWidth: 0.6, opacity: api.value(3) === 1 ? 0.45 : 0.2 }
            return {
              type: 'group',
              children: [
                { type: 'line', shape: { x1: px, y1: Y.axis, x2: px, y2: Y.axis + 4 }, style: { ...style, opacity: isLead ? 1 : 0.7 } },
                { type: 'line', shape: { x1: px, y1: Y.connTop, x2: ix, y2: cs.y - 2 }, style, z2: isLead ? 2 : 0 },
              ],
            }
          },
        },
        {
          name: '위치 축',
          type: 'custom',
          silent: true,
          data: [[0]],
          encode: { x: 0 },
          renderItem: (p: Api) => {
            const cs = p.coordSys as { x: number; y: number; width: number }
            const children: unknown[] = [
              { type: 'line', shape: { x1: cs.x, y1: Y.axis, x2: cs.x + cs.width, y2: Y.axis }, style: { stroke: t.textMuted, lineWidth: 1 } },
            ]
            ticks.forEach((v, k) => {
              const x = physX(cs, v * 1e6)
              children.push({ type: 'line', shape: { x1: x, y1: Y.axis, x2: x, y2: Y.axis - 4 }, style: { stroke: t.textMuted, lineWidth: 1 } })
              const align = x < cs.x + 20 ? 'left' : x > cs.x + cs.width - 20 ? 'right' : 'center'
              children.push({
                type: 'text',
                style: { text: k === ticks.length - 1 ? `${v.toFixed(1)} Mb` : v.toFixed(1), x, y: Y.tickLabel, align, verticalAlign: 'middle', font: font(11), fill: t.textMuted },
              })
            })
            // GWAS 결과 뷰어 QTL 구간(리드 ± 200 kb) 괄호
            const qa = physX(cs, Math.max(lo, lead.bp - QTL_HALF_KB * 1000))
            const qb = physX(cs, Math.min(hi, lead.bp + QTL_HALF_KB * 1000))
            const br = { stroke: t.textMuted, lineWidth: 1.2 }
            children.push(
              { type: 'line', shape: { x1: qa, y1: Y.bracket, x2: qb, y2: Y.bracket }, style: br },
              { type: 'line', shape: { x1: qa, y1: Y.bracket - 4, x2: qa, y2: Y.bracket }, style: br },
              { type: 'line', shape: { x1: qb, y1: Y.bracket - 4, x2: qb, y2: Y.bracket }, style: br },
              {
                type: 'text',
                style: { text: `QTL 구간 ±${QTL_HALF_KB} kb`, x: qa - 5, y: Y.bracket, align: 'right', verticalAlign: 'middle', font: font(11), fill: t.textMuted },
              },
            )
            // 후보 유전자 눈금
            if (lead.gene && lead.geneBp != null && lead.geneBp >= lo && lead.geneBp <= hi) {
              const gx = physX(cs, lead.geneBp)
              children.push(
                { type: 'line', shape: { x1: gx, y1: Y.bracket - 6, x2: gx, y2: Y.bracket + 5 }, style: { stroke: t.text, lineWidth: 2 } },
                { type: 'text', style: { text: lead.gene, x: gx, y: Y.gene, align: 'center', verticalAlign: 'middle', font: font(11, 700, true), fill: t.text } },
              )
            }
            // 리드 SNP 라벨
            const lx = physX(cs, lead.bp)
            const lAlign = lx < cs.x + 110 ? 'left' : lx > cs.x + cs.width - 110 ? 'right' : 'center'
            children.push({
              type: 'text',
              style: {
                text: `${snps[leadIdx]!.id} (−log10 p ${lead.logP.toFixed(1)})`,
                x: lAlign === 'left' ? lx - 6 : lAlign === 'right' ? lx + 6 : lx,
                y: Y.label,
                align: lAlign,
                verticalAlign: 'middle',
                font: font(11, 700),
                fill: t.accent,
              },
            })
            // 리드의 삼각형 위 위치
            const ix = (p.coordSys.x as number) + ((leadIdx + 0.5) / n) * cs.width
            children.push({ type: 'circle', shape: { cx: ix, cy: cs.y - 2, r: 2.5 }, style: { fill: t.accent } })
            return { type: 'group', children }
          },
        },
        {
          name: '리드',
          type: 'custom',
          z: 5,
          data: [[0, 0, lead.bp], ...preset.others.map((o, k) => [0, k + 1, o.bp])],
          encode: { x: 0 },
          renderItem: (p: Api, api: Api) => {
            const cs = p.coordSys as { x: number; width: number }
            const x = physX(cs, api.value(2) as number)
            const main = api.value(1) === 0
            const s = main ? 6 : 4.5
            const top = main ? Y.markTop : Y.markTop + 4
            return {
              type: 'polygon',
              shape: { points: [[x - s, top], [x + s, top], [x, Y.axis - 1]] },
              style: main ? { fill: t.accent, stroke: t.surface, lineWidth: 1 } : { fill: t.surface, stroke: t.text, lineWidth: 1.4 },
            }
          },
        },
      ],
    } as EChartsOption
  }, [win, view, width, t, hatch, groupText])

  return <EChart option={option} height={height} ariaLabel={ariaLabel} fallbackTable={fallbackTable} />
}
