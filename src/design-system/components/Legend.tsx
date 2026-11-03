import { cn } from './cn'
import { HATCH_MISSING_DENSE, stripeBg } from '../patterns'

/**
 * 범례 견본 모양. 차트 마크와 같은 모양을 고른다(산점도 원·빈 원, 리드 SNP 다이아몬드, 위반 삼각형, 빗금 막대).
 * - square(기본): 채운 사각. `color`에 CSS 배경 값(gradient 등)도 받는다(기존 호환)
 * - line·dashed: 기준선·임계선
 * - circle·ring·diamond·triangle: 점 마크(채움·빈 원·다이아몬드·삼각형). ring은 `color` 1.5px 테두리 + 표면색 속
 * - diamond-open·plus: 빈 다이아몬드(목표 표식)·더하기(보조 표식). 2026-11-02
 * - hatch: `color` 바탕 + 표면색 사선(stripeBg·stripeDecal과 같은 모양 — 계획·예정·같은 계열의 두 번째 구성)
 * - missing: 결측·대기 회색 빗금(HATCH_MISSING 계열, `color`는 무시). 2026-10-30
 */
export type LegendShape = 'square' | 'line' | 'dashed' | 'circle' | 'ring' | 'diamond' | 'diamond-open' | 'plus' | 'triangle' | 'hatch' | 'missing'

export interface LegendItem {
  label: string
  color: string
  /** 기본 사각. 기준선·임계선은 'line' 또는 'dashed', 점 마크는 'circle'·'ring'·'diamond'·'triangle', 빗금은 'hatch'·'missing' */
  shape?: LegendShape
}

function Swatch({ color, shape = 'square' }: { color: string; shape?: LegendShape }) {
  switch (shape) {
    case 'line':
    case 'dashed':
      return <span aria-hidden="true" className="inline-block w-4 border-t-2" style={{ borderColor: color, borderTopStyle: shape === 'dashed' ? 'dashed' : 'solid' }} />
    case 'circle':
      return <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: color }} />
    case 'ring':
      return <span aria-hidden="true" className="inline-block size-2.5 rounded-full border-[1.5px] bg-surface" style={{ borderColor: color }} />
    case 'diamond':
      // 회전한 사각(대각선 약 11px) — 산점 다이아몬드 마크와 같은 모양
      return (
        <span aria-hidden="true" className="inline-flex size-3 items-center justify-center">
          <span className="block size-2 rotate-45 rounded-[1px]" style={{ background: color }} />
        </span>
      )
    case 'diamond-open':
      return (
        <span aria-hidden="true" className="inline-flex size-3 items-center justify-center">
          <span className="block size-2 rotate-45 rounded-[1px] border-[1.5px] bg-surface" style={{ borderColor: color }} />
        </span>
      )
    case 'plus':
      return (
        <svg aria-hidden="true" width="11" height="11" viewBox="0 0 11 11" className="inline-block shrink-0">
          <path d="M5.5 1v9M1 5.5h9" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      )
    case 'triangle':
      return (
        <svg aria-hidden="true" width="12" height="11" viewBox="0 0 12 11" className="inline-block shrink-0">
          <path d="M6 0.5 11.5 10.5H0.5Z" fill={color} />
        </svg>
      )
    case 'hatch':
      return <span aria-hidden="true" className="inline-block size-3 rounded-[2px]" style={{ background: stripeBg(color) }} />
    case 'missing':
      return <span aria-hidden="true" className="inline-block size-3 rounded-[2px] border border-border" style={{ background: HATCH_MISSING_DENSE }} />
    default:
      return <span aria-hidden="true" className="inline-block size-2.5 rounded-[2px]" style={{ background: color }} />
  }
}

export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted', className)}>
      {items.map(it => (
        <li key={it.label} className="inline-flex items-center gap-1.5">
          <Swatch color={it.color} shape={it.shape} />
          <span>{it.label}</span>
        </li>
      ))}
    </ul>
  )
}
