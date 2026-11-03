import { Badge, DataTable, ScrollRegion, useMediaQuery, type DataTableColumn } from '@/design-system'
import { formatFixed } from '@/lib/format'
import {
  AS_OF,
  CANDIDATES,
  CHECK_VARIETY,
  COHORTS,
  COHORT_STATUS,
  CURRENT_YEAR,
  PRE_GS_YEAR,
  cohortTransitions,
  cohortYears,
  int,
  passRates,
  pct1,
  type CandidateRow,
  type Cohort,
} from '../data'

/** E. 코호트 연차 띠(G ~ G+4년): 누를 수 없는 정보라 카드가 아니라 점·선 타임라인. 지난 해 = 회색 점, 현재 = 잉크 점 + 글자, 예정 = 빈 점 + 점선 */
export function CohortTimeline({ cohort }: { cohort: Cohort }) {
  const cells = cohortYears(cohort)
  return (
    <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-5 sm:gap-0" aria-label={`${cohort} GS 1차 코호트 연차`}>
      {cells.map((c, i) => (
        <li key={c.year} className="relative flex min-w-0 flex-wrap items-baseline gap-x-2 pl-4 text-xs leading-snug sm:block sm:pl-0 sm:pr-3 sm:pt-4">
          {i < cells.length - 1 && (
            <span aria-hidden="true" className={`absolute left-0 right-0 top-[5px] hidden h-0 border-t sm:block ${cells[i + 1]!.future ? 'border-dashed border-muted' : 'border-muted'}`} />
          )}
          <span
            aria-hidden="true"
            className={[
              'absolute left-0 top-1 size-2.5 rounded-full border sm:top-0.5',
              c.current ? 'border-text bg-text' : c.future ? 'border-muted bg-surface' : 'border-muted bg-muted',
            ].join(' ')}
          />
          <span className="flex flex-wrap items-baseline gap-x-1">
            <b className={c.future ? 'font-semibold text-muted' : 'font-bold text-text'}>{c.year}</b>
            <span className="text-[11px] text-muted">G{i === 0 ? '' : `+${i}`}</span>
          </span>
          <span className={c.future ? 'text-muted sm:block' : 'text-text sm:block'}>{c.label}</span>
          {c.current && <span className="text-[11px] font-semibold text-text sm:block">현재({AS_OF})</span>}
          {c.future && <span className="text-[11px] text-muted sm:block">예정</span>}
        </li>
      ))}
    </ol>
  )
}

const TONE_CLASS: Record<CandidateRow['tone'], string> = {
  positive: 'bg-positive',
  info: 'bg-info',
  neutral: 'bg-muted',
  warning: 'bg-warning',
}

/** I. 출원 후보·결과 표 */
export function CandidateTable({ cohort }: { cohort: Cohort }) {
  const narrow = useMediaQuery('(max-width: 639px)')
  const rows = CANDIDATES[cohort]
  if (!rows) {
    return <p className="rounded-md border border-dashed border-border bg-surface-2 px-3 py-6 text-center text-sm text-muted">{cohort} 코호트는 아직 출원 후보 단계 전입니다(출원 후보 선정 {cohort + 3}년 말 예정).</p>
  }
  if (narrow) {
    return (
      <ul className="flex flex-col divide-y divide-border" aria-label={`${cohort} 코호트 출원 후보와 결과`}>
        {rows.map(r => (
          <li key={r.line} className={['flex flex-col gap-0.5 py-2 text-[13px]', r.reference ? 'text-muted' : 'text-text'].join(' ')}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="min-w-0">
                {r.name && <span className="mr-1 font-semibold text-text">{r.name}</span>}
                <span className="whitespace-nowrap font-mono text-xs">{r.line}</span>
                {r.reference && <span className="ml-1 text-[11px]">(참고)</span>}
              </span>
              <span className="inline-flex items-start gap-1.5 whitespace-nowrap">
                <span aria-hidden="true" className={`mt-1.5 inline-block size-2 shrink-0 rounded-full ${TONE_CLASS[r.tone]}`} />
                {r.result}
              </span>
            </div>
            <p className="text-xs text-muted tabular-nums">
              MET 2년 평균 쌀 수량 {r.yieldKg === null ? '—' : `${formatFixed(r.yieldKg, 1)} kg/10a`} · 지수 {r.index === null ? '—' : `${formatFixed(r.index, 1)}%`}
            </p>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <ScrollRegion label={`${cohort} 코호트 출원 후보 표(가로 스크롤)`} hint="옆으로 밀어 나머지 열 보기 →">
      <table className="w-full border-collapse text-[13px]">
        <caption className="sr-only">{cohort} 코호트 출원 후보와 결과</caption>
        <thead>
          <tr className="border-b border-text/25 text-left text-xs text-muted">
            <th scope="col" className="py-1.5 pr-2 font-medium">계통</th>
            <th scope="col" className="py-1.5 pr-2 text-right font-medium">
              MET 2년 평균
              <br />
              <span className="font-normal">쌀 수량 kg/10a</span>
            </th>
            <th scope="col" className="py-1.5 pr-2 text-right font-medium">
              지수
              <br />
              <span className="font-normal">{CHECK_VARIETY} 대비</span>
            </th>
            <th scope="col" className="py-1.5 font-medium">결과</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.line} className={['border-b border-border/70 align-top', r.reference ? 'text-muted' : ''].join(' ')}>
              <th scope="row" className="py-2 pr-2 text-left font-normal">
                {r.name && <span className="mr-1 font-semibold text-text">{r.name}</span>}
                <span className="whitespace-nowrap font-mono text-xs">{r.line}</span>
                {r.reference && <span className="ml-1 text-[11px]">(참고)</span>}
              </th>
              <td className="py-2 pr-2 text-right tabular-nums">{r.yieldKg === null ? '—' : formatFixed(r.yieldKg, 1)}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{r.index === null ? '—' : `${formatFixed(r.index, 1)}%`}</td>
              <td className="py-2">
                <span className="inline-flex items-start gap-1.5">
                  <span aria-hidden="true" className={`mt-1.5 inline-block size-2 shrink-0 rounded-full ${TONE_CLASS[r.tone]}`} />
                  <span className={r.reference ? '' : 'text-text'}>{r.result}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  )
}

// ---------------- J. 코호트 진급률 표 ----------------

interface RateRow {
  id: string
  label: string
  kind: 'cohort' | 'sep' | 'cross'
  cohort?: Cohort
  cells: { text: string; status?: '진행 중' | '대기' | null }[]
  current: string
}

/** 전환 = 도착 단계 이름까지(원문자만으로는 위 그림을 기억해야 읽힌다) */
const RATE_HEADERS = ['①→② GS 1차', '②→③ PYT', '③→④ AYT', '④→⑤ MET', '⑤→⑥ 출원 후보', '⑥→출원']

function buildRateRows(): RateRow[] {
  const rows: RateRow[] = COHORTS.map(G => ({
    id: String(G),
    label: `${G} 코호트`,
    kind: 'cohort',
    cohort: G,
    cells: cohortTransitions(G).map(t =>
      t.done && t.rate !== null && t.next !== null ? { text: `${pct1(t.rate)} (${int(t.next)}/${int(t.prev)})` } : { text: t.pendingLabel ? '' : '—', status: t.pendingLabel },
    ),
    current: COHORT_STATUS[G],
  }))
  rows.push({ id: 'sep', label: '참고 · 횡단 통과율(같은 해 단계 수 비)', kind: 'sep', cells: [], current: '' })
  for (const y of [PRE_GS_YEAR, CURRENT_YEAR]) {
    const pr = passRates(y)
    rows.push({ id: `x${y}`, label: `${y} 연간`, kind: 'cross', cells: [...pr.slice(1).map(v => ({ text: pct1(v as number) })), { text: '—' }], current: y === PRE_GS_YEAR ? 'GS 도입 전' : '올해 단계 현황' })
  }
  return rows
}
const RATE_ROWS = buildRateRows()

export function PromotionTable({ cohort, scrollHint }: { cohort: Cohort; scrollHint?: string }) {
  const columns: DataTableColumn<RateRow>[] = [
    {
      key: 'label',
      header: '코호트',
      sortable: false,
      width: 150,
      format: (_, r) =>
        r.kind === 'sep' ? (
          <span className="whitespace-normal text-xs font-semibold text-muted">{r.label}</span>
        ) : r.kind === 'cross' ? (
          <span className="inline-flex items-center gap-1.5 text-muted">
            {r.label}
            <span className="rounded-sm border border-border px-1 text-[11px]">횡단</span>
          </span>
        ) : (
          <span className="font-semibold">GS 1차 {r.label}</span>
        ),
    },
    ...RATE_HEADERS.map((h, i) => ({
      key: `c${i}`,
      header: h,
      numeric: true,
      sortable: false,
      format: (_: unknown, r: RateRow) => {
        const c = r.cells[i]
        if (!c) return null
        if (c.status) return <Badge tone={c.status === '진행 중' ? 'info' : 'neutral'}>{c.status}</Badge>
        return <span className={['tabular-nums whitespace-nowrap', r.kind === 'cross' || c.text === '—' ? 'text-muted' : ''].join(' ')}>{c.text}</span>
      },
    })),
    {
      key: 'current',
      header: '현재 단계',
      sortable: false,
      format: (_, r) => <span className={['whitespace-nowrap', r.kind === 'cohort' ? '' : 'text-muted'].join(' ')}>{r.current}</span>,
    },
  ]
  return (
    <DataTable
      columns={columns}
      rows={RATE_ROWS}
      rowKey="id"
      dense
      stickyColumn="label"
      activeRow={r => r.cohort === cohort}
      scrollHint={scrollHint}
      caption="GS 1차 코호트별 단계 진급률과 연간 횡단 통과율"
    />
  )
}
