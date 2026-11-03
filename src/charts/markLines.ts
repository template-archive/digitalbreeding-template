// markLine 데이터 항목 프리셋: 라벨 붙은 수평 기준선, 수직 사건선, 'GS 도입' 선.
// series.markLine.data 배열에 넣는다(markLine 자체의 symbol: 'none', silent: true는 호출부가 둔다).
// 템플릿마다 같은 객체(선 굵기 1.5, 라벨 11px)를 손으로 다시 쓰던 것을 모았다.
import type { ChartTheme } from './theme'

export type MarkLineStroke = 'solid' | 'dashed' | 'dotted'
export type MarkLineLabelPosition =
  | 'start'
  | 'middle'
  | 'end'
  | 'insideStartTop'
  | 'insideStartBottom'
  | 'insideMiddleTop'
  | 'insideMiddleBottom'
  | 'insideEndTop'
  | 'insideEndBottom'

export interface RefLineOptions {
  /** 선 모양. 기본 'solid' */
  line?: MarkLineStroke
  /** 선 굵기(px). 기본 1.5 */
  width?: number
  /** 라벨 위치. 기본: 수평선 'insideEndTop', 수직선 'end' */
  position?: MarkLineLabelPosition
  /** 라벨 굵기. 기본 600 */
  fontWeight?: number | 'normal' | 'bold'
  /** 라벨 색. 기본은 선 색과 같다 */
  labelColor?: string
}

export interface MarkLineItem {
  xAxis?: number | string
  yAxis?: number | string
  lineStyle: { color: string; type: MarkLineStroke; width: number }
  label:
    | { show: false }
    | { formatter: string; position: MarkLineLabelPosition; color: string; fontSize: number; fontWeight: number | 'normal' | 'bold' }
}

function item(axis: 'xAxis' | 'yAxis', value: number | string, label: string | null, color: string, o: RefLineOptions, defPos: MarkLineLabelPosition): MarkLineItem {
  return {
    [axis]: value,
    lineStyle: { color, type: o.line ?? 'solid', width: o.width ?? 1.5 },
    label:
      label === null
        ? { show: false }
        : { formatter: label, position: o.position ?? defPos, color: o.labelColor ?? color, fontSize: 11, fontWeight: o.fontWeight ?? 600 },
  }
}

/** 수평 기준선(y = value). label이 null이면 라벨 없이 선만 그린다 */
export function hMarkLine(y: number | string, label: string | null, color: string, opts: RefLineOptions = {}): MarkLineItem {
  return item('yAxis', y, label, color, opts, 'insideEndTop')
}

/** 수직선(x = value, 범주 축이면 범주 인덱스). label이 null이면 라벨 없이 선만 그린다 */
export function vMarkLine(x: number | string, label: string | null, color: string, opts: RefLineOptions = {}): MarkLineItem {
  return item('xAxis', x, label, color, opts, 'end')
}

/** 'GS 도입' 수직선: accent 색, 점선, 굵은 라벨을 선 끝(위)에 둔다. x는 범주 인덱스 또는 값 */
export function gsIntroLine(theme: ChartTheme, x: number | string, opts: RefLineOptions = {}): MarkLineItem {
  return vMarkLine(x, 'GS 도입', theme.accent, { line: 'dashed', fontWeight: 700, ...opts })
}
