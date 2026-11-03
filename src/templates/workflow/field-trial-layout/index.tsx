import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AlertOctagon, Compass, Search, StickyNote, X } from 'lucide-react'
import type { TemplateMeta } from '@/gallery/types'
import {
  AlertList,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  ErrorState,
  KpiRow,
  KpiTile,
  PageHeader,
  SaveBar,
  Segmented,
  Skeleton,
  Stepper,
  Toast,
  cn,
  useMediaQuery,
  useToast,
  HATCH_MISSING,
  type AlertListItem,
} from '@/design-system'
import { formatDate, formatNumber } from '@/lib/format'
import {
  AS_OF,
  BLOCKS,
  BLOCK_SIZE,
  ENTRIES,
  INITIAL_MEMOS,
  ISSUES,
  PLOT_BY_NO,
  PLOTS_BY_ENTRY,
  REPS,
  SUMMARY,
  TRAIT_EXTENT,
  TRAITS,
  TREND_EXTENT,
  TRIAL,
  lineLabel,
  searchEntries,
  type TraitKey,
} from './data'
import { FieldGrid, type ValueMode, type ViewMode } from './components/FieldGrid'
import { PlotPanel } from './components/PlotPanel'
import { LineTable } from './components/LineTable'
import { DIV_GRADIENT, HATCH_CHECK, SEQ_GRADIENT } from './components/scale'

export const meta: TemplateMeta = {
  slug: 'field-trial-layout',
  category: 'workflow',
  title: '시험포장 배치·관리',
  description: '알파격자 생산력 검정 포장에서 계통 위치를 찾고, 결측·이상치와 공간 경향을 점검하며 구별 메모를 남긴다.',
  tags: ['시험포장', '생산력 검정', 'AYT', '알파격자', '결측', '이상치', '공간 경향', '벼'],
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

type StepId = 'plant' | 'heading' | 'culm' | 'harvest' | 'review'

const fmt1 = (v: number) => formatNumber(v, { digits: 1 })
const CHECK_ENTRIES = ENTRIES.filter(e => e.check).length
/** 768~1279px 구 상세 서랍: 공통 BottomSheet를 오른쪽에 붙인다(옆 서랍 옵션이 공통에 없어 className으로, [공통] 요청) */
const DRAWER_CLASS = 'ml-auto h-full w-[min(34rem,100%)] rounded-t-none! border-t-0! border-l'

export default function Template() {
  const devState = useMemo(readDevState, [])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (devState === 'loading') return
    const t = window.setTimeout(() => setLoading(false), 400)
    return () => window.clearTimeout(t)
  }, [devState])

  const [mode, setMode] = useState<ViewMode>('layout')
  const [trait, setTrait] = useState<TraitKey>('yield')
  const [valueMode, setValueMode] = useState<ValueMode>('raw')
  const [showBlocks, setShowBlocks] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number | null>(114)
  const [memos, setMemos] = useState<Record<number, string>>(INITIAL_MEMOS)
  const [draft, setDraft] = useState(INITIAL_MEMOS[114] ?? '')
  const [sheetOpen, setSheetOpen] = useState(false)
  const narrow = useMediaQuery('(max-width: 767px)')
  const xlUp = useMediaQuery('(min-width: 1280px)')
  const toast = useToast()
  const cellRefs = useRef(new Map<number, HTMLButtonElement>())
  const gridRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (xlUp) setSheetOpen(false)
  }, [xlUp])

  const savedMemo = selected !== null ? memos[selected] ?? '' : ''
  const memoDirty = draft !== savedMemo
  const memoPlots = useMemo(() => new Set(Object.keys(memos).map(Number)), [memos])

  // ---- 검색 ----
  const hits = useMemo(() => searchEntries(query), [query])
  const matches = useMemo(() => {
    if (!query.trim()) return null
    return new Set(hits.flatMap(e => PLOTS_BY_ENTRY.get(e.no)!.map(p => p.no)))
  }, [query, hits])
  const resultText = !query.trim()
    ? ''
    : hits.length === 0
      ? '일치하는 계통이 없습니다'
      : hits.length === 1
        ? `${hits[0]!.name} · 3구(${PLOTS_BY_ENTRY.get(hits[0]!.no)!.map(p => p.no).join(', ')})`
        : `${hits.length}계통 일치 · ${matches!.size}구`

  // ---- 구 선택(저장하지 않은 메모는 버린다). 1280px 이상은 옆 패널, 미만은 시트(390)·서랍(768~1279) ----
  const selectPlot = (no: number) => {
    if (!xlUp) {
      if (!sheetOpen) openerRef.current = document.activeElement as HTMLElement | null
      setSheetOpen(true)
    }
    if (no === selected) return
    if (memoDirty) toast.show('저장하지 않은 메모 변경을 취소했습니다', { tone: 'info' })
    setSelected(no)
    setDraft(memos[no] ?? '')
  }
  const closeSheet = () => {
    setSheetOpen(false)
    window.setTimeout(() => openerRef.current?.focus?.({ preventScroll: true }), 0)
  }

  const saveMemo = () => {
    if (selected === null) return
    const text = draft.trim()
    setMemos(m => {
      const next = { ...m }
      if (text) next[selected] = text
      else delete next[selected]
      return next
    })
    setDraft(text)
    const p = PLOT_BY_NO.get(selected)!
    toast.show(text ? `구 ${selected}(${lineLabel(p.entry)}) 메모를 저장했습니다` : `구 ${selected}(${lineLabel(p.entry)}) 메모를 삭제했습니다`)
  }

  const scrollToGrid = (focusNo?: number) => {
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (focusNo != null) window.setTimeout(() => cellRefs.current.get(focusNo)?.focus({ preventScroll: true }), 50)
  }

  // ---- 스테퍼: 실제 진행 상태만 표시한다(현재 = 자료 검토, ①~④ 완료). 단계를 누르면 그 단계 자료 보기로 바로 간다.
  //      표시 모드 상태는 「표시」 Segmented가 보여 준다(스테퍼 현재 단계가 표시 모드를 따라 ①로 보이던 문제, 검토 F1) ----
  const currentStep: StepId = 'review'
  const onStep = (id: StepId) => {
    if (id === 'plant') setMode('layout')
    else if (id === 'review') setMode('missing')
    else {
      setMode('heatmap')
      setTrait(id === 'heading' ? 'heading' : id === 'culm' ? 'culm' : 'yield')
    }
  }
  const total = SUMMARY.plots
  const warnCount = SUMMARY.missingCount + SUMMARY.outlierCount

  // ---- 결측·이상치 목록(경보 = 이상치, 주의 = 결측) ----
  const alerts: AlertListItem[] = ISSUES.slice()
    .sort((a, b) => (a.kind === b.kind ? a.plot - b.plot : a.kind === 'outlier' ? -1 : 1))
    .map(is => {
      const p = PLOT_BY_NO.get(is.plot)!
      const T = TRAITS[is.trait]
      const memo = memos[is.plot]
      return {
        id: `${is.plot}-${is.trait}`,
        severity: is.kind === 'outlier' ? 'critical' : 'warning',
        title: is.kind === 'outlier' ? `구 ${is.plot} · ${T.short} ${formatNumber(is.value!, { digits: T.digits })} ${T.unit}` : `구 ${is.plot} · ${T.short} 결측`,
        description: `${lineLabel(p.entry)} · ${p.row}행 ${p.col}열 — ${is.kind === 'outlier' ? is.reason : memo ? `메모: ${memo}` : '사유 미기록'}`,
        onClick: () => {
          selectPlot(is.plot)
          if (xlUp) scrollToGrid(is.plot)
        },
        actionLabel: '— 포장에서 선택',
      }
    })

  // ---- 범례 ----
  const legend = (() => {
    if (mode === 'layout')
      return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
          <LegendSwatch style={{ background: 'var(--color-surface)' }} label="육성 계통(처리 번호 · 계통명 끝 4자리)" />
          <LegendSwatch style={{ background: HATCH_CHECK }} label="대비 품종(빗금 + 「대비」)" />
          <span className="inline-flex items-center gap-1.5">
            <StickyNote size={12} aria-hidden="true" /> 메모 있음
          </span>
          <span>칸 왼쪽 위 숫자 = 구 번호</span>
        </div>
      )
    if (mode === 'missing')
      return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
          <LegendSwatch style={{ background: HATCH_MISSING }} label={`결측 ${SUMMARY.missingPlots}구(${SUMMARY.missingCount}건) — 수·출·간 = 누락 형질`} />
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-5 rounded-sm border-2 border-dashed border-negative" aria-hidden="true" />
            이상치 {SUMMARY.outlierPlots}구({SUMMARY.outlierCount}건)
          </span>
          <span>나머지 구는 흐리게 표시</span>
        </div>
      )
    const T = TRAITS[trait]
    if (valueMode === 'trend') {
      const m = TREND_EXTENT[trait]
      const d = trait === 'yield' ? 0 : 1
      return (
        <div className="flex flex-col gap-1.5 text-xs text-muted">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular-nums">−{formatNumber(m, { digits: d })}</span>
            <span className="h-3 w-40 rounded-sm border border-border" style={{ background: DIV_GRADIENT }} aria-hidden="true" />
            <span className="tabular-nums">+{formatNumber(m, { digits: d })}</span>
            <span className="text-text">
              공간 경향(3×3 이동 평균 잔차, {T.unit}) — 0 = 국소 편차 없음(계통 평균 수준)
            </span>
          </div>
          <span>잔차 = 구 값 − 계통 평균. SpATS 등 공간 모형(행·열 효과)의 근사입니다. 빗금 = 유효 이웃 3개 미만.</span>
          <span>계통 평균에 그 구 자신이 들어가(3반복) 국소 효과가 약 2/3로 작게 보이고, 반복 경계를 넘는 이웃은 반복 효과가 섞입니다.</span>
        </div>
      )
    }
    const [lo, hi] = TRAIT_EXTENT[trait]
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="text-text">
            {T.short} {T.unit}
          </span>
          <span className="tabular-nums">{formatNumber(lo, { digits: 0 })}</span>
          <span className="h-3 w-40 rounded-sm border border-border" style={{ background: SEQ_GRADIENT }} aria-hidden="true" />
          <span className="tabular-nums">{formatNumber(hi, { digits: 0 })}</span>
        </span>
        <LegendSwatch style={{ background: HATCH_MISSING }} label="결측(—)" />
        <span className="inline-flex items-center gap-1.5">
          <AlertOctagon size={12} aria-hidden="true" className="text-negative" /> 이상치(경보, 척도 제외)
        </span>
        <span>척도 = 정상 관측 {T.short} 최소~최대</span>
      </div>
    )
  })()

  // 머리(공통 PageHeader: 범위 회색 줄 → 제목 + 기준일 → 시험 설계 한 문장). 로딩·오류·빈 상태에도 같은 머리
  const header = (
    <PageHeader
      context={[`${TRIAL.crop} · ${TRIAL.name}`, TRIAL.program, TRIAL.field, '가상 계통·포장 목업 데이터']}
      title={meta.title}
      scope={`${ENTRIES.length}처리(계통 ${ENTRIES.length - CHECK_ENTRIES} + 대비 ${CHECK_ENTRIES}) × 반복 ${REPS} = ${SUMMARY.plots}구 · 반복당 불완전 블록 ${BLOCKS} × ${BLOCK_SIZE}구 · 알파격자(α-lattice)`}
      asOf={formatDate(AS_OF)}
    />
  )

  if (devState === 'error')
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState
          title="시험포장 자료를 불러오지 못했습니다"
          description="포장 배치·관측값 서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요."
          action={<Button onClick={() => window.location.reload()}>다시 시도</Button>}
        />
      </div>
    )

  if (loading)
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <Skeleton height={64} />
        <KpiRow loading hero count={4} skeletonHeight={150} />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton height={560} className="lg:col-span-2" />
          <Skeleton height={560} />
        </div>
        <span className="sr-only">시험포장 자료를 불러오는 중</span>
      </div>
    )

  if (devState === 'empty')
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState title="등록된 시험구가 없습니다" description="시험 설계에서 배치를 확정하면 포장 격자와 관측값이 여기에 나옵니다." />
      </div>
    )

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* B. 조사 일정 */}
      <Stepper<StepId>
        ariaLabel="시험 조사 일정"
        current={currentStep}
        onChange={onStep}
        items={[
          { id: 'plant', label: '파종·이앙', description: '04-22 / 05-20', done: true },
          { id: 'heading', label: '출수기 조사', description: `08-04~08-28 · ${SUMMARY.traitObserved.heading}/${total}구`, done: true },
          { id: 'culm', label: '간장 조사', description: `09-10~09-12 · ${SUMMARY.traitObserved.culm}/${total}구`, done: true },
          { id: 'harvest', label: '수확·탈곡', description: `10-05~10-14 · ${SUMMARY.traitObserved.yield}/${total}구`, done: true },
          { id: 'review', label: '자료 검토', description: `10-23 · 결측·이상치 ${warnCount}건` },
        ]}
      />

      {/* C. 요약(공통 KpiRow: 1440 4열 · 390 2열) */}
      <KpiRow hero ariaLabel="시험포장 요약">
        <KpiTile
          size="hero"
          label="결측·이상치"
          value={warnCount}
          unit="건"
          sub={`이상치(경보) ${SUMMARY.outlierCount} · 결측(주의) ${SUMMARY.missingCount}`}
          severity={SUMMARY.outlierCount > 0 ? 'critical' : SUMMARY.missingCount > 0 ? 'warning' : undefined}
        />
        <KpiTile
          label="조사 완료율"
          value={fmt1(SUMMARY.completion * 100)}
          unit="%"
          sub={`${SUMMARY.observed}/${SUMMARY.expected}값`}
          info={`수량 ${SUMMARY.traitObserved.yield}/${total} · 출수기 ${SUMMARY.traitObserved.heading}/${total} · 간장 ${SUMMARY.traitObserved.culm}/${total}구. 이상치도 관측된 값으로 셉니다.`}
        />
        <KpiTile
          label="쌀 수량 평균"
          value={fmt1(SUMMARY.yieldMean)}
          unit="kg/10a"
          sub={`변이계수(CV) ${fmt1(SUMMARY.yieldCv)}% · n = ${SUMMARY.yieldN}, 결측 ${SUMMARY.missingByTrait.yield}·이상치 ${SUMMARY.outlierByTrait.yield} 제외`}
          info={`백미 기준 kg/10a. 정상 구 원자료 기준 CV = SD ${fmt1(SUMMARY.yieldSd)} / 평균 × 100. 반복·블록 효과를 뺀 분산분석 오차 CV와는 다릅니다.`}
        />
        <KpiTile label="시험구" value={SUMMARY.plots} unit="구" sub={`계통 ${SUMMARY.linePlots} · 대비 ${SUMMARY.checkPlots}`} />
      </KpiRow>

      {/* D. 도구 막대 */}
      <Card padding="sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-5">
          <ToolField label="표시">
            <Segmented<ViewMode>
              ariaLabel="표시 모드"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'layout', label: '계통 배치' },
                { value: 'heatmap', label: '표현형 히트맵' },
                { value: 'missing', label: '결측 구' },
              ]}
            />
          </ToolField>
          {mode === 'heatmap' && (
            <>
              <ToolField label="형질">
                <Segmented<TraitKey>
                  ariaLabel="형질"
                  value={trait}
                  onChange={setTrait}
                  options={[
                    { value: 'yield', label: '수량' },
                    { value: 'heading', label: '출수기' },
                    { value: 'culm', label: '간장' },
                  ]}
                />
              </ToolField>
              <ToolField label="값">
                <Segmented<ValueMode>
                  ariaLabel="값 종류"
                  value={valueMode}
                  onChange={setValueMode}
                  options={[
                    { value: 'raw', label: '원자료' },
                    { value: 'trend', label: '공간 경향' },
                  ]}
                />
              </ToolField>
            </>
          )}
          <div className="flex min-w-0 flex-col gap-1 lg:w-72">
            <label htmlFor="ftl-search" className="text-xs font-medium text-muted">
              계통 검색
            </label>
            <div className="relative">
              <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                id="ftl-search"
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') setQuery('')
                }}
                placeholder="예: YR22-0412, 가람솔"
                aria-describedby="ftl-search-result"
                className="h-9 w-full rounded-md border border-border bg-surface pl-8 pr-8 text-[13px] text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent touch:h-11 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="검색어 지우기"
                  className="touch-hit absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted hover:text-text"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          <label className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-text">
            <input type="checkbox" checked={showBlocks} onChange={e => setShowBlocks(e.target.checked)} className="size-4 accent-[var(--color-text)]" />
            <span className="whitespace-nowrap">불완전 블록 경계 표시</span>
            <span className="text-xs text-muted">(끄면 난괴법(RCBD) 반복 단위로 보기)</span>
          </label>
        </div>
        {/* 검색 결과 라이브 영역: 비었을 때는 sr-only로 자리를 차지하지 않는다(도구 막대 아래 빈 띠, 검토 F7) */}
        <p id="ftl-search-result" role="status" aria-live="polite" className={cn('text-[13px] font-medium text-text tabular-nums', resultText ? 'mt-2' : 'sr-only')}>
          {resultText}
        </p>
      </Card>

      {/* E + F(구 상세: 1280px 이상 옆 패널, 미만은 시트·서랍) */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div ref={gridRef} className="min-w-0 scroll-mt-4 xl:col-span-2">
          <Card
            title="포장 격자 · 시험포장 A-3"
            subtitle={`9행 × 14열 · 구 6.3 m²(2.1 × 3.0 m, 추정) · 굵은 선 = 반복 경계${showBlocks ? ', 중간 선 = 불완전 블록(2열 × 3행)' : ''}`}
            actions={
              <span className="inline-flex items-center gap-1 text-xs text-muted" aria-hidden="true">
                <Compass size={13} /> ↑ 북 · 관개 수로 ←
              </span>
            }
          >
            <FieldGrid
              mode={mode}
              trait={trait}
              valueMode={valueMode}
              showBlocks={showBlocks}
              matches={matches}
              selected={selected}
              onSelect={selectPlot}
              memoPlots={memoPlots}
              cellRefs={cellRefs}
            />
            <div className="mt-3" data-legend={mode === 'heatmap' ? `heatmap-${trait}-${valueMode}` : mode}>
              {legend}
            </div>
          </Card>
        </div>
        {xlUp && (
          <PlotPanel
            plotNo={selected}
            draft={draft}
            onDraft={setDraft}
            onSelect={no => {
              selectPlot(no)
              scrollToGrid(no)
            }}
          />
        )}
      </div>

      {/* G + H */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card padding="md" className="self-start">
          <details open className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <h2 className="text-[15px] font-semibold text-text">결측·이상치 {warnCount}건</h2>
              <span className="text-xs text-muted group-open:hidden">펼치기</span>
              <span className="hidden text-xs text-muted group-open:inline">접기</span>
            </summary>
            <p className="mb-3 mt-1 text-xs text-muted">
              경보 = 허용 범위 밖 값(수량 300~800 kg/10a · 출수기 95~135일 · 간장 55~120 cm, 추정 기준) · 주의 = 결측
            </p>
            <AlertList items={alerts} ariaLabel={`결측·이상치 ${warnCount}건`} density="compact" />
          </details>
        </Card>
        <Card title="계통별 요약" subtitle="평균은 결측·이상치 제외 · 수량 지수 기준 가람솔 = 100 · 공간 미보정(가람솔 구 215가 배수 불량 구역에 있음)" className="min-w-0 self-start lg:col-span-2">
          <LineTable
            activeEntry={selected !== null ? PLOT_BY_NO.get(selected)!.entry : null}
            onLocate={name => {
              setQuery(name)
              scrollToGrid()
            }}
          />
        </Card>
      </div>

      <p className="text-xs text-muted">계통명·품종명·시험포장은 모두 가상이며 실존 계통·품종과 관계없습니다. 이상치 허용 범위와 구 크기는 추정값이므로 기관 기준에 맞춰 조정하세요.</p>

      {/* 구 상세 시트·서랍. 저장 버튼이 SaveBar보다 DOM 앞에 오도록 먼저 둔다 */}
      <BottomSheet
        open={!xlUp && sheetOpen}
        onClose={closeSheet}
        labelledBy="ftl-plot-title"
        maxHeight={narrow ? '88vh' : '100%'}
        className={narrow ? undefined : DRAWER_CLASS}
        header="구 상세·메모"
        footer={
          <>
            <span className="text-xs text-muted" aria-live="polite">
              {memoDirty ? `구 ${selected} 메모 변경 · 미저장` : `구 ${selected} 메모 변경 없음`}
            </span>
            <span className="flex gap-2">
              <Button variant="ghost" disabled={!memoDirty} onClick={() => setDraft(savedMemo)} className="min-h-11">
                변경 취소
              </Button>
              <Button variant="primary" data-action="save" disabled={!memoDirty} onClick={saveMemo} className="min-h-11 px-4">
                메모 저장
              </Button>
            </span>
          </>
        }
      >
        <PlotPanel plain titleId="ftl-plot-title" plotNo={selected} draft={draft} onDraft={setDraft} onSelect={selectPlot} />
      </BottomSheet>

      {/* 메모 저장 바: 고칠 때만 나타난다(이 화면의 주 작업은 점검이고 기록은 메모뿐). 화면 아래에 붙는다 */}
      {memoDirty && (xlUp || !sheetOpen) && (
        <SaveBar
          placement="bottom"
          pinned
          dirty={1}
          saving={false}
          canSave
          onSave={saveMemo}
          onRevert={() => setDraft(savedMemo)}
          saveLabel="메모 저장"
          saveButtonProps={{ 'data-action': 'save' }}
        >
          <span aria-live="polite" className="font-semibold tabular-nums text-text">
            구 {selected} 메모 변경 · 미저장
          </span>
          <span className="text-muted">다른 구를 고르면 저장하지 않은 변경은 취소됩니다</span>
        </SaveBar>
      )}

      <Toast {...toast.toastProps} className="max-sm:bottom-28!" />
    </div>
  )
}

function ToolField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {/* 가로 스크롤 줄 안 Segmented: 터치에서 누르는 영역(세로 44px)이 줄 높이로 잘리지 않게 여유 */}
      <div className="max-w-full overflow-x-auto touch:py-2">{children}</div>
    </div>
  )
}

function LegendSwatch({ style, label }: { style: CSSProperties; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-3.5 w-5 rounded-sm border border-border" style={style} aria-hidden="true" />
      {label}
    </span>
  )
}
