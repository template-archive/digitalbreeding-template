import { useMemo, useState } from 'react'
import type { TemplateMeta } from '@/gallery/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  KpiRow,
  KpiTile,
  PageHeader,
  ScrollRegion,
  Segmented,
  Skeleton,
  SummaryCallout,
  Switch,
  useElementWidth,
  useMediaQuery,
} from '@/design-system'
import { formatFixed, formatSigned } from '@/lib/format'
import {
  H_MIN_DENDRO,
  ANALYSIS_DATE,
  BASE_CRITERION,
  BASE_DATE,
  BLAST,
  BLAST_EDGE,
  CUT_H,
  DEFAULT_CRITERION,
  DEFAULT_P,
  DEFAULT_PAIR,
  DG_PCT_MAX,
  IDX,
  K,
  L,
  N,
  SNP_COUNT,
  TRAITS,
  annualYield,
  computeResponse,
  criterionLabel,
  f2,
  fmtInt,
  fmtPct,
  pairOf,
  summarize,
  upgma,
  visibleTraits,
  type Criterion,
} from './data'
import { CorrelationMatrix, MatrixLegend } from './components/CorrelationMatrix'
import { PairDetail } from './components/PairDetail'
import { PairScatter } from './components/PairScatter'
import { ResponsePanel } from './components/ResponsePanel'
import { MetricStrip } from './components/MetricStrip'

export const meta: TemplateMeta = {
  slug: 'trait-correlation',
  category: 'viz',
  title: '형질 상관 행렬',
  description:
    '훈련 집단 1,850계통의 8형질 유전 상관(rG)·표현형 상관(rP)·유전력을 군집 정렬 행렬로 보고, 쌍별 분해와 선발 지수의 상관 반응(부수 효과)을 확인하는 화면.',
  tags: ['유전 상관', '표현형 상관', '유전력', 'REML', 'UPGMA', '상관 반응', '선발 지수', '벼'],
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

type SortMode = 'cluster' | 'base'
const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'cluster', label: '군집 정렬' },
  { value: 'base', label: '기본 순서' },
]

/** 다음 GS 재학습 시점 — 유전체 예측 성능 화면의 「다음 재학습(2027-02)」, program-baseline 연간 일정(재학습 2월)과 같게 */
const NEXT_RETRAIN = '2027-02'

export default function Template() {
  const narrow = useMediaQuery('(max-width: 639px)')
  const [devState, setDevState] = useState<DevState>(readDevState)
  const [sort, setSort] = useState<SortMode>('cluster')
  const [withComp, setWithComp] = useState(true)
  const [showSE, setShowSE] = useState(true)
  const [dimNs, setDimNs] = useState(true)
  const [pair, setPair] = useState<[number, number]>(DEFAULT_PAIR)
  const [criterion, setCriterion] = useState<Criterion>(DEFAULT_CRITERION)
  const [p, setP] = useState<number>(DEFAULT_P)
  const { ref: boxRef, width } = useElementWidth<HTMLDivElement>()

  const visible = useMemo(() => visibleTraits(withComp), [withComp])
  const clustering = useMemo(() => upgma(visible), [visible])
  const order = sort === 'cluster' ? clustering.order : visible
  const summary = useMemo(() => summarize(visible), [visible])
  const cur = useMemo(() => computeResponse(criterion, p), [criterion, p])
  const base = useMemo(() => computeResponse(BASE_CRITERION, p), [p])

  const toggleComp = (next: boolean) => {
    setWithComp(next)
    if (!next) {
      if (TRAITS[pair[0]]!.component || TRAITS[pair[1]]!.component) setPair(DEFAULT_PAIR)
      if (criterion.startsWith('single:') && TRAITS[IDX[criterion.slice(7) as keyof typeof IDX]]!.component) setCriterion(DEFAULT_CRITERION)
    }
  }
  const select = (a: number, b: number) => setPair(a < b ? [a, b] : [b, a])

  // 머리(공통 PageHeader: 범위 회색 한 줄 → 제목 + 기준일 스탬프 → 데이터 범위 한 문장)
  const header = (
    <PageHeader
      context={['벼', '중부 평야지', `${NEXT_RETRAIN} GS 재학습 준비`]}
      title={meta.title}
      scope={`훈련 집단 ${fmtInt(N)}계통 · 2변량 REML(GBLUP, 유전체 관계 행렬(GRM) ${fmtInt(SNP_COUNT)} SNP) · 표현형 계통 평균 · 형질 ${K}개(수량 구성 요소 2 포함) · 분석일 ${ANALYSIS_DATE}`}
      asOf={BASE_DATE}
      details={
        narrow ? (
          <>
            상관 반응: 세대당 기대 반응 ÷ 세대 간격 {formatFixed(L, 1)}년 = 연간. {formatFixed(DG_PCT_MAX, 1)}%/년을 넘으면 작물 수량 카탈로그 범위를 넘는 이론값으로 표시한다. 유의 판정: Wald z = rG / SE(Robertson 근사), 양측 p. 부호가 다른 쌍:
            rG와 rP의 부호가 다르고 둘 다 |r| ≥ 0.05인 쌍.
          </>
        ) : undefined
      }
      detailsLabel="지표 계산 방법"
    />
  )

  if (devState === 'error') {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState
          title="형질 상관 결과를 읽지 못했습니다. 다시 시도하세요"
          description="2변량 REML 분석 결과 응답이 없습니다."
          action={<Button onClick={() => setDevState('ready')}>다시 시도</Button>}
        />
      </div>
    )
  }
  if (devState === 'empty') {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState title="상관 분석 결과가 없습니다" description="형질 2개 이상의 2변량 REML 결과가 등록되면 상관 행렬이 표시됩니다." />
      </div>
    )
  }
  if (devState === 'loading') {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <Skeleton height={narrow ? 92 : 48} className="rounded-md" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-7" title={`${K} × ${K} 형질 상관 행렬`} subtitle="상관 분석 결과를 불러오는 중…">
            <Skeleton height={560} />
          </Card>
          <Card className="xl:col-span-5" title="쌍 상세">
            <Skeleton height={560} />
          </Card>
        </div>
        <KpiRow loading hero count={4} skeletonHeight={128} />
        <Skeleton height={320} />
      </div>
    )
  }

  const st = summary.strongest
  const yi = IDX.yield
  const annual = annualYield(cur.resp[yi]!)
  const ratio = cur.resp[yi]! / base.resp[yi]!
  const isBase = criterion === BASE_CRITERION
  const sd = summary.signDiff
  const q = pairOf(pair[0], pair[1])
  const xs = TRAITS[q.a]!
  const ys = TRAITS[q.b]!
  const blastInPair = q.a === BLAST || q.b === BLAST

  // 선택 지표: 넓은 화면 KpiRow(대표 = 상관 반응), 390px 가로 띠. 띠 안에서는 위로 열리는 ⓘ가 잘리므로 뜻은 머리 「자세히」로
  const tiles = [
    <KpiTile
      key="response"
      size="hero"
      label={`상관 반응 · ${criterionLabel(criterion)}`}
      plainLabel={`상관 반응(현재 선발 기준 ${criterionLabel(criterion)})`}
      value={`수량 ${formatSigned(cur.resp[yi]!, 1)}`}
      unit="kg/10a/세대"
      sub={`${isBase ? '' : `수량 단일의 ${fmtPct(ratio)} · `}연 ${formatFixed(annual.perYear, 1)} kg/10a(${formatFixed(annual.pct, 2)}%) · p ${fmtPct(p)}`}
      badge={annual.over ? <Badge tone="warning">범위 초과(이론값)</Badge> : undefined}
      info={narrow ? undefined : `세대당 기대 반응 ÷ 세대 간격 ${formatFixed(L, 1)}년 = 연간. ${formatFixed(DG_PCT_MAX, 1)}%/년을 넘으면 작물 수량 카탈로그 범위를 넘는 이론값으로 표시한다.`}
    />,
    <KpiTile
      key="sig"
      label="유의한 유전 상관"
      value={`${summary.sigRg} / ${summary.pairs}`}
      unit="쌍"
      sub={`p < 0.05 · 본페로니 ${summary.bonfRg}쌍 · 표현형 ${summary.sigRp}쌍`}
      info={narrow ? undefined : `Wald z = rG / SE(Robertson 근사), 양측 p. 본페로니 α = 0.05/${summary.pairs} = ${formatFixed(summary.bonfAlpha, 4)}. 표현형 상관은 n = ${fmtInt(N)}이라 작은 상관도 유의하다.`}
    />,
    <KpiTile
      key="strongest"
      label="가장 강한 유전 상관"
      value={f2(st.rg)}
      sub={`${TRAITS[st.a]!.short}–${TRAITS[st.b]!.short} · ± ${f2(st.se)} · rP ${f2(st.rp)}`}
      info={narrow ? undefined : '|rG| 최대 쌍. 늦게 피는 계통이 키도 큰 경향(같은 생육 기간 유전자 묶음).'}
    />,
    <KpiTile
      key="sign"
      label="부호가 다른 쌍"
      value={sd.length}
      unit="쌍"
      sub={sd.length ? sd.map(s => `${TRAITS[s.a]!.label}–${TRAITS[s.b]!.short} rG ${formatSigned(s.rg, 2)} · rP ${formatSigned(s.rp, 2)}`).join(' / ') : '없음'}
      badge={sd.length ? <Badge tone="warning">표현형만 보면 오해</Badge> : undefined}
      info={narrow ? undefined : 'rG와 rP의 부호가 다르고 둘 다 |r| ≥ 0.05인 쌍. 환경 상관이 표현형 상관을 반대로 끈 경우다.'}
    />,
  ]

  // 조작: 넓은 화면은 행렬 아래, 390px은 행렬 바로 위. 표준오차는 셀에 나올 폭에서만(좁으면 쌍 상세에 있다)
  const controls = (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted">정렬</span>
        <Segmented ariaLabel="행렬 정렬" size="sm" options={SORT_OPTIONS} value={sort} onChange={setSort} />
      </div>
      <Switch className="h-8" checked={withComp} onChange={toggleComp} label="수량 구성 요소(수장·이삭수) 포함" />
      {width >= 640 && <Switch className="h-8" checked={showSE} onChange={setShowSE} label="표준오차 표시" />}
      <Switch className="h-8" checked={dimNs} onChange={setDimNs} label="비유의 흐리게" />
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* 결론 띠: 머리 바로 아래 한 곳. 형질 구성·선발 기준에 따라 바뀐다 */}
      <SummaryCallout live>
        유의한 유전 상관은 <b>{summary.sigRg}</b> / {summary.pairs}쌍이고 가장 강한 쌍은 {TRAITS[st.a]!.short}–{TRAITS[st.b]!.short}(rG <b>{f2(st.rg)}</b>)입니다.{' '}
        {sd.length > 0 && <>rG와 rP의 부호가 다른 쌍이 <b>{sd.length}</b>쌍 있어 표현형 상관만 보면 오해할 수 있습니다. </>}
        {criterionLabel(criterion)} 기준으로 상위 {fmtPct(p)}를 고르면 수량은 세대당 <b>{formatSigned(cur.resp[yi]!, 1)}</b> kg/10a로 기대됩니다.
      </SummaryCallout>

      {/* 주 그림 + 쌍 상세 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card
          className="min-w-0 xl:col-span-7"
          title={`${visible.length} × ${visible.length} 형질 상관 행렬`}
          subtitle={`군집 정렬 = 비가중 평균 연결(UPGMA, 거리 1 − |rG|, 덴드로그램 높이 축은 ${f2(H_MIN_DENDRO)}부터) · 점선 상자 = h ${f2(CUT_H)} 절단 묶음 · 진한 테두리 = 선택 쌍 · 셀을 누르면 쌍 상세·산점도가 바뀝니다`}
        >
          <div className="flex flex-col gap-3">
            {narrow && controls}
            {/* 폭 측정은 바깥 블록, 넘칠 때 안내·페이드는 공통 ScrollRegion */}
            <div ref={boxRef} className="w-full">
              <ScrollRegion label="형질 상관 행렬(가로 스크롤)" className="pb-1">
                {width > 0 && (
                  <CorrelationMatrix
                    order={order}
                    clustering={sort === 'cluster' ? clustering : null}
                    showSE={showSE}
                    dimNs={dimNs}
                    selected={pair}
                    onSelect={select}
                    width={width}
                  />
                )}
              </ScrollRegion>
            </div>
            <div className="flex flex-col gap-3 border-t border-border pt-3">
              {!narrow && controls}
              <MatrixLegend />
            </div>
            <p className="text-xs text-muted">
              별: 유의 수준(보정 없음). n = {fmtInt(N)}이라 |rP| ≥ 0.05면 유의 — 크기를 함께 보세요. rG SE는 Robertson(1959) 근사. 도열병은 발병 지수(낮을수록 저항)라 상관 부호를 지수 기준으로
              읽습니다.
            </p>
          </div>
        </Card>
        <PairDetail className="min-w-0 self-start xl:col-span-5" pair={pair} p={p} />
      </div>

      {/* 선택 지표 */}
      {narrow ? (
        <MetricStrip label="선택 지표(가로 스크롤)">{tiles}</MetricStrip>
      ) : (
        <KpiRow hero ariaLabel="선택 지표">
          {tiles}
        </KpiRow>
      )}

      {/* E. 산점도 */}
      <Card
        title={`쌍 산점도 · ${xs.label}–${ys.label}`}
        subtitle={`${fmtInt(N)}계통 · 검은 선 = 최소제곱(OLS) 회귀선 · 점을 가리키거나 누르면 계통명`}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-text">교차 검증 GEBV 대 GEBV</p>
            <p className="mb-1 text-xs text-muted">
              r = {f2(q.rgebv)} (GEBV 간 상관, rG와 다른 양)
            </p>
            <PairScatter kind="gebv" a={q.a} b={q.b} r={q.rgebv} height={300} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-text">계통 평균 표현형 대 표현형</p>
            <p className="mb-1 text-xs text-muted">r = {f2(q.rp)} (= 행렬 rP)</p>
            <PairScatter kind="pheno" a={q.a} b={q.b} r={q.rp} height={300} />
            {blastInPair && (
              <p className="mt-1 text-xs text-muted">
                발병 지수 0~9 척도 경계값 {fmtInt(BLAST_EDGE.total)}계통(0점 {fmtInt(BLAST_EDGE.lo)} · 9점 {fmtInt(BLAST_EDGE.hi)})이 축 끝에 쌓여 있습니다.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* F + G */}
      <ResponsePanel
        order={order}
        criterion={criterion}
        onCriterion={setCriterion}
        p={p}
        onP={setP}
        cur={cur}
        base={base}
        visible={visible}
      />

      <footer className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted">
        <p>
          유전 상관(rG, genetic correlation)은 형질 쌍별 2변량 제한 최대 우도(REML) 추정값(유전체 관계 행렬 GRM 기반 GBLUP), 표현형 상관(rP)은 계통 평균의 Pearson 상관, 환경(잔차)
          상관(rE)은 rP = hx·hy·rG + ex·ey·rE를 풀어 얻은 값입니다. 분해의 3자리 값은 각각 반올림해 합이 0.001 다를 수 있습니다.
        </p>
        <p>
          상관 반응은 이론 기대값으로, GEBV 기반 선발 화면의 실제 선발 결과(후보 600계통, 절단 분포·앵커 포함)와 기준이 다릅니다. 수장·이삭수의 유전력·정확도와 일부 σA는 추정 가정값입니다.
        </p>
        <p>계통명은 모두 가상이며 실존 계통·품종과 관계없습니다.</p>
      </footer>
    </div>
  )
}
