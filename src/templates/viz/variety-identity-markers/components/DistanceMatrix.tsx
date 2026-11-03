/**
 * D. 구별 마커 수 행렬(10 × 10, 대칭, 대각 "—").
 * 순차 단색 척도(값이 클수록 진함) + 셀 숫자. d < 2 = 빗금 + 경고 테두리, d = 2 = 점선 테두리(색 없이도 구분).
 * 가로 축은 1~10 번호, 세로 축은 "번호 짧은 이름". 역할 그룹 경계선.
 */
import { useMemo } from 'react'
import { EChart, selectionStroke, useChartTheme, type EChartsOption } from '@/charts'
import { hatchPattern } from '@/design-system'
import { DISTINCT_MIN, D_ID_MATRIX, D_MATRIX, MARKERS, ID_IDX, N, N_ID, N_MARKERS, PROFILES, diffMarkers, label } from '../data'

interface Props {
  width: number
  idOnly: boolean
  a: number
  b: number
  onSelect: (i: number, j: number) => void
}

/** 세로 축 라벨 폭: 넓은 화면은 계통명을 그대로, 좁은 화면만 줄인 이름 */
const LABEL_W_NARROW = 84
const LABEL_W_WIDE = 112
const FULL_LABEL_MIN = 520
const TOP = 26
const PAD_R = 8

/** 역할 그룹 경계(그 행 앞에 선) */
const CUTS = PROFILES.filter(p => p.idx > 0 && PROFILES[p.idx - 1]!.role !== p.role).map(p => p.idx)

export function matrixLayout(width: number) {
  const full = width >= FULL_LABEL_MIN
  const labelW = full ? LABEL_W_WIDE : LABEL_W_NARROW
  const cell = Math.max(20, Math.min(46, Math.floor((width - labelW - PAD_R) / N)))
  const side = cell * N
  return { full, labelW, cell, side, chartW: labelW + side + PAD_R, chartH: TOP + side + 8 }
}

export function DistanceMatrix({ width, idOnly, a, b, onSelect }: Props) {
  const t = useChartTheme()
  const hatch = useMemo(() => hatchPattern(t), [t])
  const L = matrixLayout(width)
  const M = idOnly ? D_ID_MATRIX : D_MATRIX
  const max = idOnly ? N_ID : 11

  const option = useMemo<EChartsOption>(() => {
    const heat: number[][] = []
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (r !== c) heat.push([c, r, M[r]![c]!])
    const fontSize = L.cell >= 34 ? 13 : 11
    return {
      animation: false,
      grid: { left: L.labelW, top: TOP, width: L.side, height: L.side, containLabel: false },
      xAxis: {
        type: 'category',
        data: PROFILES.map(p => String(p.idx + 1)),
        position: 'top',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { interval: 0, fontSize: 11, color: t.textMuted, margin: 6 },
      },
      yAxis: {
        type: 'category',
        data: PROFILES.map(p => `${p.idx + 1}  ${L.full ? label(p) : p.short}`),
        inverse: true,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { interval: 0, fontSize: 11, color: t.text, margin: 6 },
      },
      visualMap: { type: 'continuous', min: 0, max, dimension: 2, seriesIndex: 0, show: false, inRange: { color: t.sequential } },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (p: unknown) => {
          const q = p as { seriesName?: string; value?: number[] }
          if (!q.value) return ''
          const [c, r] = q.value as [number, number]
          if (r === c) return `<b>${PROFILES[r]!.name}</b> · 자기 자신`
          const ga = PROFILES[r]!.geno
          const gb = PROFILES[c]!.geno
          const ms = idOnly ? diffMarkers(ga, gb, ID_IDX) : diffMarkers(ga, gb)
          const d = M[r]![c]!
          const verdict = d < DISTINCT_MIN ? '식별 곤란' : d === DISTINCT_MIN ? '식별 가능(최소)' : '식별 가능'
          return `<b>${label(PROFILES[r]!)} ↔ ${label(PROFILES[c]!)}</b><br/>구별 마커 ${d}개(${idOnly ? `ID ${N_ID}` : N_MARKERS}마커 중) · ${verdict}<br/><span style="color:${t.textMuted}">${ms.join(' · ') || '다른 마커 없음'}</span>`
        },
      },
      series: [
        {
          name: 'd',
          type: 'heatmap',
          data: heat,
          itemStyle: { borderColor: t.surface, borderWidth: 1 },
          emphasis: { itemStyle: { borderColor: t.text, borderWidth: 1.5 } },
          cursor: 'pointer',
          progressive: 0,
        },
        {
          // 대각·기준 표시·숫자
          name: 'overlay',
          type: 'custom',
          data: Array.from({ length: N * N }, (_, k) => [k % N, Math.floor(k / N)]),
          z: 3,
          cursor: 'pointer',
          renderItem: (_p, api) => {
            const c = api.value(0) as number
            const r = api.value(1) as number
            const [cx, cy] = api.coord([c, r]) as [number, number]
            const s = L.cell
            const x = cx - s / 2
            const y = cy - s / 2
            if (r === c)
              return {
                type: 'group',
                children: [
                  { type: 'rect', shape: { x: x + 0.5, y: y + 0.5, width: s - 1, height: s - 1 }, style: { fill: t.surface2 } },
                  { type: 'text', style: { x: cx, y: cy, text: '—', fill: t.textMuted, fontSize, align: 'center', verticalAlign: 'middle' } },
                ],
              }
            const d = M[r]![c]!
            const children: unknown[] = []
            if (d < DISTINCT_MIN) {
              children.push({ type: 'rect', shape: { x: x + 1, y: y + 1, width: s - 2, height: s - 2 }, style: { fill: hatch ? { image: hatch, repeat: 'repeat' } : t.surface2, stroke: t.warning, lineWidth: 2.5 } })
            } else if (d === DISTINCT_MIN) {
              children.push({ type: 'rect', shape: { x: x + 2, y: y + 2, width: s - 4, height: s - 4 }, style: { fill: 'transparent', stroke: t.text, lineWidth: 1.5, lineDash: [3, 2] } })
            }
            const strong = d / max > 0.5 && d >= DISTINCT_MIN
            children.push({
              type: 'text',
              style: {
                x: cx,
                y: cy,
                text: String(d),
                fill: strong ? t.surface : t.text,
                fontSize,
                fontWeight: d <= DISTINCT_MIN ? 700 : 500,
                align: 'center',
                verticalAlign: 'middle',
                ...(d < DISTINCT_MIN ? { backgroundColor: t.surface, padding: [1, 3], borderRadius: 2 } : {}),
              },
            })
            return { type: 'group', children } as never
          },
          tooltip: { show: true },
        },
        {
          name: 'groups',
          type: 'custom',
          data: [[0, 0]],
          silent: true,
          clip: false,
          z: 4,
          tooltip: { show: false },
          renderItem: () => ({
            type: 'group',
            children: CUTS.flatMap(k => {
              const v = TOP + k * L.cell
              const h = L.labelW + k * L.cell
              const style = { stroke: t.text, lineWidth: 1.25, opacity: 0.55 }
              return [
                { type: 'line' as const, shape: { x1: 4, y1: v, x2: L.labelW + L.side, y2: v }, style },
                { type: 'line' as const, shape: { x1: h, y1: TOP - 4, x2: h, y2: TOP + L.side }, style },
              ]
            }),
          }),
        },
        {
          name: 'sel',
          type: 'custom',
          data: [
            [b, a],
            [a, b],
          ],
          silent: true,
          z: 5,
          tooltip: { show: false },
          renderItem: (_p, api) => {
            const [cx, cy] = api.coord([api.value(0), api.value(1)]) as [number, number]
            const s = L.cell
            const shape = { x: cx - s / 2 - 1, y: cy - s / 2 - 1, width: s + 2, height: s + 2 }
            // 데이터 위 선택 = 표면색 후광 → 글자색 선(selectionStroke). 강조색은 순차 척도(파랑)에 묻힌다
            const ss = selectionStroke(t)
            return {
              type: 'group',
              children: [
                { type: 'rect', shape, style: { fill: 'transparent', stroke: ss.haloColor, lineWidth: ss.haloWidth } },
                { type: 'rect', shape, style: { fill: 'transparent', stroke: ss.lineColor, lineWidth: ss.lineWidth } },
              ],
            }
          },
        },
      ],
    }
  }, [t, hatch, L.cell, L.side, L.labelW, L.full, M, max, idOnly, a, b])

  const onEvents = useMemo(
    () => ({
      click: (raw: unknown) => {
        const p = raw as { seriesName?: string; value?: number[] }
        if ((p.seriesName === 'd' || p.seriesName === 'overlay') && p.value) {
          const [c, r] = p.value as [number, number]
          if (r !== c) onSelect(r, c)
        }
      },
    }),
    [onSelect],
  )

  const hard = []
  for (let r = 0; r < N; r++) for (let c = r + 1; c < N; c++) if (M[r]![c]! < DISTINCT_MIN) hard.push(`${label(PROFILES[r]!)} ↔ ${label(PROFILES[c]!)} ${M[r]![c]}개`)
  const ariaLabel = idOnly
    ? `ID 마커 ${N_ID}개만 쓴 구별 마커 수 행렬. 식별 곤란(구별 마커 ${DISTINCT_MIN}개 미만) ${hard.length}쌍: ${hard.join(', ')}.`
    : `KASP ${MARKERS.length}마커 구별 마커 수 행렬 10 × 10. 식별 곤란 ${hard.length}쌍: ${hard.join(', ')}. 나머지 쌍은 ${DISTINCT_MIN}개 이상으로 식별 가능.`

  return (
    <div style={{ width: L.chartW, maxWidth: '100%' }}>
      <EChart
        option={option}
        height={L.chartH}
        ariaLabel={ariaLabel}
        onEvents={onEvents}
        fallbackTable={{ columns: ['품종·계통', ...PROFILES.map(p => label(p))], rows: PROFILES.map((p, r) => [label(p), ...PROFILES.map((_, c) => (r === c ? '—' : M[r]![c]!))]) }}
      />
    </div>
  )
}
