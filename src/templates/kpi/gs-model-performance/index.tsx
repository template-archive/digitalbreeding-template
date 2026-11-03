import { useEffect, useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import type { TemplateMeta } from '@/gallery/types'
import {
  Badge,
  Button,
  Card,
  ChartCard,
  ConclusionBundle,
  ConclusionPanel,
  DataTable,
  EmptyState,
  ErrorState,
  KpiRow,
  KpiTile,
  PageGrid,
  PageHeader,
  Segmented,
  Select,
  Skeleton,
  useMediaQuery,
  type DataTableColumn,
} from '@/design-system'
import { formatDelta, formatFixed, formatNumber, formatSigned } from '@/lib/format'
import {
  ALT_MODELS,
  AS_OF,
  BENCH_DATE,
  CELLS,
  CROP,
  CUR_YEAR,
  CV_REPS,
  FIT_MIN,
  FOLDS,
  FORWARD_MEAN_RATIO,
  FORWARD_NEXT,
  KPI,
  MARKERS,
  MODELS,
  MODEL_NOTE,
  N_PLAN_2027,
  N_STAR_ADD,
  N_STAR_ROUND,
  N_TRAIN,
  ME,
  OPERATING_MODEL,
  PLAN_YEAR,
  PRACTICAL_DELTA,
  PROGRAM,
  R,
  RECOMMENDED_MEAN,
  REC_BY_TRAIT,
  REGRESSION,
  REPEATS,
  RETRAIN_LABEL,
  RETRAIN_NEXT,
  R_PLAN_2027,
  R_TARGET,
  SEED,
  SWITCHES,
  TRAITS,
  TRAIT_BY_KEY,
  YEARS,
  fmt3,
  modelMean,
  severity,
  type ModelKey,
  type TraitKey,
} from './data'
import { AccuracyChart, type Metric } from './components/AccuracyChart'
import { DeltaCiChart } from './components/DeltaCiChart'
import { PanelSeverity, PanelTrend } from './components/PanelTrend'
import { ModelLegend, modelColorVar } from './components/ModelLegend'
import { RecommendationList } from './components/RecommendationList'
import { LearningCurveChart } from './components/LearningCurveChart'
import { TrendChart } from './components/TrendChart'
import { HeritabilityChart, regressionLabel } from './components/HeritabilityChart'

export const meta: TemplateMeta = {
  slug: 'gs-model-performance',
  category: 'kpi',
  title: '유전체 선발 모델 성능',
  description: '운영 GS 모델의 예측 정확도가 목표에 닿았는지, 훈련 집단을 얼마나 늘려야 하는지, 다음 재학습에서 형질별로 어떤 모델을 쓸지 교차 검증 벤치마크로 판단합니다.',
  tags: ['유전체 선발', 'GS', '예측 정확도', 'GBLUP', 'BayesB', '학습 곡선', '교차 검증', '벼'],
  organism: '벼',
  status: 'review',
  updatedAt: '2026-11-02',
}

const n2 = (v: number) => formatFixed(v, 2)
const nN = (v: number) => formatNumber(v, { digits: 0 })
const CV_LABEL = `${FOLDS}-fold × ${REPEATS}회`
/** 결론 묶음 안 KPI 줄: 1440 2×2 · 768 4칸 · 390 2열(ConclusionBundle 기본 격자는 390에서 1열이라 KpiRow로 감싼다) */
const TILE_COLS = { md: 4, lg: 2 }

function readPreviewState(): 'loading' | 'empty' | 'error' | null {
  if (typeof location === 'undefined') return null
  const s = new URLSearchParams(location.search).get('state')
  return s === 'loading' || s === 'empty' || s === 'error' ? s : null
}

const traitOptions = TRAITS.map(t => ({ value: t.key, label: t.name }))
const metricOptions: { value: Metric; label: string }[] = [
  { value: 'accuracy', label: '예측 정확도 r' },
  { value: 'ability', label: '예측 능력 r·√h²' },
]

interface DetailRow {
  key: TraitKey
  name: string
  h2: number
  sqrtH2: number
  rec: ModelKey
}
const DETAIL_ROWS: DetailRow[] = TRAITS.map(t => ({ key: t.key, name: t.name, h2: t.h2, sqrtH2: Math.sqrt(t.h2), rec: REC_BY_TRAIT[t.key].rec }))

const D_NAME: DataTableColumn<DetailRow> = { key: 'name', header: '형질', format: v => <span className="font-semibold">{String(v)}</span> }
const D_H2: DataTableColumn<DetailRow> = { key: 'h2', header: 'h²', numeric: true, format: v => n2(v as number), sortDescFirst: true }
const D_SQRT_H2: DataTableColumn<DetailRow> = { key: 'sqrtH2', header: '√h²', numeric: true, hideBelow: 'sm', format: v => n2(v as number), sortable: false }
const D_MODELS: DataTableColumn<DetailRow>[] = MODELS.map(
  (m): DataTableColumn<DetailRow> => ({
    key: m,
    header: m,
    numeric: true,
    sortValue: r => CELLS[r.key][m].mean,
    sortDescFirst: true,
    headerTitle: `${m}: ${MODEL_NOTE[m]}. 평균 r ± 반복 SD`,
    format: (_v, r) => {
      const c = CELLS[r.key][m]
      const best = r.rec === m
      return (
        <span className={['inline-flex flex-col items-end leading-tight tabular-nums', best ? 'font-bold text-text' : 'text-text'].join(' ')}>
          <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
            {best && (
              <>
                <Star size={11} aria-hidden="true" className="fill-current" />
                <span className="sr-only">권장 </span>
              </>
            )}
            {n2(c.mean)}
          </span>
          <span className="whitespace-nowrap text-[11px] font-normal text-muted">± {fmt3(c.sd)}</span>
        </span>
      )
    },
  }),
)
const D_REC: DataTableColumn<DetailRow> = {
  key: 'rec',
  header: '권장',
  format: v => (v === OPERATING_MODEL ? <Badge tone="neutral">유지</Badge> : <Badge tone="info">{String(v)}</Badge>),
}
const DETAIL_COLUMNS: DataTableColumn<DetailRow>[] = [D_NAME, D_H2, D_SQRT_H2, ...D_MODELS, D_REC]
// 390px: 결론 열(권장)을 형질 바로 뒤로, √h²는 숨김(hideBelow)
const DETAIL_COLUMNS_NARROW: DataTableColumn<DetailRow>[] = [D_NAME, D_REC, ...D_MODELS, D_H2]

export default function GsModelPerformanceTemplate() {
  const preview = useMemo(readPreviewState, [])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(preview === 'error')
  const [trait, setTrait] = useState<TraitKey>('yield')
  const [metric, setMetric] = useState<Metric>('accuracy')
  const [visible, setVisible] = useState<ModelKey[]>([...MODELS])
  // 학습 곡선은 네 모델이 거의 겹쳐 기본은 운영 모델만, 나머지는 토글로
  const [curveModels, setCurveModels] = useState<ModelKey[]>([OPERATING_MODEL])
  const narrow = useMediaQuery('(max-width: 639px)')

  useEffect(() => {
    if (preview === 'loading') return
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [preview])

  const toggled = (v: ModelKey[], m: ModelKey) => (v.includes(m) ? (v.length > 1 ? v.filter(x => x !== m) : v) : MODELS.filter(x => x === m || v.includes(x)))

  const sel = TRAIT_BY_KEY[trait]
  const isYield = trait === 'yield'

  // 머리(공통 PageHeader: 범위·소속 회색 한 줄 → 제목 + 오른쪽 기준일·필터 → 데이터 한 문장)
  const header = (
    <PageHeader
      context={[`${CROP} · 유전체 선발(GS)`, PROGRAM]}
      title={meta.title}
      scope={`운영 모델 ${OPERATING_MODEL}(${RETRAIN_LABEL[CUR_YEAR]} 재학습) · ${CUR_YEAR} 벤치마크: 훈련 집단 ${nN(N_TRAIN)}계통 · ${nN(MARKERS)} SNP · ${CV_LABEL} 교차 검증(분할 ${CV_REPS}개)으로 ${MODELS.length}개 모델을 같은 분할에서 비교`}
      asOf={`${AS_OF} · 벤치마크 실행 ${BENCH_DATE}(추정)`}
      details={`예측 정확도 r = corr(GEBV, y) / √h², ${CV_LABEL} 교차 검증 분할 ${CV_REPS}개 평균. 쌀 수량 ${OPERATING_MODEL} 신뢰도 r² = ${n2(CELLS.yield.GBLUP.reliability)}.`}
      actions={<Select label="형질" options={traitOptions} value={trait} onChange={v => setTrait(v as TraitKey)} />}
    />
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <span className="sr-only">벤치마크 결과를 불러오는 중입니다</span>
        <ConclusionBundle panel={<Skeleton height={300} />}>
          <KpiRow loading count={4} cols={TILE_COLS} skeletonHeight={144} className="col-span-full" />
        </ConclusionBundle>
        <PageGrid>
          <Skeleton className="col-span-12 lg:col-span-8" height={440} />
          <Skeleton className="col-span-12 lg:col-span-4" height={440} />
          <Skeleton className="col-span-12 md:col-span-6 lg:col-span-4" height={380} />
          <Skeleton className="col-span-12 md:col-span-6 lg:col-span-4" height={380} />
          <Skeleton className="col-span-12 lg:col-span-4" height={380} />
        </PageGrid>
      </div>
    )
  }

  if (preview === 'empty') {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState title="표시할 벤치마크 결과가 없습니다" description="이 프로그램에 등록된 GS 교차 검증 실행이 없습니다. 유전체 분석실에서 벤치마크를 먼저 실행하세요." />
      </div>
    )
  }

  if (failed) {
    const retry = (
      <Button size="sm" onClick={() => setFailed(false)}>
        다시 시도
      </Button>
    )
    const err = (title: string, cls: string) => (
      <Card key={title} className={cls} title={title}>
        <ErrorState title="벤치마크 결과를 불러오지 못했습니다" description="GS 분석 서버 응답이 없습니다. 잠시 후 다시 시도하세요." action={retry} />
      </Card>
    )
    return (
      <div className="flex flex-col gap-4">
        {header}
        <PageGrid>
          {err('KPI', 'col-span-12')}
          {err('GBLUP 대비 예측 정확도 차이(Δr)', 'col-span-12 lg:col-span-8')}
          {err('모델 선택 근거', 'col-span-12 lg:col-span-4')}
          {err('훈련 집단 크기별 학습 곡선', 'col-span-12 md:col-span-6 lg:col-span-4')}
          {err('쌀 수량 정확도 연도별 추이', 'col-span-12 md:col-span-6 lg:col-span-4')}
          {err('형질별 유전력과 정확도', 'col-span-12 lg:col-span-4')}
          {err('형질 × 모델 예측 정확도', 'col-span-12')}
        </PageGrid>
      </div>
    )
  }

  const yRes = REGRESSION.points.find(p => p.trait === 'yield')!
  const switchNames = SWITCHES.map(s => TRAIT_BY_KEY[s.trait].name)
  const switchModels = [...new Set(SWITCHES.map(s => s.rec))].join('·')
  const aHeight = narrow ? 560 : 500
  const deltaHeight = narrow ? 440 : 500
  const fitHours = (m: ModelKey) => (FIT_MIN[m] * CV_REPS) / 60

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* 결론 묶음: 쌀 수량 r 판단 + 연도별 추세, 받치는 지표 4개 */}
      <ConclusionBundle
        panel={
          <ConclusionPanel
            label={
              <>
                {CUR_YEAR} · {OPERATING_MODEL} {RETRAIN_LABEL[CUR_YEAR]} 재학습 · 전년 대비 {formatDelta(KPI.rDelta, { digits: 2, unit: '' })} <PanelSeverity severity={severity(KPI.achievement)} />
              </>
            }
            valueLabel={`쌀 수량 예측 정확도 r · ${CV_LABEL}`}
            value={n2(KPI.r)}
            statement={
              <>
                목표 {n2(KPI.rTarget)}의 <b>{formatFixed(KPI.achievement, 1)}%</b>입니다. 학습 곡선상 훈련 집단 약 {nN(N_STAR_ROUND)}계통(+{nN(N_STAR_ADD)})에서 목표에 닿고, {PLAN_YEAR} 계획 {nN(N_PLAN_2027)}계통이면 예상 r {n2(R_PLAN_2027)}입니다. 다음 재학습({RETRAIN_NEXT})에서 {switchNames.join('·')} {SWITCHES.length}개 형질을 {switchModels}로 교체 권장합니다.
              </>
            }
            aside={
              <PanelTrend
                kind="line"
                title="쌀 수량 r 연도별 · 점선 목표"
                points={YEARS.map(y => ({ label: String(y), value: R[y] }))}
                refs={[{ value: R_TARGET, label: `목표 ${n2(R_TARGET)}` }]}
                format={n2}
                ariaLabel={`쌀 수량 ${OPERATING_MODEL} 예측 정확도: ${YEARS[0]}년 ${n2(R[YEARS[0]])}에서 ${CUR_YEAR}년 ${n2(KPI.r)}로 상승, 목표 ${n2(R_TARGET)}.`}
              />
            }
          />
        }
      >
        <KpiRow cols={TILE_COLS} className="col-span-full">
          <KpiTile
            size="compact"
            label="훈련 집단"
            value={nN(KPI.trainN)}
            unit="계통"
            sub={<span className="break-keep">{`목표 r ${n2(R_TARGET)} 도달 약 ${nN(N_STAR_ROUND)}계통(+${nN(N_STAR_ADD)}, 학습 곡선 추정)`}</span>}
            period={String(CUR_YEAR)}
            delta={KPI.trainDelta}
            deltaDigits={0}
            deltaUnit="계통"
            deltaLabel="전년 대비"
            info="표현형·유전형을 모두 가진 계통 수."
          />
          <KpiTile
            size="compact"
            label={`${TRAITS.length}개 형질 평균 정확도`}
            value={n2(KPI.traitMean)}
            sub={<span className="break-keep">{`${OPERATING_MODEL} · 범위 ${n2(KPI.traitMin.r)}(${KPI.traitMin.trait.short})~${n2(KPI.traitMax.r)}(${KPI.traitMax.trait.short})`}</span>}
            period={String(CUR_YEAR)}
            info={`권장 조합 적용 시 평균 ${n2(RECOMMENDED_MEAN)}.`}
          />
          <KpiTile
            size="compact"
            label="모델 교체 권장"
            value={`${KPI.switchCount} / ${TRAITS.length}`}
            unit="형질"
            sub={<span className="break-keep">{`${switchNames.join('·')} → ${switchModels} · ${RETRAIN_NEXT} 재학습 적용`}</span>}
            period={`${RETRAIN_NEXT} 재학습`}
            badge={<Badge tone="info">{`${switchModels} ${SWITCHES.length}`}</Badge>}
            info="운영 모델은 현재 모든 형질 GBLUP입니다. 판정은 다음 재학습 권장일 뿐 현재 운영 값을 바꾸지 않습니다."
          />
          <KpiTile
            size="compact"
            label="전진 검증 정확도"
            value={n2(KPI.forward)}
            sub={<span className="break-keep">{`같은 해 CV ${n2(KPI.forwardCv)} 대비 ${formatSigned(KPI.forwardGap, 2)}(비 ${n2(KPI.forwardRatio)})`}</span>}
            period={String(KPI.forwardYear)}
            info={`그해 2월 재학습 모델로 그해 처음 표현형을 조사한 신규 계통(PYT)을 예측한 정확도. 같은 가계가 훈련·검증에 섞이는 무작위 k-fold보다 낮은 것이 정상입니다. ${CUR_YEAR}년 값은 ${FORWARD_NEXT} 산출 예정.`}
          />
        </KpiRow>
      </ConclusionBundle>

      <PageGrid>
        {/* 주 차트: 어느 모델이 나은가 */}
        <ChartCard
          className="col-span-12 lg:col-span-8"
          title={`${OPERATING_MODEL} 대비 예측 정확도 차이(Δr)`}
          subtitle={`${CUR_YEAR} 벤치마크 · 같은 분할 쌍체 차이(모델 − ${OPERATING_MODEL}) · 가로줄 = 95% CI`}
          legend={[
            ...ALT_MODELS.map(m => ({ label: m, color: modelColorVar(m), shape: 'circle' as const })),
            { label: '채운 점 = 교체 기준 충족', color: 'var(--color-text-muted)', shape: 'circle' },
            { label: '빈 점 = 기준 미달', color: 'var(--color-text-muted)', shape: 'ring' },
          ]}
          source={`교체 기준 = Δr ${formatSigned(PRACTICAL_DELTA, 2)} 이상 그리고 95% CI 하한 > 0 · 회색 띠 = 선택 형질(${sel.name}) · 절대 r은 아래 막대·상세 표`}
          height={deltaHeight}
        >
          <DeltaCiChart selected={trait} narrow={narrow} height={deltaHeight} />
        </ChartCard>

        {/* B */}
        <Card
          className="col-span-12 lg:col-span-4"
          title="다음 재학습 모델 판정"
          subtitle={`${RETRAIN_NEXT} 적용 권장 · 쌍체 차이(모델 − ${OPERATING_MODEL}) Δr과 95% CI`}
        >
          <RecommendationList selected={trait} onSelect={setTrait} />
        </Card>

        {/* C */}
        <ChartCard
          className="col-span-12 md:col-span-6 lg:col-span-4"
          title={`훈련 집단 크기별 학습 곡선 · ${sel.name}`}
          subtitle={`${CUR_YEAR} 훈련 집단 부분 표본 교차 검증, ${nN(N_TRAIN)} 초과는 학습 곡선 외삽(추정)`}
          actions={<ModelLegend ariaLabel="학습 곡선에 표시할 모델" visible={curveModels} onToggle={m => setCurveModels(v => toggled(v, m))} />}
          legend={[
            ...(curveModels.includes('GBLUP')
              ? [
                  { label: 'GBLUP 외삽', color: modelColorVar('GBLUP'), shape: 'dashed' as const },
                  { label: 'GBLUP ±SD', color: 'color-mix(in srgb, var(--viz-cat-1) 25%, transparent)' },
                ]
              : []),
            ...(isYield
              ? [
                  { label: `목표 r ${n2(R_TARGET)}`, color: 'var(--color-warning)', shape: 'dashed' as const },
                  { label: '연도별 운영 모델', color: 'var(--color-text)', shape: 'diamond-open' as const },
                ]
              : []),
          ]}
          source={`r(N) = a · √(N·h² / (N·h² + Me)), Me = ${ME} · 연도별 쌀 수량 정확도에 맞춘 경험적 적합(Daetwyler 등 2008 식 변형)`}
          height={340}
        >
          <LearningCurveChart trait={sel} visible={curveModels} height={340} compact={narrow} />
        </ChartCard>

        {/* D */}
        <ChartCard
          className="col-span-12 md:col-span-6 lg:col-span-4"
          title="쌀 수량 정확도 연도별 추이"
          subtitle={`${OPERATING_MODEL} · 매년 2월 재학습${narrow ? '' : ' · 연도 아래 N = 훈련 집단(계통)'}`}
          legend={[
            { label: 'CV 정확도', color: 'var(--viz-cat-1)', shape: 'line' },
            { label: '목표 r', color: 'var(--color-warning)', shape: 'dashed' },
            { label: '전진 검증(신규 계통)', color: 'var(--viz-cat-2)', shape: 'dashed' },
            { label: `${CUR_YEAR} 전진 검증: ${FORWARD_NEXT} 산출 예정`, color: 'transparent' },
          ]}
          source={`전진 검증은 같은 해 CV의 평균 ${n2(FORWARD_MEAN_RATIO)}배 · 무작위 k-fold는 같은 가계가 훈련·검증에 함께 들어가 낙관적`}
          height={340}
        >
          <TrendChart height={340} compact={narrow} />
        </ChartCard>

        {/* E */}
        <ChartCard
          className="col-span-12 lg:col-span-4"
          title="형질별 유전력과 정확도"
          subtitle={`${OPERATING_MODEL} · ${TRAITS.length}개 형질 · 회귀 ${regressionLabel()}, R² = ${n2(REGRESSION.r2)}`}
          source={`형질 간 정확도 차이의 ${formatFixed(REGRESSION.r2 * 100, 0)}%는 h²로 설명된다. 쌀 수량은 회귀선보다 ${formatSigned(yRes.resid, 2)} 높다(다환경 표현형이 가장 많은 형질, 추정).`}
          height={340}
        >
          <HeritabilityChart selected={trait} height={340} />
        </ChartCard>

        {/* A */}
        <ChartCard
          className="col-span-12 lg:col-span-6"
          title="형질 × 모델 예측 정확도"
          subtitle={`${CUR_YEAR} 벤치마크 · 훈련 집단 ${nN(N_TRAIN)}계통 · ${CV_LABEL} · 오차 막대 = 반복 SD · ‘권장’ = 다음 재학습 권장 모델`}
          actions={
            <>
              <Segmented size="sm" ariaLabel="형질 × 모델 차트 지표" options={metricOptions} value={metric} onChange={setMetric} />
              <ModelLegend ariaLabel="형질 × 모델 차트에 표시할 모델" visible={visible} onToggle={m => setVisible(v => toggled(v, m))} />
            </>
          }
          source={
            metric === 'accuracy'
              ? `예측 정확도 r = corr(GEBV, y) / √h² · 회색 띠 = 선택 형질(${sel.name}) · 막대 숫자는 툴팁과 상세 표`
              : `예측 능력 = r × √h²(형질별 h² 상한 √h² 이하) · 쌀 수량 GBLUP ${n2(CELLS.yield.GBLUP.predAbility)} = ${n2(KPI.r)} × ${n2(Math.sqrt(TRAIT_BY_KEY.yield.h2))}`
          }
          height={aHeight}
        >
          <AccuracyChart metric={metric} visible={visible} selected={trait} horizontal={narrow} height={aHeight} />
        </ChartCard>

        {/* 상세 표 */}
        <Card
          className="col-span-12 lg:col-span-6"
          title="형질 × 모델 상세"
          subtitle={`평균 r ± SD(분할 ${CV_REPS}개) · 별 아이콘·굵은 값 = 권장 · h²는 훈련 집단 계통평균(${CUR_YEAR} REML)`}
        >
          <DataTable
            columns={narrow ? DETAIL_COLUMNS_NARROW : DETAIL_COLUMNS}
            rows={DETAIL_ROWS}
            rowKey="key"
            dense
            scrollHint="옆으로 밀어 나머지 모델·h² 열 보기 →"
            activeRow={r => r.key === trait}
            onRowClick={r => setTrait(r.key)}
            stickyColumn={{ key: 'name', below: 'md' }}
            caption="형질별 모델 예측 정확도와 권장 모델"
          />
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs tabular-nums sm:grid-cols-4">
            {MODELS.map(m => (
              <div key={m} className="flex flex-col">
                <dt className="flex items-center gap-1.5 text-muted">
                  <span aria-hidden="true" className="inline-block size-2 rounded-[2px]" style={{ background: modelColorVar(m) }} />
                  {m}
                </dt>
                <dd className="text-text">
                  평균 {n2(modelMean(m))} · CV {fitHours(m) >= 1 ? `${formatFixed(fitHours(m), 1)}시간` : `${nN(FIT_MIN[m] * CV_REPS)}분`}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-muted">
            CV 시간 = 1회 적합 시간 × {CV_REPS}회({nN(N_TRAIN)}계통 × {nN(MARKERS)} SNP, 형질 1개, 추정). 권장 조합 {TRAITS.length}형질 평균 {n2(RECOMMENDED_MEAN)}.
          </p>
        </Card>
      </PageGrid>

      <p className="text-xs text-muted">
        목업 데이터(시드 {SEED}) · 모든 수치는 가상이며 실존 프로그램과 관계없습니다 · 연도별 정확도·목표·훈련 집단은 육종 프로그램 KPI 개요와 같은 값입니다.
      </p>
    </div>
  )
}
