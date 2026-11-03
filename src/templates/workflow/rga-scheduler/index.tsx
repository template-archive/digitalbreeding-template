import { useEffect, useMemo, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import type { TemplateMeta } from '@/gallery/types'
import {
  AlertList,
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  ErrorState,
  KpiRow,
  KpiTile,
  PageHeader,
  SaveBar,
  Skeleton,
  Toast,
  useMediaQuery,
  useToast,
  type AlertListItem,
} from '@/design-system'
import { formatNumber } from '@/lib/format'
import {
  AS_OF,
  BATCHES,
  BATCH_BY_ID,
  BEDS,
  CLEAN,
  DAYLENGTH_H,
  DEADLINE_GS,
  EDIT_GEN,
  F1_TO_F6_DAYS,
  F1_TO_F6_YEARS,
  GEN_DAYS,
  GEN_PER_YEAR,
  L_DESIGN,
  L_PARTS,
  P27,
  P27_ALL,
  P27_BEDS,
  P27_DAYLENGTH_NOTE,
  P27_FIRST,
  SAVE_DELAY_MS,
  TOTAL_CAP,
  WIN,
  buildPlan,
  dDay,
  draftFromSaved,
  fmtD,
  hasError,
  hasWarning,
  overrideOf,
  sameDraft,
  summarize,
  validate,
  weekday,
  weekly,
  type AlertRow,
  type BedId,
  type Draft,
  type Drafts,
  type Overrides,
  type Validation,
} from './data'
import { BedGantt, GanttLegend, type Selection } from './components/BedGantt'
import { OccupancyChart } from './components/OccupancyChart'
import { BatchCards, BatchTable, buildRows } from './components/BatchTable'
import { BatchDetail, ParentDetail } from './components/BatchDetail'
import { BedDetail } from './components/BedDetail'

export const meta: TemplateMeta = {
  slug: 'rga-scheduler',
  category: 'workflow',
  title: '속성세대진전 일정',
  description: '속성세대진전(RGA) 온실 10베드의 세대별 파종·출수·수확 일정을 간트로 보고, 다음 세대 파종일·베드·세대 단축 방법을 고쳐 수용량·정비 충돌과 유전체 선발(GS) 시료 마감을 확인한 뒤 저장한다.',
  tags: ['속성세대진전', 'RGA', 'SSD', '세대 진전', '온실', '간트', '일정', 'GS', '벼'],
  organism: '벼',
  status: 'review',
  updatedAt: '2026-11-02',
}

type DevState = 'ready' | 'loading' | 'empty' | 'error'
function readDevState(): DevState {
  if (typeof window === 'undefined') return 'ready'
  const s = new URLSearchParams(window.location.search).get('state')
  return s === 'loading' || s === 'empty' || s === 'error' ? s : 'ready'
}

const TITLE = '속성세대진전 일정'
const SCOPE = `단일(短日) 처리 ${DAYLENGTH_H}시간 · 세대당 ${GEN_DAYS}일(연 ${GEN_PER_YEAR.toFixed(1)}세대) · 단립계통법(SSD) · F6 잎은 유전체 선발(GS) 1차 6K 단일 염기 다형성(SNP) 칩 시료`
const DEFAULT_SELECTION: Selection = { type: 'batch', id: 'R26-4' }
/** 640~1279px 상세 서랍: 공통 BottomSheet를 오른쪽에 붙인다(옆 서랍 옵션이 공통에 없어 className으로, [공통] 요청) */
const DRAWER_CLASS = 'ml-auto h-full w-[min(34rem,100%)] rounded-t-none! border-t-0! border-l'

export default function Template() {
  const [devState, setDevState] = useState<DevState>(readDevState)
  if (devState !== 'ready') return <DevStateView state={devState} onRetry={() => setDevState('ready')} />
  return <RgaScheduler />
}

/** 페이지 머리(공통 PageHeader): 작물·시설 → 제목 + 기준일 → 세대 진전 설정 한 문장. 상태 화면도 같은 머리 */
function Header() {
  return <PageHeader context={['벼', `속성세대진전(RGA) 온실 2동 ${BEDS.length}베드`, '가상 기관 목업']} title={TITLE} scope={SCOPE} asOf={`${AS_OF}(${weekday(AS_OF)})`} />
}

function RgaScheduler() {
  const [saved, setSaved] = useState<Overrides>({})
  const [drafts, setDrafts] = useState<Drafts>({})
  const [selection, setSelection] = useState<Selection>(DEFAULT_SELECTION)
  const [saving, setSaving] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const narrow = useMediaQuery('(max-width: 639px)')
  const xlUp = useMediaQuery('(min-width: 1280px)')
  const toast = useToast()
  const openerRef = useRef<HTMLElement | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(saveTimer.current), [])
  useEffect(() => {
    if (xlUp) setSheetOpen(false)
  }, [xlUp])

  const savedPlan = useMemo(() => buildPlan(saved), [saved])
  const draftOverrides = useMemo(() => {
    const o: Overrides = { ...saved }
    for (const [id, d] of Object.entries(drafts)) {
      const ov = overrideOf(BATCH_BY_ID.get(id)!, d!)
      if (ov) o[id] = ov
    }
    return o
  }, [saved, drafts])
  const plan = useMemo(() => buildPlan(draftOverrides), [draftOverrides])
  const dirtyIds = useMemo(() => new Set(Object.keys(drafts)), [drafts])

  const draftOf = (id: string): Draft => drafts[id] ?? draftFromSaved(BATCH_BY_ID.get(id)!, savedPlan.scheds.get(id)!)
  const validations = useMemo(() => {
    const m = new Map<string, Validation>()
    for (const b of BATCHES) m.set(b.id, validate(b, drafts[b.id] ?? draftFromSaved(b, savedPlan.scheds.get(b.id)!), plan))
    return m
  }, [drafts, plan, savedPlan])
  const dirtyV = [...dirtyIds].map(id => ({ id, v: validations.get(id)! }))
  const errorCount = dirtyV.filter(x => hasError(x.v)).length
  const warnCount = dirtyV.filter(x => hasWarning(x.v)).length
  // 마감 지연(경보)과 마감 주의(여유 14일 이하)를 나눠 센다 — 경보 목록이 '경보 · n일 지연'인 항목을 저장 바가 '주의'라고 부르지 않게
  const lateCount = dirtyV.filter(x => x.v.deadline.status === 'late').length
  const cautionCount = dirtyV.filter(x => x.v.deadline.status === 'caution').length
  const saveState = errorCount > 0 ? 'error' : dirtyIds.size === 0 ? 'clean' : warnCount > 0 ? 'warn' : 'dirty'

  const s = useMemo(() => summarize(savedPlan), [savedPlan])
  const weeks = useMemo(() => weekly(savedPlan), [savedPlan])
  const rows = useMemo(() => buildRows(plan, dirtyIds, AS_OF), [plan, dirtyIds])

  const setDraft = (id: string, d: Draft) => {
    const b = BATCH_BY_ID.get(id)!
    setDrafts(prev => {
      const next = { ...prev }
      if (sameDraft(d, draftFromSaved(b, savedPlan.scheds.get(id)!))) delete next[id]
      else next[id] = d
      return next
    })
  }

  // 1280px 이상은 목록 옆 패널, 미만은 시트(390)·서랍(640~1279): 행을 누를 때마다 아래로 튀지 않고 시트 안에서 저장한다
  const reveal = () => {
    if (xlUp) return
    if (!sheetOpen) openerRef.current = document.activeElement as HTMLElement | null
    setSheetOpen(true)
  }
  const closeSheet = () => {
    setSheetOpen(false)
    window.setTimeout(() => openerRef.current?.focus?.({ preventScroll: true }), 0)
  }
  const selectBatch = (id: string) => {
    setSelection({ type: 'batch', id })
    reveal()
  }
  const selectBed = (bed: BedId) => {
    setSelection({ type: 'bed', id: bed })
    reveal()
  }

  const save = () => {
    if (saving || dirtyIds.size === 0 || errorCount > 0) return
    const snap = { ...draftOverrides }
    const items = dirtyV.map(x => ({ id: x.id, v: x.v, ov: snap[x.id]! }))
    setSaving(true)
    saveTimer.current = window.setTimeout(() => {
      setSaved(snap)
      setDrafts({})
      setSaving(false)
      // 마감 지연(경보)·마감 주의를 나눠 적는다(여러 건이면 묶음 ID를 붙임)
      const late = items.filter(x => x.v.deadline.status === 'late')
      const caution = items.filter(x => x.v.deadline.status === 'caution')
      const lateText = (v: Validation) => `GS 1차 시료 채취 ${-v.deadline.slack}일 늦음`
      const cautionText = (v: Validation) => `마감 여유 ${v.deadline.slack}일`
      const deadlineParts = (withId: boolean) =>
        [
          late.length ? `마감 지연 ${late.length}건(${late.map(x => `${withId ? `${x.id} ` : ''}${lateText(x.v)}`).join(', ')})` : '',
          caution.length ? `마감 주의 ${caution.length}건(${caution.map(x => `${withId ? `${x.id} ` : ''}${cautionText(x.v)}`).join(', ')})` : '',
        ].filter(Boolean)
      let msg: string
      if (items.length === 1) {
        const { id, ov } = items[0]!
        const parts = deadlineParts(false)
        msg = parts.length
          ? `${id} 일정을 저장했습니다 · ${parts.join(' · ')}`
          : `${id} 일정을 저장했습니다 · F${ov.gen} 파종 ${fmtD(ov.sow)} · ${ov.bed} · 이후 ${6 - ov.gen}세대 다시 계산`
      } else {
        const parts = deadlineParts(true)
        msg = `일정 ${items.length}건을 저장했습니다${parts.length ? ` · ${parts.join(' · ')}` : ''}`
      }
      toast.show(msg, { tone: late.length || caution.length ? 'warning' : 'positive' })
    }, SAVE_DELAY_MS)
  }
  const revert = () => setDrafts({})

  // ---------------- KPI 값(저장된 일정)
  const occPct = (100 * s.cells) / TOTAL_CAP
  const occSub = `셀 ${formatNumber(s.cells)} / ${formatNumber(TOTAL_CAP)}(${occPct.toFixed(1)}%) · 빈 베드 ${s.emptyBeds.length ? s.emptyBeds.join('·') : '없음'}`
  const genSub = `세대당 ${GEN_DAYS}일 · F1→F6 종자 ${F1_TO_F6_YEARS.toFixed(1)}년(${F1_TO_F6_DAYS}일) · 세대 간격 L ${L_DESIGN.toFixed(1)}년(설계값)`
  const gs = s.gs27
  const gsMinText = gs.min.slack < 0 ? `${gs.min.b.id} ${-gs.min.slack}일 지연` : `최소 여유 ${gs.min.slack}일(${gs.min.b.id})`
  const gsSub = `마감 ${DEADLINE_GS[2027]}(D-${dDay(DEADLINE_GS[2027])}) · ${gsMinText} · ${formatNumber(gs.lines)}계통`
  const parentConflict = s.parentConflicts.length > 0
  const parentSub = `첫 파종 ${P27_FIRST.sow1}(${P27_FIRST.name}) · 부모 ${P27_ALL.length}계통 · ${P27_BEDS.join('·')} ${parentConflict ? '충돌' : '확보'}`
  const parentD = dDay(P27_FIRST.sow1)

  // ---------------- 경보
  const onAlert = (a: AlertRow) => (a.batch ? () => selectBatch(a.batch!) : a.bed ? () => selectBed(a.bed!) : undefined)
  const alertItems: AlertListItem[] = s.alerts
    .filter(a => a.level !== 'info')
    .map(a => ({ id: a.id, severity: a.level === 'critical' ? 'critical' : 'warning', title: a.title, description: a.description, onClick: onAlert(a), actionLabel: '— 상세 보기' }))
  const infoItems: AlertListItem[] = s.alerts
    .filter(a => a.level === 'info')
    .map(a => ({ id: a.id, severity: 'info', title: a.title, description: a.description, onClick: onAlert(a), actionLabel: '— 상세 보기' }))
  const nCrit = s.alerts.filter(a => a.level === 'critical').length
  const nWarn = s.alerts.filter(a => a.level === 'warning').length

  // ---------------- 상세
  let detail
  if (selection.type === 'bed') detail = <BedDetail bed={selection.id as BedId} plan={plan} onSelectBatch={selectBatch} />
  else {
    const b = BATCH_BY_ID.get(selection.id)
    const p = P27.find(x => x.id === selection.id)
    if (b) detail = <BatchDetail key={b.id} b={b} plan={plan} saved={savedPlan} draft={draftOf(b.id)} v={validations.get(b.id)!} dirty={dirtyIds.has(b.id)} onDraft={d => setDraft(b.id, d)} />
    else if (p) detail = <ParentDetail p={p} />
  }
  const selectedRow = selection.type === 'batch' ? selection.id : null
  const detailTitle = selection.type === 'bed' ? '베드 상세' : P27.some(p => p.id === selection.id) ? '교배 부모 상세' : '묶음 상세·일정 편집'

  return (
    <div className="flex flex-col gap-5">
      <Header />

      {/* B. KPI(공통 KpiRow: 1440 대표 2칸 + 3 · 768 대표 2칸 + 1 / 2 · 390 대표 전체 폭 + 2열) */}
      <KpiRow hero ariaLabel="속성세대진전 요약">
        <KpiTile
          size="hero"
          label={`베드 점유(${fmtD(AS_OF)})`}
          value={`${s.occupiedBeds} / ${BEDS.length}`}
          unit="베드"
          sub={occSub}
          achievement={occPct}
          achievementDigits={1}
          achievementLabel="셀 점유율"
          targetLabel={`수용량 ${formatNumber(TOTAL_CAP)}셀`}
        />
        <KpiTile label="세대 진전 속도" value={`연 ${GEN_PER_YEAR.toFixed(1)}`} unit="세대" sub={genSub} />
        <KpiTile
          label="2027 GS 1차 시료 채취"
          value={`${gs.ok} / ${gs.total}`}
          unit="묶음 충족"
          sub={gsSub}
          achievement={(100 * gs.ok) / gs.total}
          achievementLabel="충족률"
          targetLabel={`${gs.total}묶음`}
          severity={gs.late ? 'critical' : gs.caution ? 'warning' : 'ok'}
          badge={gs.late ? <Badge tone="negative">{gs.late}묶음 지연</Badge> : undefined}
        />
        <KpiTile
          label="2027년 1차 교배 부모 파종"
          value={`D-${parentD}`}
          sub={parentSub}
          severity={parentConflict ? 'critical' : undefined}
          badge={parentConflict ? <Badge tone="negative">베드 충돌</Badge> : undefined}
        />
      </KpiRow>

      {/* C | E */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card title="경보·주의" subtitle={`저장된 일정 기준 · 경보 ${nCrit} · 주의 ${nWarn} · 정보 ${infoItems.length}`} className="xl:col-span-2">
          <div className="flex flex-col gap-2">
            <AlertList items={alertItems} ariaLabel={`경보 ${nCrit}건, 주의 ${nWarn}건`} density="compact" emptyText="경보·주의 없음" />
            {infoItems.length > 0 && <AlertList items={infoItems} ariaLabel={`정보 ${infoItems.length}건`} density="compact" />}
          </div>
        </Card>
        <Card title="셀 점유 추이(주별)" subtitle={`매주 월요일 셀 합 · 향후 90일(${fmtD(AS_OF)}~) 평균 ${s.avg90.toFixed(1)}% · 저장된 일정 기준`} className="xl:col-span-3">
          <OccupancyChart weeks={weeks} avg90={s.avg90} />
        </Card>
      </div>

      {/* D. 간트 */}
      <Card
        title="베드 간트"
        subtitle={`${WIN.from} ~ ${WIN.to} · 막대 = 파종 → 수확(+정리 ${CLEAN}일 옅게), 출수 지점 눈금 · 막대를 누르면 묶음, 베드 이름을 누르면 베드 상세`}
        padding={narrow ? 'sm' : 'md'}
      >
        <div className="flex flex-col gap-2">
          <GanttLegend />
          <BedGantt plan={plan} saved={savedPlan} dirty={dirtyIds} selection={selection} onSelectBatch={selectBatch} onSelectBed={selectBed} />
        </div>
      </Card>

      {/* F | G·H — 표·상세는 각자 내용 높이(옆 카드 높이로 늘어난 빈 띠 없음) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5 xl:items-start">
        <Card title="파종 묶음" subtitle={`묶음 ${BATCHES.length}개 + 2027 교배 부모 ${P27.length}개 · 1묶음 = 1베드 · 행을 누르면 상세`} padding={narrow ? 'sm' : 'md'} className="min-w-0 xl:col-span-3">
          {narrow ? <BatchCards rows={rows} selected={selectedRow} onSelect={selectBatch} /> : <BatchTable rows={rows} selected={selectedRow} onSelect={selectBatch} />}
        </Card>
        {xlUp && (
          <div className="min-w-0 xl:col-span-2">
            <Card title={detailTitle} subtitle={selection.type === 'bed' ? '베드 이름을 다시 누르거나 묶음을 누르면 바뀝니다' : '고친 일정은 저장 전까지 이 화면에만 미리보기로 반영됩니다'}>
              {detail}
            </Card>
          </div>
        )}
      </div>

      {/* J. 각주 */}
      <footer className="flex flex-col gap-1 border-t border-border pt-3 text-xs leading-relaxed text-muted">
        <p>세대당 일수·시설 규모·마감일은 가상 기관의 추정 목업입니다. 2028 GS 마감은 2027과 같은 규칙으로 정한 추정값입니다.</p>
        <p>
          F2~F6은 거둔 종자 세대 기준(F1~F5 재배)입니다. 세대 간격 L {L_DESIGN.toFixed(1)}년은 디지털 공정 설계값({L_PARTS.map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' + ')})이며, 유전체 추정 육종가(GEBV) 예측 단계를 포함합니다.
        </p>
        <p>KASP F2 시료(YR25-F2-…)는 같은 조합의 잔여 F2 종자로 키운 마커 보조 선발(MAS) 집단으로 이 온실 범위 밖입니다.</p>
        <p>속성세대진전 세대 수 근거: IRRI SpeedFlower(연 4~5세대). 이 화면의 연 {GEN_PER_YEAR.toFixed(1)}세대는 그보다 보수적인 설정입니다.</p>
        <p>{P27_DAYLENGTH_NOTE}</p>
      </footer>

      {/* 상세: 390px 하단 시트, 640~1279px 오른쪽 서랍. 시트를 닫지 않고 저장한다. 저장 버튼이 SaveBar보다 DOM 앞에 오도록 먼저 둔다 */}
      <BottomSheet
        open={!xlUp && sheetOpen}
        onClose={closeSheet}
        labelledBy="rga-sheet-title"
        maxHeight={narrow ? '88vh' : '100%'}
        className={narrow ? undefined : DRAWER_CLASS}
        header={<span id="rga-sheet-title">{`${selection.id} · ${detailTitle}`}</span>}
        footer={
          <>
            <span className={`text-xs tabular-nums ${errorCount ? 'font-semibold text-negative' : 'text-muted'}`} aria-live="polite">
              {errorCount ? `오류 ${errorCount}건을 고치면 저장할 수 있습니다` : `변경 ${dirtyIds.size}건`}
            </span>
            <Button variant="primary" data-action="save" onClick={save} disabled={dirtyIds.size === 0 || errorCount > 0 || saving} className="min-h-11 px-6">
              {saving ? '저장 중…' : '저장'}
            </Button>
          </>
        }
      >
        {detail}
      </BottomSheet>

      {/* I. 저장 바: 미저장이 있으면 화면 아래에 붙는다. 390px은 늘 붙는다 */}
      <div data-save-state={saveState} className={dirtyIds.size > 0 || saving ? 'sticky bottom-0 z-20' : 'max-sm:sticky max-sm:bottom-0 max-sm:z-20'}>
        <SaveBar
          placement="bottom"
          dirty={dirtyIds.size}
          saving={saving}
          canSave={dirtyIds.size > 0 && errorCount === 0 && !saving}
          onSave={save}
          onRevert={revert}
          blockReasonId={errorCount > 0 ? 'rga-save-block' : undefined}
          saveButtonProps={{ 'data-action': 'save' }}
        >
          <span aria-live="polite" className="font-semibold tabular-nums text-text">
            {saving ? '저장 중…' : `변경 ${dirtyIds.size}건 · 오류 ${errorCount}건 · 마감 지연 ${lateCount}건 · 마감 주의 ${cautionCount}건`}
          </span>
          {errorCount > 0 && (
            <span id="rga-save-block" className="font-semibold text-negative">
              오류를 고치면 저장할 수 있습니다({dirtyV.filter(x => hasError(x.v)).map(x => x.id).join(', ')})
            </span>
          )}
          {errorCount === 0 && dirtyIds.size > 0 && (
            <span className="text-muted">
              {[...dirtyIds].map(id => `${id} F${EDIT_GEN[id]}`).join(', ')} 미리보기 중
            </span>
          )}
        </SaveBar>
      </div>

      <Toast {...toast.toastProps} className="max-sm:bottom-28!" />
    </div>
  )
}

// ---------------------------------------------------------------- 상태 화면

function DevStateView({ state, onRetry }: { state: Exclude<DevState, 'ready'>; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <Header />
      {state === 'loading' && (
        <div aria-busy="true" aria-label="세대 진전 일정을 불러오는 중" className="flex flex-col gap-4">
          <KpiRow loading hero count={4} skeletonHeight={150} ariaLabel="속성세대진전 요약" />
          <Skeleton height={420} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <Skeleton height={360} className="xl:col-span-3" />
            <Skeleton height={360} className="xl:col-span-2" />
          </div>
        </div>
      )}
      {state === 'empty' && (
        <EmptyState
          title="등록된 파종 묶음이 없습니다"
          description="교배 기록에서 F1 파종 묶음을 등록하면 베드별 세대 일정과 마감 점검이 여기에 표시됩니다."
        />
      )}
      {state === 'error' && (
        <ErrorState
          title="세대 진전 일정을 불러오지 못했습니다"
          description="온실 관리 서버와 연결을 확인한 뒤 다시 시도하세요."
          action={
            <Button size="sm" onClick={onRetry}>
              다시 시도
            </Button>
          }
        />
      )}
      <p className="flex items-center gap-1 text-xs text-muted">
        <Info size={12} aria-hidden="true" />
        개발용 상태 화면(?state={state})
      </p>
    </div>
  )
}
