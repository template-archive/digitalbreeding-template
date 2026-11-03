import { AlertTriangle, Equal, Layers, Search, Sprout, TrendingDown } from 'lucide-react'
import { Badge, Button, DataTable, EmptyState, FilterChip, Select, useMediaQuery, type DataTableColumn, type DataTableSort } from '@/design-system'
import { formatNumber } from '@/lib/format'
import {
  CHECK_LABEL,
  GEBV_LOW,
  GEBV_MODEL,
  INDEX_KEYS,
  INDEX_LABEL,
  PLOT_TRAIT_LABEL,
  STD,
  TEST_LINES,
  TRAIT_LABEL,
  TRAIT_ORDER,
  WEIGHTS,
  dayToDate,
  repShort,
  type DecisionState,
  type Line,
  type Rec,
  type Trait,
} from '../data'
import { DecisionBadge, RecBadge, TraitValue, UnsavedMark, f1, f2, fGebv, violText } from './ui'

// ---------------------------------------------------------------- 필터

export type StatusFilter = 'all' | 'undecided' | 'decided' | 'differs'
export interface Filters {
  rec: 'all' | Rec
  status: StatusFilter
  trait: 'all' | Trait
  query: string
}
export const DEFAULT_FILTERS: Filters = { rec: 'all', status: 'all', trait: 'all', query: '' }

export interface Row {
  line: Line
  st: DecisionState | null
  dirty: boolean
  differ: boolean
  error: boolean
}

export function matches(r: Row, f: Filters): boolean {
  const l = r.line
  if (f.rec !== 'all' && l.rec !== f.rec) return false
  if (f.status === 'undecided' && r.st?.decision != null) return false
  if (f.status === 'decided' && r.st?.decision == null) return false
  if (f.status === 'differs' && !r.differ) return false
  if (f.trait !== 'all' && !l.viol.includes(f.trait)) return false
  const q = f.query.trim().toUpperCase()
  if (q && !l.name.toUpperCase().includes(q)) return false
  return true
}

export function Toolbar({ f, setF, rows }: { f: Filters; setF: (f: Filters) => void; rows: Row[] }) {
  const recCount = (r: Rec) => TEST_LINES.filter(l => l.rec === r).length
  const st = {
    undecided: rows.filter(r => r.st?.decision == null).length,
    decided: rows.filter(r => r.st?.decision != null).length,
    differs: rows.filter(r => r.differ).length,
  }
  const traitCount = (t: Trait) => TEST_LINES.filter(l => l.viol.includes(t)).length
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div role="group" aria-label="자동 판정 필터" className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted">자동 판정</span>
          <FilterChip pressed={f.rec === 'all'} onClick={() => setF({ ...f, rec: 'all' })} label="전체" count={TEST_LINES.length} data={{ 'data-filter-rec': 'all' }} />
          {(['promote', 'hold', 'drop'] as Rec[]).map(r => (
            <FilterChip key={r} pressed={f.rec === r} onClick={() => setF({ ...f, rec: r })} label={{ promote: '진급', hold: '보류', drop: '탈락' }[r]} count={recCount(r)} data={{ 'data-filter-rec': r }} />
          ))}
        </div>
        <div role="group" aria-label="결정 상태 필터" className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted">결정</span>
          <FilterChip pressed={f.status === 'all'} onClick={() => setF({ ...f, status: 'all' })} label="전체" data={{ 'data-filter-status': 'all' }} />
          <FilterChip pressed={f.status === 'undecided'} onClick={() => setF({ ...f, status: 'undecided' })} label="미결정" count={st.undecided} data={{ 'data-filter-status': 'undecided' }} />
          <FilterChip pressed={f.status === 'decided'} onClick={() => setF({ ...f, status: 'decided' })} label="결정" count={st.decided} data={{ 'data-filter-status': 'decided' }} />
          <FilterChip pressed={f.status === 'differs'} onClick={() => setF({ ...f, status: 'differs' })} label="기준과 다름" count={st.differs} data={{ 'data-filter-status': 'differs' }} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Select<'all' | Trait>
          label="위반 형질"
          value={f.trait}
          onChange={v => setF({ ...f, trait: v })}
          options={[{ value: 'all', label: '전체' }, ...TRAIT_ORDER.map(t => ({ value: t, label: `${TRAIT_LABEL[t]} ${traitCount(t)}` }))]}
        />
        <label className="relative flex min-w-0 flex-1 items-center sm:max-w-60">
          <span className="sr-only">계통명 검색</span>
          <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 text-muted" />
          <input
            type="search"
            value={f.query}
            onChange={e => setF({ ...f, query: e.target.value })}
            placeholder="계통명 검색(예: YR23)"
            className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-2 text-[13px] text-text placeholder:text-muted"
          />
        </label>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 플래그

interface Flag {
  key: string
  icon: typeof Layers
  text: string
  tone: 'warning' | 'muted'
}
export function flagsOf(l: Line): Flag[] {
  if (l.check) return []
  const out: Flag[] = []
  if (l.border.length) out.push({ key: 'border', icon: Equal, text: `한계 경계(${l.border.map(t => TRAIT_LABEL[t]).join('·')})`, tone: 'muted' })
  if (l.gebvLow) out.push({ key: 'gebv', icon: TrendingDown, text: `GEBV 낮음(< ${fGebv(GEBV_LOW)})`, tone: 'warning' })
  const rs = repShort(l)
  if (rs.length) out.push({ key: 'rep', icon: Layers, text: rs.map(t => `${PLOT_TRAIT_LABEL[t]} ${l.n[t]}반복`).join(', '), tone: 'muted' })
  if (l.seedWarn) out.push({ key: 'seed', icon: Sprout, text: `종자 주의 ${formatNumber(Math.round(l.stock))} g`, tone: 'warning' })
  return out
}

function FlagIcons({ l }: { l: Line }) {
  const fs = flagsOf(l)
  if (!fs.length) return <span className="text-muted">—</span>
  return (
    <span className="inline-flex items-center gap-1" title={fs.map(f => f.text).join(' · ')}>
      {fs.map(f => (
        <f.icon key={f.key} size={14} aria-hidden="true" className={f.tone === 'warning' ? 'text-warning' : 'text-muted'} />
      ))}
      <span className="sr-only">{fs.map(f => f.text).join(', ')}</span>
    </span>
  )
}

// ---------------------------------------------------------------- 표

const BIG = 1e12
const INDEX_TITLE = `진급 지수 = ${INDEX_KEYS.map(k => `${INDEX_LABEL[k]} ${Math.round(WEIGHTS[k] * 100)}%`).join(' · ')} (표준화 z의 가중합)`

export function LineTable({
  rows,
  checks,
  selected,
  onSelect,
  sort,
  onSort,
  onReset,
}: {
  rows: Row[]
  checks: Row[]
  selected: string
  onSelect: (name: string) => void
  sort: DataTableSort
  onSort: (s: DataTableSort) => void
  onReset: () => void
}) {
  // 768~1023px: 형질 4열(출수기~밥맛)을 「한계 위반」 한 열로 접어 결정 열이 가로 스크롤 뒤에 숨지 않게 한다(390px은 카드)
  const lgUp = useMediaQuery('(min-width: 1024px)')
  // 대비 2행은 정렬과 무관하게 맨 위: 현재 방향에 맞춰 아주 큰/작은 값을 준다
  const top = (r: Row, v: number) => (r.line.check ? (sort.dir === 'desc' ? BIG - r.line.no : -BIG + r.line.no) : v)
  const num = (key: string, header: string, get: (l: Line) => number, extra: Partial<DataTableColumn<Row>> = {}): DataTableColumn<Row> => ({
    key,
    header,
    numeric: true,
    sortDescFirst: true,
    sortValue: r => top(r, get(r.line)),
    ...extra,
  })
  const traitColumns: DataTableColumn<Row>[] = [
    num('heading', '출수기', l => l.heading, {
      headerTitle: '파종 후 일수(파종 04-22)',
      format: (_, r) => (
        <span title={`${dayToDate(r.line.d.heading)} 출수`}>
          <TraitValue l={r.line} t="heading" />
        </span>
      ),
    }),
    num('culm', '간장', l => l.culm, { headerTitle: 'cm', format: (_, r) => <TraitValue l={r.line} t="culm" /> }),
    num('blast', '도열병', l => l.blast, { headerTitle: '잎도열병 발병 지수 0~9(낮을수록 저항성)', format: (_, r) => <TraitValue l={r.line} t="blast" /> }),
    num('taste', '밥맛', l => l.taste, { headerTitle: '식미치(식미계 점수)', format: (_, r) => <TraitValue l={r.line} t="taste" /> }),
  ]
  const violationColumn: DataTableColumn<Row> = {
    key: 'viol',
    header: '한계 위반',
    sortable: false,
    headerTitle: '필수 형질 한계 위반(출수기·간장·도열병·밥맛). 형질별 값은 계통 상세에서 봅니다',
    format: (_, r) =>
      r.line.viol.length ? (
        <span className="flex flex-col gap-0.5 font-semibold text-negative">
          {r.line.viol.map(t => (
            <span key={t} className="whitespace-nowrap">
              {violText(r.line, t)}
            </span>
          ))}
        </span>
      ) : (
        <span className="text-muted">—</span>
      ),
  }
  const columns: DataTableColumn<Row>[] = [
    num('rank', '순위', l => -l.rank, {
      sortDescFirst: true,
      headerTitle: '진급 지수 순위(시험 40계통)',
      format: (_, r) => (r.line.check ? <span className="text-muted">—</span> : r.line.rank),
    }),
    {
      key: 'name',
      header: '계통',
      sortable: false,
      format: (_, r) => <LineCell r={r} />,
    },
    num('yield', '쌀 수량', l => l.yieldMean, { headerTitle: 'kg/10a, 백미 · 정상 관측 구 평균', format: (_, r) => f1(r.line.d.yield) }),
    num('idx', '지수', l => l.yieldIdx, { headerTitle: `100 · 계통 평균 / 가람솔 A-3 평균 ${f1(STD.d.yield)}`, format: (_, r) => f1(r.line.d.idx) }),
    ...(lgUp ? traitColumns : [violationColumn]),
    num('gebv', 'GEBV', l => l.gebv, {
      headerTitle: `${GEBV_MODEL.when} ${GEBV_MODEL.method} · 훈련 집단 ${formatNumber(GEBV_MODEL.train)}계통 · AYT 2026 미포함`,
      format: (_, r) => (
        <span className="flex flex-col items-end leading-tight">
          <span>{fGebv(r.line.gebv)}</span>
          <span className="text-[11px] text-muted">r² {f2(r.line.rel)}</span>
        </span>
      ),
    }),
    num('index', '진급 지수', l => l.index, {
      headerTitle: INDEX_TITLE,
      format: (_, r) => (r.line.check ? <span className="text-muted">—</span> : <span className="font-semibold">{f2(r.line.index)}</span>),
    }),
    { key: 'rec', header: '자동 판정', sortable: false, format: (_, r) => <RecBadge rec={r.line.rec} compact /> },
    {
      key: 'decision',
      header: '결정',
      sortable: false,
      format: (_, r) => (r.line.check ? <span className="text-muted">—</span> : <DecisionBadge decision={r.st?.decision ?? null} differ={r.differ} compact />),
    },
    { key: 'flags', header: '플래그', sortable: false, format: (_, r) => <FlagIcons l={r.line} /> },
  ]

  return (
    <div className="flex flex-col gap-2">
      <DataTable<Row>
        columns={columns}
        className="[&_td]:px-[5px] [&_th]:px-[5px] [&_td:first-child]:pl-2.5 [&_th:first-child]:pl-2.5"
        rows={[...checks, ...rows]}
        rowKey={r => r.line.name}
        dense
        maxHeight={880}
        stickyColumn="name"
        sort={sort}
        onSortChange={s => s && onSort(s)}
        allowUnsorted={false}
        onRowClick={r => onSelect(r.line.name)}
        activeRow={r => r.line.name === selected}
        rowTone={r => (r.error ? 'negative' : null)}
        // 미저장 행 = 계통 칸 「✎미저장」 + 옅은 면 배경(일괄 자동 판정 뒤 20행도 훑어서 구분). 고정 열까지 같은 면으로 칠한다
        rowProps={r => ({ 'data-unsaved': r.dirty ? 'true' : undefined, className: r.dirty ? '[&>td]:bg-surface-2' : undefined })}
        caption="2026 AYT 계통별 성적·자동 판정·결정. 행을 누르거나 Enter로 계통 상세를 엽니다"
      />
      {rows.length === 0 && (
        <EmptyState
          title="조건에 맞는 계통이 없습니다"
          description="대비 품종 2행만 표시됩니다."
          action={
            <Button size="sm" onClick={onReset}>
              필터 초기화
            </Button>
          }
        />
      )}
    </div>
  )
}

function LineCell({ r }: { r: Row }) {
  const l = r.line
  return (
    <span data-line={l.name} className="flex items-center gap-1.5">
      {r.error && <AlertTriangle size={13} aria-label="사유 누락" className="shrink-0 text-negative" />}
      <span className="flex flex-col leading-tight">
        <span className="font-semibold">{l.name}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          처리 {l.no}
          {r.dirty && <UnsavedMark />}
        </span>
      </span>
      {l.check && <Badge tone="info">대비</Badge>}
      {l.check && <span className="sr-only">{CHECK_LABEL[l.check]}</span>}
    </span>
  )
}

// ---------------------------------------------------------------- 390px 카드

export function LineCards({ rows, checks, selected, onSelect, onReset }: { rows: Row[]; checks: Row[]; selected: string; onSelect: (name: string) => void; onReset: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2" aria-label="계통 목록">
        {[...checks, ...[...rows].sort((a, b) => a.line.rank - b.line.rank)].map(r => {
          const l = r.line
          const sel = l.name === selected
          return (
            <li key={l.name}>
              <button
                type="button"
                data-line={l.name}
                onClick={() => onSelect(l.name)}
                aria-current={sel ? 'true' : undefined}
                className={`flex w-full flex-col gap-1.5 rounded-lg border border-border bg-surface p-3 text-left ${sel ? 'select-ring' : ''} ${r.error ? 'border-l-2 border-l-negative' : ''}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="text-xs tabular-nums text-muted">{l.check ? '대비' : `${l.rank}위`}</span>
                    <span className="truncate font-semibold text-text">{l.name}</span>
                    {r.error && <AlertTriangle size={13} aria-label="사유 누락" className="shrink-0 self-center text-negative" />}
                  </span>
                  {/* 390px 두 배지가 어느 쪽 판단인지 라벨로 밝힌다(검토 A1): 권고 = 자동 판정, 결정 = 사람이 정한 값 */}
                  <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted">
                    {!l.check && '권고'}
                    <RecBadge rec={l.rec} />
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted">
                  <span>
                    지수 <b className="text-text">{f1(l.d.idx)}</b>
                  </span>
                  <span>
                    GEBV <b className="text-text">{fGebv(l.gebv)}</b>
                  </span>
                  {l.viol.length > 0 && <span className="font-semibold text-negative">위반 {l.viol.map(t => TRAIT_LABEL[t]).join('·')}</span>}
                  {!l.check && (
                    <span className="ml-auto flex items-center gap-1 text-[11px] text-muted">
                      결정
                      <DecisionBadge decision={r.st?.decision ?? null} dirty={r.dirty} differ={r.differ} />
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {rows.length === 0 && (
        <EmptyState
          title="조건에 맞는 계통이 없습니다"
          action={
            <Button size="sm" onClick={onReset}>
              필터 초기화
            </Button>
          }
        />
      )}
    </div>
  )
}
