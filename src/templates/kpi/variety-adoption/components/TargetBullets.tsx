import { SeverityTag } from '@/design-system'
import { CUR, TARGET_2026, TARGET_CAUTION, TARGET_OK, TARGET_RATE, TARGET_SUM, main5FarmArea, targetStatus } from '../data'
import { TARGET_LABEL, ha, pc, targetColorVar } from './fmt'

/** G. 보급 목표 달성 — 품종별 불릿 막대(실적 막대 + 목표 눈금) */
export function TargetBullets() {
  const max = Math.max(...TARGET_2026.map(r => Math.max(r.actual, r.target))) * 1.04
  const totalStatus = targetStatus(TARGET_RATE)
  return (
    <div className="flex flex-1 flex-col gap-3">
      {/* 옆 차트 카드 높이만큼 행 간격을 벌려 아래 빈 띠를 없앤다 */}
      <ul className="flex flex-1 flex-col justify-between gap-3" aria-label={`${CUR} 품종별 보급 목표 달성`}>
        {TARGET_2026.map(r => {
          const s = targetStatus(r.rate)
          const c = targetColorVar(s)
          return (
            <li key={r.v.id} className="grid grid-cols-[4.5rem_1fr] items-center gap-x-2 gap-y-0.5">
              <span className="text-[13px] font-semibold text-text">{r.v.name}</span>
              <div className="relative h-4 rounded-sm bg-surface-2" aria-hidden="true">
                <div className="absolute inset-y-0.5 left-0 rounded-sm" style={{ width: `${(r.actual / max) * 100}%`, background: c, opacity: 0.85 }} />
                <div className="absolute -inset-y-0.5 w-[3px] -translate-x-1/2 rounded-full bg-text" style={{ left: `${(r.target / max) * 100}%` }} title={`목표 ${ha(r.target)} ha`} />
              </div>
              <span />
              <span className="flex flex-wrap items-center justify-between gap-x-2 text-xs tabular-nums text-muted">
                <span>
                  <b className="text-text">{ha(r.actual)}</b> / {ha(r.target)} ha · <b className="text-text">{pc(r.rate, 1)}</b>
                </span>
                <SeverityTag severity={s} label={TARGET_LABEL[s]} />
              </span>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-2 text-xs text-muted tabular-nums">
        <span>
          합계(보급 5품종, 시범 제외) <b className="text-text">{ha(main5FarmArea(CUR))}</b> / {ha(TARGET_SUM)} ha
        </span>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-text">
          {pc(TARGET_RATE, 1)}
          <SeverityTag severity={totalStatus} label={TARGET_LABEL[totalStatus]} />
        </span>
      </div>
      <p className="text-xs text-muted">
        막대 = {CUR} 재배 면적(추정), 세로 눈금 = 목표. 달성률 ≥ {TARGET_OK}% 달성 · {TARGET_CAUTION}~{TARGET_OK}% 주의 · &lt; {TARGET_CAUTION}% 경보.
      </p>
    </div>
  )
}
