import { useId, useMemo, useState } from 'react'
import { ChevronDown, Filter, RotateCcw, X } from 'lucide-react'
import { Badge, Button, Card, DataTable, EmptyState, Slider, cn, type DataTableColumn } from '@/design-system'
import {
  DEFAULT_FILTERS,
  GROUP_LABEL,
  MAX_PARENTS,
  activeFilterCount,
  fmt2,
  fmtSigned1,
  type Candidate,
  type Filters,
  type Group,
} from '../data'
import { Notice } from './ui'

const GROUPS: Group[] = ['A', 'B', 'C']

function FilterFields({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v })
  const toggleGroup = (g: Group) =>
    set('groups', filters.groups.includes(g) ? filters.groups.filter(x => x !== g) : GROUPS.filter(x => x === g || filters.groups.includes(x)))
  return (
    <div className="flex flex-col gap-4">
      <Slider label="수량 GEBV 최소 (kg/10a)" min={-25} max={55} step={1} value={filters.gebvMin} onChange={v => set('gebvMin', v)} format={v => fmtSigned1(v)} />
      <Slider label="신뢰도(r²) 최소" min={0.3} max={0.6} step={0.01} value={filters.relMin} onChange={v => set('relMin', Math.round(v * 100) / 100)} format={fmt2} />
      <Slider
        label="출수기 최소 (일)"
        min={100}
        max={130}
        step={1}
        value={filters.headingMin}
        onChange={v => onChange({ ...filters, headingMin: v, headingMax: Math.max(v, filters.headingMax) })}
        format={v => `${v}일`}
      />
      <Slider
        label="출수기 최대 (일)"
        min={100}
        max={130}
        step={1}
        value={filters.headingMax}
        onChange={v => onChange({ ...filters, headingMax: v, headingMin: Math.min(v, filters.headingMin) })}
        format={v => `${v}일`}
      />
      <Slider label="간장 최대 (cm)" min={70} max={110} step={1} value={filters.culmMax} onChange={v => set('culmMax', v)} format={v => `${v}cm`} />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-xs font-medium text-muted">그룹</legend>
        {GROUPS.map(g => (
          <label key={g} className="flex cursor-pointer items-center gap-2 text-[13px] text-text">
            <input type="checkbox" checked={filters.groups.includes(g)} onChange={() => toggleGroup(g)} className="size-4 accent-[var(--color-text)]" />
            {GROUP_LABEL[g]}
          </label>
        ))}
      </fieldset>
      <Button size="sm" variant="secondary" onClick={() => onChange(DEFAULT_FILTERS)} disabled={activeFilterCount(filters) === 0}>
        <RotateCcw size={13} aria-hidden="true" />
        필터 초기화
      </Button>
    </div>
  )
}

export interface ParentStepProps {
  candidates: Candidate[]
  visible: Candidate[]
  filters: Filters
  onFilters: (f: Filters) => void
  selected: string[]
  onToggle: (name: string) => void
  readOnly: boolean
  notice: string | null
  onDismissNotice: () => void
  wide: boolean
  /** 767px 이하: 표 대신 카드 목록(②단계 조합 카드와 같은 문법) */
  mobile: boolean
}

type Row = Candidate & { selected: number }

/** 767px 이하 후보 카드: 카드 전체가 선택 토글(라벨), 판단에 쓰는 GEBV·신뢰도를 오른쪽에 둔다(검토 C1·C3) */
function ParentCards({ rows, full, readOnly, onToggle }: { rows: Row[]; full: boolean; readOnly: boolean; onToggle: (name: string) => void }) {
  return (
    <ul aria-label="부모 후보" className="flex max-h-[560px] flex-col gap-2 overflow-y-auto">
      {rows.map(r => {
        const on = r.selected === 1
        const disabled = readOnly || (!on && full)
        return (
          <li key={r.name}>
            <label
              data-parent-card={r.name}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 text-[13px]',
                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                on && 'border-muted bg-surface-2',
              )}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={disabled}
                onChange={() => onToggle(r.name)}
                aria-label={`${r.name} 부모로 선택`}
                className="size-4 shrink-0 cursor-pointer accent-[var(--color-text)] disabled:cursor-not-allowed"
              />
              <span className="min-w-0 flex-1">
                <span className={cn('block tabular-nums text-text', on ? 'font-bold' : 'font-semibold')}>{r.name}</span>
                <span className="block text-xs text-muted tabular-nums">
                  {GROUP_LABEL[r.group]} · 출수기 {r.heading}일 · 간장 {r.culm}cm · {r.pi}
                </span>
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <b className="block font-semibold text-text">{fmtSigned1(r.gebv)}</b>
                <span className="block text-xs text-muted">r² {fmt2(r.rel)}</span>
              </span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}

export function ParentStep({ candidates, visible, filters, onFilters, selected, onToggle, readOnly, notice, onDismissNotice, wide, mobile }: ParentStepProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const selSet = useMemo(() => new Set(selected), [selected])
  const full = selected.length >= MAX_PARENTS
  const nActive = activeFilterCount(filters)

  const rows: Row[] = useMemo(
    () => visible.map(c => ({ ...c, selected: selSet.has(c.name) ? 1 : 0 })).sort((a, b) => b.gebv - a.gebv),
    [visible, selSet],
  )

  const columns: DataTableColumn<Row>[] = [
    {
      key: 'selected',
      header: '선택',
      width: 40,
      align: 'center',
      sortable: false,
      format: (_, r) => {
        const on = r.selected === 1
        const disabled = readOnly || (!on && full)
        // 맨 체크박스는 라벨로 감싸 좁은 화면·터치에서 누르는 영역 44px(touch-hit)
        return (
          <label className="touch-hit inline-flex cursor-pointer align-middle">
            <input
              type="checkbox"
              checked={on}
              disabled={disabled}
              onChange={() => onToggle(r.name)}
              aria-label={`${r.name} 부모로 선택`}
              className="size-4 cursor-pointer accent-[var(--color-text)] disabled:cursor-not-allowed"
            />
          </label>
        )
      },
    },
    // 선택은 체크박스·행 강조(highlight)가 맡는다(계통명에 강조색 글자 없음)
    { key: 'name', header: '계통명', format: (v, r) => <span className={r.selected ? 'font-bold' : 'font-semibold'}>{String(v)}</span> },
    // 390px 머리글은 짧게(수량 GEBV → GEBV, 신뢰도(r²) → r²). 전체 이름은 headerTitle·표 아래 각주
    {
      key: 'gebv',
      header: (
        // 한 덩어리 span: 숫자 열 머리는 정렬 아이콘을 앞에 두려고 flex 순서를 뒤집으므로 조각이 나뉘면 어순이 바뀐다
        <span>
          <span className="max-sm:hidden">수량 </span>GEBV
        </span>
      ),
      headerTitle: '수량 GEBV(kg/10a, 기준 집단 평균 대비)',
      numeric: true,
      format: v => <span className="font-semibold">{fmtSigned1(v as number)}</span>,
    },
    // 390px: 선택·계통·GEBV·신뢰도만(판단에 쓰는 열). 그룹·출수기·간장·Pi는 sm 이상
    {
      key: 'group',
      header: '그룹',
      hideBelow: 'sm',
      format: v => <span className="text-muted">{GROUP_LABEL[v as Group]}</span>,
    },
    {
      key: 'rel',
      header: (
        <span>
          <span className="max-sm:hidden">신뢰도</span>(r²)
        </span>
      ),
      headerTitle: '신뢰도(r²) = GEBV 정확도의 제곱',
      numeric: true,
      format: v => fmt2(v as number),
    },
    { key: 'heading', header: '출수기(일)', numeric: true, hideBelow: 'sm' },
    { key: 'culm', header: '간장(cm)', numeric: true, hideBelow: 'sm' },
    { key: 'pi', header: 'Pi 유전자', hideBelow: 'sm', format: v => (v === '없음' ? <span className="text-muted">없음</span> : <Badge tone="neutral">{String(v)}</Badge>) },
  ]

  const chips = selected.map(n => candidates.find(c => c.name === n)!).filter(Boolean)
  const hiddenSelected = chips.filter(c => !visible.includes(c)).length

  const filterPanel = <FilterFields filters={filters} onChange={onFilters} />

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* C. 필터 */}
      {wide ? (
        <Card title="후보 필터" subtitle="즉시 적용 · 선택 상태는 유지" className="w-[280px] shrink-0 lg:sticky lg:top-4">
          {filterPanel}
        </Card>
      ) : (
        <div className="rounded-lg border border-border bg-surface shadow-1">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            aria-controls={panelId}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-text"
          >
            <Filter size={15} aria-hidden="true" className="text-muted" />
            필터 · 적용 {nActive}개
            <ChevronDown size={16} aria-hidden="true" className={`ml-auto text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          <div id={panelId} hidden={!open} className="border-t border-border px-4 py-4">
            {filterPanel}
          </div>
        </div>
      )}

      {/* D. 후보 표 */}
      <Card
        className="min-w-0 flex-1"
        title="부모 후보"
        subtitle={
          <span className="tabular-nums">
            {candidates.length}계통 중 <strong className="text-text">{visible.length}계통</strong> 표시 · 선택 <strong className="text-text">{selected.length}계통</strong>
            {hiddenSelected > 0 && ` (필터로 숨겨진 선택 ${hiddenSelected})`}
          </span>
        }
      >
        <div className="mb-3 flex flex-col gap-2">
          {notice && <Notice onClose={onDismissNotice}>{notice}</Notice>}
          {full && !readOnly && <Notice tone="warning">부모는 최대 {MAX_PARENTS}계통까지 선택할 수 있습니다.</Notice>}
          {selected.length < 2 && <Notice tone="warning">조합을 검토하려면 부모를 2계통 이상 선택하세요.</Notice>}
          <details open={!mobile}>
            <summary className="min-h-11 cursor-pointer py-3 text-[13px] font-medium text-muted md:hidden">선택한 부모 {selected.length}계통 확인</summary>
          <ul aria-label="선택한 부모" className="flex flex-wrap gap-1.5 touch:gap-2">
            {chips.map(c => (
              <li key={c.name}>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 py-0.5 pl-2.5 pr-1 text-xs font-medium text-text">
                  <span className="tabular-nums">{c.name}</span>
                  <span className="text-muted tabular-nums">{fmtSigned1(c.gebv)}</span>
                  {!readOnly && (
                    <button type="button" onClick={() => onToggle(c.name)} aria-label={`${c.name} 선택 해제`} className="touch-hit rounded-full p-0.5 text-muted hover:bg-surface hover:text-text">
                      <X size={12} aria-hidden="true" />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          </details>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title="조건에 맞는 후보가 없습니다"
            description="필터 범위를 넓히거나 초기화하세요. 선택한 부모는 그대로 유지됩니다."
            action={
              <Button size="sm" onClick={() => onFilters(DEFAULT_FILTERS)}>
                <RotateCcw size={13} aria-hidden="true" />
                필터 초기화
              </Button>
            }
          />
        ) : mobile ? (
          <ParentCards rows={rows} full={full} readOnly={readOnly} onToggle={onToggle} />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey="name"
            dense
            maxHeight={560}
            highlight={r => r.selected === 1}
            caption="부모 후보 계통 목록. 기본 정렬은 수량 GEBV 내림차순"
            defaultSort={{ key: 'gebv', dir: 'desc' }}
            stickyColumn={{ key: 'name', below: 'md' }}
          />
        )}
        {candidates.length > 0 && <p className="mt-2 text-xs text-muted">GEBV: 기준 집단 평균 대비 편차(GBLUP), 부호 표시. 신뢰도(r²) = GEBV 정확도의 제곱.</p>}
      </Card>
    </div>
  )
}
