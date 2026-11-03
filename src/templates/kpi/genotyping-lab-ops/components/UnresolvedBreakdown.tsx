import { PLATFORMS, UNRESOLVED_BREAKDOWN, UNRESOLVED_SAMPLES } from '../data'
import { platformVar } from './shared'

const mmdd = (d: string) => d.slice(5).replace('-', '/')

/** 미해결 재분석 KPI 타일 하단 — 플랫폼·상태별 비중 막대와 예정일 목록(가까운 순) */
export function UnresolvedBreakdown() {
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="flex h-1.5 gap-px overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        {UNRESOLVED_BREAKDOWN.map((b, i) => (
          <span
            key={`${b.platform}-${b.status}`}
            className="h-full"
            style={{ width: `${(b.count / UNRESOLVED_SAMPLES) * 100}%`, background: platformVar(b.platform), opacity: i > 0 && UNRESOLVED_BREAKDOWN[i - 1].platform === b.platform ? 0.5 : 1 }}
          />
        ))}
      </div>
      <ul className="flex flex-col gap-0.5 text-xs text-muted tabular-nums">
        {UNRESOLVED_BREAKDOWN.map(b => (
          <li key={`${b.platform}-${b.status}`} className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate">
              {PLATFORMS[b.platform].key} {b.status === '재시퀀싱 대기' ? '재시퀀싱' : b.status}
            </span>
            <span className="shrink-0">
              <b className="font-semibold text-text">{b.count}</b> · {mmdd(b.due)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
