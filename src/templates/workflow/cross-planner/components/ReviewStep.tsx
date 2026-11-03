import { useMemo } from 'react'
import { LayoutGrid, List, Minus, Plus, Sparkles, X } from 'lucide-react'
import { Badge, Button, Card, EmptyState, KinBadge, Segmented } from '@/design-system'
import { HEADING_GAP, I_BY_P, MAX_CROSSES, fmt1, fmt2, fmtSigned1, parentOrder, type Candidate, type CrossPred, type PKey } from '../data'
import { CrossMatrix, MatrixLegend, METRIC_LABEL, metricValue, type Metric } from './CrossMatrix'
import { Notice, RecommendBadge } from './ui'

const P_OPTIONS: { value: PKey; label: string }[] = [
  { value: '10', label: '10%' },
  { value: '5', label: '5%' },
  { value: '1', label: '1%' },
]
const METRIC_OPTIONS = (Object.keys(METRIC_LABEL) as Metric[]).map(m => ({ value: m, label: METRIC_LABEL[m].short }))

export interface ReviewStepProps {
  parents: Candidate[]
  pairs: CrossPred[]
  recommended: CrossPred[]
  plannedKeys: Set<string>
  pKey: PKey
  onP: (p: PKey) => void
  metric: Metric
  onMetric: (m: Metric) => void
  focusKey: string | null
  onFocus: (k: string) => void
  onAdd: (k: string) => void
  onRemove: (k: string) => void
  onAddRecommended: () => void
  readOnly: boolean
  notice: string | null
  onDismissNotice: () => void
  mobile: boolean
  mobileView: 'list' | 'matrix'
  onMobileView: (v: 'list' | 'matrix') => void
  onBack: () => void
}

function CrossDetail({
  x,
  recommended,
  planned,
  full,
  readOnly,
  onAdd,
  onRemove,
}: {
  x: CrossPred
  recommended: boolean
  planned: boolean
  full: boolean
  readOnly: boolean
  onAdd: () => void
  onRemove: () => void
}) {
  const gapWarn = x.headingGap > HEADING_GAP
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        {[x.a, x.b].map((p, i) => (
          <div key={p.name} className="flex items-baseline justify-between gap-2 text-[13px]">
            <span className="min-w-0 truncate">
              <span className="mr-1.5 text-xs text-muted">{i === 0 ? '부모 P' : '부모 Q'}</span>
              <strong className="text-text">{p.name}</strong>
            </span>
            <span className="shrink-0 text-muted tabular-nums">GEBV {fmtSigned1(p.gebv)}</span>
          </div>
        ))}
      </div>
      <div className="rounded-md border border-border bg-surface-2 p-3">
        <div className="text-xs font-medium text-muted">유용성 기준(UC) · 선발된 상위 자손의 기대 평균 GEBV</div>
        <div className="mt-1 flex items-baseline gap-1 tabular-nums">
          <span className="text-4xl font-extrabold tracking-tight text-text">{fmt1(x.uc)}</span>
          <span className="text-sm font-bold text-muted">kg/10a</span>
        </div>
        <p className="mt-2 text-[13px] text-text tabular-nums">
          UC = {fmt1(x.mu)} + {x.i.toFixed(3)} × {fmt1(x.sigma)} = <strong>{fmt1(x.uc)}</strong> kg/10a
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[13px] tabular-nums">
        <dt className="text-muted">자손 평균 μ</dt>
        <dd className="text-right font-semibold text-text">{fmt1(x.mu)} kg/10a</dd>
        <dt className="text-muted">자손 SD σ</dt>
        <dd className="text-right font-semibold text-text">{fmt1(x.sigma)} kg/10a</dd>
        <dt className="text-muted">공조계수(f)</dt>
        <dd className="flex items-center justify-end gap-1.5 font-semibold text-text">
          {fmt2(x.f)} <KinBadge level={x.level} />
        </dd>
        <dt className="text-muted">출수기 차이</dt>
        <dd className="flex items-center justify-end gap-1.5 font-semibold text-text">
          {x.headingGap}일
          {gapWarn && <Badge tone="warning">개화기 불일치</Badge>}
        </dd>
        <dt className="text-muted">Pi 유전자</dt>
        <dd className="text-right font-semibold text-text">
          {x.a.pi} × {x.b.pi}
        </dd>
      </dl>
      {gapWarn && <p className="text-xs text-muted">출수기 차이가 {HEADING_GAP}일을 넘습니다 — 파종 시기 조절 필요.</p>}
      <div className="flex flex-wrap items-center gap-2">
        {recommended && <RecommendBadge />}
        {planned ? (
          <Button variant="danger" onClick={onRemove} disabled={readOnly} className="ml-auto">
            <Minus size={14} aria-hidden="true" />
            조합 빼기
          </Button>
        ) : (
          <Button variant="primary" onClick={onAdd} disabled={readOnly || full} className="ml-auto">
            <Plus size={14} aria-hidden="true" />
            조합 담기
          </Button>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-muted">
        σ = σA·√(1−f)·k, σA = 28.2 kg/10a, k = {x.k.toFixed(3)}(부모 차이에 따른 분리 계수, 목업 근사). 정역교배 차이는 반영하지 않습니다.
      </p>
    </div>
  )
}

export function ReviewStep(props: ReviewStepProps) {
  const { parents, pairs, recommended, plannedKeys, pKey, onP, metric, onMetric, focusKey, onFocus, onAdd, onRemove, onAddRecommended, readOnly, notice, mobile, mobileView } = props
  const pairMap = useMemo(() => new Map(pairs.map(x => [x.key, x])), [pairs])
  const recSet = useMemo(() => new Set(recommended.map(x => x.key)), [recommended])
  // 행·열 순서는 data.ts의 parentOrder(GEBV 내림차순)와 같아야 키(행|열)가 맞는다
  const sortedParents = useMemo(() => parents.slice().sort(parentOrder), [parents])
  const range = useMemo<[number, number]>(() => {
    const vs = pairs.map(x => metricValue(x, metric))
    return vs.length ? [Math.min(...vs), Math.max(...vs)] : [0, 1]
  }, [pairs, metric])
  const full = plannedKeys.size >= MAX_CROSSES
  const focus = focusKey ? pairMap.get(focusKey) ?? null : null
  const recRemaining = recommended.filter(x => !plannedKeys.has(x.key)).length
  const i = I_BY_P[pKey]

  if (parents.length < 2)
    return (
      <Card>
        <EmptyState
          title="부모를 2계통 이상 선택하세요"
          description="① 부모 후보 선택 단계에서 교배에 쓸 계통을 고르면 조합 행렬이 만들어집니다."
          action={<Button onClick={props.onBack}>부모 선택으로 돌아가기</Button>}
        />
      </Card>
    )

  const plannedList = Array.from(plannedKeys)
    .map(k => pairMap.get(k))
    .filter((x): x is CrossPred => !!x)
  const sortedPairs = pairs.slice().sort((a, b) => b.uc - a.uc)

  const detail = focus ? (
    <CrossDetail
      x={focus}
      recommended={recSet.has(focus.key)}
      planned={plannedKeys.has(focus.key)}
      full={full}
      readOnly={readOnly}
      onAdd={() => onAdd(focus.key)}
      onRemove={() => onRemove(focus.key)}
    />
  ) : (
    <p className="text-[13px] text-muted">행렬에서 셀을 고르면 조합의 예측 자손 성적과 근연 정도(자손 분산 축소)가 여기에 표시됩니다.</p>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* F. 선발 비율 + 지표 */}
      <Card padding="md">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-text tabular-nums">
              UC = μ + i·σ, <span className="font-bold">i = {i.toFixed(3)}</span>(p = {pKey}%)
            </p>
            <p className="mt-0.5 text-xs text-muted">
              유용성 기준(UC): 조합에서 상위 p% 자손을 선발했을 때의 기대 평균 GEBV. 선발 강도(i)는 정규 절단 선발 기준(10% 1.755 · 5% 2.063 · 1% 2.665). 참 유전가치 기준 선발(정확도 1)을 가정하므로 절대 개량량이 아니라 조합 간 상대 비교용이다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="shrink-0 whitespace-nowrap text-xs font-medium text-muted" aria-hidden="true">
                조합 내 선발 비율 p
              </span>
              {readOnly ? (
                <Badge tone="neutral">p = {pKey}% · 확정 시 고정</Badge>
              ) : (
                <Segmented options={P_OPTIONS} value={pKey} onChange={onP} ariaLabel="조합 내 선발 비율 p" size="sm" />
              )}
            </div>
            {(!mobile || mobileView === 'matrix') && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="shrink-0 whitespace-nowrap text-xs font-medium text-muted" aria-hidden="true">셀 지표</span>
                <Segmented options={METRIC_OPTIONS} value={metric} onChange={onMetric} ariaLabel="행렬 셀 지표" size="sm" />
              </div>
            )}
          </div>
        </div>
      </Card>

      {readOnly && <Notice tone="warning">확정된 계획입니다. 조합을 바꾸려면 ③ 확정 단계에서 「새 계획 시작」을 누르세요.</Notice>}
      {notice && <Notice onClose={props.onDismissNotice}>{notice}</Notice>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* E. 행렬 / 모바일 목록 */}
        <Card
          className="lg:col-span-2"
          title="부모 × 부모 조합 행렬"
          subtitle={`선택 부모 ${parents.length}계통 · 상삼각 ${pairs.length}조합 · 대각(자가 조합)은 제외`}
          actions={
            mobile ? (
              <Button size="sm" variant="secondary" onClick={() => props.onMobileView(mobileView === 'list' ? 'matrix' : 'list')}>
                {mobileView === 'list' ? <LayoutGrid size={13} aria-hidden="true" /> : <List size={13} aria-hidden="true" />}
                {mobileView === 'list' ? '행렬 보기' : '목록 보기'}
              </Button>
            ) : undefined
          }
        >
          {mobile && mobileView === 'list' ? (
            <ul className="flex flex-col gap-2" aria-label="조합 목록(UC 내림차순)">
              {sortedPairs.map((x, rank) => {
                const sel = plannedKeys.has(x.key)
                return (
                  <li
                    key={x.key}
                    className={`rounded-md border bg-surface p-3 ${x.level === 'warn' ? 'border-negative/60' : x.level === 'caution' ? 'border-dashed border-warning/70' : 'border-border'} ${sel ? 'select-ring' : ''}`}
                    data-planned={sel ? 'true' : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 text-[13px]">
                        <span className="mr-1 text-xs text-muted tabular-nums">{rank + 1}.</span>
                        <strong className="text-text">{x.a.name}</strong> <span className="text-muted">×</span> <strong className="text-text">{x.b.name}</strong>
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        <span className="text-lg font-extrabold text-text">{fmt1(x.uc)}</span>
                        <span className="ml-0.5 text-[11px] text-muted">UC</span>
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-muted tabular-nums">
                      μ {fmt1(x.mu)} · σ {fmt1(x.sigma)} · f {fmt2(x.f)} · 출수기 차 {x.headingGap}일
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {x.level !== 'ok' && <KinBadge level={x.level} />}
                      {recSet.has(x.key) && <RecommendBadge />}
                      {x.headingGap > HEADING_GAP && <Badge tone="warning">개화기 불일치</Badge>}
                      <Button
                        size="sm"
                        variant={sel ? 'danger' : 'secondary'}
                        className="ml-auto"
                        disabled={readOnly || (!sel && full)}
                        onClick={() => (sel ? onRemove(x.key) : onAdd(x.key))}
                      >
                        {sel ? <Minus size={12} aria-hidden="true" /> : <Plus size={12} aria-hidden="true" />}
                        {sel ? '빼기' : '담기'}
                        <span className="sr-only">{` (${x.a.name} × ${x.b.name})`}</span>
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="flex flex-col gap-3">
              <CrossMatrix
                parents={sortedParents}
                pairs={pairMap}
                metric={metric}
                range={range}
                recommended={recSet}
                planned={plannedKeys}
                focusKey={focusKey}
                onFocus={onFocus}
              />
              <MatrixLegend metric={metric} range={range} />
            </div>
          )}
        </Card>

        {/* G. 셀 상세 */}
        {!(mobile && mobileView === 'list') && (
          <Card title="조합 상세" subtitle="셀을 클릭하거나 Enter로 선택" className="lg:sticky lg:top-4 lg:self-start">
            {detail}
          </Card>
        )}
      </div>

      {/* H. 담은 조합 */}
      <Card
        title="담은 조합"
        subtitle={
          <span className="tabular-nums">
            {plannedKeys.size} / {MAX_CROSSES}건{full && ' · 상한에 도달해 더 담을 수 없습니다'}
          </span>
        }
        actions={
          <Button variant="secondary" onClick={onAddRecommended} disabled={readOnly || recRemaining === 0 || full}>
            <Sparkles size={14} aria-hidden="true" />
            추천 조합 모두 담기{recRemaining > 0 && ` (${recRemaining})`}
          </Button>
        }
      >
        {plannedList.length === 0 ? (
          <p className="text-[13px] text-muted">아직 담은 조합이 없습니다. 상세 패널의 「조합 담기」나 「추천 조합 모두 담기」를 쓰세요.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5 touch:gap-2" aria-label="담은 조합" data-planned-count={plannedList.length}>
            {plannedList.map(x => (
              <li key={x.key}>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 py-1 pl-2.5 pr-1 text-xs text-text tabular-nums">
                  <button type="button" onClick={() => onFocus(x.key)} className="touch-hit-y hover:underline">
                    {x.a.name} × {x.b.name}
                  </button>
                  <span className="font-semibold">UC {fmt1(x.uc)}</span>
                  {x.level === 'warn' && <span className="font-bold text-negative">근연</span>}
                  {x.level === 'caution' && <span className="font-bold text-warning">주의</span>}
                  {!readOnly && (
                    <button type="button" onClick={() => onRemove(x.key)} aria-label={`${x.a.name} × ${x.b.name} 빼기`} className="touch-hit rounded-full p-0.5 text-muted hover:bg-surface hover:text-text">
                      <X size={12} aria-hidden="true" />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
