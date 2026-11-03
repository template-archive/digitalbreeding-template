import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BadgeCheck, RotateCcw } from 'lucide-react'
import type { TemplateMeta } from '@/gallery/types'
import { Button, ErrorState, PageHeader, SaveBar, Skeleton, Stepper, Toast, useMediaQuery, useToast } from '@/design-system'
import { formatDate } from '@/lib/format'
import {
  ANCHOR_NAMES,
  CANDIDATES,
  CANDIDATE_BY_NAME,
  DEFAULT_FILTERS,
  MAX_CROSSES,
  MAX_PARENTS,
  PARENT_MAX_USE,
  PLAN,
  SIGMA_A,
  allPairs,
  applyFilters,
  crossId,
  fmt1,
  parentUse,
  planSummary,
  planWarnings,
  predictByKey,
  recommend,
  type Candidate,
  type CrossPred,
  type Filters,
  type PKey,
  type PlannedCross,
} from './data'
import { ParentStep } from './components/ParentStep'
import { ReviewStep } from './components/ReviewStep'
import { ConfirmStep, type ConfirmRow } from './components/ConfirmStep'
import type { Metric } from './components/CrossMatrix'
import { Notice } from './components/ui'

type Step = 1 | 2 | 3

export const meta: TemplateMeta = {
  slug: 'cross-planner',
  category: 'workflow',
  title: '교배 조합 설계',
  description: '후보 계통에서 부모를 고르고 부모×부모 행렬에서 유용성 기준(UC)과 근연 정도(공조계수)를 비교해 다음 시즌 교배 조합을 확정한다.',
  tags: ['교배 설계', '유용성 기준', 'UC', 'GEBV', '공조계수', '근연 조합', '벼'],
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

interface Confirmed {
  ids: Map<string, string>
  count: number
}

export default function Template() {
  const devState = useMemo(readDevState, [])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (devState === 'loading') return
    const t = window.setTimeout(() => setLoading(false), 400)
    return () => window.clearTimeout(t)
  }, [devState])

  const wide = useMediaQuery('(min-width: 1024px)')
  const mobile = useMediaQuery('(max-width: 767px)')

  const candidates: Candidate[] = devState === 'empty' ? [] : CANDIDATES

  const [step, setStep] = useState<Step>(1)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selected, setSelected] = useState<string[]>(() => (devState === 'empty' ? [] : ANCHOR_NAMES))
  const [plan, setPlan] = useState<PlannedCross[]>([])
  const [pKey, setPKey] = useState<PKey>('5')
  const [metric, setMetric] = useState<Metric>('uc')
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'matrix'>('list')
  const [notice, setNotice] = useState<string | null>(null)
  const [ack, setAck] = useState(false)
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null)
  const toast = useToast()
  const readOnly = confirmed !== null

  const visible = useMemo(() => applyFilters(candidates, filters), [candidates, filters])
  const parents = useMemo(() => selected.map(n => CANDIDATE_BY_NAME.get(n)!).filter(Boolean), [selected])
  const pairs = useMemo(() => allPairs(parents, pKey), [parents, pKey])
  const recommended = useMemo(() => recommend(pairs), [pairs])
  const plannedKeys = useMemo(() => new Set(plan.map(c => c.key)), [plan])

  // 포커스 셀 기본값: UC 최고 셀
  const effectiveFocus = focusKey && pairs.some(x => x.key === focusKey) ? focusKey : (pairs.slice().sort((a, b) => b.uc - a.uc)[0]?.key ?? null)

  // ---- ① 부모 선택 ----
  const toggleParent = (name: string) => {
    if (readOnly) return
    setNotice(null)
    if (selected.includes(name)) {
      const dropped = plan.filter(c => c.female === name || c.male === name).length
      setSelected(s => s.filter(n => n !== name))
      if (dropped > 0) {
        setPlan(p => p.filter(c => c.female !== name && c.male !== name))
        setNotice(`선택 조합 ${dropped}건이 함께 해제되었습니다.`)
      }
    } else if (selected.length < MAX_PARENTS) {
      setSelected(s => [...s, name])
    }
  }

  // ---- ② 담기·빼기 ----
  const addCross = (key: string) => {
    if (readOnly || plannedKeys.has(key)) return
    if (plan.length >= MAX_CROSSES) {
      setNotice(`조합은 최대 ${MAX_CROSSES}건까지 담을 수 있습니다.`)
      return
    }
    const [a, b] = key.split('|') as [string, string]
    setPlan(p => [...p, { key, female: a, male: b }])
  }
  const removeCross = (key: string) => {
    if (readOnly) return
    setPlan(p => p.filter(c => c.key !== key))
  }
  const addRecommended = () => {
    if (readOnly) return
    const add = recommended.filter(x => !plannedKeys.has(x.key))
    const room = MAX_CROSSES - plan.length
    const take = add.slice(0, Math.max(0, room))
    setPlan(p => [...p, ...take.map(x => ({ key: x.key, female: x.a.name, male: x.b.name }))])
    if (take.length < add.length) setNotice(`상한 ${MAX_CROSSES}건에 도달해 추천 조합 ${add.length - take.length}건을 담지 못했습니다.`)
  }

  // ---- ③ 확정 ----
  const preds = useMemo(
    () =>
      plan
        .map(c => ({ c, x: predictByKey(c.key, pKey) }))
        .filter((r): r is { c: PlannedCross; x: CrossPred } => !!r.x)
        .sort((a, b) => b.x.uc - a.x.uc),
    [plan, pKey],
  )
  const warnings = useMemo(() => planWarnings(plan, pKey), [plan, pKey])
  const summary = useMemo(() => planSummary(plan, pKey), [plan, pKey])
  const overuse = useMemo(() => new Set(Array.from(parentUse(plan)).filter(([, n]) => n > PARENT_MAX_USE).map(([k]) => k)), [plan])
  const hasKinWarn = warnings.some(w => w.kind === 'kinWarn')

  const rows: ConfirmRow[] = preds.map(({ c, x }, i) => ({
    key: c.key,
    order: i + 1,
    id: confirmed?.ids.get(c.key) ?? null,
    female: c.female,
    male: c.male,
    mu: x.mu,
    sigma: x.sigma,
    uc: x.uc,
    f: x.f,
    headingGap: x.headingGap,
    pred: x,
    warnCount: warnings.filter(w => w.keys.includes(c.key)).length,
  }))

  const swap = (key: string) => setPlan(p => p.map(c => (c.key === key ? { ...c, female: c.male, male: c.female } : c)))

  const confirm = () => {
    if (readOnly || plan.length === 0 || (hasKinWarn && !ack)) return
    const ids = new Map(preds.map(({ c }, i) => [c.key, crossId(i)]))
    setConfirmed({ ids, count: preds.length })
    toast.show(`교배 조합 ${preds.length}건을 확정했습니다 · ${PLAN.name.replace('(온실)', '')}(${crossId(0)}~${crossId(preds.length - 1)})`)
  }
  const reset = () => {
    setConfirmed(null)
    setPlan([])
    setSelected(ANCHOR_NAMES)
    setFilters(DEFAULT_FILTERS)
    setPKey('5')
    setMetric('uc')
    setFocusKey(null)
    setAck(false)
    setNotice(null)
    setStep(1)
  }

  const goStep = (s: Step) => {
    if (s > 1 && selected.length < 2) return
    setNotice(null)
    setStep(s)
  }

  // 머리(공통 PageHeader): 범위·소속 회색 한 줄 → 제목 + 기준일 → 데이터 한 문장 → 접힌 용어·계산 근거
  const header = (
    <PageHeader
      context={[`${PLAN.crop} · ${PLAN.trait}`, PLAN.name]}
      title={meta.title}
      scope={`후보 ${CANDIDATES.length}계통에서 부모 최대 ${MAX_PARENTS}계통 · 조합 최대 ${MAX_CROSSES}건 · 유전체 추정 육종가(GEBV)는 기준 집단 평균 대비 편차(GBLUP) · 목업 데이터`}
      asOf={formatDate(PLAN.asOf)}
      detailsLabel="용어·계산 근거"
      details={
        <>
          유전체 추정 육종가(GEBV) · 신뢰도(r²) · 유용성 기준(UC) = μ + i·σ · 선발 강도(i) · 공조계수(f, 두 부모에서 하나씩 뽑은 대립유전자가 같은 조상에서 왔을 확률 — 관계 계수 G = 2f) · 상가적 유전 표준편차(σA = {fmt1(SIGMA_A)} kg/10a).
          자손 분산은 무한소 모형 근사이며 실제 도구는 마커 효과와 재조합률로 계산합니다(PopVar 등). 계통명은 모두 가상이며 실존 계통·품종과 관계없습니다. 도열병 저항성 유전자(Pi-ta·Pib·Pi9·Pigm) 보유 여부도 가상입니다.
        </>
      }
    />
  )

  if (devState === 'error')
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState title="후보 계통을 불러오지 못했습니다" description="GEBV 예측 결과 서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요." action={<Button onClick={() => window.location.reload()}>다시 시도</Button>} />
      </div>
    )

  if (loading)
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <Skeleton height={60} />
        <div className="flex flex-col gap-4 lg:flex-row">
          <Skeleton height={420} className="lg:w-[280px]" />
          <Skeleton height={420} className="flex-1" />
        </div>
        <span className="sr-only">후보 계통을 불러오는 중</span>
      </div>
    )

  // 단계 바(공통 SaveBar): 모든 단계가 같은 자리·같은 문법이다. 왼쪽 상태 → 이전 → 오른쪽 다음·확정(검토 C2).
  // 확정은 되돌리기 어려워 강한 근연 조합이 있으면 왼쪽 확인 체크를 먼저 받는다(기존 절차 그대로)
  const canConfirm = !readOnly && plan.length > 0 && (!hasKinWarn || ack)
  const blockReason =
    step === 1 && selected.length < 2
      ? '부모를 2계통 이상 선택하세요'
      : step === 3 && !readOnly && plan.length === 0
        ? '담은 조합이 없습니다'
        : step === 3 && !readOnly && hasKinWarn && !ack
          ? '강한 근연 조합 확인이 필요합니다'
          : null
  const stepBar = {
    1: { status: `부모 ${selected.length}계통 선택`, label: '다음: 조합 검토', icon: <ArrowRight size={14} aria-hidden="true" />, can: selected.length >= 2, go: () => goStep(2) },
    2: { status: `담은 조합 ${plan.length} / ${MAX_CROSSES}건`, label: '다음: 확정', icon: <ArrowRight size={14} aria-hidden="true" />, can: true, go: () => goStep(3) },
    3: readOnly
      ? { status: '확정된 계획은 읽기 전용입니다', label: '새 계획 시작', icon: <RotateCcw size={14} aria-hidden="true" />, can: true, go: reset }
      : { status: `교배 조합 ${plan.length}건`, label: '조합 확정', icon: <BadgeCheck size={15} aria-hidden="true" />, can: canConfirm, go: confirm },
  }[step]
  const backLabel = step === 3 ? '이전: 조합 검토' : '이전: 부모 선택'

  return (
    <div className="flex flex-col gap-4">
      {header}

      <Stepper
        ariaLabel="교배 계획 단계"
        current={step}
        onChange={goStep}
        items={[
          { id: 1, label: '부모 후보 선택', description: `부모 ${selected.length}`, enabled: true, done: selected.length >= 2 },
          { id: 2, label: '조합 검토', description: `조합 ${plan.length}`, enabled: selected.length >= 2, done: plan.length > 0 },
          { id: 3, label: '확정', description: readOnly ? `확정 ${confirmed.count}건` : `조합 ${plan.length}`, enabled: selected.length >= 2, done: readOnly },
        ]}
      />

      <h2 className="sr-only">{`${step}단계 · ${step === 1 ? '부모 후보 선택' : step === 2 ? '조합 검토' : '확정'}`}</h2>

      {readOnly && step !== 3 &&<Notice tone="warning">확정된 계획은 편집할 수 없습니다. 바꾸려면 ③ 확정 단계에서 「새 계획 시작」을 누르세요.</Notice>}

      {step === 1 && (
        <ParentStep
          candidates={candidates}
          visible={visible}
          filters={filters}
          onFilters={setFilters}
          selected={selected}
          onToggle={toggleParent}
          readOnly={readOnly}
          notice={notice}
          onDismissNotice={() => setNotice(null)}
          wide={wide}
          mobile={mobile}
        />
      )}

      {step === 2 && (
        <ReviewStep
          parents={parents}
          pairs={pairs}
          recommended={recommended}
          plannedKeys={plannedKeys}
          pKey={pKey}
          onP={p => { if (!readOnly) setPKey(p) }}
          metric={metric}
          onMetric={setMetric}
          focusKey={effectiveFocus}
          onFocus={setFocusKey}
          onAdd={addCross}
          onRemove={removeCross}
          onAddRecommended={addRecommended}
          readOnly={readOnly}
          notice={notice}
          onDismissNotice={() => setNotice(null)}
          mobile={mobile}
          mobileView={mobileView}
          onMobileView={setMobileView}
          onBack={() => goStep(1)}
        />
      )}

      {step === 3 && (
        <ConfirmStep
          rows={rows}
          summary={summary}
          warnings={warnings}
          overuse={overuse}
          confirmed={readOnly}
          hasKinWarn={hasKinWarn}
          onSwap={swap}
          onRemove={removeCross}
          onBack={() => goStep(2)}
          plan={plan}
          mobile={mobile}
        />
      )}

      {/* 단계 바: 화면 아래 고정(sticky), 좁은 화면은 버튼 44px */}
      <SaveBar
        placement="bottom"
        pinned
        dirty={0}
        saving={false}
        canSave={stepBar.can}
        onSave={stepBar.go}
        onRevert={() => undefined}
        showRevert={false}
        saveLabel={stepBar.label}
        saveIcon={stepBar.icon}
        blockReasonId={blockReason ? 'cp-step-block' : undefined}
        saveButtonProps={{ 'data-action': 'step-next' }}
        secondary={
          step > 1 && !(step === 3 && readOnly) ? (
            <Button variant="ghost" onClick={() => goStep((step - 1) as Step)} className="flex-1 max-sm:min-h-11 sm:flex-none">
              {backLabel}
            </Button>
          ) : undefined
        }
      >
        <span aria-live="polite" className="font-semibold tabular-nums text-text">
          {stepBar.status}
        </span>
        {blockReason && (
          <span id="cp-step-block" className="text-xs font-medium text-negative">
            {blockReason}
          </span>
        )}
        {step === 3 && !readOnly && hasKinWarn && (
          <label data-kin-ack="" className="flex cursor-pointer items-center gap-2 text-[13px] text-text">
            <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} className="size-4 accent-[var(--color-text)]" />
            강한 근연 조합(자손 분산이 작음)을 포함해 확정합니다
          </label>
        )}
      </SaveBar>

      <Toast {...toast.toastProps} className="max-sm:bottom-28!" />
    </div>
  )
}
