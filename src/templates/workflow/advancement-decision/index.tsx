import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Info, Wand2 } from 'lucide-react'
import type { TemplateMeta } from '@/gallery/types'
import {
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
  SummaryCallout,
  Toast,
  useMediaQuery,
  useToast,
  type DataTableSort,
} from '@/design-system'
import { formatNumber, josa } from '@/lib/format'
import {
  AS_OF,
  CHECK_LINES,
  CHECK_MET_MEAN,
  GEBV_MODEL,
  HIGH,
  LINE_BY_NAME,
  MET,
  MET_TARGET,
  REVIEWER,
  REVIEW_MEETING,
  SAVED_AT,
  SAVED_AT_NEXT,
  SAVED_DECISIONS,
  SAVE_DELAY_MS,
  STD,
  TEST_LINES,
  TRAIT_LABEL,
  TRAIT_ORDER,
  TRIAL,
  TRIAL_CV,
  applyRecommendations,
  differs,
  needsReason,
  sameState,
  summarize,
  type Decision,
  type Decisions,
} from './data'
import { f1 } from './components/ui'
import { CriteriaCard } from './components/CriteriaCard'
import { IndexGebvScatter } from './components/IndexGebvScatter'
import { DEFAULT_FILTERS, LineCards, LineTable, Toolbar, matches, type Filters, type Row } from './components/LineTable'
import { LineDetail, type DetailHandlers } from './components/LineDetail'
import { DecisionSummary } from './components/DecisionSummary'

export const meta: TemplateMeta = {
  slug: 'advancement-decision',
  category: 'workflow',
  title: '계통 진급 심사',
  description: '2026 생산력 검정(AYT) 성적·필수 형질 한계·수량 GEBV로 2027 지역 적응 시험(MET)에 올릴 계통을 자동 판정과 비교해 진급·보류·탈락으로 정하고 저장한다.',
  tags: ['진급 심사', 'AYT', 'MET', '선발', 'GEBV', '대비 품종', '진급 지수', '벼'],
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

const DEFAULT_SELECTED = [...TEST_LINES].sort((a, b) => a.rank - b.rank)[0]!.name
const DEFAULT_SORT: DataTableSort = { key: 'index', dir: 'desc' }
const TITLE = '계통 진급 심사'
/** 640~1279px 상세 서랍: 공통 BottomSheet를 오른쪽에 붙인다(옆 서랍 옵션이 공통에 없어 className으로, [공통] 요청) */
const DRAWER_CLASS = 'ml-auto h-full w-[min(34rem,100%)] rounded-t-none! border-t-0! border-l'

/** 페이지 머리(공통 PageHeader): 범위·소속·심사자 → 제목 + 마지막 저장 → 시험 한 문장. 상태 화면도 같은 머리 */
function Header({ savedAt }: { savedAt: string }) {
  return (
    <PageHeader
      context={[`${TRIAL.crop} · ${TRIAL.name} → ${MET.year} 지역 적응 시험(MET)`, TRIAL.field, `심사자 ${REVIEWER.name}(${REVIEWER.team})`]}
      title={TITLE}
      scope={`${TRIAL.design} · ${TRIAL.lines}계통 + 대비 ${TRIAL.checks} · 시험 CV ${f1(TRIAL_CV)}% · 자료 기준 ${AS_OF} · 심사회의 ${REVIEW_MEETING}(예정) · 계통명·수치는 가상 목업`}
      asOfLabel="마지막 저장"
      asOf={savedAt}
    />
  )
}

export default function Template() {
  const [devState, setDevState] = useState<DevState>(readDevState)
  if (devState !== 'ready') return <DevStateView state={devState} onRetry={() => setDevState('ready')} />
  return <AdvancementDecision />
}

function AdvancementDecision() {
  const [decisions, setDecisions] = useState<Decisions>(SAVED_DECISIONS)
  const [saved, setSaved] = useState<Decisions>(SAVED_DECISIONS)
  const [savedAt, setSavedAt] = useState(SAVED_AT)
  const [selected, setSelected] = useState(DEFAULT_SELECTED)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<DataTableSort>(DEFAULT_SORT)
  const [saving, setSaving] = useState(false)
  const [errorLines, setErrorLines] = useState<Set<string>>(new Set())
  const [sheetOpen, setSheetOpen] = useState(false)
  const narrow = useMediaQuery('(max-width: 639px)')
  const xlUp = useMediaQuery('(min-width: 1280px)')
  const toast = useToast()
  const detailRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(saveTimer.current), [])

  const s = useMemo(() => summarize(decisions, saved), [decisions, saved])

  // 오류 = 저장을 눌러 걸린 계통 중 아직 사유가 부족한 계통(사유를 채우면 즉시 사라진다)
  const errors = useMemo(() => TEST_LINES.filter(l => errorLines.has(l.name) && needsReason(l, decisions[l.name]!)).map(l => l.name), [errorLines, decisions])
  const errorSet = useMemo(() => new Set(errors), [errors])

  const rows: Row[] = useMemo(
    () =>
      TEST_LINES.map(l => {
        const st = decisions[l.name]!
        return { line: l, st, dirty: !sameState(st, saved[l.name]!), differ: differs(l, st), error: errorSet.has(l.name) }
      }),
    [decisions, saved, errorSet],
  )
  const checkRows: Row[] = useMemo(() => CHECK_LINES.map(l => ({ line: l, st: null, dirty: false, differ: false, error: false })), [])
  const visibleRows = useMemo(() => rows.filter(r => matches(r, filters)), [rows, filters])
  const visibleNames = useMemo(() => new Set([...visibleRows.map(r => r.line.name), ...CHECK_LINES.map(l => l.name)]), [visibleRows])

  useEffect(() => {
    if (xlUp) setSheetOpen(false)
  }, [xlUp])

  // 1280px 이상은 목록 옆 패널, 미만은 시트(390)·서랍(640~1279)이라 행을 누를 때마다 스크롤로 튀지 않는다(검토 A2)
  const select = (name: string, reveal = false) => {
    setSelected(name)
    if (!xlUp) {
      if (!sheetOpen) openerRef.current = document.activeElement as HTMLElement | null
      setSheetOpen(true)
    } else if (reveal) window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 30)
  }
  const closeSheet = () => {
    setSheetOpen(false)
    window.setTimeout(() => openerRef.current?.focus?.(), 0)
  }

  const line = LINE_BY_NAME.get(selected)!
  const st = line.check ? null : decisions[line.name]!
  const setLine = (patch: Partial<{ decision: Decision | null; reason: string }>) => setDecisions(prev => ({ ...prev, [selected]: { ...prev[selected]!, ...patch } }))
  const handlers: DetailHandlers = {
    onDecision: d => setLine({ decision: d }),
    onRevertToRec: () => setLine({ decision: line.rec }),
    onReason: text => setLine({ reason: text }),
  }

  const save = () => {
    if (saving || s.dirty === 0) return
    const bad = TEST_LINES.filter(l => needsReason(l, decisions[l.name]!)).map(l => l.name)
    if (bad.length) {
      setErrorLines(new Set(bad))
      return
    }
    const n = s.dirty
    const snap = decisions
    const promote = s.promote
    setSaving(true)
    saveTimer.current = window.setTimeout(() => {
      setSaved(snap)
      setSavedAt(SAVED_AT_NEXT)
      setErrorLines(new Set())
      setSaving(false)
      const over = promote - MET_TARGET
      toast.show(`결정 ${n}건 저장 — 진급 ${promote} / 목표 ${MET_TARGET}${over > 0 ? ` · 목표 초과 ${over}` : ''}`, { tone: over > 0 ? 'warning' : 'positive' })
    }, SAVE_DELAY_MS)
  }
  const revert = () => {
    setDecisions(saved)
    setErrorLines(new Set())
  }
  const apply = () => setDecisions(prev => applyRecommendations(prev))

  // ---------------- 요약 줄 값
  const expectedGap = MET_TARGET - s.expected.promote
  const goalSub =
    expectedGap > 0
      ? `미결정을 자동 판정대로 하면 ${s.expected.promote} — ${expectedGap} 부족`
      : expectedGap === 0
        ? `미결정을 자동 판정대로 하면 ${s.expected.promote} — 목표 달성`
        : `목표 초과 ${-expectedGap} — MET 시험구 계통당 ${MET.sites * MET.reps}구(${MET.sites}개 지역 × ${MET.reps}반복) 추가`
  const differParts = (['promote', 'hold', 'drop'] as Decision[]).filter(d => s.differBy[d] > 0).map(d => `${{ promote: '진급', hold: '보류', drop: '탈락' }[d]} ${s.differBy[d]}`)
  const differSub = `사유 입력 ${s.differReasoned}/${s.differ}${differParts.length ? ` · ${differParts.join(' · ')}` : ''}`
  const violSub = `${TRAIT_ORDER.map(t => `${TRAIT_LABEL[t]} ${s.violBy[t]}`).join(' · ')}, 중복 포함`
  const progressSub = `미결정 ${s.undecided} · 미저장 ${s.dirty}`

  const detail = <LineDetail key={line.name} l={line} st={st} dirty={st ? !sameState(st, saved[line.name]!) : false} error={errorSet.has(line.name)} h={handlers} titleId={xlUp ? undefined : 'adv-sheet-title'} />

  return (
    <div className="flex flex-col gap-5">
      {/* A. 머리 */}
      <Header savedAt={savedAt} />

      {/* C. 요약 줄(공통 KpiRow: 1440 대표 2칸 + 3 · 768 대표 2칸 + 1 / 2 · 390 대표 전체 폭 + 2열) */}
      <KpiRow hero ariaLabel="진급 심사 요약">
        <KpiTile
          size="hero"
          label={`${MET.year} MET 진급`}
          value={s.promote}
          unit={`/ 목표 ${MET_TARGET}`}
          sub={goalSub}
          target={MET_TARGET}
          targetLabel={`목표 ${MET_TARGET}계통`}
          severity={expectedGap < 0 ? 'warning' : undefined}
          achievementDigits={expectedGap < 0 ? 1 : undefined}
        />
        <KpiTile label="결정 진행" value={`${s.decided} / ${TEST_LINES.length}`} unit="계통" sub={progressSub} achievement={(100 * s.decided) / TEST_LINES.length} targetLabel={`시험 ${TEST_LINES.length}계통`} achievementLabel="진행률" />
        <KpiTile
          label="기준과 다른 결정"
          value={s.differ}
          unit="건"
          sub={differSub}
          badge={
            s.missingReason > 0 ? (
              <Badge tone="negative">
                <AlertTriangle size={11} aria-hidden="true" />
                사유 누락 {s.missingReason}
              </Badge>
            ) : undefined
          }
        />
        <KpiTile label="필수 형질 위반" value={s.violLines} unit="계통" sub={violSub} />
      </KpiRow>

      {/* B. 안내 띠(공통 SummaryCallout info, 닫기) — KPI 줄 바로 아래 한 곳 */}
      <SummaryCallout tone="info" icon={<Info size={15} aria-hidden="true" className="text-info" />} dismissible>
        대비 지수 기준 가람솔 A-3 평균 {f1(STD.d.yield)} kg/10a는 구 215 배수 불량 영향으로 MET 2년 평균 {f1(CHECK_MET_MEAN)}보다 낮아 지수가 높게 나옵니다. 다수성 대비 온새미로 지수 {josa(f1(HIGH.d.idx), '를을')} 함께 보세요.
      </SummaryCallout>

      {/* D | E */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <CriteriaCard collapsed={!xlUp} />
        <IndexGebvScatter decisions={decisions} visible={visibleNames} selected={selected} onSelect={n => select(n)} />
      </div>

      {/* F | G — 목록·상세는 각자 내용 높이(옆 카드 높이로 늘어난 빈 띠 없음) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5 xl:items-start">
        <Card
          title="계통 목록"
          subtitle={`${visibleRows.length}계통 표시 + 대비 ${CHECK_LINES.length} · 기본 정렬 진급 지수 · ! 한계 위반(초과·미달) · 점선 밑줄 한계 경계(통과)`}
          padding={narrow ? 'sm' : 'md'}
          className="min-w-0 xl:col-span-3"
        >
          <div className="flex flex-col gap-3">
            <Toolbar f={filters} setF={setFilters} rows={rows} />
            {narrow ? (
              <LineCards rows={visibleRows} checks={checkRows} selected={selected} onSelect={n => select(n)} onReset={() => setFilters(DEFAULT_FILTERS)} />
            ) : (
              <LineTable rows={visibleRows} checks={checkRows} selected={selected} onSelect={n => select(n)} sort={sort} onSort={setSort} onReset={() => setFilters(DEFAULT_FILTERS)} />
            )}
          </div>
        </Card>
        {xlUp && (
          <div ref={detailRef} className="min-w-0 scroll-mt-16 xl:col-span-2">
            <Card title="계통 상세·결정" subtitle="결정은 저장 전까지 이 화면에만 반영됩니다">
              {detail}
            </Card>
          </div>
        )}
      </div>

      {/* I. 결정 요약 */}
      <DecisionSummary s={s} decisions={decisions} onSelect={n => select(n, true)} />

      {/* J. 각주 */}
      <footer className="flex flex-col gap-1 border-t border-border pt-3 text-xs leading-relaxed text-muted">
        <p>모든 계통명·수치는 가상 목업입니다. 유전자 이름은 실제 이름이지만 보유 여부는 가상입니다.</p>
        <p>자동 판정 기준은 이 프로그램의 내부 기준(추정)입니다. 판정은 표시값(출수기·간장 정수, 도열병·밥맛 소수 1자리, 지수 소수 1자리) 기준입니다.</p>
        <p>계통 평균은 정상 관측 구만 사용합니다(결측·범위 이상치 제외).</p>
        <p>수량구성요소(수장·이삭수·천립중)는 입력 진행 중이라 심사 형질에서 뺐습니다.</p>
        <p>
          수량 GEBV는 {GEBV_MODEL.when} {GEBV_MODEL.method}(훈련 집단 {formatNumber(GEBV_MODEL.train)}계통, {GEBV_MODEL.chip}) 예측값으로 2026 AYT 표현형을 포함하지 않습니다. 진급 계통은 {MET.years} {MET.sites}개 지역 × {MET.reps}반복 MET에 편입됩니다.
        </p>
      </footer>

      {/* 상세: 390px 하단 시트, 640~1279px 오른쪽 서랍 — 저장 버튼이 SaveBar보다 DOM 앞에 오도록 SaveBar 앞에 둔다 */}
      <BottomSheet
        open={!xlUp && sheetOpen}
        onClose={closeSheet}
        labelledBy="adv-sheet-title"
        maxHeight={narrow ? '88vh' : '100%'}
        className={narrow ? undefined : DRAWER_CLASS}
        header={`${line.name} · 상세·결정`}
        footer={
          <>
            <span className={`text-xs tabular-nums ${errors.length ? 'font-semibold text-negative' : 'text-muted'}`} aria-live="polite">
              {errors.length ? `사유가 필요한 결정 ${errors.length}건` : `미저장 ${s.dirty}건`}
            </span>
            <Button variant="primary" data-action="save" onClick={save} disabled={s.dirty === 0 || saving} className="min-h-11 px-6">
              {saving ? '저장 중…' : '저장'}
            </Button>
          </>
        }
      >
        {detail}
      </BottomSheet>

      {/* H. 저장 바 + 오류 요약 */}
      <div className={`${s.dirty > 0 || saving || errors.length > 0 ? 'sticky bottom-0 z-20' : 'max-sm:sticky max-sm:bottom-0 max-sm:z-20'} flex flex-col gap-2`}>
        {errors.length > 0 && (
          <div role="alert" id="adv-save-errors" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-negative/50 bg-surface px-3 py-2 text-[13px] text-negative shadow-1">
            <AlertTriangle size={14} aria-hidden="true" className="shrink-0" />
            <b>사유가 필요한 결정 {errors.length}건 —</b>
            {errors.map((n, i) => (
              <span key={n}>
                {i ? ', ' : ''}
                <button type="button" onClick={() => select(n, true)} className="font-semibold underline underline-offset-2">
                  {n}
                </button>
              </span>
            ))}
          </div>
        )}
        <SaveBar
          placement="bottom"
          dirty={s.dirty}
          saving={saving}
          canSave={s.dirty > 0 && !saving}
          onSave={save}
          onRevert={revert}
          blockReasonId={errors.length ? 'adv-save-errors' : undefined}
          saveButtonProps={{ 'data-action': 'save' }}
          secondary={
            <Button
              icon={<Wand2 size={14} aria-hidden="true" />}
              data-action="apply-recommendations"
              onClick={apply}
              disabled={s.undecided === 0 || saving}
              aria-label={`미결정 ${s.undecided}계통에 자동 판정 적용`}
              className="flex-[2] max-sm:min-h-11 sm:flex-none"
            >
              자동 판정 적용
            </Button>
          }
        >
          <span aria-live="polite" className="font-semibold tabular-nums text-text">
            {saving ? '저장 중…' : `미저장 ${s.dirty}건`}
          </span>
          <span className="tabular-nums text-muted">
            진급 {s.promote} / 목표 {MET_TARGET} · 미결정 {s.undecided}
          </span>
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
      <Header savedAt={SAVED_AT} />
      {state === 'loading' && (
        <div aria-busy="true" aria-label="AYT 성적을 불러오는 중" className="flex flex-col gap-4">
          <KpiRow loading hero count={4} skeletonHeight={150} ariaLabel="진급 심사 요약" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <Skeleton height={480} className="xl:col-span-3" />
            <Skeleton height={480} className="xl:col-span-2" />
          </div>
        </div>
      )}
      {state === 'empty' && <EmptyState title="심사할 계통이 없습니다(AYT 결과 미등록)" description="생산력 검정 수확·조사 성적을 등록하면 계통별 자동 판정과 결정 입력이 여기에 표시됩니다." />}
      {state === 'error' && (
        <ErrorState
          title="AYT 성적을 불러오지 못했습니다"
          description="시험 성적 서버와 연결을 확인한 뒤 다시 시도하세요."
          action={
            <Button size="sm" onClick={onRetry}>
              다시 시도
            </Button>
          }
        />
      )}
    </div>
  )
}
