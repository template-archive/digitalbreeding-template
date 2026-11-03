import { useEffect, type RefObject } from 'react'
import { cn } from '@/design-system'
import { formatSigned } from '@/lib/format'
import type { Loop } from '../data'

/** 루프 색(4개). 1번 범주색은 품종 노드의 accent와 겹쳐 건너뛴다. 5번째부터는 번호 배지만 */
const LOOP_VARS = ['var(--viz-cat-2)', 'var(--viz-cat-3)', 'var(--viz-cat-4)', 'var(--viz-cat-7)']
export const loopColor = (i: number) => (i < LOOP_VARS.length ? LOOP_VARS[i]! : 'var(--color-muted)')

/**
 * 루프 번호 모양은 하나다: 표면색 원 + 루프 색 테두리 + 잉크 숫자. 계통도 노드(SVG)·범례·표·세로 목록이 모두 같다.
 * 색 채움 + 흰 숫자는 cat-2 3.0:1, cat-3 4.1:1로 작은 숫자 대비 4.5:1에 못 미친다.
 */
export function LoopBadge({ i, color, className }: { i: number; color?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex size-[19px] shrink-0 items-center justify-center rounded-full border-2 bg-surface text-[11px] font-extrabold leading-none text-text tabular-nums', className)}
      style={{ borderColor: color ?? loopColor(i) }}
    >
      {i + 1}
    </span>
  )
}

/** 강조 중인 루프의 경로쌍(인스턴스 키 = 그 인스턴스로 들어오는 간선). 없으면 null */
export function activePaths(loops: Loop[], activeLoop: number | null): Set<string> | null {
  if (activeLoop === null || !loops[activeLoop]) return null
  const s = new Set<string>([''])
  for (const p of loops[activeLoop]!.pairs) for (const k of [...p.keysA, ...p.keysB]) s.add(k)
  return s
}

/** 390px: 표에서 루프 번호를 누르면 그 공통 조상 노드로 스크롤한다(표와 계통도가 한 화면에 없다). 표시 세대가 바뀐 뒤에도 다시 찾는다 */
export function useScrollToLoop(ref: RefObject<HTMLElement | null>, loop: number | null, depth: number) {
  useEffect(() => {
    if (loop === null) return
    const el = ref.current?.querySelector(`[data-loop-end="${loop}"]`)
    if (!el) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: still ? 'auto' : 'smooth' })
  }, [ref, loop, depth])
}

export const fmtF = (v: number, digits = 2) => v.toFixed(digits)
export const fmtGebv = (v: number) => formatSigned(v, 1)
