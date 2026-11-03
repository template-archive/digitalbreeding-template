/**
 * F. 채종 로트 DNA 순도 검정: 표 안 이형립 누적 막대(0부터, 허용 기준 눈금: 옆 막대 그림과 표의 행 높이가 달라 같은 검정이 다른 높이에 놓였다) + 행 상세.
 */
import { AlertTriangle, CheckCircle2, CircleAlert } from 'lucide-react'
import { useChartTheme } from '@/charts'
import { Badge, DataTable, Legend, ScrollRegion, Segmented, cn, useMediaQuery, type DataTableColumn } from '@/design-system'
import { formatFixed, formatNumber } from '@/lib/format'
import {
  ACCEPT_PROB,
  ALLOWED_RANGE,
  AXIS_MAX,
  DISTINCT_MIN,
  MISCALL_RATE,
  OFF_KIND_LABEL,
  POP_STD,
  PURITY_DATES,
  PURITY_ROWS,
  RECHECK_CALL_LABEL,
  RECHECK_EXPECT,
  SEEDS_PER_TEST,
  VERDICT_LABEL,
  YEARS,
  label,
  lower95,
  yearSummary,
  type PurityRow,
  type Verdict,
} from '../data'

const VERDICT_TONE: Record<Verdict, 'positive' | 'warning' | 'negative'> = { pass: 'positive', edge: 'warning', fail: 'negative' }
const VERDICT_ICON = { pass: CheckCircle2, edge: CircleAlert, fail: AlertTriangle }
export const fmtPurity = (v: number) => `${formatFixed(v, 2)}%`
export const fmtLower = (v: number) => `${formatFixed(v, 1)}%`
const lowerZero = lower95(0, SEEDS_PER_TEST) * 100

export function VerdictBadge({ v }: { v: Verdict }) {
  const Icon = VERDICT_ICON[v]
  return (
    <Badge tone={VERDICT_TONE[v]}>
      <span className="inline-flex items-center gap-1">
        <Icon size={12} aria-hidden="true" />
        {VERDICT_LABEL[v]}
      </span>
    </Badge>
  )
}

interface Props {
  year: 2025 | 2026
  onYear: (y: 2025 | 2026) => void
  selected: string | null
  onSelect: (id: string | null) => void
}

export function PurityPanel({ year, onYear, selected, onSelect }: Props) {
  const t = useChartTheme()
  const S = yearSummary(year)
  const rows = S.rows
  const sel = selected ? PURITY_ROWS.find(r => r.id === selected && r.year === year) ?? null : null
  const hybColor = t.categorical[1]!
  const mixColor = t.categorical[3]!

  // lg 미만(표가 넘치는 폭)에서는 결론 열(판정·이형립·순도)을 검정 ID 바로 뒤로 당긴다
  const compact = useMediaQuery('(max-width: 1023px)')
  const idCol: DataTableColumn<PurityRow> = { key: 'id', header: '검정 ID', format: (_v, r) => <span className="font-semibold">{r.id}</span> }
  const rest: DataTableColumn<PurityRow>[] = [
    { key: 'line', header: '품종·계통', format: (_v, r) => label(r.line), sortValue: r => r.line.idx },
    { key: 'plot', header: '채종 구획' },
    {
      key: 'lot',
      header: '입고 로트',
      format: (_v, r) =>
        r.lot ? (
          <span className="flex flex-col whitespace-nowrap leading-tight">
            <span>{r.lot}</span>
            <span className="text-[11px] text-muted tabular-nums">입고 {formatNumber(r.intakeG!)} g</span>
          </span>
        ) : (
          <span className="whitespace-nowrap font-semibold text-negative">입고 제외(폐기)</span>
        ),
    },
    { key: 'n', header: '판독/검정', numeric: true, format: (_v, r) => `${r.n}/${r.tested}` },
  ]
  const xCol: DataTableColumn<PurityRow> = {
    key: 'x',
    header: '이형립(교잡/혼입)',
    numeric: true,
    format: (_v, r) => (
      <span className="inline-flex items-center justify-end gap-2">
        <OffBar r={r} hyb={hybColor} mix={mixColor} />
        <span className="w-10 text-right tabular-nums">{r.x === 0 ? '0' : <b>{`${r.x}(${r.nHyb}/${r.nMix})`}</b>}</span>
      </span>
    ),
  }
  const recheckCol: DataTableColumn<PurityRow> = { key: 'nRecheck', header: '재분석(일치)', numeric: true, format: (_v, r) => String(r.nRecheck) }
  const purityCol: DataTableColumn<PurityRow> = { key: 'purity', header: '순도', numeric: true, format: (_v, r) => fmtPurity(r.purity) }
  const verdictCol: DataTableColumn<PurityRow> = { key: 'verdict', header: '판정', format: (_v, r) => <VerdictBadge v={r.verdict} /> }
  const undetectCol: DataTableColumn<PurityRow> = {
    key: 'undetect',
    header: '검출 불가 혼입',
    format: (_v, r) => (r.undetect.length ? r.undetect.map(label).join(', ') : <span className="text-muted">—</span>),
    sortable: false,
  }
  const columns: DataTableColumn<PurityRow>[] = compact
    ? [idCol, verdictCol, xCol, purityCol, ...rest, recheckCol, undetectCol]
    : [idCol, ...rest, xCol, recheckCol, purityCol, verdictCol, undetectCol]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          ariaLabel="검정 연도"
          size="sm"
          options={YEARS.map(y => ({ value: String(y), label: `${y}년` }))}
          value={String(year)}
          onChange={v => onYear(Number(v) as 2025 | 2026)}
        />
        <p className="text-xs text-muted tabular-nums">
          채취 {PURITY_DATES[year].sampled} → 판정 {PURITY_DATES[year].judged} → 입고 {PURITY_DATES[year].intake} · 검정 {S.tests}건 {formatNumber(S.tested)}립 · 합격 {S.pass}
          {S.edge ? `(한계 ${S.edge} 포함)` : ''} · 불합격 {S.fail.length} · 재분석 {S.recheck}립({formatFixed(S.recheckPct, 2)}%)
        </p>
      </div>
      <Legend
        items={[
          { label: '교잡형', color: hybColor },
          { label: '혼입형', color: mixColor },
          { label: `허용 ${ALLOWED_RANGE.k}립(판독 ${ALLOWED_RANGE.lo}~${ALLOWED_RANGE.hi}립)`, color: t.text, shape: 'line' },
        ]}
      />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={r => r.id}
        dense
        stickyColumn="id"
        onRowClick={r => onSelect(r.id === selected ? null : r.id)}
        activeRow={r => r.id === selected}
        rowTone={r => (r.verdict === 'fail' ? 'negative' : null)}
        rowProps={r => ({ 'data-purity-id': r.id })}
        caption={`${year}년 채종 로트 DNA 순도 검정. 허용 ${ALLOWED_RANGE.k}립을 넘은 검정은 ${S.fail.length ? S.fail.map(r => `${r.id}(${r.x}립)`).join(', ') : '없음'}`}
        scrollHint={compact ? '옆으로 밀어 로트·검출 불가 혼입 보기 →' : '옆으로 밀어 판정·검출 불가 혼입 보기 →'}
      />

      <div className="rounded-md border border-border bg-surface-2/50 p-3" aria-live="polite" data-purity-detail={sel?.id ?? ''}>
        {sel ? <PurityDetail r={sel} /> : <p className="text-[13px] text-muted">행을 선택하면 이형립 상세(유형 · 이형접합 마커 · 동형 불일치 · 추정 기원)가 여기에 나옵니다.</p>}
      </div>

      <p className="text-xs leading-relaxed text-muted">
        합격 기준(내부, 추정): 집단 기준 이형률 {formatFixed(POP_STD * 100, 1)}%, 수용 확률 {Math.round(ACCEPT_PROB * 100)}% → 판독 {ALLOWED_RANGE.lo}~{ALLOWED_RANGE.hi}립에서 이형립{' '}
        {ALLOWED_RANGE.k}립까지 · {SEEDS_PER_TEST}립 검정으로는 순도 {formatFixed(100 - POP_STD * 100, 1)}%를 입증할 수 없음(이형 0이어도 95% 하한 {fmtLower(lowerZero)}). 교잡형 = 이형접합(AB) 마커 2개 이상, 혼입형
        = AB 없이 동형 불일치 2개 이상, AB 1개 또는 불일치 1개 = 재분석(같은 립 DNA 재실행, 일치하면 판독에 포함 · 이형립 아님, 마커당 오호출{' '}
        {formatFixed(MISCALL_RATE * 100, 1)}% 가정 시 립의 약 {formatFixed(RECHECK_EXPECT * 100, 1)}%).
      </p>
    </div>
  )
}

/** 표 칸 이형립 막대: 0 ~ AXIS_MAX립, 교잡형 → 혼입형 누적, 세로 눈금 = 허용 립 수. 숫자는 옆 칸에 함께 적는다 */
function OffBar({ r, hyb, mix }: { r: PurityRow; hyb: string; mix: string }) {
  const pct = (n: number) => `${(n / AXIS_MAX) * 100}%`
  return (
    <span aria-hidden="true" className="relative inline-flex h-2.5 w-[72px] overflow-visible rounded-[2px] bg-surface-2">
      <span className="block h-full" style={{ width: pct(r.nHyb), background: hyb }} />
      <span className="block h-full" style={{ width: pct(r.nMix), background: mix }} />
      <span className="absolute -inset-y-0.5 w-0.5 bg-text" style={{ left: pct(r.k) }} />
    </span>
  )
}

function PurityDetail({ r }: { r: PurityRow }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-text">
          {r.id} · {label(r.line)} · {r.plot}
        </h3>
        <VerdictBadge v={r.verdict} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted">이형립 / 판독</dt>
          <dd className="font-semibold tabular-nums">
            {r.x} / {r.n}립 <span className="font-normal text-muted">(허용 {r.k})</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">순도</dt>
          <dd className="font-semibold tabular-nums">{fmtPurity(r.purity)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">순도 95% 하한(단측)</dt>
          <dd className="font-semibold tabular-nums">{fmtLower(r.lower)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">입고</dt>
          <dd className={cn('font-semibold', !r.lot && 'text-negative')}>{r.lot ? `${r.lot} · ${formatNumber(r.intakeG!)} g` : '입고 제외(폐기)'}</dd>
        </div>
      </dl>
      {r.memo && <p className="text-[13px] text-text">메모: {r.memo}</p>}
      {r.undetect.length > 0 && (
        <p className="text-xs text-muted">
          검출 불가 혼입: {r.undetect.map(label).join(', ')} — 기준 품종과 구별 마커가 {DISTINCT_MIN}개 미만이므로 종자 혼입·화분 교잡 모두 불일치 1개라 재분석으로 분류됩니다.
        </p>
      )}
      {r.offs.length === 0 ? (
        <p className="text-[13px] text-muted">
          이형립 없음 — 판독 {r.n}립 모두 기준 프로필과 같습니다{r.nRecheck ? `(재분석 ${r.nRecheck}립 포함)` : ''}.
        </p>
      ) : (
        <ScrollRegion
          label={`${r.id} 이형립 상세 표(가로 스크롤)`}
          hint="옆으로 밀어 나머지 열 보기 →"
          fadeColor="color-mix(in oklab, var(--color-surface-2) 50%, var(--color-surface))"
        >
          <table className="w-full min-w-[520px] text-[13px]">
            <caption className="sr-only">{r.id} 이형립 상세</caption>
            <thead>
              <tr className="border-b border-text/25 text-left text-xs text-muted">
                <th scope="col" className="py-1 pr-2 font-medium">립</th>
                <th scope="col" className="py-1 pr-2 font-medium">유형</th>
                <th scope="col" className="py-1 pr-2 font-medium">AB(이형접합) 마커</th>
                <th scope="col" className="py-1 pr-2 font-medium">동형 불일치 마커</th>
                <th scope="col" className="py-1 font-medium">추정 기원</th>
              </tr>
            </thead>
            <tbody>
              {r.offs.map(o => (
                <tr key={o.no} className="border-b border-border/70 last:border-b-0">
                  <td className="py-1 pr-2 font-semibold">{o.no}</td>
                  <td className="py-1 pr-2">{OFF_KIND_LABEL[o.kind]}</td>
                  <td className="py-1 pr-2">{o.het.length ? o.het.join('·') : '—'}</td>
                  <td className="py-1 pr-2">{o.mism.length ? o.mism.join('·') : '—'}</td>
                  <td className="py-1">
                    {o.origin} {o.cls === 'hyb' ? '화분' : '종자 혼입'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      )}
      <p className="text-[13px] text-text" data-purity-recheck={r.nRecheck}>
        <span className="font-semibold">재분석 {r.nRecheck}립</span>
        <span className="text-muted"> — 같은 립 DNA 재분석에서 모두 기준 프로필과 일치(이형립 아님, 판독에 포함)</span>
        {r.nRecheck > 0 && <>: {r.recheck.map(c => `${c.marker} ${RECHECK_CALL_LABEL[c.call]}`).join(' · ')}</>}
      </p>
    </div>
  )
}
