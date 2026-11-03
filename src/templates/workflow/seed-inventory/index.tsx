import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock, FlaskConical, Inbox, PackageX, Sprout } from 'lucide-react'
import type { TemplateMeta } from '@/gallery/types'
import {
  AlertList,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  ErrorState,
  KpiRow,
  PageHeader,
  Skeleton,
  SummaryTile,
  Tabs,
  Toast,
  useMediaQuery,
  useToast,
  type AlertListItem,
  type DataTableSort,
} from '@/design-system'
import { formatNumber } from '@/lib/format'
import {
  AS_OF,
  CATS,
  CAT_LABEL,
  DORMANCY,
  DUE_SOON_DAYS,
  GERM_FAIL,
  GERM_PASS,
  GERM_TEST,
  HULL_RATIO,
  INITIAL_STATE,
  MIN_HOLD,
  NEXT_YEAR,
  PAGE_SIZE,
  RETEST_MONTHS,
  SAVE_DELAY_MS,
  STORAGE,
  TEST_GRAINS,
  approve,
  cancelApproval,
  daysBetween,
  derive,
  evalRequest,
  isAlarmLot,
  isOpen,
  lineLabel,
  lineShort,
  reject,
  setMta,
  ship,
  summarize,
  updateItem,
  type Cat,
  type InvState,
} from './data'
import { fmtG, fmtKg } from './components/ui'
import { RequestList, type ReqRow } from './components/RequestList'
import { RequestBar, RequestDetail, RequestFooter, blockSentences, type RequestHandlers } from './components/RequestDetail'
import { DEFAULT_FILTERS, LotTable, LotToolbar, filterLots, type LotFilters } from './components/LotTable'
import { LotDetail } from './components/LotDetail'
import { StandardsCard } from './components/StandardsCard'

export const meta: TemplateMeta = {
  slug: 'seed-inventory',
  category: 'workflow',
  title: '종자 재고·분양',
  description: '저온 저장고의 종자 로트 재고·발아 검사 상태를 보고, 교배·MET·외부 분양 요청을 점검해 승인·출고한다.',
  tags: ['종자 관리', '재고', '분양', '발아 검사', '천립중', 'MTA', 'F1', '벼'],
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

type TabId = 'req' | 'lot'
const DEFAULT_REQ = 'RQ26-044'
const DEFAULT_LOT = 'L25-023'
const DEFAULT_SORT: DataTableSort = { key: 'id', dir: 'asc' }
/** 처음 보이는 경보 수(나머지는 더 보기). 차단·미달이 앞에 오므로 처리할 요청 목록이 첫 화면에 들어온다(검토 V1) */
const NARROW_ALERTS = 5
const WIDE_ALERTS = 6
/** 640~1279px 상세 서랍: 공통 BottomSheet를 오른쪽에 붙인다(옆 서랍 옵션이 공통에 없어 className으로, [공통] 요청) */
const DRAWER_CLASS = 'ml-auto h-full w-[min(34rem,100%)] rounded-t-none! border-t-0! border-l'

export default function Template() {
  const [devState, setDevState] = useState<DevState>(readDevState)
  if (devState !== 'ready') return <DevStateView state={devState} onRetry={() => setDevState('ready')} />
  return <SeedInventory />
}

function SeedInventory() {
  const [state, setState] = useState<InvState>(INITIAL_STATE)
  const stateRef = useRef(state)
  stateRef.current = state
  const d = useMemo(() => derive(state), [state])
  const sm = useMemo(() => summarize(state, d), [state, d])
  const [tab, setTab] = useState<TabId>('req')
  const [reqId, setReqId] = useState(DEFAULT_REQ)
  const [lotId, setLotId] = useState<string>(DEFAULT_LOT)
  const [filters, setFiltersRaw] = useState<LotFilters>(DEFAULT_FILTERS)
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<DataTableSort | null>(DEFAULT_SORT)
  const [saving, setSaving] = useState(false)
  const [allAlerts, setAllAlerts] = useState(false)
  const [sheet, setSheet] = useState<'req' | 'lot' | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const narrow = useMediaQuery('(max-width: 639px)')
  const xlUp = useMediaQuery('(min-width: 1280px)')
  const toast = useToast()
  const tabsRef = useRef<HTMLElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (xlUp) setSheet(null)
  }, [xlUp])

  const setFilters = (f: LotFilters) => {
    setFiltersRaw(f)
    setPage(0)
  }
  const reveal = () => window.setTimeout(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
  // 상세: 1280px 이상은 옆 패널, 미만은 시트(390)·서랍(640~1279)
  const openSheet = (k: 'req' | 'lot') => {
    if (sheet === null) openerRef.current = document.activeElement as HTMLElement | null
    setSheet(k)
  }
  const closeSheet = () => {
    setSheet(null)
    setRejecting(false)
    window.setTimeout(() => openerRef.current?.focus?.({ preventScroll: true }), 0)
  }
  /** sheet: false면 목록으로만 이동(요약 타일). scroll: false면 패널만 바꾼다(목록 안 선택) */
  const openReq = (id: string, opts: { sheet?: boolean; scroll?: boolean } = {}) => {
    setTab('req')
    setReqId(id)
    setRejecting(false)
    if (!xlUp && opts.sheet !== false) openSheet('req')
    else if (opts.scroll !== false) reveal()
  }
  const openLot = (id: string, opts: { alarmOnly?: boolean; sheet?: boolean } = {}) => {
    setTab('lot')
    setLotId(id)
    const f = { ...DEFAULT_FILTERS, alarmOnly: !!opts.alarmOnly }
    setFiltersRaw(f)
    setSort(DEFAULT_SORT)
    const list = filterLots(d, f, r => isAlarmLot(d, r))
      .map(r => r.lot.id)
      .sort()
    setPage(Math.max(0, Math.floor(list.indexOf(id) / PAGE_SIZE)))
    if (!xlUp && opts.sheet !== false) openSheet('lot')
    else reveal()
  }

  // ---------------- 요청 처리 ----------------
  const req = state.requests.find(r => r.id === reqId)!
  const ev = evalRequest(d, req)
  const later = (f: () => void) => {
    setSaving(true)
    window.setTimeout(() => {
      f()
      setSaving(false)
    }, SAVE_DELAY_MS)
  }
  const handlers: RequestHandlers = {
    onQty: (line, qty) => setState(s => updateItem(s, req.id, line, { qty })),
    onLot: (line, lot) => setState(s => updateItem(s, req.id, line, { lotOverride: lot })),
    onExclude: (line, excluded) => setState(s => updateItem(s, req.id, line, { excluded })),
    onMta: signed => setState(s => setMta(s, req.id, signed)),
    onApprove: () =>
      later(() => {
        const s = stateRef.current
        const r = s.requests.find(x => x.id === req.id)!
        const e = evalRequest(derive(s), r)
        if (e.blocked) {
          toast.show(`${r.id} 승인할 수 없습니다 · ${blockSentences(r, e)[0]}`, { tone: 'negative', duration: 0 })
          return
        }
        setState(approve(s, r.id))
        toast.show(`${r.id} 승인 · 출고 대기`)
      }),
    onReject: reason =>
      later(() => {
        setState(reject(stateRef.current, req.id, reason))
        toast.show(`${req.id} 반려 · ${reason}`, { tone: 'info' })
      }),
    onShip: () =>
      later(() => {
        const res = ship(stateRef.current, req.id)
        if (!res) {
          toast.show(`${req.id} 출고할 수 없습니다 · 출고 직전 점검에서 차단 사유가 나왔습니다`, { tone: 'negative', duration: 0 })
          return
        }
        setState(res.state)
        const first = res.shipped[0]!
        const units = new Set(res.shipped.map(x => x.unit))
        const body =
          res.shipped.length === 1
            ? `${lineShort(first.line)} ${reqQty(first.qty, first.unit)}(${first.lot} 잔량 ${fmtG(first.after)} g)`
            : `${res.shipped.length}개 품목${
                units.size === 1
                  ? ` ${reqQty(
                      res.shipped.reduce((a, x) => a + x.qty, 0),
                      first.unit,
                    )}`
                  : ''
              }`
        const below = res.belowLines.length ? ` · 최소 보유량 미달 ${res.belowLines.length}계통(${res.belowLines.map(lineShort).join(', ')})` : ''
        toast.show(`${req.id} 출고 완료 · ${body}${below}`, {
          tone: below ? 'warning' : 'positive',
          duration: 6000,
        })
      }),
    onCancel: () =>
      later(() => {
        setState(cancelApproval(stateRef.current, req.id))
        toast.show(`${req.id} 승인 취소 · 승인 대기로 되돌렸습니다`, {
          tone: 'info',
        })
      }),
    onOpenLot: id => openLot(id),
  }

  // ---------------- 경보 ----------------
  const alerts: AlertListItem[] = useMemo(() => {
    const out: AlertListItem[] = []
    for (const r of state.requests.filter(isOpen)) {
      const e = sm.evals.get(r.id)!
      if (!e.blocked) continue
      out.push({
        id: `req-${r.id}`,
        severity: 'critical',
        title: `${r.id} ${r.use} 요청 — 점검 차단`,
        value: `차단 ${e.blockCount}`,
        description: blockSentences(r, e)[0],
        onClick: () => openReq(r.id),
        actionLabel: `— ${r.id} 요청 상세 보기`,
      })
    }
    for (const ln of d.lines.values()) {
      if (!ln.below) continue
      const rows = ln.lots.map(l => d.row(l.id))
      const fail = rows.find(r => r.status === 'fail')
      const empty = rows.find(r => r.status === 'empty')
      const target = fail ?? empty ?? rows[0]!
      const desc = fail
        ? `발아 불합격 ${fail.germ.last?.germ}% — 재증식 필요 (${fail.lot.id} 재고 ${fmtG(fail.bal ?? 0)} g은 파종 용도 사용 불가)`
        : empty
          ? `소진 — 재교배 예정(교배 실적 기록) · ${empty.lot.id}`
          : ln.unit === '립'
            ? `F1 예비 ${formatNumber(ln.avail)} / ${formatNumber(ln.min)}립 · ${target.lot.id}`
            : `최소 보유량 미달 ${fmtG(ln.avail)} / ${formatNumber(ln.min)} g — ${NEXT_YEAR} 증식 필요 · ${target.lot.id}`
      out.push({
        id: `below-${ln.id}`,
        severity: 'critical',
        title: `${lineLabel(ln.id)} 최소 보유량 미달 (${CAT_LABEL[ln.minCat]})`,
        value: ln.unit === '립' ? `${formatNumber(ln.avail)} / ${formatNumber(ln.min)}립` : `${fmtG(ln.avail)} / ${formatNumber(ln.min)} g`,
        description: desc,
        onClick: () => openLot(target.lot.id),
        actionLabel: `— ${target.lot.id} 로트 상세 보기`,
      })
    }
    for (const r of d.rows.filter(x => x.germ.dueState === 'overdue')) {
      out.push({
        id: `due-${r.lot.id}`,
        severity: 'warning',
        icon: Clock,
        title: `${r.lot.id} ${lineLabel(r.lot.line)} 재검사 기한 지남(${daysBetween(r.germ.due!, AS_OF)}일)`,
        value: r.germ.due,
        description: `발아 주의 ${r.germ.last?.germ}% (${r.germ.last?.resultDate} 판정) → 기한 ${r.germ.due}`,
        onClick: () => openLot(r.lot.id),
        actionLabel: `— ${r.lot.id} 로트 상세 보기`,
      })
    }
    for (const r of d.rows.filter(x => x.status === 'hold' || x.status === 'awaiting')) {
      out.push({
        id: `st-${r.lot.id}`,
        severity: 'warning',
        icon: r.status === 'hold' ? PackageX : Inbox,
        title: `${r.lot.id} ${r.lot.line} F1 ${r.status === 'hold' ? '사용 보류' : '입고 대기'}`,
        value: r.status === 'hold' ? `${formatNumber(r.bal ?? 0)}립` : '립수 없음',
        description: r.status === 'hold' ? `사용 보류 — 자식(自殖, selfing) 의심 (${r.lot.memo ?? ''})` : '입고 대기 — 교배 실적 기록에서 립수 입력 필요',
        onClick: () => openLot(r.lot.id),
        actionLabel: `— ${r.lot.id} 로트 상세 보기`,
      })
    }
    for (const r of d.rows.filter(x => x.germ.state === 'caution' && x.germ.dueState !== 'overdue')) {
      out.push({
        id: `cau-${r.lot.id}`,
        severity: 'warning',
        icon: FlaskConical,
        title: `${r.lot.id} ${lineLabel(r.lot.line)} 발아 주의 ${r.germ.last?.germ}%`,
        value: `기한 ${r.germ.due}`,
        description: `${r.germ.last?.resultDate} 판정${r.lot.memo ? ` · ${r.lot.memo}` : ''}`,
        onClick: () => openLot(r.lot.id),
        actionLabel: `— ${r.lot.id} 로트 상세 보기`,
      })
    }
    return out
    // openReq·openLot은 d·화면 폭에만 의존한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, d, sm, xlUp])

  const shownAlerts = allAlerts ? alerts : alerts.slice(0, narrow ? NARROW_ALERTS : WIDE_ALERTS)

  // ---------------- 목록 ----------------
  const reqRows: ReqRow[] = state.requests.map(r => ({
    req: r,
    ev: isOpen(r) ? (sm.evals.get(r.id) ?? null) : null,
  }))
  const lotRows = useMemo(() => filterLots(d, filters, r => isAlarmLot(d, r)), [d, filters])
  const catCounts = Object.fromEntries(CATS.map(c => [c, d.rows.filter(r => r.lot.cat === c).length])) as Record<Cat, number>
  const lotRow = d.row(lotId)

  const belowSub = sm.belowByCat.map(x => `${CAT_LABEL[x.cat]} ${x.n}`).join(' · ')

  return (
    <div className="flex flex-col gap-5">
      {/* A. 머리(공통 PageHeader) — 조정 무게·발아 판정 규칙 문단은 「자세히」로 접는다 */}
      <InvHeader scope={`로트 ${formatNumber(sm.lots)} · 분양·반출 요청 ${state.requests.length}건(승인 대기 ${sm.pending}) · 재고는 정조 무게(g), F1은 립수 · 가상 목업 데이터`} />

      {/* B. 요약 줄(공통 KpiRow: 1440 대표 2칸 + 3 · 768 3칸 · 390 2열, 홀수 마지막 전체 폭) */}
      <KpiRow hero ariaLabel="요약">
        <SummaryTile
          hero
          label="분양 요청 승인 대기"
          value={formatNumber(sm.pending)}
          unit="건"
          severity={sm.pending > 0 ? 'warning' : undefined}
          tag="처리 필요"
          sub={`점검 차단 ${sm.blocked} · 출고 대기 ${sm.approved} · ${Number(AS_OF.slice(5, 7))}월 출고 ${sm.octShipped}건`}
          onClick={() => openReq(state.requests.find(r => r.status === 'pending')?.id ?? reqId, { sheet: false })}
          actionLabel="요청 목록 보기"
        />
        <SummaryTile
          label="최소 보유량 미달"
          value={formatNumber(sm.below)}
          unit="계통"
          severity={sm.below > 0 ? 'critical' : undefined}
          tag="증식 필요"
          sub={`${belowSub}${belowSub ? ' · ' : ''}사용 보류 ${sm.holdLines} · 입고 대기 ${sm.awaitingLines}`}
          onClick={() => openLot(lotId, { alarmOnly: true, sheet: false })}
          actionLabel="경보 로트 보기"
        />
        <SummaryTile
          label="발아 재검사 기한 지남"
          value={formatNumber(sm.overdue)}
          unit="로트"
          severity={sm.overdue > 0 ? 'warning' : undefined}
          tag="재검사"
          sub={`${DUE_SOON_DAYS}일 이내 ${sm.soon} · 불합격 ${sm.germ.fail} · 검사 중 ${sm.germ.testing}`}
          onClick={() => openLot(d.rows.find(r => r.germ.dueState === 'overdue')?.lot.id ?? lotId, { alarmOnly: true, sheet: false })}
          actionLabel="경보 로트 보기"
        />
        <SummaryTile
          label="재고(정조)"
          value={fmtKg(sm.totalG)}
          unit="kg"
          sub={`로트 ${formatNumber(sm.lots)} · F1 ${formatNumber(sm.f1Grains)}립(보류 ${formatNumber(sm.f1Hold)} 포함)`}
          onClick={() => openLot(lotId, { sheet: false })}
          actionLabel="재고 로트 보기"
        />
      </KpiRow>

      {/* C. 경보 목록 */}
      <Card title={`경보·주의 ${alerts.length}건`} subtitle="처리할 일 · 심각도 순 · 항목을 누르면 요청·로트 상세로 이동합니다">
        <AlertList items={shownAlerts} density="compact" ariaLabel="재고·요청 경보" emptyText="경보가 없습니다" className="xl:grid xl:grid-cols-2" />
        {shownAlerts.length < alerts.length && (
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setAllAlerts(true)}>
            나머지 {alerts.length - shownAlerts.length}건 더 보기
          </Button>
        )}
      </Card>

      {/* D. 탭 */}
      <section ref={tabsRef} aria-label="요청과 재고" className="flex scroll-mt-16 flex-col gap-3">
        <Tabs<TabId>
          ariaLabel="요청·재고 탭"
          value={tab}
          onChange={setTab}
          items={[
            { id: 'req', label: `분양·반출 요청 (${state.requests.length})` },
            { id: 'lot', label: `재고 로트 (${formatNumber(d.rows.length)})` },
          ]}
        />
        {tab === 'req' ? (
          <div role="tabpanel" aria-label="분양·반출 요청" className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            {/* 상세가 긴 요청에서 왼쪽 열이 비지 않게 목록을 붙여 둔다(상세를 읽는 동안 다른 요청을 고를 수 있다, 검토 V2) */}
            <div className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-4 xl:col-span-3 xl:self-start">
              <RequestList rows={reqRows} selected={reqId} onSelect={id => openReq(id, { scroll: false })} narrow={narrow} />
              <StandardsCard />
            </div>
            {xlUp && (
              <div className="min-w-0 xl:col-span-2" data-request-id={req.id}>
                <RequestDetail key={req.id} req={req} ev={ev} d={d} saving={saving} h={handlers} />
              </div>
            )}
          </div>
        ) : (
          <div role="tabpanel" aria-label="재고 로트" className="flex flex-col gap-3">
            <LotToolbar f={filters} setF={setFilters} counts={catCounts} />
            <p className="text-xs text-muted" aria-live="polite">
              {formatNumber(lotRows.length)}로트 표시 · 막대 = 로트 재고 ÷ 계통 최소 보유량 · 경보는 계통 가용 기준(F1은 립)
            </p>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
              <div className="min-w-0 ">
                <LotTable
                  rows={lotRows}
                  d={d}
                  selected={lotId}
                  onSelect={id => {
                    setLotId(id)
                    if (!xlUp) openSheet('lot')
                  }}
                  page={page}
                  onPage={setPage}
                  narrow={narrow}
                  sort={sort}
                  onSort={s => {
                    setSort(s)
                    setPage(0)
                  }}
                />
              </div>
              {xlUp && (
                <div className="min-w-0">
                  <LotDetail r={lotRow} d={d} onOpenLot={openLot} onOpenReq={id => openReq(id)} />
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* E. 각주 */}
      <footer className="flex flex-col gap-1 border-t border-border pt-3 text-xs leading-relaxed text-muted">
        <p>모든 계통명·기관명·수치는 가상 목업 데이터입니다.</p>
        <p>
          발아 판정 기준(합격 {GERM_PASS}% · 주의 {GERM_FAIL}%)과 최소 보유량(대비 품종 {formatNumber(MIN_HOLD.check)} g · 출원 후보 {formatNumber(MIN_HOLD.cand)} g · MET {formatNumber(MIN_HOLD.met)}{' '}
          g · 부모 후보 {formatNumber(MIN_HOLD.parent)} g · AYT {formatNumber(MIN_HOLD.ayt)} g · F1 {MIN_HOLD.f1}립)·표준 출고량은 이 프로그램의 내부 기준(추정)입니다.
        </p>
        <p>정조 천립중 = 현미 천립중 ÷ 제현율 {HULL_RATIO.toFixed(2)}(추정).</p>
        <p className="inline-flex items-center gap-1">
          <Sprout size={11} aria-hidden="true" />
          연결 화면: 교배 실적 기록(F1 결실 립수·진위), 교배 설계(부모 후보), 시험포장 배치·표현형 입력(AYT 수확·천립중), 샘플 추적(유전체 분석 시료).
        </p>
      </footer>

      {/* 상세: 390px 하단 시트, 640~1279px 오른쪽 서랍. 시트를 닫지 않고 승인·출고한다. 시트 버튼이 결정 바보다 DOM 앞에 오도록 먼저 둔다 */}
      <BottomSheet
        open={!xlUp && sheet !== null}
        onClose={closeSheet}
        labelledBy="si-sheet-title"
        maxHeight={narrow ? '88vh' : '100%'}
        className={narrow ? undefined : DRAWER_CLASS}
        header={sheet === 'lot' ? '로트 상세' : '요청 상세·처리'}
        footer={sheet === 'req' && isOpen(req) ? <RequestFooter req={req} ev={ev} saving={saving} h={handlers} rejecting={rejecting} onRejecting={setRejecting} /> : undefined}
      >
        {sheet === 'lot' ? (
          <LotDetail plain titleId="si-sheet-title" r={lotRow} d={d} onOpenLot={openLot} onOpenReq={id => openReq(id)} />
        ) : (
          <div data-request-id={req.id}>
            <RequestDetail key={req.id} plain titleId="si-sheet-title" req={req} ev={ev} d={d} saving={saving} h={handlers} />
          </div>
        )}
      </BottomSheet>

      {/* 결정 바: 처리할 요청을 보고 있을 때 화면 아래에 붙는다 */}
      {tab === 'req' && isOpen(req) && <RequestBar req={req} ev={ev} saving={saving} h={handlers} rejecting={rejecting && sheet === null} onRejecting={setRejecting} />}

      <Toast {...toast.toastProps} className="max-sm:bottom-32!" />
    </div>
  )
}

/** 요청·출고량은 입력한 정수 그대로 */
const reqQty = (v: number, unit: 'g' | '립') => `${formatNumber(v)}${unit === 'g' ? ' g' : '립'}`

/** 페이지 머리(본 화면·로딩·빈·오류 상태 공용). 긴 방법·판정 규칙 문단은 「자세히」 */
function InvHeader({ scope }: { scope?: string }) {
  return (
    <PageHeader
      context={
        <>
          벼(<i>Oryza sativa</i>) · 저온 저장고 1·2({STORAGE.tempC} °C, 상대습도 {STORAGE.rh}%)
        </>
      }
      title={meta.title}
      scope={scope}
      asOf={AS_OF}
      detailsLabel="재고 단위 · 발아 검사 규칙"
      details={
        <div className="flex flex-col gap-1.5">
          <p>
            재고는 로트(lot)별 <b className="text-text">정조</b>(paddy rice, 겉껍질 포함 낟알) 무게(g), F1(잡종 1세대)은 립수로 관리합니다. 립 환산 = g ÷ <b className="text-text">천립중(정조)</b>(1,000-grain weight,
            TGW) × 1,000.
          </p>
          <p>
            발아율(germination rate)은 {formatNumber(TEST_GRAINS)}립({GERM_TEST.perRep}립 × {GERM_TEST.reps}반복, {GERM_TEST.tempC} °C, 치상 후 {GERM_TEST.days}일 판정)으로 검사하고 검사 립수는 재고에서 뺍니다. 2026 수확
            로트는 휴면 타파(dormancy breaking, {DORMANCY.tempC} °C {DORMANCY.days}일) 후 치상합니다. 판정 합격 ≥ {GERM_PASS}% · 주의 {GERM_FAIL}~{GERM_PASS - 1}% · 불합격 &lt; {GERM_FAIL}%, 재검사 기한은 판정일 +{' '}
            {RETEST_MONTHS.pass}개월(합격) / {RETEST_MONTHS.caution}개월(주의). 품종 종자는 기본식물(breeder seed), 외부 분양은 물질이전계약(MTA) 체결 뒤 출고하며, 진위 검정에서 자식(自殖, selfing)이 의심되는 F1은
            사용 보류합니다.
          </p>
        </div>
      }
    />
  )
}

// ---------------------------------------------------------------- 상태 화면

function DevStateView({ state, onRetry }: { state: Exclude<DevState, 'ready'>; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <InvHeader scope="벼 육종 프로그램 저온 저장고 · 가상 목업 데이터" />
      {state === 'loading' && (
        <div aria-busy="true" aria-label="종자 재고를 불러오는 중" className="flex flex-col gap-4">
          <KpiRow loading hero count={4} skeletonHeight={150} ariaLabel="요약" />
          <Skeleton height={180} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <Skeleton height={420} className="xl:col-span-3" />
            <Skeleton height={420} className="xl:col-span-2" />
          </div>
        </div>
      )}
      {state === 'empty' && <EmptyState title="등록된 종자 로트가 없습니다" description="수확 종자를 입고하면 로트·재고·발아 검사 상태가 여기에 표시됩니다." />}
      {state === 'error' && (
        <ErrorState
          title="종자 재고를 불러오지 못했습니다"
          description="재고 서버와 연결을 확인한 뒤 다시 시도하세요."
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
