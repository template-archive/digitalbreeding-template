import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, CheckCircle2, Clock, FlaskConical, Play, RotateCcw, Search, Square, SquareCheck } from 'lucide-react'
import type { TemplateMeta } from '@/gallery/types'
import {
  BottomSheet,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  KpiRow,
  PageHeader,
  SectionHeader,
  Segmented,
  Select,
  Skeleton,
  SummaryTile,
  Switch,
  Toast,
  cn,
  useMediaQuery,
  useToast,
  type DataTableColumn,
} from '@/design-system'
import { formatNumber } from '@/lib/format'
import {
  AS_OF,
  INITIAL_STATE,
  NEXT_RERUN_BATCH,
  PLATES,
  RERUN_REASONS,
  STAGES,
  TAT_TARGET,
  advancePlates,
  approveQc,
  buildBoard,
  buildSummary,
  canAdvance,
  canApprove,
  canRequestRerun,
  canStartRerun,
  md,
  plateInfo,
  plateStats,
  requestRerun,
  rerunColumn,
  rerunGroups,
  searchSamples,
  startRerun,
  statusLabel,
  type PlateStats,
  type RerunGroup,
  type RerunReason,
  type Sample,
  type StageIdx,
  type TrackState,
} from './data'
import { Board, type PlatformFilter } from './components/Board'
import { PlateGrid, type GridView } from './components/PlateGrid'
import { SampleDetail } from './components/SampleDetail'
import { ActionBar, ConfirmDialog, type BarAction } from './components/ActionBar'
import { DelayBadge, PlateAlertBadge, PlatformTag } from './components/ui'

export const meta: TemplateMeta = {
  slug: 'sample-tracking',
  category: 'workflow',
  title: '샘플 추적',
  description: '유전체 분석실의 플레이트·샘플이 어느 단계에 있는지, 무엇이 늦고 무엇을 다시 돌려야 하는지 확인하고 단계·재분석 상태를 갱신한다.',
  tags: ['유전체 분석실', 'KASP', 'GBS', '96웰 플레이트', 'TAT', '재분석', 'LIMS', '벼'],
  organism: '벼',
  status: 'review',
  updatedAt: '2026-11-02',
}

/** 범위·소속(제목 위 회색 한 줄). 상태 화면에도 같은 머리를 둔다 */
const CONTEXT = (
  <>
    벼(<i>Oryza sativa</i>) · 중부 평야지 벼 육종 프로그램 유전체 분석실 · 가상 분석실 목업 데이터
  </>
)

/** 플랫폼·용어 설명(머리 「자세히」에 접어 둔다) */
const PLATFORM_DETAILS = (
  <>
    플랫폼: KASP(경쟁적 대립유전자 특이 PCR) 16마커 — 마커 보조 선발(MAS) F2 개체, TAT 목표 {TAT_TARGET.KASP}일 · 유전체 축소 표현 시퀀싱(GBS) — 교배 부모·훈련 집단, {TAT_TARGET.GBS}일 · 6K 단일 염기
    다형성(SNP) 칩 — 유전체 선발(GS) 후보, {TAT_TARGET['6K']}일(2026 캠페인 완료). TAT = 처리 소요 시간(접수 → 결과 제공). 추적 범위 이전의 플레이트는 분석실 운영 현황에서 조회합니다.
  </>
)

type DevState = 'ready' | 'loading' | 'empty' | 'error'
function readDevState(): DevState {
  if (typeof window === 'undefined') return 'ready'
  const s = new URLSearchParams(window.location.search).get('state')
  return s === 'loading' || s === 'empty' || s === 'error' ? s : 'ready'
}

type DialogKind = 'advance' | 'approve' | 'request' | 'start'
const SAVE_DELAY = 600
const DEFAULT_PLATE = 'KSP-2610-02'
const DEFAULT_DETAIL = 'KSP-2610-02-E05'
/** 640~1279px 샘플 상세 서랍: 공통 BottomSheet를 오른쪽에 붙인다(옆 서랍 옵션이 공통에 없어 className으로, [공통] 요청) */
const DRAWER_CLASS = 'ml-auto h-full w-[min(34rem,100%)] rounded-t-none! border-t-0! border-l'

export default function Template() {
  const [devState, setDevState] = useState<DevState>(readDevState)
  if (devState !== 'ready') return <DevStateView state={devState} onRetry={() => setDevState('ready')} />
  return <SampleTracking />
}

function SampleTracking() {
  const [state, setState] = useState<TrackState>(INITIAL_STATE)
  const [platform, setPlatform] = useState<PlatformFilter>('all')
  const [delayedOnly, setDelayedOnly] = useState(false)
  const [rerunOnly, setRerunOnly] = useState(false)
  const [cardSel, setCardSel] = useState<Set<string>>(new Set())
  const [wellSel, setWellSel] = useState<Set<string>>(new Set())
  /** 「여러 웰 선택」 모드: 켜면 웰 탭(클릭) = 선택 토글(터치 기기용, Shift·Ctrl 없이), 끄면 탭 = 샘플 상세 */
  const [multiMode, setMultiMode] = useState(false)
  const [plateId, setPlateId] = useState(DEFAULT_PLATE)
  const [detail, setDetail] = useState<string | null>(DEFAULT_DETAIL)
  const [highlight, setHighlight] = useState<Set<string>>(new Set())
  const [view, setView] = useState<GridView>('status')
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  const [reason, setReason] = useState<RerunReason>(RERUN_REASONS[0])
  const [saving, setSaving] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const wide = useMediaQuery('(min-width: 1024px)')
  const narrow = useMediaQuery('(max-width: 639px)')
  const xlUp = useMediaQuery('(min-width: 1280px)')
  // 웰 44px: 좁은 화면·터치(CSS touch: 변형과 같은 조건). 플레이트는 가로 스크롤한다
  const touchWells = useMediaQuery('(pointer: coarse), (max-width: 639px)')
  const toast = useToast()
  const boardRef = useRef<HTMLDivElement>(null)
  const plateRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (xlUp) setSheetOpen(false)
  }, [xlUp])

  // ---- 집계(모두 state에서 계산) ----
  const board = useMemo(() => buildBoard(state), [state])
  const summary = useMemo(() => buildSummary(state), [state])
  const groups = useMemo(() => rerunGroups(state), [state])
  const statsMap = useMemo(() => {
    const m = new Map<string, PlateStats>()
    for (const p of PLATES) m.set(p.id, plateStats(state, p.id))
    return m
  }, [state])
  const stats = useCallback((id: string) => statsMap.get(id)!, [statsMap])
  const sampleByBarcode = useMemo(() => new Map(state.samples.map(s => [s.barcode, s])), [state])

  const [expanded, setExpanded] = useState<Set<StageIdx>>(() => new Set(board.filter(c => c.delayedPlates > 0 || c.rerun > 0).map(c => c.stage)))

  const info = plateInfo(state, plateId)
  const plateSamples = useMemo(() => state.samples.filter(s => s.plate === plateId), [state, plateId])
  const pst = stats(plateId)
  const detailSample = detail ? sampleByBarcode.get(detail) ?? null : null
  const detailInfo = detailSample ? plateInfo(state, detailSample.plate) : null

  // ---- 플레이트 열기 ----
  const openPlate = (id: string, opts: { highlight?: string[]; detail?: string } = {}) => {
    setPlateId(id)
    setWellSel(new Set())
    setHighlight(new Set(opts.highlight ?? []))
    const ss = state.samples.filter(s => s.plate === id)
    const first = opts.detail ?? (ss.find(s => s.fail && s.status !== '폐기·대체 개체 사용') ?? ss.find(s => s.status === 'QC 실패 예상') ?? ss[0])?.barcode ?? null
    setDetail(first)
    window.setTimeout(() => plateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
  }
  const openRerun = (g: RerunGroup) => openPlate(g.plate, { highlight: g.samples.map(s => s.barcode), detail: g.samples[0]!.barcode })

  // ---- 샘플 상세: 1280px 이상은 옆 패널, 미만은 시트(390)·서랍(640~1279) ----
  const openDetail = () => {
    if (xlUp) return
    openerRef.current = document.activeElement as HTMLElement | null
    setSheetOpen(true)
  }
  const closeDetail = () => {
    setSheetOpen(false)
    window.setTimeout(() => openerRef.current?.focus?.({ preventScroll: true }), 0)
  }

  // ---- 선택 ----
  const toggleCard = (id: string) => {
    setWellSel(new Set())
    setCardSel(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  const onWellClick = (s: Sample, multi: boolean) => {
    if (multi || multiMode) {
      setCardSel(new Set())
      setWellSel(prev => {
        const n = new Set(prev)
        if (n.has(s.barcode)) n.delete(s.barcode)
        else n.add(s.barcode)
        return n
      })
      return
    }
    setWellSel(new Set())
    setDetail(s.barcode)
    openDetail()
  }
  const toggleWells = (barcodes: string[]) => {
    setCardSel(new Set())
    setWellSel(prev => {
      const all = barcodes.every(b => prev.has(b))
      const n = new Set(prev)
      barcodes.forEach(b => (all ? n.delete(b) : n.add(b)))
      return n
    })
  }
  const clearSelection = () => {
    setCardSel(new Set())
    setWellSel(new Set())
  }

  const selPlates = [...cardSel].filter(k => k.startsWith('plate:')).map(k => k.slice(6))
  const selGroups = [...cardSel].filter(k => k.startsWith('rerun:')).map(k => groups.find(g => g.key === k.slice(6))).filter((g): g is RerunGroup => !!g)
  const selWells = [...wellSel].map(b => sampleByBarcode.get(b)).filter((s): s is Sample => !!s)
  const startTargets: Sample[] = selWells.length ? selWells : selGroups.flatMap(g => g.samples)

  // ---- 검색 ----
  const search = useMemo(() => searchSamples(state.samples, query), [state, query])
  const onQuery = (v: string) => {
    setQuery(v)
    const r = searchSamples(state.samples, v)
    if (r.exact) openPlate(r.exact.plate, { highlight: [r.exact.barcode], detail: r.exact.barcode })
  }

  // ---- 일괄 작업 ----
  const firstReason = <T,>(items: T[], f: (x: T) => string | null, name: (x: T) => string) => {
    for (const x of items) {
      const r = f(x)
      if (r) return `${name(x)}: ${r}`
    }
    return null
  }
  // 순서 = 주 동작 우선순위(QC 승인 > 다음 단계 > 재분석 요청 > 재분석 시작). 일괄 작업 바에는 지금 선택에 해당하는 동작만 넘긴다
  const allActions: BarAction[] = [
    {
      id: 'approve',
      label: 'QC 승인',
      icon: <CheckCircle2 size={14} aria-hidden="true" />,
      disabledReason: selPlates.length === 0 ? 'QC 단계 플레이트 카드를 선택하세요' : firstReason(selPlates, id => canApprove(state, id), id => id),
      onClick: () => setDialog('approve'),
    },
    {
      id: 'advance',
      label: '다음 단계로',
      icon: <ArrowRight size={14} aria-hidden="true" />,
      disabledReason: selPlates.length === 0 ? '플레이트 카드를 선택하세요' : firstReason(selPlates, id => canAdvance(state, id), id => id),
      onClick: () => setDialog('advance'),
    },
    {
      id: 'request',
      label: '재분석 요청',
      icon: <RotateCcw size={14} aria-hidden="true" />,
      disabledReason:
        selWells.length === 0 ? '플레이트 뷰에서 웰을 고르세요(「여러 웰 선택」을 켜고 탭, 또는 Shift·Ctrl 클릭·행·열 머리)' : firstReason(selWells, canRequestRerun, s => s.well),
      onClick: () => setDialog('request'),
    },
    {
      id: 'start',
      label: '재분석 시작',
      icon: <Play size={14} aria-hidden="true" />,
      disabledReason:
        startTargets.length === 0
          ? '재분석 대기 묶음 카드나 대기 웰을 선택하세요'
          : selPlates.length > 0 && selWells.length === 0
            ? '플레이트 카드에는 쓸 수 없습니다(재분석 묶음만)'
            : firstReason(startTargets, canStartRerun, s => s.barcode),
      onClick: () => setDialog('start'),
    },
  ]
  const actions = allActions.filter(a => ((a.id === 'approve' || a.id === 'advance') && selPlates.length > 0) || (a.id === 'request' && selWells.length > 0) || (a.id === 'start' && (selGroups.length > 0 || selWells.length > 0)))
  const selectionSummary: ReactNode = selWells.length ? (
    <span>
      <b className="tabular-nums">{selWells.length}</b>웰 선택 · {plateId}
    </span>
  ) : (
    <span>
      {selPlates.length > 0 && (
        <>
          플레이트 <b className="tabular-nums">{selPlates.length}</b>장
        </>
      )}
      {selPlates.length > 0 && selGroups.length > 0 && ' · '}
      {selGroups.length > 0 && (
        <>
          재분석 묶음 <b className="tabular-nums">{selGroups.length}</b>개({formatNumber(selGroups.reduce((a, g) => a + g.samples.length, 0))}샘플)
        </>
      )}
    </span>
  )

  const closeDialog = useCallback(() => {
    if (!saving) setDialog(null)
  }, [saving])

  const commit = () => {
    if (!dialog) return
    const prev = state
    setSaving(true)
    window.setTimeout(() => {
      let next = prev
      let msg = ''
      if (dialog === 'advance') {
        next = advancePlates(prev, selPlates)
        msg = selPlates
          .map(id => {
            const a = plateInfo(prev, id)
            const b = plateInfo(next, id)
            return `${id} ${STAGES[a.stage]} → ${STAGES[b.stage]}${a.delay > 0 && b.delay === 0 ? '(지연 해제)' : ''}${b.awaitingReadout ? ' · 판독 파일 업로드 대기' : ''}`
          })
          .join(', ')
      } else if (dialog === 'approve') {
        const r = approveQc(prev, selPlates)
        next = r.state
        msg = `${selPlates.join(', ')} QC 승인 — 통과 ${r.pass}, 재분석 대기 ${r.fail}`
      } else if (dialog === 'request') {
        next = requestRerun(prev, selWells.map(s => s.barcode), reason)
        msg = `${plateId} ${selWells.length}웰 재분석 요청(${reason}) — 재분석 대기, ${md(NEXT_RERUN_BATCH)} 배치`
      } else {
        const targets = startTargets.filter(s => s.status === '대기')
        next = startRerun(prev, targets.map(s => s.barcode))
        const started = targets.map(s => next.samples.find(x => x.barcode === s.barcode)!)
        const toDna = started.filter(s => rerunColumn(s) === 1).length
        msg = `재분석 시작 ${targets.length}샘플 — DNA 추출 열 ${toDna} · 분석 열 ${targets.length - toDna}`
      }
      setState(next)
      setSaving(false)
      setDialog(null)
      clearSelection()
      toast.show(
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{msg}</span>
          <button
            type="button"
            className="touch-hit rounded-sm font-semibold text-text underline underline-offset-2"
            onClick={() => {
              setState(prev)
              toast.show('마지막 작업을 되돌렸습니다', { tone: 'info' })
            }}
          >
            되돌리기
          </button>
        </span>,
        { duration: 8000 },
      )
    }, SAVE_DELAY)
  }

  const dialogBody = (() => {
    if (dialog === 'advance')
      return (
        <ul className="list-disc pl-5">
          {selPlates.map(id => {
            const a = plateInfo(state, id)
            return (
              <li key={id}>
                {id}: {STAGES[a.stage]} → <b>{STAGES[a.stage + 1]}</b> (단계 일자 {AS_OF})
                {a.stage + 1 === 3 && <span className="text-muted"> — 판독 파일이 올라올 때까지 QC 승인은 비활성</span>}
              </li>
            )
          })}
        </ul>
      )
    if (dialog === 'approve')
      return (
        <ul className="list-disc pl-5">
          {selPlates.map(id => {
            const s = stats(id)
            return (
              <li key={id}>
                {id}: 통과 <b>{s.awaitingDecision}</b> · QC 실패 {s.expFail} → 재분석 대기({md(NEXT_RERUN_BATCH)} 배치). 결과일 {AS_OF}, TAT {plateInfo(state, id).elapsed}일
              </li>
            )
          })}
        </ul>
      )
    if (dialog === 'request')
      return (
        <div className="flex flex-col gap-3">
          <p>
            {plateId} 웰 {selWells.length}개({selWells.map(s => s.well).join(', ')})를 재분석 대기열에 넣습니다. 예정 {NEXT_RERUN_BATCH}.
          </p>
          <Segmented ariaLabel="재분석 사유" options={RERUN_REASONS.map(r => ({ value: r, label: r }))} value={reason} onChange={setReason} />
        </div>
      )
    if (dialog === 'start') {
      const t = startTargets.filter(s => s.status === '대기')
      const dna = t.filter(s => s.fail === 'KASP_DNA').length
      return (
        <p>
          재분석 대기 {t.length}샘플을 시작합니다. DNA 품질 원인 {dna}샘플은 DNA 추출 열, 나머지 {t.length - dna}샘플은 분석 열로 옮깁니다. 예정일({md(NEXT_RERUN_BATCH)})은 유지됩니다.
        </p>
      )
    }
    return null
  })()

  const plateOptions = PLATES.map(p => {
    const pi = plateInfo(state, p.id)
    const tags = [STAGES[pi.stage], stats(p.id).alert ? '플레이트 경보' : '', pi.delay > 0 ? `지연 +${pi.delay}일` : ''].filter(Boolean)
    return { value: p.id, label: `${p.id} · ${p.platform} · ${tags.join(' · ')}` }
  })

  const searchCols: DataTableColumn<Sample>[] = [
    { key: 'id', header: '샘플 ID', format: v => <span className="font-semibold tabular-nums">{String(v)}</span> },
    { key: 'barcode', header: '바코드', format: v => <span className="tabular-nums">{String(v)}</span> },
    // 390px: 바코드에 플레이트·웰이 들어 있으므로 플레이트·웰·플랫폼·의뢰자를 숨겨 결론 열(단계·상태)을 앞쪽에 둔다
    { key: 'plate', header: '플레이트', hideBelow: 'sm' },
    { key: 'well', header: '웰', hideBelow: 'sm' },
    { key: 'platform', header: '플랫폼', hideBelow: 'sm', format: v => <PlatformTag platform={v as Sample['platform']} /> },
    { key: 'status', header: '단계·상태', format: (_, r) => statusLabel(r, plateInfo(state, r.plate)) },
    { key: 'call', header: '콜레이트', numeric: true, format: (v, r) => (v == null ? '—' : `${(v as number).toFixed(1)}%${r.called != null ? ` (${r.called}/16)` : ''}`) },
    { key: 'line', header: '계통/교배 조합', sortValue: r => r.line ?? r.cross, format: (_, r) => r.line ?? r.cross },
    { key: 'req', header: '의뢰자', sortable: false, hideBelow: 'md', format: (_, r) => PLATES.find(p => p.id === r.plate)!.requester },
  ]

  const inProg = summary.inProgress
  const octOther = summary.tracked.plates - inProg.plates - summary.oct.plates
  const hasSel = cardSel.size > 0 || wellSel.size > 0

  // 샘플 상세의 「이 웰 선택에 추가」(터치에서 Shift·Ctrl 없이 웰을 모으는 두 번째 길, 검토 S1)
  const pickable = detailSample != null && detailSample.plate === plateId
  const picked = detailSample != null && wellSel.has(detailSample.barcode)
  const togglePick = () => {
    if (!detailSample) return
    setCardSel(new Set())
    setWellSel(prev => {
      const n = new Set(prev)
      if (n.has(detailSample.barcode)) n.delete(detailSample.barcode)
      else n.add(detailSample.barcode)
      return n
    })
  }
  const pickLabel = picked ? '웰 선택에서 빼기' : '이 웰 선택에 추가'

  return (
    <div className="flex flex-col gap-5">
      {/* 머리(공통 PageHeader: 범위 회색 줄 → 제목 + 기준일 → 추적 범위 한 문장 → 접힌 플랫폼·용어) */}
      <PageHeader
        context={CONTEXT}
        title={meta.title}
        scope={
          <>
            추적 범위{' '}
            <b className="font-semibold text-text">
              {summary.tracked.plates}장 · 시료 {formatNumber(summary.tracked.samples)}샘플
            </b>
            (대조 {summary.tracked.plates * 2}웰 별도) = 진행 중 {inProg.plates}장 + 10월 결과 제공 {summary.oct.plates}장 + 미해결 재분석이 남은 9월 플레이트 {octOther}장
          </>
        }
        asOf={AS_OF}
        details={PLATFORM_DETAILS}
        detailsLabel="플랫폼·용어"
      />

      {/* A. 요약 줄(공통 KpiRow·SummaryTile: 1440 대표 2칸 + 3 · 390 대표 전체 폭 + 2열) */}
      <KpiRow hero ariaLabel="요약">
        <SummaryTile
          hero
          label="진행 중"
          value={formatNumber(inProg.samples)}
          unit="샘플"
          sub={`${inProg.plates}장 · KASP ${inProg.byPlatform.KASP} · GBS ${inProg.byPlatform.GBS}`}
        />
        <SummaryTile
          severity={summary.delayed.plates > 0 ? 'warning' : undefined}
          label={
            <>
              <Clock size={13} aria-hidden="true" /> 지연
            </>
          }
          value={String(summary.delayed.plates)}
          unit="장"
          sub={`${formatNumber(summary.delayed.samples)}샘플 · ${summary.delayed.ids.join(', ') || '없음'}`}
        />
        <SummaryTile
          severity={summary.unresolved.alertPlates > 0 ? 'critical' : summary.unresolved.samples > 0 ? 'warning' : undefined}
          label="미해결 재분석"
          value={formatNumber(summary.unresolved.samples)}
          unit="샘플"
          sub={`${summary.unresolved.plates}장 · 경보 ${summary.unresolved.alertPlates} · ${summary.unresolved.byStatus.map(b => `${b.label} ${b.n}(${md(b.due)})`).join(' · ')}`}
          onClick={() => {
            setRerunOnly(true)
            setDelayedOnly(false)
            setPlatform('all')
            setExpanded(new Set([0, 1, 2, 3]))
            boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          actionLabel="보드에서 재분석 카드만 보기"
          linkLabel="보드에서 보기"
        />
        <SummaryTile
          label="10월 결과 제공"
          value={formatNumber(summary.oct.samples)}
          unit="샘플"
          sub={`${summary.oct.plates}장 · 1차 QC 통과 ${formatNumber(summary.oct.firstPass)}(${summary.oct.firstPassPct.toFixed(1)}%)`}
        />
      </KpiRow>

      {/* B. 단계 보드(검색은 도구 줄 한 칸, 전폭 카드 크롬 제거, 검토 S6) */}
      <section ref={boardRef} aria-labelledby="st-board" className="flex scroll-mt-4 flex-col gap-3">
        <SectionHeader
          title={<span id="st-board">단계 보드</span>}
          description="열 머리 = 그 단계의 신규 샘플·플레이트·재분석 샘플. 카드를 누르면 아래 플레이트 뷰에 열리고, 체크박스로 여러 장을 골라 일괄 작업합니다."
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="relative block min-w-0 flex-1 basis-full sm:basis-80 lg:max-w-md">
            <span className="sr-only">샘플 검색</span>
            <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={e => onQuery(e.target.value)}
              placeholder="바코드·샘플 ID·계통·플레이트 검색 — 예: KSP-2610-02-E05"
              className="h-9 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-[13px] text-text placeholder:text-muted touch:h-11"
            />
          </label>
          <Segmented
            ariaLabel="플랫폼"
            size="sm"
            options={[
              { value: 'all', label: '전체' },
              { value: '6K', label: '6K' },
              { value: 'KASP', label: 'KASP' },
              { value: 'GBS', label: 'GBS' },
            ]}
            value={platform}
            onChange={v => setPlatform(v as PlatformFilter)}
          />
          <Switch checked={delayedOnly} onChange={setDelayedOnly} label="지연만" />
          <Switch checked={rerunOnly} onChange={setRerunOnly} label="재분석만" />
        </div>
        {query.trim().length >= 2 && (
          <div aria-live="polite" data-search-count={search.results.length} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-1">
            {search.results.length === 0 ? (
              <p className="text-[13px] text-muted">추적 범위({summary.tracked.plates}장)에 없는 샘플입니다. 이전 플레이트는 분석실 운영 현황에서 조회하세요.</p>
            ) : (
              <>
                <p className="text-[13px] text-text">
                  <b className="tabular-nums">{formatNumber(search.results.length)}</b>건
                  {search.exact && ` — ${search.exact.barcode}(${search.exact.id})를 플레이트 뷰·샘플 상세에 열었습니다`}
                  {!search.exact && ' — 행을 누르면 플레이트 뷰·샘플 상세로 이동합니다'}
                </p>
                <DataTable
                  columns={searchCols}
                  rows={search.results}
                  rowKey="barcode"
                  dense
                  pageSize={8}
                  maxHeight={320}
                  stickyColumn={{ key: 'id', below: 'md' }}
                  onRowClick={r => openPlate(r.plate, { highlight: [r.barcode], detail: r.barcode })}
                  activeRow={r => r.barcode === detail}
                  caption="검색 결과"
                />
              </>
            )}
          </div>
        )}
        {platform === '6K' ? (
          <EmptyState
            title="6K SNP 칩은 진행 중인 플레이트가 없습니다 — 2026 캠페인(4~7월, 22장, 2,000샘플) 완료"
            description="진행 중인 플레이트 없음(2026 캠페인 완료). 다른 플랫폼을 고르거나 「전체」로 돌아가세요."
            action={
              <Button size="sm" onClick={() => setPlatform('all')}>
                전체 보기
              </Button>
            }
          />
        ) : (
          <Board
            columns={board}
            stats={stats}
            platform={platform}
            delayedOnly={delayedOnly}
            rerunOnly={rerunOnly}
            selected={cardSel}
            onToggleSelect={toggleCard}
            onOpenPlate={id => openPlate(id)}
            onOpenRerun={openRerun}
            activePlate={plateId}
            narrow={!wide}
            expanded={expanded}
            onToggleExpand={s =>
              setExpanded(prev => {
                const n = new Set(prev)
                if (n.has(s)) n.delete(s)
                else n.add(s)
                return n
              })
            }
          />
        )}
      </section>

      {/* D. 플레이트 뷰 + E. 샘플 상세 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div ref={plateRef} data-plate-view={plateId} data-well-mode={multiMode ? 'multi' : 'detail'} className="min-w-0 scroll-mt-4 xl:col-span-8">
          <Card
            title="96웰 플레이트 뷰"
            subtitle="8행(A~H) × 12열 · 시료 94 + 대조 2(H11 양성, H12 음성 대조(NTC))"
            actions={<Segmented ariaLabel="격자 보기" size="sm" options={[{ value: 'status', label: '상태' }, { value: 'call', label: '콜레이트' }]} value={view} onChange={v => setView(v as GridView)} />}
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Select label="플레이트" options={plateOptions} value={plateId} onChange={id => openPlate(id)} />
                <PlatformTag platform={info.def.platform} />
                {info.delay > 0 && <DelayBadge days={info.delay} />}
                {pst.alert && <PlateAlertBadge />}
              </div>
              <PlateSummary info={info} st={pst} />
              {/* 터치 기기용 다중 선택 모드(Shift·Ctrl 없이 탭으로 웰을 고른다). 키보드·마우스의 Shift·Ctrl 클릭은 모드와 관계없이 동작 */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <button
                  type="button"
                  data-well-mode-toggle=""
                  aria-pressed={multiMode}
                  onClick={() => setMultiMode(m => !m)}
                  className={cn(
                    'touch-hit inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold text-text',
                    multiMode ? 'border-text/40 bg-active' : 'border-border bg-surface hover:bg-surface-2',
                  )}
                >
                  {multiMode ? <SquareCheck size={15} aria-hidden="true" /> : <Square size={15} aria-hidden="true" />}
                  여러 웰 선택
                </button>
                <p className="text-xs text-muted" aria-live="polite">
                  {multiMode ? (
                    <>
                      켜짐 — 웰을 누를 때마다 선택·해제{selWells.length > 0 && <> · <b className="font-semibold tabular-nums text-text">{selWells.length}</b>웰 선택</>}
                    </>
                  ) : (
                    '꺼짐 — 웰을 누르면 샘플 상세'
                  )}
                </p>
              </div>
              <PlateGrid
                info={info}
                samples={plateSamples}
                view={view}
                detail={detail}
                selected={wellSel}
                highlight={highlight}
                multiMode={multiMode}
                touchWells={touchWells}
                onWellClick={onWellClick}
                onToggleWells={toggleWells}
              />
              <p className="text-[11px] text-muted">
                「여러 웰 선택」을 켜거나 Shift·Ctrl 클릭·행·열 머리로 여러 웰을 고르면 일괄 작업 바가 나타납니다. 대조 웰(H11·H12)은 고를 수 없습니다.
              </p>
            </div>
          </Card>
        </div>
        {xlUp ? (
          <div data-sample-detail={detail ?? undefined} className="min-w-0 xl:col-span-4 xl:self-start">
            <Card
              title="샘플 상세"
              subtitle={detailSample ? `${detailSample.plate} · ${detailSample.well}` : undefined}
              actions={
                pickable ? (
                  <Button size="sm" data-action="pick-well" aria-pressed={picked} onClick={togglePick}>
                    {pickLabel}
                  </Button>
                ) : undefined
              }
            >
              {detailSample && detailInfo ? (
                <SampleDetail state={state} sample={detailSample} info={detailInfo} />
              ) : (
                <EmptyState title="샘플을 고르세요" description="플레이트 뷰에서 웰을 누르거나 바코드를 검색하세요." />
              )}
            </Card>
          </div>
        ) : (
          <Card padding="sm" className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 text-[13px] text-text tabular-nums">
                {detailSample ? (
                  <>
                    <span className="text-muted">열린 샘플</span> {detailSample.plate} · {detailSample.well}
                  </>
                ) : (
                  <span className="text-muted">플레이트 뷰에서 웰을 누르거나 바코드를 검색하세요.</span>
                )}
              </p>
              <Button data-action="open-sample-detail" disabled={!detailSample} onClick={openDetail} className="touch:min-h-11">
                샘플 상세
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* 각주 */}
      <footer className="flex flex-col gap-1 border-t border-border pt-3 text-xs leading-relaxed text-muted">
        <p>모든 수치·이름은 가상 분석실의 목업 데이터입니다.</p>
        <p>단계 마감은 TAT 목표(KASP 7일, GBS 21일, 6K 14일)를 단계별로 나눈 내부 기준입니다(KASP 접수 1·추출 2·분석 5·QC 7일, GBS 1·3·18·21일, 누적).</p>
        <p>KASP는 MAS 대상 유전자 마커가 하나라도 미호출이면 실패입니다(16마커 중 미호출 1개 이하 통과). GBS는 리드 수 ≥ 1M이고 결측률 ≤ 20%여야 통과입니다.</p>
        <p>처리량·TAT 집계는 분석실 운영 현황과 같은 기준(결과 제공일)입니다. 플레이트 경보 = 실패율 &gt; 10%.</p>
      </footer>

      {/* 샘플 상세: 390px 하단 시트, 640~1279px 오른쪽 서랍 */}
      <BottomSheet
        open={!xlUp && sheetOpen}
        onClose={closeDetail}
        labelledBy="st-sheet-title"
        maxHeight={narrow ? '88vh' : '100%'}
        className={narrow ? undefined : DRAWER_CLASS}
        header={<span id="st-sheet-title">{detailSample ? `${detailSample.plate} · ${detailSample.well} · 샘플 상세` : '샘플 상세'}</span>}
        footer={
          <>
            <span className="text-xs tabular-nums text-muted" aria-live="polite">
              선택 {selWells.length}웰
            </span>
            {pickable && (
              <Button variant="primary" data-action="pick-well" aria-pressed={picked} onClick={togglePick} className="min-h-11 px-4">
                {pickLabel}
              </Button>
            )}
          </>
        }
      >
        <div data-sample-detail={detail ?? undefined}>{detailSample && detailInfo && <SampleDetail state={state} sample={detailSample} info={detailInfo} />}</div>
      </BottomSheet>

      {hasSel && <ActionBar summary={selectionSummary} actions={actions} onClear={clearSelection} saving={saving} selection={{ plates: selPlates.length, groups: selGroups.length, wells: selWells.length }} />}
      {dialog && (
        <ConfirmDialog
          kind={dialog}
          title={{ advance: '다음 단계로 옮길까요?', approve: 'QC를 승인할까요?', request: '재분석을 요청할까요?', start: '재분석을 시작할까요?' }[dialog]}
          confirmLabel={{ advance: '옮기기', approve: '승인', request: '요청', start: '시작' }[dialog]}
          saving={saving}
          onConfirm={commit}
          onCancel={closeDialog}
        >
          {dialogBody}
        </ConfirmDialog>
      )}
      <Toast {...toast.toastProps} className={hasSel ? 'max-sm:bottom-40! sm:max-md:bottom-24! md:bottom-20!' : undefined} />
    </div>
  )
}

// ---------------------------------------------------------------- 하위 요소

function PlateSummary({ info, st }: { info: ReturnType<typeof plateInfo>; st: PlateStats }) {
  const { def, stage } = info
  const items: { label: string; value: ReactNode; tone?: string }[] = [
    { label: '단계', value: info.awaitingReadout ? 'QC · 판독 파일 대기' : STAGES[stage] },
    { label: '시료', value: st.n },
  ]
  if (stage === 4) {
    items.push({ label: '통과', value: def.platform === 'KASP' ? `${st.pass} (16/16 ${st.pass16} · 15/16 ${st.pass15})` : st.pass })
    items.push({ label: '실패', value: st.fail, tone: st.alert ? 'text-negative' : undefined })
    items.push({ label: '실패율', value: `${st.failRate.toFixed(1)}%${st.alert ? ' · 경보 > 10%' : ''}`, tone: st.alert ? 'text-negative' : undefined })
    items.push({ label: 'TAT', value: `${info.tat}일${info.tat! > TAT_TARGET[def.platform] ? `(목표 ${TAT_TARGET[def.platform]}일 초과)` : ''}`, tone: info.tat! > TAT_TARGET[def.platform] ? 'text-warning' : undefined })
  } else {
    items.push({ label: '경과 / 마감', value: `${info.elapsed}일 / ${info.deadline}일`, tone: info.delay > 0 ? 'text-warning' : undefined })
    items.push({ label: '목표 결과일', value: info.targetDate })
    if (stage === 3 && !info.awaitingReadout) items.push({ label: 'QC 실패 예상', value: st.expFail, tone: 'text-warning' })
  }
  if (st.meanCall != null) items.push({ label: '평균 콜레이트', value: `${st.meanCall.toFixed(1)}%` })
  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface-2/70 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
        <FlaskConical size={12} aria-hidden="true" className="self-center" />
        <span className="font-semibold text-text">{def.id}</span>
        <span>
          {def.reqNo} · {def.requester} · {def.purpose}
        </span>
        {def.note && <span className="text-warning">비고: {def.note.text}</span>}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 xl:grid-cols-4">
      {items.map(it => (
        <div key={it.label} className="flex min-w-0 flex-col">
          <dt className="text-[11px] text-muted">{it.label}</dt>
          <dd className={`text-sm font-semibold tabular-nums ${it.tone ?? 'text-text'}`}>{it.value}</dd>
        </div>
      ))}
      </dl>
    </div>
  )
}

function DevStateView({ state, onRetry }: { state: Exclude<DevState, 'ready'>; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader context={CONTEXT} title={meta.title} asOf={AS_OF} details={PLATFORM_DETAILS} detailsLabel="플랫폼·용어" />
      {state === 'loading' && (
        <div aria-busy="true" aria-label="샘플 정보를 불러오는 중" className="flex flex-col gap-4">
          <KpiRow loading hero count={4} skeletonHeight={150} ariaLabel="요약" />
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map(i => (
              <Skeleton key={i} height={260} />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Skeleton height={420} className="xl:col-span-8" />
            <Skeleton height={420} className="xl:col-span-4" />
          </div>
        </div>
      )}
      {state === 'empty' && <EmptyState title="추적 중인 샘플이 없습니다" description="진행 중인 플레이트와 미해결 재분석이 없습니다. 새 의뢰가 접수되면 여기에 표시됩니다." />}
      {state === 'error' && (
        <ErrorState
          title="샘플 정보를 불러오지 못했습니다"
          description="분석실 서버와 연결을 확인한 뒤 다시 시도하세요."
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
