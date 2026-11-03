import { useMemo, useRef } from 'react'
import { cn } from '@/design-system'
import { KIND_LABEL, NODES, YEAR_LABEL, instances, label, loopEndKeys, type Depth, type Instance, type Loop } from '../data'
import { LoopBadge, activePaths, useScrollToLoop } from './style'

interface Props {
  root: string
  depth: Depth
  loops: Loop[]
  highlight: boolean
  activeLoop: number | null
  scrollLoop: number | null
  selectedId: string | null
  onSelect: (id: string, el: Element) => void
}

/** 390px 대체 보기: 세로 들여쓰기 목록(모본 먼저 깊이 우선). 넓은 세대(4·5)도 가로 스크롤 없이 읽는다. 행 높이 44px */
export function PedigreeList({ root, depth, loops, highlight, activeLoop, scrollLoop, selectedId, onSelect }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  useScrollToLoop(boxRef, scrollLoop, depth)

  const { rows, counts } = useMemo(() => {
    const { out } = instances(root, depth)
    const rows: Instance[] = [{ id: root, g: 0, path: '', truncated: false, y: 0 }, ...out]
    const counts = new Map<string, number>()
    for (const i of out) counts.set(i.id, (counts.get(i.id) ?? 0) + 1)
    return { rows, counts }
  }, [root, depth])
  const loopIndex = useMemo(() => loopEndKeys(loops), [loops])
  const active = useMemo(() => activePaths(loops, activeLoop), [activeLoop, loops])

  return (
    <div ref={boxRef} data-pedigree-list="true">
      <ul aria-label={`${label(root)} 세로 계통 목록, ${depth}세대까지`}>
        {rows.map(n => {
          const p = NODES[n.id]!
          const li = highlight ? loopIndex.get(n.path) : undefined
          const cnt = counts.get(n.id) ?? 0
          const sel = selectedId === n.id
          const on = active?.has(n.path) && n.g > 0
          const isDam = n.path.endsWith('D')
          return (
            <li key={`l${n.path}`}>
              <button
                type="button"
                aria-pressed={sel}
                data-loop-end={li}
                onClick={e => onSelect(n.id, e.currentTarget)}
                className={cn('flex min-h-11 w-full items-center gap-2 border-b border-border/70 py-1 pr-1 text-left', on && 'bg-surface-2', sel && 'select-ring rounded-sm')}
                style={{ paddingLeft: 2 + n.g * 13 }}
              >
                <span className="w-3 shrink-0 text-center text-xs font-bold text-muted">
                  {n.g === 0 ? '' : isDam ? '♀' : '♂'}
                  {n.g > 0 && <span className="sr-only">{isDam ? '모본' : '부본'}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-text">{label(n.id)}</span>
                  <span className="block truncate text-xs text-muted tabular-nums">
                    {n.g === 0 ? '기준 계통' : `${n.g}세대`} · {KIND_LABEL[p.kind]} · {YEAR_LABEL[p.kind]} {p.year}
                  </span>
                </span>
                {cnt > 1 && <span className="shrink-0 text-xs font-bold text-muted tabular-nums">×{cnt}</span>}
                {n.truncated && <span className="shrink-0 text-xs font-bold text-accent">＋상위</span>}
                {li !== undefined && <LoopBadge i={li} />}
                {li !== undefined && <span className="sr-only">근연 루프 {li + 1}의 공통 조상</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
