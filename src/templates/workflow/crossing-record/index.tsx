import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, Search } from 'lucide-react'
import type { TemplateMeta } from '@/gallery/types'
import { BottomSheet, Button, Card, EmptyState, ErrorState, FilterChip, KpiRow, PageHeader, ScrollRegion, Skeleton, Toast, cn, useMediaQuery, useToast } from '@/design-system'
import {
  AS_OF,
  BATCHES,
  CROSSES,
  DEFAULT_FIELDS,
  DEFAULT_SELECTED,
  EARLY_HARVEST_DAP,
  MARKER_PANEL_SIZE,
  RATE_HIGH,
  RATE_LOW,
  ROUND_LABEL,
  FIELD_LABEL,
  SAVE_DELAY_MS,
  TARGET_SEEDS,
  deriveAll,
  fmtRate,
  kaspStatus,
  mmdd,
  summarize,
  validate,
  CROSS_BY_ID,
  type F1Status,
  type FieldIssues,
  type FieldKey,
  type Fields,
  type Override,
  type OverrideReason,
  type Derived,
} from './data'
import { SummaryRow } from './components/SummaryRow'
import { EntryTable } from './components/EntryTable'
import { CrossCards } from './components/CrossCards'
import { CrossDetail } from './components/CrossDetail'
import { ProgressChart } from './components/ProgressChart'
import { SaveBar } from './components/SaveBar'

export const meta: TemplateMeta = {
  slug: 'crossing-record',
  category: 'workflow',
  title: '교배 실적 기록',
  description: '교배 회차의 제웅·수분·결실 야장을 입력해 결실률을 계산하고, KASP 다형 마커로 F1 진위를 확인해 목표 F1 종자 확보와 재교배 조합을 관리한다.',
  tags: ['교배', '결실률', 'F1 진위', 'KASP', '재교배', '야장 입력', '벼'],
  organism: '벼',
  status: 'review',
  updatedAt: '2026-11-02',
}

type DevState = 'ready' | 'loading' | 'empty' | 'error'
function readState(): DevState {
  if (typeof window === 'undefined') return 'ready'
  const s = new URLSearchParams(window.location.search).get('state')
  return s === 'loading' || s === 'empty' || s === 'error' ? s : 'ready'
}

type Chip = 'all' | 'recross' | 'needInput' | 'anomaly' | 'pending' | 'suspect'
const CHIP_TEST: Record<Chip, (r: Derived) => boolean> = {
  all: () => true,
  recross: r => r.recross === 'suspect' || r.recross === 'short',
  needInput: r => r.recross === 'needInput',
  anomaly: r => r.band === 'low' || r.band === 'high',
  pending: r => r.status === 'pending',
  suspect: r => r.status === 'suspect',
}

const firstDate = CROSSES.reduce((a, c) => (c.date < a ? c.date : a), CROSSES[0]!.date)
const lastDate = CROSSES.reduce((a, c) => (c.date > a ? c.date : a), CROSSES[0]!.date)
const firstHarvest = CROSSES.reduce((a, c) => (c.harvest < a ? c.harvest : a), CROSSES[0]!.harvest)
const lastHarvest = CROSSES.reduce((a, c) => (c.harvest > a ? c.harvest : a), CROSSES[0]!.harvest)
const ID_RANGE = `${CROSSES[0]!.id}~${CROSSES[CROSSES.length - 1]!.id}`

const sameOverride = (a: Override | undefined, b: Override | undefined) => (a?.status ?? null) === (b?.status ?? null) && (a?.reason ?? null) === (b?.reason ?? null)

/** 768~1279px 상세 서랍: 공통 BottomSheet를 오른쪽에 붙인다(옆 서랍 옵션이 공통에 없어 className으로, [공통] 요청) */
const DRAWER_CLASS = 'ml-auto h-full w-[min(34rem,100%)] rounded-t-none! border-t-0! border-l'

export default function Template() {
  const [devState, setDevState] = useState<DevState>(readState)
  const narrow = useMediaQuery('(max-width: 767px)')
  const xlUp = useMediaQuery('(min-width: 1280px)')
  const toast = useToast()
  const openerRef = useRef<HTMLElement | null>(null)

  const [saved, setSaved] = useState<Record<string, Fields>>(DEFAULT_FIELDS)
  const [fields, setFields] = useState<Record<string, Fields>>(DEFAULT_FIELDS)
  const [savedOverrides, setSavedOverrides] = useState<Record<string, Override | undefined>>({})
  const [overrides, setOverrides] = useState<Record<string, Override | undefined>>({})
  const [selected, setSelected] = useState(DEFAULT_SELECTED)
  const [chip, setChip] = useState<Chip>('all')
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const saveTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(saveTimer.current), [])

  const issues = useMemo(() => {
    const out: Record<string, FieldIssues> = {}
    for (const c of CROSSES) out[c.id] = validate(c, fields[c.id]!)
    return out
  }, [fields])
  const rows = useMemo(() => deriveAll(fields, saved, overrides), [fields, saved, overrides])
  const summary = useMemo(() => summarize(rows), [rows])

  const dirtyIds = useMemo(
    () => CROSSES.filter(c => (Object.keys(fields[c.id]!) as FieldKey[]).some(k => fields[c.id]![k] !== saved[c.id]![k]) || !sameOverride(overrides[c.id], savedOverrides[c.id])).map(c => c.id),
    [fields, saved, overrides, savedOverrides],
  )
  const dirtySet = useMemo(() => new Set(dirtyIds), [dirtyIds])
  const errorCount = useMemo(() => Object.values(issues).reduce((a, is) => a + Object.values(is).filter(i => i?.level === 'error').length, 0), [issues])
  const errorItems = useMemo(
    () => CROSSES.flatMap(c => (Object.keys(FIELD_LABEL) as FieldKey[]).flatMap(k => (issues[c.id]?.[k]?.level === 'error' ? [{ id: c.id, field: k, message: issues[c.id]![k]!.message }] : []))),
    [issues],
  )

  const chipCounts = useMemo(() => Object.fromEntries((Object.keys(CHIP_TEST) as Chip[]).map(k => [k, rows.filter(CHIP_TEST[k]).length])) as Record<Chip, number>, [rows])
  const visible = useMemo(() => {
    const q = query.trim().toUpperCase()
    return rows.filter(r => CHIP_TEST[chip](r) && (!q || r.cross.id.includes(q) || r.cross.female.includes(q) || r.cross.male.includes(q)))
  }, [rows, chip, query])

  const onChange = useCallback((id: string, key: FieldKey, value: string) => {
    setFields(prev => ({ ...prev, [id]: { ...prev[id]!, [key]: value } }))
  }, [])
  const onSelect = useCallback(
    (id: string) => {
      setSelected(id)
      if (!xlUp) {
        openerRef.current = document.activeElement as HTMLElement | null
        setSheetOpen(true)
      }
    },
    [xlUp],
  )
  const onFocusRow = useCallback((id: string) => setSelected(id), [])
  const closeSheet = () => {
    setSheetOpen(false)
    window.setTimeout(() => openerRef.current?.focus?.(), 0)
  }
  /** 오류 띠에서 해당 입력 칸으로 이동(필터로 숨어 있으면 필터를 푼다) */
  const jumpToError = (id: string, field: FieldKey) => {
    setChip('all')
    setQuery('')
    setSelected(id)
    if (field !== 'seeds' && narrow) {
      // 390px 카드에는 결실 립수 칸만 있다: 나머지 칸의 오류는 상세에서 확인한다
      setSheetOpen(true)
      return
    }
    window.setTimeout(() => document.querySelector<HTMLInputElement>(`input[aria-label='${id} ${FIELD_LABEL[field]}']`)?.focus(), 30)
  }
  const onStatus = (s: F1Status) => {
    const ks = kaspStatus(CROSS_BY_ID[selected]!)
    setOverrides(prev => ({ ...prev, [selected]: s === ks ? undefined : { status: s, reason: prev[selected]?.reason ?? 'reread' } }))
  }
  const onReason = (r: OverrideReason) => setOverrides(prev => (prev[selected] ? { ...prev, [selected]: { ...prev[selected]!, reason: r } } : prev))

  const save = () => {
    if (saving || errorCount > 0 || dirtyIds.length === 0) return
    const n = dirtyIds.length
    const pct = fmtRate(summary.progress)
    const snapFields = fields
    const snapOverrides = overrides
    setSaving(true)
    saveTimer.current = window.setTimeout(() => {
      setSaved(snapFields)
      setSavedOverrides(snapOverrides)
      setSaving(false)
      toast.show(`교배 실적 ${n}건을 저장했습니다 · F1 목표 진행률 ${pct}%`)
    }, SAVE_DELAY_MS)
  }
  const revert = () => {
    setFields(saved)
    setOverrides(savedOverrides)
  }

  useEffect(() => {
    if (xlUp) setSheetOpen(false)
  }, [xlUp])

  const selRow = rows.find(r => r.cross.id === selected)!

  // A. 머리(공통 PageHeader: 범위 회색 한 줄 → 제목 + 기준일 → 데이터 한 문장 → 접힌 방법 설명) + 회차 일정 한 줄
  const header = (
    <div className="flex flex-col gap-3">
      <PageHeader
        context={
          <>
            벼(<i>Oryza sativa</i>) · {ROUND_LABEL}(하계, 교배 망실)
          </>
        }
        title={meta.title}
        scope={`유전체 선발(GS) 부모 재순환 조합 ${ID_RANGE}(${CROSSES.length}조합) · 결실률은 결실 립수 ÷ 교배 영화로 계산 · F1 진위는 KASP 다형 마커 판정 · 가상 목업 데이터`}
        asOf={AS_OF}
        details={
          <>
            모본을 제웅(除雄, emasculation)하고 남긴 영화(穎花, spikelet)에 부본 꽃가루를 수분한다. 수확한 종자로 결실률(seed set)을 계산하고, F1(잡종 1세대) 유묘를 KASP(경쟁적 대립유전자 특이 PCR){' '}
            {MARKER_PANEL_SIZE}마커 중 부모 간 다형 마커(polymorphic marker)로 검정해 자식(自殖, selfing) 개체를 가려낸다.
          </>
        }
      />
      <ScrollRegion label="회차 일정(가로 스크롤)" hint={false} fadeColor="var(--color-bg)">
        <ol aria-label="회차 일정" className="flex w-max gap-1.5 text-xs">
          {[
            { k: '교배', v: `${mmdd(firstDate)}~${mmdd(lastDate)}`, done: true },
            { k: `F1 조기 수확(교배 후 ${EARLY_HARVEST_DAP}일)`, v: `${mmdd(firstHarvest)}~${mmdd(lastHarvest)}`, done: true },
            { k: `진위 확인 1차 ${BATCHES[1].plate}`, v: `${mmdd(BATCHES[1].resulted)} 결과`, done: true },
            { k: `2차 ${BATCHES[2].plate}`, v: `${mmdd(BATCHES[2].received)} 접수 예정`, done: false },
          ].map((s, i) => (
            // 현재 단계 = 잉크 채움(Stepper 현재 단계와 같은 문법), 지난 단계 = 체크
            <li
              key={i}
              aria-current={s.done ? undefined : 'step'}
              className={cn('flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1.5', s.done ? 'border-border bg-surface text-text' : 'border-primary bg-primary text-primary-contrast')}
            >
              {s.done && <Check size={13} aria-hidden="true" className="text-muted" />}
              <span className={s.done ? 'text-muted' : undefined}>{s.k}</span>
              <span className="font-semibold tabular-nums">{s.v}</span>
              <span className="sr-only">{s.done ? '(완료)' : '(현재 단계)'}</span>
            </li>
          ))}
        </ol>
      </ScrollRegion>
    </div>
  )

  if (devState === 'loading')
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <div role="status" className="sr-only">
          교배 실적을 불러오는 중입니다
        </div>
        <KpiRow loading hero count={4} skeletonHeight={150} ariaLabel="요약" />
        <Skeleton height={36} />
        <Skeleton height={480} />
      </div>
    )
  if (devState === 'empty')
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState title="이 회차에 기록된 교배 조합이 없습니다" description="교배 계획에서 조합을 확정하면 이곳에 실적 입력 행이 만들어집니다." />
      </div>
    )
  if (devState === 'error')
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState
          title="교배 실적을 불러오지 못했습니다"
          description="네트워크 연결을 확인한 뒤 다시 시도하세요."
          action={
            <Button variant="primary" onClick={() => setDevState('ready')}>
              다시 시도
            </Button>
          }
        />
      </div>
    )

  const chips: { k: Chip; label: string }[] = [
    { k: 'all', label: `전체 ${chipCounts.all}` },
    { k: 'recross', label: `재교배 필요 ${chipCounts.recross}` },
    { k: 'needInput', label: `입력 필요 ${chipCounts.needInput}` },
    { k: 'anomaly', label: `결실 이상 ${chipCounts.anomaly}(저조 ${summary.bands.low} · 과다 ${summary.bands.high})` },
    { k: 'pending', label: `F1 대기 ${chipCounts.pending}` },
    { k: 'suspect', label: `자식 의심 ${chipCounts.suspect}` },
  ]

  const detail = <CrossDetail row={selRow} issues={issues[selected]} override={overrides[selected]} onStatus={onStatus} onReason={onReason} titleId="cr-detail-title" />
  const entryProps = { rows: visible, fields, saved, issues, dirty: dirtySet, selected, onSelect, onFocusRow, onChange }
  const canSave = dirtyIds.length > 0 && errorCount === 0 && !saving

  return (
    <div className="flex flex-col gap-4">
      {header}

      <SummaryRow s={summary} rows={rows} dirty={dirtyIds.length > 0} />

      {/* C. 필터 칩 + 검색 */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="조합 필터" className="flex flex-wrap gap-1.5 touch:gap-2">
          {chips.map(c => (
            <FilterChip key={c.k} pressed={chip === c.k} onClick={() => setChip(c.k)} label={<span className="tabular-nums">{c.label}</span>} />
          ))}
        </div>
        <label className="relative flex items-center">
          <span className="sr-only">조합 ID·계통명 검색</span>
          <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 text-muted" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="조합 ID·계통명 검색"
            className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-2 text-[13px] text-text placeholder:text-muted touch:h-11 lg:w-60"
          />
        </label>
      </div>

      {/* D + F */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card
          className="xl:self-start"
          title="교배 실적 입력"
          subtitle={`${visible.length}조합 표시 · 결실률은 계산값(입력하지 않음) · 정상 ${RATE_LOW}~${RATE_HIGH}%`}
          padding={narrow ? 'sm' : 'md'}
        >
          {narrow ? <CrossCards {...entryProps} /> : <EntryTable {...entryProps} />}
        </Card>
        {xlUp && (
          <Card title="조합 상세" className="xl:sticky xl:top-4 xl:self-start">
            {detail}
          </Card>
        )}
      </div>

      {/* E */}
      <Card
        title="조합별 유효 F1 종자"
        subtitle={`목표 ${TARGET_SEEDS}립 아래 ${rows.filter(r => r.eff < TARGET_SEEDS).length}조합 · 막대를 누르면 표와 상세가 같은 조합으로 바뀝니다`}
      >
        <ProgressChart rows={rows} selected={selected} onSelect={onSelect} narrow={narrow} />
      </Card>

      <footer className="flex flex-col gap-0.5 text-xs leading-relaxed text-muted">
        <p>모든 계통명·수치는 가상 목업 데이터입니다. 유전자 이름은 실제 이름이지만 계통별 보유 여부는 가상입니다.</p>
        <p>
          결실률 정상 범위({RATE_LOW}~{RATE_HIGH}%)와 목표 F1 종자 수({TARGET_SEEDS}립)는 이 프로그램의 내부 기준(추정)입니다.
        </p>
        <p>F1 진위는 KASP {MARKER_PANEL_SIZE}마커 중 부모 간 다형 마커로 판정합니다(분석실 패널과 같음).</p>
      </footer>

      {/* 상세: 390px 하단 시트, 768~1279px 오른쪽 서랍. 시트를 닫지 않고 저장한다(검토 R4). 저장 버튼이 SaveBar보다 DOM 앞에 오도록 먼저 둔다 */}
      <BottomSheet
        open={!xlUp && sheetOpen}
        onClose={closeSheet}
        labelledBy="cr-detail-title"
        maxHeight={narrow ? '88vh' : '100%'}
        className={narrow ? undefined : DRAWER_CLASS}
        header={`${selected} · 조합 상세`}
        footer={
          <>
            <span className={`text-xs tabular-nums ${errorCount ? 'font-semibold text-negative' : 'text-muted'}`} aria-live="polite">
              {errorCount ? `오류 ${errorCount}건을 고쳐야 저장할 수 있습니다` : `변경 ${dirtyIds.length}건`}
            </span>
            <Button variant="primary" data-action="save" onClick={save} disabled={!canSave} className="min-h-11 px-6">
              {saving ? '저장 중…' : '저장'}
            </Button>
          </>
        }
      >
        {detail}
      </BottomSheet>

      {/* G. 저장 바 + 오류 요약 띠(문구가 표 칸을 벌리지 않게 띠로 모은다, 검토 R3) */}
      <div className={`${dirtyIds.length > 0 || saving ? 'sticky bottom-0 z-20' : 'max-sm:sticky max-sm:bottom-0 max-sm:z-20'} flex flex-col gap-2`}>
        {errorItems.length > 0 && (
          <div role="alert" id="cr-save-errors" className="flex flex-col gap-1 rounded-md border border-negative/50 bg-surface px-3 py-2 text-[13px] text-negative shadow-1">
            <b className="inline-flex items-center gap-1.5">
              <AlertTriangle size={14} aria-hidden="true" className="shrink-0" />
              입력 오류 {errorItems.length}건
            </b>
            <ul className="flex flex-col gap-0.5">
              {errorItems.map(e => (
                <li key={`${e.id}-${e.field}`}>
                  <button type="button" onClick={() => jumpToError(e.id, e.field)} className="touch-hit-y text-left font-semibold underline underline-offset-2">
                    {e.id} {FIELD_LABEL[e.field]}
                  </button>{' '}
                  {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        <SaveBar dirty={dirtyIds.length} errors={errorCount} saving={saving} onSave={save} onRevert={revert} />
      </div>

      <Toast {...toast.toastProps} className="max-sm:bottom-28!" />
    </div>
  )
}
