import { useState } from 'react'
import { useChartTheme } from '@/charts'
import { ALERT_OVER, ALERT_UNDER, FY, GROUPS, GROUP_SHARE, GROUP_SUM, ITEMS, T2026, type BudgetItem, type GroupKey } from '../data'
import { SeverityTag, cn, stripeBg } from '@/design-system'
import { STATUS_LABEL, groupColor, groupStriped, man, pc } from './fmt'

/** 불릿 축 끝(예산 대비 %) */
const AXIS_MAX = 115
const pos = (pct: number) => `${(Math.min(AXIS_MAX, Math.max(0, pct)) / AXIS_MAX) * 100}%`

const sevWord = (status: 'critical' | 'warning') => (status === 'critical' ? '경보' : '주의')

function useFill() {
  const theme = useChartTheme()
  return (g: GroupKey) => {
    const c = groupColor(theme, g)
    return groupStriped(g) ? stripeBg(c, theme.surface) : c
  }
}

/** C-1. 그룹 구성 100% 막대 */
export function CompositionBar() {
  const fill = useFill()
  return (
    <figure aria-label={`${FY} 예산 구성: ${GROUPS.map(g => `${g.label} ${pc(GROUP_SHARE[g.key])}`).join(', ')}`}>
      <div className="flex h-7 w-full overflow-hidden rounded-md border border-border" aria-hidden="true">
        {GROUPS.map(g => (
          <div
            key={g.key}
            className="flex h-full min-w-0 items-center justify-center border-r border-surface text-[11px] font-bold last:border-r-0"
            style={{ width: `${GROUP_SHARE[g.key]}%`, background: fill(g.key) }}
          >
            {GROUP_SHARE[g.key] >= 18 && (
              <span className="rounded-sm bg-surface px-1 text-text tabular-nums">
                {g.key} {pc(GROUP_SHARE[g.key])}
              </span>
            )}
          </div>
        ))}
      </div>
      <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {GROUPS.map(g => (
          <li key={g.key} className="flex min-w-0 items-start gap-1.5">
            <span aria-hidden="true" className="mt-0.5 inline-block size-3 shrink-0 rounded-[2px]" style={{ background: fill(g.key) }} />
            <span className="min-w-0 text-muted">
              <b className="font-semibold text-text">
                {g.key} {g.label}
              </b>{' '}
              <span className="tabular-nums">
                {man(GROUP_SUM[g.key].budget)}만 원 · {pc(GROUP_SHARE[g.key])}
              </span>
              {g.note && <span className="block">{g.note}</span>}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  )
}

const GROUP_HEAD_NOTE: Partial<Record<GroupKey, string>> = {
  A: `합 ${man(GROUP_SUM.A.budget)}만 원 = 비교 기준 직접비(${T2026.year})`,
  C: '두 직접비 정의에 포함하지 않음',
}

function BulletRow({ it, active }: { it: BudgetItem; active: boolean }) {
  const theme = useChartTheme()
  const fill = useFill()
  const [tip, setTip] = useState(false)
  const color = groupColor(theme, it.group)
  const alert = it.status !== 'ok'
  const tickColor = it.status === 'critical' ? theme.negative : it.status === 'warning' ? theme.warning : theme.text
  return (
    <li
      id={`pb-row-${it.id}`}
      tabIndex={0}
      data-item={it.id}
      data-status={it.status}
      data-active={active ? 'true' : undefined}
      className={cn(
        'relative grid scroll-mt-20 grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_3.6rem] items-center gap-x-2 rounded-md px-1.5 py-1 outline-none sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_4rem]',
        active ? 'select-ring bg-surface-2' : 'hover:bg-surface-2 focus-visible:bg-surface-2',
      )}
      onMouseEnter={() => setTip(true)}
      onMouseLeave={() => setTip(false)}
      onFocus={() => setTip(true)}
      onBlur={() => setTip(false)}
      aria-describedby={tip ? `pb-tip-${it.id}` : undefined}
    >
      <span className="min-w-0 text-[12.5px] leading-tight">
        <span className="block break-keep font-medium text-text">{it.name}</span>
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="text-[11px] text-muted tabular-nums">{man(it.budget)}만 원</span>
          {/* 막대 위에 얹으면 실적 끝을 가려 왼쪽 칸에 둔다. 심각도는 공통 태그(아이콘 + 문자) */}
          {it.status !== 'ok' && <SeverityTag severity={it.status} label={`${sevWord(it.status)} · 전망 ${pc(it.fcPct)}`} className="tabular-nums" />}
        </span>
        {it.costNote && <span className="block text-[11px] text-muted">{it.costNote}</span>}
      </span>
      <div className="relative h-5">
        <div aria-hidden="true" className="absolute inset-y-0.5 left-0 rounded-sm" style={{ width: pos(100), background: color, opacity: 0.2 }} />
        <div aria-hidden="true" className="absolute inset-y-[5px] left-0 rounded-sm" style={{ width: pos(it.execPct), background: fill(it.group) }} />
        <div
          aria-hidden="true"
          className={cn('absolute -inset-y-0.5 -translate-x-1/2 rounded-full', alert ? 'w-[4px]' : 'w-[2px]')}
          style={{ left: pos(it.fcPct), background: tickColor }}
        />
      </div>
      <span className="text-right text-[12.5px] font-semibold text-text tabular-nums">
        {pc(it.execPct)}
        {it.done && <span className="block text-[11px] font-normal text-muted">완료</span>}
      </span>
      {/* 툴팁 기준은 행 전체 폭(막대 칸에 두면 390에서 약 75px에 갇혀 글자 단위로 깨졌다) */}
      {tip && (
        <span
          role="tooltip"
          id={`pb-tip-${it.id}`}
          className="absolute bottom-full left-0 z-30 mb-1 w-max max-w-full break-keep rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs leading-relaxed text-text shadow-2 tabular-nums"
        >
          <b>{it.name}</b>
          {it.costNote && <> · {it.costNote}</>}
          <br />
          예산 {man(it.budget)} · 실적 {n1(it.actToDate)} · 전망 {n1(it.forecast)}만 원
          <br />
          집행률 {pc(it.execPct)} · 계획 대비 {pc(it.vsPlan)} · {STATUS_LABEL[it.status]}
        </span>
      )}
    </li>
  )
}

const n1 = (v: number) => v.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** C-2. 비목 12행 불릿 차트(그룹 머리 행 + 비목 행) */
export function BudgetBullets({ focusId }: { focusId: string | null }) {
  const theme = useChartTheme()
  const fill = useFill()
  return (
    <div className="relative flex flex-col gap-2">
      <div className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_3.6rem] gap-x-2 px-1.5 text-[11px] text-muted sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_4rem]" aria-hidden="true">
        <span>비목 · 예산</span>
        <span className="relative h-4">
          {[0, 50, 100].map(v => (
            <span key={v} className="absolute -translate-x-1/2 tabular-nums" style={{ left: pos(v) }}>
              {v}%
            </span>
          ))}
        </span>
        <span className="text-right">집행률</span>
      </div>
      {GROUPS.map(g => (
        <section key={g.key} aria-label={`${g.key} ${g.label}`} className="flex flex-col gap-0.5">
          <h3 className="flex flex-wrap items-baseline gap-x-2 border-b border-border px-1.5 pb-1 text-[12.5px]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-text">
              <span aria-hidden="true" className="inline-block size-2.5 rounded-[2px]" style={{ background: fill(g.key) }} />
              {g.key} {g.label}
            </span>
            <span className="text-[11.5px] font-normal text-muted tabular-nums">
              {GROUP_HEAD_NOTE[g.key] ?? `${man(GROUP_SUM[g.key].budget)}만 원`} · 집행 {pc(GROUP_SUM[g.key].execPct)}
            </span>
          </h3>
          <ul className="flex flex-col">
            {ITEMS.filter(i => i.group === g.key).map(it => (
              <BulletRow key={it.id} it={it} active={focusId === it.id} />
            ))}
          </ul>
        </section>
      ))}
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-1.5 text-[11px] text-muted" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-[2px]" style={{ background: theme.categorical[0], opacity: 0.2 }} />
          예산(100%)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-4 rounded-[2px]" style={{ background: theme.categorical[0] }} />
          실적 누계(10/23)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-[2px] rounded-full" style={{ background: theme.text }} />
          연말 전망
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-[4px] rounded-full" style={{ background: theme.negative }} />
          <SeverityTag severity="critical" />
          전망 &gt; {ALERT_OVER}%
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-[4px] rounded-full" style={{ background: theme.warning }} />
          <SeverityTag severity="warning" />
          전망 &lt; {ALERT_UNDER}%
        </span>
      </div>
      <div className="sr-only">
      <table>
        <caption>비목별 예산·실적 누계·연말 전망(만 원, 추정)</caption>
        <thead>
          <tr>
            <th scope="col">그룹</th>
            <th scope="col">비목</th>
            <th scope="col">예산</th>
            <th scope="col">실적 누계</th>
            <th scope="col">연말 전망</th>
            <th scope="col">집행률</th>
            <th scope="col">전망 %</th>
            <th scope="col">판정</th>
          </tr>
        </thead>
        <tbody>
          {ITEMS.map(it => (
            <tr key={it.id}>
              <td>{it.group}</td>
              <th scope="row">{it.name}</th>
              <td>{man(it.budget)}</td>
              <td>{n1(it.actToDate)}</td>
              <td>{n1(it.forecast)}</td>
              <td>{pc(it.execPct)}</td>
              <td>{pc(it.fcPct)}</td>
              <td>{STATUS_LABEL[it.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
