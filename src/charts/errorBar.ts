/**
 * 범주 축 막대 + 오차 막대(±SD·신뢰구간) custom 시리즈 빌더.
 * - 묶음 막대: 모델·환경마다 시리즈를 하나씩 만들고 `group: { index: j, count: k }`를 준다(범주 폭의 80%를 k칸으로 나눔)
 * - 오차 막대만: `bar: false`. 막대는 일반 bar 시리즈로 그리고(라벨 등) 이 시리즈를 위에 겹친다
 * - 세로(기본)·가로(`horizontal`, yAxis가 범주) 모두 지원. 표식(예: 권장 ★)은 오차 막대 끝 바깥에 붙는다
 *
 * 데이터 행은 `[index, value, lo, hi, marker(0|1), ...extra]`이다. 툴팁 formatter·클릭의 `params.value`가 이 배열이다.
 * 축 범위·툴팁·배경 강조는 템플릿이 정한다.
 */
import type { EChartsOption } from 'echarts'

type SeriesOption = Extract<NonNullable<EChartsOption['series']>, unknown[]>[number]

export interface ErrorBarDatum {
  /** 범주 인덱스 */
  index: number
  /** 막대 끝 값(`bar: false`면 생략 가능, 행에는 hi가 들어간다) */
  value?: number
  /** 오차 막대 아래·위 끝(호출부가 축 범위로 잘라서 넘긴다) */
  lo: number
  hi: number
  /** true면 `marker`를 그린다 */
  marker?: boolean
  /** 행 끝에 붙일 값(params.value[5..]) */
  extra?: (number | string)[]
}

export interface ErrorBarSeriesOptions {
  name: string
  data: readonly ErrorBarDatum[]
  /** true면 범주 축이 y(가로 막대) */
  horizontal?: boolean
  /** 막대 모양. false면 오차 막대만 그린다. radius는 끝쪽 두 모서리(기본 2) */
  bar?: { color: string; opacity?: number; radius?: number } | false
  /** 묶음 위치. 기본 { index: 0, count: 1, width: 0.8 }(범주 폭 대비 묶음 폭) */
  group?: { index: number; count: number; width?: number }
  /** 오차 막대 선. cap은 끝 가로선 반길이(px). 기본 min(5, 막대 폭 × 0.35), lineWidth 기본 1.3 */
  error: { color: string; lineWidth?: number; cap?: number | ((barWidth: number) => number) }
  /** datum.marker가 true인 항목에 붙일 글자 표식 */
  marker?: { text: string; color: string; fontSize?: number }
  /** custom 시리즈의 나머지 옵션(z, silent, tooltip 등) */
  series?: Record<string, unknown>
}

interface RenderApi {
  value: (dim: number) => number
  coord: (v: number[]) => number[]
  size: (v: number[]) => number[]
}

/** 막대 + 오차 막대 시리즈. 반환값을 option.series 배열에 넣는다 */
export function errorBarSeries(opts: ErrorBarSeriesOptions): SeriesOption {
  const { name, data, horizontal = false, bar, group, error, marker, series } = opts
  const gIndex = group?.index ?? 0
  const gCount = group?.count ?? 1
  const gWidth = group?.width ?? 0.8
  const lineWidth = error.lineWidth ?? 1.3
  const capOf = typeof error.cap === 'function' ? error.cap : typeof error.cap === 'number' ? (() => error.cap as number) : (w: number) => Math.min(5, w * 0.35)

  const renderItem = (_params: unknown, api: RenderApi) => {
    const idx = api.value(0)
    const v = api.value(1)
    const lo = api.value(2)
    const hi = api.value(3)
    const showMarker = api.value(4) === 1
    const coord = (val: number) => api.coord(horizontal ? [val, idx] : [idx, val]) as [number, number]
    const band = horizontal ? api.size([0, 1])[1]! : api.size([1, 0])[0]!
    const groupW = band * gWidth
    const slot = groupW / gCount
    const barW = Math.max(2, slot - Math.min(3, slot * 0.18))
    const off = -groupW / 2 + slot * (gIndex + 0.5)
    const base = coord(0)
    const top = coord(v)
    const pLo = coord(lo)
    const pHi = coord(hi)
    const cap = capOf(barW)
    const err = { stroke: error.color, lineWidth }
    const r = bar ? (bar.radius ?? 2) : 0
    const children: unknown[] = []
    if (horizontal) {
      const cy = base[1] + off
      if (bar) children.push({ type: 'rect', shape: { x: base[0], y: cy - barW / 2, width: top[0] - base[0], height: barW, r: [0, r, r, 0] }, style: { fill: bar.color, opacity: bar.opacity ?? 1 } })
      children.push({ type: 'line', shape: { x1: pLo[0], y1: cy, x2: pHi[0], y2: cy }, style: err })
      children.push({ type: 'line', shape: { x1: pLo[0], y1: cy - cap, x2: pLo[0], y2: cy + cap }, style: err })
      children.push({ type: 'line', shape: { x1: pHi[0], y1: cy - cap, x2: pHi[0], y2: cy + cap }, style: err })
      if (showMarker && marker)
        children.push({ type: 'text', style: { x: pHi[0] + 4, y: cy, text: marker.text, fill: marker.color, fontSize: marker.fontSize ?? 11, verticalAlign: 'middle', align: 'left' } })
    } else {
      const cx = base[0] + off
      if (bar) children.push({ type: 'rect', shape: { x: cx - barW / 2, y: top[1], width: barW, height: base[1] - top[1], r: [r, r, 0, 0] }, style: { fill: bar.color, opacity: bar.opacity ?? 1 } })
      children.push({ type: 'line', shape: { x1: cx, y1: pLo[1], x2: cx, y2: pHi[1] }, style: err })
      children.push({ type: 'line', shape: { x1: cx - cap, y1: pLo[1], x2: cx + cap, y2: pLo[1] }, style: err })
      children.push({ type: 'line', shape: { x1: cx - cap, y1: pHi[1], x2: cx + cap, y2: pHi[1] }, style: err })
      if (showMarker && marker)
        children.push({ type: 'text', style: { x: cx, y: pHi[1] - 3, text: marker.text, fill: marker.color, fontSize: marker.fontSize ?? 11, align: 'center', verticalAlign: 'bottom' } })
    }
    return { type: 'group', children }
  }

  return {
    name,
    type: 'custom',
    encode: horizontal ? { y: 0, x: 1 } : { x: 0, y: 1 },
    data: data.map(d => [d.index, d.value ?? d.hi, d.lo, d.hi, d.marker ? 1 : 0, ...(d.extra ?? [])]),
    renderItem,
    ...series,
  } as SeriesOption
}
