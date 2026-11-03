import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatPercent } from '@/lib/format'
import { KIND_LABEL, NODES, label, type Contribution } from '../data'

const TICKS = [0, 25, 50, 75, 100]

function Bar({ c, strong }: { c: Contribution; strong: boolean }) {
  const p = NODES[c.id]!
  return (
    <li className="grid grid-cols-[7.5rem_1fr] items-center gap-2">
      <span className="min-w-0 truncate text-[13px] text-text" title={`${p.id} · ${KIND_LABEL[p.kind]}`}>
        <span className="font-semibold">{label(c.id)}</span>
        {p.name && <span className="ml-1 text-[11px] text-muted">{p.id}</span>}
      </span>
      <span className="relative flex h-5 items-center">
        <span className={`h-full rounded-r-sm ${strong ? 'bg-accent' : 'bg-accent/45'}`} style={{ width: `calc((100% - 3.5rem) * ${c.share})` }} aria-hidden="true" />
        <span className="ml-1.5 text-xs font-semibold tabular-nums text-text">{formatPercent(c.share, 1)}</span>
      </span>
    </li>
  )
}

/** 조상 기여율 가로 막대(기초 조상 기본, 펼치면 모든 조상) */
export function ContributionBars({ items }: { items: Contribution[] }) {
  const [all, setAll] = useState(false)
  const found = items.filter(c => c.foundation)
  const sum = found.reduce((s, c) => s + c.share, 0)
  const rest = items.filter(c => !c.foundation)
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5" aria-label="기초 조상 기여율">
        {found.map(c => (
          <Bar key={c.id} c={c} strong />
        ))}
      </ul>
      <div className="grid grid-cols-[7.5rem_1fr] gap-2">
        <span className="text-right text-xs font-semibold text-text">합계 {formatPercent(sum, 1)}</span>
        <div aria-hidden="true" className="relative mr-[3.5rem] h-4 border-t border-border text-[11px] text-muted tabular-nums">
          {TICKS.map(t => (
            <span
              key={t}
              className={`absolute top-0.5 ${t === 25 || t === 75 ? "max-sm:hidden" : ""}`}
              style={{
                left: `${t}%`,
                transform: t === 0 ? 'none' : t === 100 ? 'translateX(-100%)' : 'translateX(-50%)',
              }}
            >
              {t}%
            </span>
          ))}
        </div>
      </div>
      <p className="-mt-1 text-xs text-muted">막대 값은 소수 1자리 반올림이라 더한 값이 합계와 마지막 자리가 다를 수 있음(합계는 정확한 합을 반올림).</p>
      <p className="text-xs text-muted">같은 조상이 여러 경로로 들어오면 경로마다 (½)^세대수가 더해져 기여율이 커진다(예: 여러 번 등장하는 기초 계통).</p>
      {rest.length > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={all}
            onClick={() => setAll(v => !v)}
            className="touch-hit inline-flex items-center gap-1 rounded-sm text-xs font-semibold text-text underline decoration-border underline-offset-2 hover:decoration-text"
          >
            <ChevronDown size={14} aria-hidden="true" className={all ? 'rotate-180' : ''} />
            {all ? '중간 조상 접기' : `모든 조상 보기(중간 조상 ${rest.length}개 추가)`}
          </button>
          {all && (
            <ul className="mt-2 flex flex-col gap-1.5" aria-label="중간 조상 기여율">
              {rest.map(c => (
                <Bar key={c.id} c={c} strong={false} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
