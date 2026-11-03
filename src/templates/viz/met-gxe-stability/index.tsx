import { useState } from 'react'
import type { TemplateMeta } from '@/gallery/types'
import {
  Badge,
  Button,
  ChartCard,
  EmptyState,
  ErrorState,
  KpiRow,
  KpiTile,
  Legend,
  PageGrid,
  PageHeader,
  Segmented,
  Skeleton,
  SummaryCallout,
  Switch,
  useMediaQuery,
} from '@/design-system'
import { useChartTheme } from '@/charts'
import { formatFixed, formatSigned } from '@/lib/format'
import {
  ANALYSIS,
  ASV_MEAN,
  CHECK,
  CV,
  DEFAULT_SELECTED,
  ENV_INDEX_RANGE,
  GENO_BY_ID,
  GE_OVER_G,
  GGE_PC_SUM,
  GRAND_MEAN,
  INDEX_RULE,
  HULL_IDS,
  IPCA_PCT,
  LSD,
  MEGA_ENVS,
  MEGA_EVIDENCE,
  MS_GE,
  DF_GE,
  N_CHECK,
  N_E,
  N_G,
  N_S,
  N_TEST,
  N_Y,
  PASSED,
  REPS,
  SITES,
  SITE_TOP_IDS,
  SITE_WINNER_IDS,
  T975,
  UNSTABLE_REF,
  VAR_PCT,
  W_RULE,
  YEARS,
} from './data'
import { GgeBiplot, ggeAxisTitle } from './components/GgeBiplot'
import { StabilityScatter, STAB_AXIS, type StabilityMetric } from './components/StabilityScatter'
import { ReactionNorm, reactionLegendIds } from './components/ReactionNorm'
import { VarianceDecomp } from './components/VarianceDecomp'
import { RankTable } from './components/RankTable'
import { DetailPanel } from './components/DetailPanel'
import { RuleBox } from './components/RuleBox'
import { megaColor } from './components/colors'
import { MetricStrip } from './components/MetricStrip'

export const meta: TemplateMeta = {
  slug: 'met-gxe-stability',
  category: 'viz',
  title: '다환경 시험 GxE·안정성',
  description: '지역 적응 시험(MET) 2년 결과로 GxE 크기, GGE 메가 환경, 평균–안정성을 보고 출원 후보 계통을 고른 근거를 정리한다.',
  tags: ['MET', 'GxE', 'GGE 바이플롯', '안정성', '지역 적응 시험', '벼'],
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

const f1 = (v: number) => formatFixed(v, 1)
const f2 = (v: number) => formatFixed(v, 2)

/** 머리 둘째 줄(데이터 범위 한 문장). 분석일은 제목 줄 오른쪽 스탬프 */
const SCOPE_LINE = `${YEARS[0]}~${YEARS[N_Y - 1]} · ${N_G} 유전자형(시험 ${N_TEST} + 대비 ${N_CHECK}) · ${N_S}개 지역 × ${N_Y}년 · ${ANALYSIS.design} ${REPS}반복 · ${ANALYSIS.trait}(${ANALYSIS.unit}, ${ANALYSIS.basis}) · CV ${f1(CV)}%`

/** 2차원 근사 승자와 실측 1위가 다른 지역: "당진·예산 실측 1위 YR20-0815, 청주 YR20-0527" */
const MISMATCH_TEXT = (() => {
  const byTop = new Map<string, string[]>()
  SITES.forEach((s, j) => {
    if (SITE_TOP_IDS[j] === SITE_WINNER_IDS[j]) return
    byTop.set(SITE_TOP_IDS[j]!, [...(byTop.get(SITE_TOP_IDS[j]!) ?? []), s.short])
  })
  return [...byTop.entries()].map(([id, sites], k) => `${sites.join('·')}${k === 0 ? ' 실측 1위' : ''} ${id}`).join(', ')
})()

const MEGA_TEXT = MEGA_ENVS.map(m => `${m.label}${m.sites.length > 1 ? ` ${m.sites.length}개 지역` : ''} → ${m.winnerId}`).join(', ')
const PASS_DIFFS = PASSED.map(g => g.diffVsCheck)
/** 후보 전부가 LSD를 넘는지(KPI 배지·각주 문장) */
const OVER_LSD = PASSED.filter(g => g.overLsd)
const ALL_OVER_LSD = PASSED.every(g => g.overLsd)

/** 메가 환경 근거: "중부 평야지 10개 중 YR19-0118 4회 · … · 중북부지(철원) 2개 중 YR20-0527 2회(2025·2026 모두)" */
const MEGA_EVIDENCE_TEXT = MEGA_EVIDENCE.map(
  ({ mega: m, n, k }) => `${m.label} ${n}개 중 ${m.winnerId} ${k}회${k === n ? `(${YEARS.join('·')} 모두)` : ''}`,
).join(' · ')

/** 비선발 사유를 규칙에서 생성: "W 11.7% > 5.0%이고 메가 환경 승자도 아니라" */
function excludeReason(g: (typeof PASSED)[number]): string {
  if (g.index < INDEX_RULE) return `지수 ${f1(g.index)}% < ${f1(INDEX_RULE)}%라`
  const parts: string[] = []
  if (g.wPct > W_RULE) parts.push(`W ${f1(g.wPct)}% > ${f1(W_RULE)}%`)
  if (!g.mega) parts.push('메가 환경 승자도 아니라')
  return parts.length === 2 ? `${parts[0]}이고 ${parts[1]}` : (parts[0] ?? '규칙을 통과하지 못해')
}

const CAND_RANGE = `${formatSigned(Math.min(...PASS_DIFFS), 1)}~${formatSigned(Math.max(...PASS_DIFFS), 1)}`

export default function Template() {
  const [devState, setDevState] = useState<DevState>(readDevState)
  const [selectedId, setSelectedId] = useState(DEFAULT_SELECTED)
  const [metric, setMetric] = useState<StabilityMetric>('w')
  const [showSectors, setShowSectors] = useState(true)
  const [showAllLabels, setShowAllLabels] = useState(false)
  const narrow = useMediaQuery('(max-width: 639px)')
  const theme = useChartTheme()

  const biplotH = narrow ? 360 : 470
  const subH = narrow ? 300 : 360

  // 머리(공통 PageHeader: 범위 회색 한 줄 → 제목 + 분석일 스탬프 → 데이터 범위 한 문장)
  const header = (
    <PageHeader
      context={[ANALYSIS.crop, ANALYSIS.title, `${YEARS[N_Y - 1]} ${N_Y}년차`]}
      title={meta.title}
      scope={SCOPE_LINE}
      asOfLabel="분석일"
      asOf={ANALYSIS.analyzedAt}
      details={
        narrow
          ? `GxE 비율 = 결합 분산분석의 SS_G + SS_E + SS_GE 대비 GxE. GxE가 유전자형 효과보다 크면 한 계통을 모든 지역에 추천하기 어렵다. 대비 품종 가람솔 연도별 평균: ${YEARS[0]} ${f1(CHECK.yearMeans[0]!)} · ${YEARS[1]} ${f1(CHECK.yearMeans[1]!)} kg/10a.`
          : undefined
      }
      detailsLabel="지표 계산 방법"
    />
  )

  if (devState === 'error') {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState
          title="MET 분석 결과를 읽지 못했습니다. 다시 시도하세요"
          description="결합 분산분석·GGE·안정성 결과 파일을 불러오는 중 오류가 났습니다."
          action={
            <Button variant="primary" onClick={() => setDevState('ready')}>
              다시 시도
            </Button>
          }
        />
      </div>
    )
  }
  if (devState === 'loading') {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <Skeleton height={narrow ? 92 : 72} className="rounded-md" />
        <PageGrid>
          <Skeleton height={biplotH + 110} className="col-span-12 rounded-lg xl:col-span-7" />
          <Skeleton height={biplotH + 110} className="col-span-12 rounded-lg xl:col-span-5" />
          <div className="col-span-12">
            <KpiRow loading hero count={4} skeletonHeight={128} />
          </div>
          <Skeleton height={subH + 110} className="col-span-12 rounded-lg lg:col-span-6" />
          <Skeleton height={subH + 110} className="col-span-12 rounded-lg lg:col-span-6" />
        </PageGrid>
      </div>
    )
  }
  if (devState === 'empty') {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState title="분석 결과가 없습니다" description="이 시험의 수확 자료가 아직 올라오지 않았습니다. 지역별 수량 조사를 마친 뒤 결합 분석을 실행하세요." />
      </div>
    )
  }

  const sel = GENO_BY_ID[selectedId]!
  const unstable = GENO_BY_ID[UNSTABLE_REF]!
  const top = PASSED[0]!
  const biplotAria = `GGE 바이플롯 ${ggeAxisTitle(0)} × ${ggeAxisTitle(1)}, 합 ${f1(GGE_PC_SUM)}%. which-won-where 다각형 꼭짓점 ${HULL_IDS.length}개(${HULL_IDS.join(', ')}), 메가 환경 ${MEGA_ENVS.length}개: ${MEGA_TEXT}.`
  const stabAria =
    metric === 'w'
      ? `평균–안정성 산점도. 기준선 전체 평균 ${f1(GRAND_MEAN)} kg/10a, W ${f1(W_RULE)}%. ${top.id}(${f1(top.mean)}, W ${f1(top.wPct)}%)는 고수량·안정 사분면, ${unstable.id}(${f1(unstable.mean)}, W ${f1(unstable.wPct)}%)는 고수량·불안정 사분면에 있다.`
      : `평균–안정성 산점도(ASV). 기준선 전체 평균 ${f1(GRAND_MEAN)} kg/10a, ASV 평균 ${f2(ASV_MEAN)}. ${top.id} ASV ${f2(top.asv)}로 가장 안정, ${unstable.id} ASV ${f2(unstable.asv)}.`
  const legendIds = reactionLegendIds(selectedId)
  const reactionAria = `반응 규준(Finlay–Wilkinson). ${N_E}개 환경, 환경 지수 ${formatSigned(ENV_INDEX_RANGE[0], 1)}~${formatSigned(ENV_INDEX_RANGE[1], 1)} kg/10a. 반응 기울기 b: ${legendIds
    .map(id => `${GENO_BY_ID[id]!.name ?? id} ${f2(GENO_BY_ID[id]!.b)}`)
    .join(', ')}. b가 1보다 크면 좋은 환경에서 더 많이 늘고 나쁜 환경에서 더 많이 준다.`

  // 선택 지표: 넓은 화면 KpiRow(대표 = GxE 비율), 390px 가로 띠. 띠 안에서는 ⓘ가 잘리므로 뜻은 머리 「자세히」로
  const tiles = [
    <KpiTile
      key="gxe"
      label="유전자형×환경 상호작용(GxE)"
      plainLabel="유전자형×환경 상호작용(GxE) 비율"
      value={f1(VAR_PCT.GE)}
      unit="%"
      size="hero"
      sub={`G ${f1(VAR_PCT.G)} · E ${f1(VAR_PCT.E)} · GxE/G ${f1(GE_OVER_G)}배 · CV ${f1(CV)}%`}
      badge={<Badge tone="warning">지역별 추천 필요</Badge>}
      info={narrow ? undefined : '결합 분산분석의 SS_G + SS_E + SS_GE 대비 GxE 비율. GxE가 유전자형 효과보다 크면 한 계통을 모든 지역에 추천하기 어렵다.'}
    />,
    <KpiTile
      key="mean"
      label="전체 평균 쌀 수량"
      value={f1(GRAND_MEAN)}
      unit="kg/10a"
      sub={`대비 가람솔 ${f1(CHECK.mean)}`}
      info={narrow ? undefined : `${N_G} 유전자형 × ${N_E}개 환경 전체 평균. 대비 품종 가람솔의 연도별 평균: ${YEARS[0]} ${f1(CHECK.yearMeans[0]!)} · ${YEARS[1]} ${f1(CHECK.yearMeans[1]!)} kg/10a.`}
    />,
    <KpiTile key="mega" label="메가 환경" value={MEGA_ENVS.length} unit="개" sub={`GGE PC1+PC2 ${f1(GGE_PC_SUM)}% · ${MEGA_ENVS.map(m => m.sites.length).join('·')}개 지역`} />,
    <KpiTile
      key="passed"
      label="출원 후보"
      value={PASSED.length}
      unit="계통"
      sub={`가람솔 대비 ${CAND_RANGE} kg/10a · LSD ${f1(LSD)}`}
      badge={
        ALL_OVER_LSD ? (
          <Badge tone="positive">모두 LSD 초과</Badge>
        ) : (
          <Badge tone="warning">
            {OVER_LSD.length}/{PASSED.length} LSD 초과
          </Badge>
        )
      }
    />,
  ]

  // 조작: 넓은 화면은 바이플롯 아래, 390px은 바로 위
  const biplotControls = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <Switch checked={showSectors} onChange={setShowSectors} label="수선·구역" />
      <Switch checked={showAllLabels} onChange={setShowAllLabels} label="모든 라벨" />
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* 결론 띠: 머리 바로 아래 한 곳 */}
      <SummaryCallout>
        수량 변동의 <b>{f1(VAR_PCT.E)}%</b>가 환경, <b>{f1(VAR_PCT.GE)}%</b>가 GxE(유전자형의 {f1(GE_OVER_G)}배)라 지역별 추천이 필요합니다. GGE 바이플롯은 메가 환경{' '}
        {MEGA_ENVS.length}개({MEGA_TEXT})를 가르고, 각 구역의 승자 {PASSED.length}계통이 출원 후보 규칙을 통과했습니다. {unstable.id}는 평균 {unstable.rank}위지만{' '}
        {excludeReason(unstable)} 빠졌습니다.
      </SummaryCallout>

      <PageGrid>
        <ChartCard
          className="col-span-12 xl:col-span-7"
          title="GGE 바이플롯 — 어느 계통이 어디서 이겼나(which-won-where)"
          subtitle={`2년 평균 지역 값(${N_G} × ${N_S}) · 점을 누르면 계통 선택 · x·y 같은 축척`}
          height={biplotH + (narrow ? 150 : 78)}
          source={`환경 중심화, 척도 없음, 대칭 SVP. 2차원 근사이므로 실측 1위와 다를 수 있음(${MISMATCH_TEXT}) · 점선 = 원점에서 다각형 변에 내린 수선(구역 경계) · 메가 환경 근거(지역·연도 실측 1위): ${MEGA_EVIDENCE_TEXT}`}
        >
          <div className="flex h-full flex-col">
            {narrow && <div className="mb-1.5">{biplotControls}</div>}
            <div className="min-h-0 flex-1">
              <GgeBiplot selectedId={selectedId} onSelect={setSelectedId} showSectors={showSectors} showAllLabels={showAllLabels} height={biplotH} ariaLabel={biplotAria} />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-border pt-2">
              {!narrow && biplotControls}
              <Legend
                items={[
                  ...MEGA_ENVS.map(m => ({ label: `${m.label} → ${m.winnerId}`, color: megaColor(theme, m) })),
                  { label: '대비 품종', color: theme.text, shape: 'diamond' as const },
                  { label: `${unstable.id}(비교)`, color: theme.categorical[6]! },
                ]}
              />
            </div>
          </div>
        </ChartCard>

        {/* 상세 패널은 옆 바이플롯 높이로 늘이지 않는다(빈 띠 방지) */}
        <section className="col-span-12 flex min-w-0 flex-col gap-2 self-start rounded-lg border border-border bg-surface p-4 shadow-1 xl:col-span-5" aria-label="선택 계통 상세">
          <p className="text-xs font-medium text-muted">계통 상세 · 표·차트에서 계통을 누르면 바뀝니다</p>
          <DetailPanel g={sel} />
        </section>

        {/* 선택 지표 */}
        <div className="col-span-12 min-w-0">
          {narrow ? (
            <MetricStrip label="선택 지표(가로 스크롤)">{tiles}</MetricStrip>
          ) : (
            <KpiRow hero ariaLabel="선택 지표">
              {tiles}
            </KpiRow>
          )}
        </div>

        <section className="col-span-12 flex min-w-0 flex-col gap-3 self-start rounded-lg border border-border bg-surface p-4 shadow-1 lg:col-span-5">
          <div>
            <h3 className="text-[15px] font-semibold leading-snug text-text">분산 분해 — 수량 변동은 어디서 오나</h3>
            <p className="mt-0.5 text-xs text-muted">
              {N_E}개 환경({N_S}개 지역 × {N_Y}년) · 시험구 {N_G * N_E * REPS}개
            </p>
          </div>
          <VarianceDecomp />
        </section>

        <section className="col-span-12 flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1 lg:col-span-7">
          <div>
            <h3 className="text-[15px] font-semibold leading-snug text-text">출원 후보 판정</h3>
            <p className="mt-0.5 text-xs text-muted">지수는 가람솔 2년 평균 {f1(CHECK.mean)} kg/10a 대비 · 항목을 누르면 계통 선택</p>
          </div>
          <RuleBox selectedId={selectedId} onSelect={setSelectedId} />
        </section>

        <ChartCard
          className="col-span-12 lg:col-span-6"
          title="평균–안정성"
          subtitle={`오른쪽 아래가 고수량·안정 · AMMI IPCA1 ${f1(IPCA_PCT[0])}% · IPCA2 ${f1(IPCA_PCT[1])}%`}
          actions={
            <Segmented
              ariaLabel="안정성 지표"
              size="sm"
              value={metric}
              onChange={setMetric}
              options={[
                { value: 'w', label: 'Wricke W' },
                { value: 'asv', label: 'AMMI ASV' },
              ]}
            />
          }
          height={subH}
          source={`${STAB_AXIS[metric]} · 생태가(ecovalence)는 작을수록 안정 · 기준선: 전체 평균 ${f1(GRAND_MEAN)}, ${metric === 'w' ? `W ${f1(W_RULE)}%(= 100/${N_G})` : `ASV 평균 ${f2(ASV_MEAN)}`}`}
        >
          <StabilityScatter metric={metric} selectedId={selectedId} onSelect={setSelectedId} height={subH} narrow={narrow} ariaLabel={stabAria} />
        </ChartCard>

        <ChartCard
          className="col-span-12 lg:col-span-6"
          title="반응 규준(Finlay–Wilkinson)"
          subtitle={`${N_E}개 환경의 환경 지수에 대한 회귀 · 선을 누르면 계통 선택 · 점 = 선택 계통 ${sel.id}의 실측`}
          height={subH + (narrow ? 96 : 30)}
          source="회색 선 = 나머지 계통 · 점선 = 기울기 1(전체 평균) · b < 1은 나쁜 환경에서 덜 줄고 좋은 환경에서 덜 늘어남"
        >
          <ReactionNorm selectedId={selectedId} onSelect={setSelectedId} height={subH} ariaLabel={reactionAria} />
        </ChartCard>

        <section className="col-span-12 flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1">
          <div>
            <h3 className="text-[15px] font-semibold leading-snug text-text">지역 × 계통 순위표</h3>
            <p className="mt-0.5 text-xs text-muted">
              셀 = {YEARS[0]}~{YEARS[N_Y - 1]} 2년 평균(kg/10a) + 지역 내 순위 · 진한 테두리 칸 = 지역 1위 · 후보 = 출원 후보, 대비 = 대비 품종 · 지역 열을 정렬하면 그 지역 순위로 · 행을 누르면 계통 선택
            </p>
          </div>
          <RankTable selectedId={selectedId} onSelect={setSelectedId} />
          <p className="text-xs text-muted">
            LSD(5%) {f1(LSD)} kg/10a: 2년·{N_S}지역 평균 비교, t(0.975, {DF_GE}) {formatFixed(T975, 3)} × √(2 × MS_GE {formatFixed(MS_GE, 1)} / {N_E * REPS}) — 환경을 임의 효과로 볼 때의 오차항.
            출원 후보 {PASSED.length}계통의 가람솔 대비 차({PASSED.map(g => formatSigned(g.diffVsCheck, 1)).join(', ')}){ALL_OVER_LSD ? '는 모두 LSD보다 큽니다' : ` 가운데 ${OVER_LSD.length}계통만 LSD보다 큽니다`}. 가람솔 지역 값은 {YEARS[0]}~{YEARS[N_Y - 1]}{' '}
            평균이라 다른 화면의 2024~2025 평균과 다릅니다.
          </p>
        </section>
      </PageGrid>

      <p className="text-xs text-muted">
        계통명·수량은 모두 가상의 예시 값이며 실존 계통·품종과 관계없습니다. 분산 성분 비율의 현실 범위(E 60~80%, G 5~15%, GxE 15~30%)는 벼·밀 MET 문헌의 일반 범위에 따른 추정입니다.
      </p>
    </div>
  )
}
