import { HATCH_MISSING } from '@/design-system'
import { useChartTheme } from '@/charts'
import {
  ANNUAL_STAGES,
  CURRENT_YEAR,
  FILED_2026,
  PENDING,
  PIPELINE,
  PIPELINE_TARGET_2026,
  REASON_LABEL,
  REASON_SHORT,
  REASONS,
  cohortCounts,
  cohortStages,
  cohortTransitions,
  int,
  lastStageIndex,
  passRates,
  pct1,
  sortedReasons,
  type Cohort,
} from '../data'
import { reasonColor } from './ReasonBars'

/** 로그 척도 위치(%) — 최대 = max. 로그에서 길이는 값에 비례하지 않으므로 막대가 아니라 점으로 그린다 */
const logPct = (v: number, max: number) => Math.max(2, (Math.log10(Math.max(1, v)) / Math.log10(max)) * 100)

function LogDot({ value, max, tone }: { value: number; max: number; tone: 'accent' | 'warning' }) {
  return (
    <span className="relative block h-2.5 flex-1" aria-hidden="true">
      <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
      <span className={`absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${tone === 'warning' ? 'bg-warning' : 'bg-accent'}`} style={{ left: `${logPct(value, max)}%` }} />
    </span>
  )
}

/** 390px: 생키 대신 단계 카드 목록 */
export function MobileStageList({ cohort }: { cohort: Cohort }) {
  const st = cohortStages(cohort)
  const c = cohortCounts(cohort)
  const trs = cohortTransitions(cohort)
  const last = lastStageIndex(cohort)
  return (
    <ol className="flex flex-col gap-2" aria-label={`${cohort} GS 1차 코호트 단계 목록`}>
      {c.slice(0, last + 1).map((n, k) => {
        const tr = k > 0 ? trs[k - 1] : null
        const top2 = tr?.alloc ? sortedReasons(tr.alloc).slice(0, 2) : []
        const filed = cohort === 2022 && k === 6
        return (
          <li key={k} className="rounded-md border border-border bg-surface p-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 text-[13px] font-semibold text-text">
                {st[k].no} {filed ? `${FILED_2026.name} 출원` : st[k].short} <span className="font-normal text-muted">{filed ? FILED_2026.date : st[k].yearLabel}</span>
              </span>
              <span className="text-xl font-extrabold tabular-nums text-text">{int(n)}</span>
            </div>
            <div className="mt-1.5 flex pr-1">
              <LogDot value={n} max={c[0]} tone="accent" />
            </div>
            {tr && (
              <p className="mt-1.5 text-xs leading-snug text-muted">
                진급률 <b className="tabular-nums text-text">{pct1(tr.rate ?? 0)}</b> ({int(n)}/{int(tr.prev)}) · {tr.key === 'T6' ? '선정 제외' : '탈락'} <b className="tabular-nums text-text">{int(tr.drop ?? 0)}</b>
                {top2.length > 0 && <> · {top2.map(x => `${REASON_SHORT[x.r]} ${int(x.n)}`).join(' · ')}</>}
              </p>
            )}
          </li>
        )
      })}
      {PENDING[cohort].map(p => (
        <li key={p.label} className="rounded-md border border-dashed border-muted p-2.5" style={p.kind === 'pending' ? { background: HATCH_MISSING } : undefined}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 text-[13px] font-semibold text-text">{p.kind === 'pending' ? (p.label.startsWith('진급') ? '진급 심의 대기' : p.label.split(' · ')[0]) : '출원 예정'}</span>
            <span className="text-xl font-extrabold tabular-nums text-text">{int(p.value)}</span>
          </div>
          <p className="mt-1 text-xs leading-snug text-text">{p.detail}</p>
        </li>
      ))}
    </ol>
  )
}

/** 390px: C 단계 현황 6줄 요약 */
export function MobileAnnualList() {
  const counts = PIPELINE[CURRENT_YEAR]
  const rates = passRates(CURRENT_YEAR)
  return (
    <ul className="flex flex-col divide-y divide-border text-[13px]" aria-label={`${CURRENT_YEAR} 단계 현황`}>
      {ANNUAL_STAGES.map((s, i) => {
        const below = counts[i] < PIPELINE_TARGET_2026[i]
        return (
          <li key={s.no} className="flex items-center gap-2 py-1.5">
            <span className="w-28 shrink-0 text-text">
              {s.no} {s.short}
            </span>
            <LogDot value={counts[i]} max={3000} tone={below ? 'warning' : 'accent'} />
            <span className="w-24 shrink-0 text-right tabular-nums">
              <b>{int(counts[i])}</b>
              {rates[i] !== null && <span className="text-muted"> · {pct1(rates[i] as number)}</span>}
            </span>
            {below && <span className="sr-only">목표 {PIPELINE_TARGET_2026[i]} 미달</span>}
          </li>
        )
      })}
    </ul>
  )
}

/** 390px: H 탈락 사유 — 행별 쌓인 막대 + 상위 사유 텍스트 */
export function MobileReasons({ cohort }: { cohort: Cohort }) {
  const theme = useChartTheme()
  const rows = cohortTransitions(cohort).filter(t => t.done && t.alloc)
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map(t => {
        const total = t.drop as number
        const top2 = sortedReasons(t.alloc ?? {}).slice(0, 2)
        return (
          <li key={t.key}>
            <div className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className="min-w-0 text-text">
                {t.label} <span className="text-xs text-muted">· {t.basis}</span>
              </span>
              <b className="shrink-0 tabular-nums">탈락 {int(total)}</b>
            </div>
            <div className="mt-1 flex h-3 overflow-hidden rounded-sm" aria-hidden="true">
              {REASONS.filter(r => (t.alloc?.[r] ?? 0) > 0).map(r => (
                <span key={r} style={{ width: `${((t.alloc?.[r] ?? 0) / total) * 100}%`, background: reasonColor(theme, r) }} className="border-r border-surface last:border-r-0" />
              ))}
            </div>
            <p className="mt-0.5 text-xs text-muted">{top2.map(x => `${REASON_LABEL[x.r]} ${int(x.n)}(${pct1((x.n / total) * 100)})`).join(' · ')}</p>
          </li>
        )
      })}
    </ul>
  )
}
