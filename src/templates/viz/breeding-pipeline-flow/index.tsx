import { useEffect, useMemo, useState } from 'react'
import type { TemplateMeta } from '@/gallery/types'
import {
  Button,
  Card,
  ChartCard,
  EmptyState,
  ErrorState,
  KpiRow,
  KpiTile,
  PageGrid,
  PageHeader,
  Segmented,
  Skeleton,
  SummaryCallout,
  useMediaQuery,
} from '@/design-system'
import { useChartTheme } from '@/charts'
import { josa } from '@/lib/format'
import {
  ANNUAL_STAGES,
  APPS_2026,
  AS_OF,
  CANDIDATES,
  COHORTS,
  COHORT_STATUS,
  CURRENT_YEAR,
  DEFAULT_COHORT,
  FILED_2026,
  MET_INDEX,
  MET_Y1_2024,
  PIPELINE,
  PIPELINE_TARGET_2026,
  PRE_GS_YEAR,
  REASONS,
  REASON_LABEL,
  TRANSITIONS,
  appsAchievement,
  cohortCounts,
  cohortTransitions,
  gsConclusion,
  int,
  metAchievement,
  passRates,
  pct1,
  sortedReasons,
  trialLines,
  SEVERITY_LABEL,
  appsForecast,
  appsForecastLabel,
  severity,
  type Cohort,
} from './data'
import { FlowSankey } from './components/FlowSankey'
import { AnnualSnapshot } from './components/AnnualSnapshot'
import { ReasonBars, reasonColor } from './components/ReasonBars'
import { GsCompare, POST_LABEL, PRE_LABEL } from './components/GsCompare'
import { CandidateTable, CohortTimeline, PromotionTable } from './components/CohortPanels'
import { MobileAnnualList, MobileReasons, MobileStageList } from './components/MobileLists'
import { MetricStrip } from './components/MetricStrip'

export const meta: TemplateMeta = {
  slug: 'breeding-pipeline-flow',
  category: 'viz',
  title: '육종 파이프라인 계통 흐름',
  description: '올해 단계별 계통 수와 목표 미달 단계, 선택한 GS 1차 코호트가 몇 년에 걸쳐 어디까지 진급했고 단계마다 몇 계통이 왜 빠졌는지를 생키 흐름으로 보여 줍니다.',
  tags: ['파이프라인', '진급률', '탈락 사유', '생키', '코호트', 'GS', '벼'],
  organism: '벼',
  status: 'review',
  updatedAt: '2026-11-02',
}

function readPreviewState(): 'loading' | 'empty' | 'error' | null {
  if (typeof location === 'undefined') return null
  const s = new URLSearchParams(location.search).get('state')
  return s === 'loading' || s === 'empty' || s === 'error' ? s : null
}

const CAND_LINES = (CANDIDATES[2023] ?? []).filter(r => !r.reference).map(r => r.line)
const SANKEY_H = { wide: 320, mid: 300 }

export default function BreedingPipelineFlowTemplate() {
  const preview = useMemo(readPreviewState, [])
  const [cohort, setCohort] = useState<Cohort>(DEFAULT_COHORT)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(preview === 'error')
  const narrow = useMediaQuery('(max-width: 639px)')
  const mid = useMediaQuery('(max-width: 1023px)')
  const theme = useChartTheme()

  useEffect(() => {
    if (preview === 'loading') return
    const t = setTimeout(() => setLoading(false), 500)
    return () => clearTimeout(t)
  }, [preview])

  // A. 머리(공통 PageHeader): 범위·소속 → 제목 + 기준일 → 데이터 한 문장 → 약어 풀이는 「자세히」
  const header = (
    <PageHeader
      context={['벼 · 중부 평야지', '가상 프로그램(품종명·계통명 가상)']}
      title={meta.title}
      scope={`${CURRENT_YEAR} 연간 단계별 계통 수와 유전체 선발(GS) 1차 코호트(${COHORTS[0]}~${COHORTS[COHORTS.length - 1]})의 연차별 진급·탈락 흐름 · 목업 데이터`}
      asOf={AS_OF}
      details={
        <>
          유전체 선발(GS) · 유전체 추정 육종가(GEBV) · 예비 생산력 검정(PYT) · 생산력 검정(AYT) · 지역 적응 시험(MET). 수량은 쌀 수량(kg/10a, 백미). 코호트 = GS
          1차(계통 선발) 연도이며, 한 코호트를 G년(GS 1차·PYT)부터 G+4년(출원)까지 따라갑니다.
          {narrow && ' 품종 출원 등급은 연중에는 연말 전망(실적 + 확정 예정)으로 정합니다.'}
        </>
      }
    />
  )

  if (failed) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState
          title="파이프라인 기록을 불러오지 못했습니다"
          description="육종 정보 시스템 응답이 없습니다. 잠시 후 다시 시도하세요."
          action={
            <Button variant="secondary" onClick={() => setFailed(false)}>
              다시 시도
            </Button>
          }
        />
      </div>
    )
  }
  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <span className="sr-only">파이프라인 기록을 불러오는 중입니다</span>
        <Skeleton height={narrow ? 92 : 48} className="rounded-md" />
        <PageGrid>
          <Skeleton className="col-span-12 xl:col-span-7" height={420} />
          <Skeleton className="col-span-12 xl:col-span-5" height={420} />
        </PageGrid>
        <KpiRow loading count={4} skeletonHeight={150} />
      </div>
    )
  }

  const empty = preview === 'empty' || cohortCounts(cohort).length === 0
  const cur = PIPELINE[CURRENT_YEAR]
  // MET 세트 정의(program-baseline 「MET 세트 정의」): PIPELINE의 MET = 그해 완료 세트, 포장 계통 = 완료 + 1년차
  const metSetNote = `MET ${cur[MET_INDEX]} = 그해 완료 세트(${CURRENT_YEAR - 1}~${CURRENT_YEAR}). ${CURRENT_YEAR} 포장에는 1년차 세트 ${MET_Y1_2024}계통(${CURRENT_YEAR - 2} 코호트, ${CURRENT_YEAR}~${CURRENT_YEAR + 1})이 함께 있어 MET 포장 계통은 ${cur[MET_INDEX] + MET_Y1_2024}. 시험 계통 ${josa(String(trialLines(CURRENT_YEAR)), '는은')} 완료 세트 기준`
  const appsSev = severity(appsForecast())
  const prev = PIPELINE[CURRENT_YEAR - 1]
  const rates = passRates(CURRENT_YEAR)
  const trs = cohortTransitions(cohort)
  const doneTrs = trs.filter(t => t.done && t.alloc)
  const c = cohortCounts(cohort)
  const sankeyH = mid ? SANKEY_H.mid : SANKEY_H.wide
  const firstTop = doneTrs[0]?.alloc ? sortedReasons(doneTrs[0].alloc)[0] : null

  const metSev = severity(metAchievement())
  // 목표 미달 단계(상수에서 생성): 2026은 MET 하나
  const shortStages = ANNUAL_STAGES.filter((_, i) => cur[i] < PIPELINE_TARGET_2026[i]).map(st => st.short)

  // 선택 지표(2026 연간, 코호트와 무관): 넓은 화면 KpiRow, 390px 가로 띠
  const tiles = [
    <KpiTile
      key="candidates"
      label="세대 진전 후보"
      value={int(cur[0])}
      unit="계통"
      sub={`GS 1차 선발 ${int(cur[1])} · ${pct1(rates[1] as number)}`}
      period={`${CURRENT_YEAR} 연간`}
      delta={cur[0] - prev[0]}
      deltaUnit="계통"
      deltaDigits={0}
      deltaLabel="전년 대비"
    />,
    <KpiTile
      key="trial"
      label="시험 계통(PYT+AYT+MET)"
      value={String(trialLines(CURRENT_YEAR))}
      unit="계통"
      sub={`PYT ${cur[2]} · AYT ${cur[3]} · MET ${cur[4]}`}
      period={`${CURRENT_YEAR} 연간`}
      delta={trialLines(CURRENT_YEAR) - trialLines(CURRENT_YEAR - 1)}
      deltaUnit="계통"
      deltaDigits={0}
      deltaLabel={`전년 대비(${trialLines(CURRENT_YEAR - 1)})`}
    />,
    <KpiTile key="filing" label="출원 후보" value={String(cur[5])} unit="계통" sub={CAND_LINES.join(' · ')} period={`${CURRENT_YEAR} 연간`} />,
    <KpiTile
      key="apps"
      label={`${CURRENT_YEAR} 품종 출원`}
      plainLabel={`${CURRENT_YEAR} 품종 출원`}
      value={String(APPS_2026.filed)}
      unit="건"
      sub={
        <>
          {`${FILED_2026.name} ${FILED_2026.date.slice(5)} 출원 · ${APPS_2026.planned.month}월 ${APPS_2026.planned.line} 예정 · `}
          <span className="whitespace-nowrap">{appsForecastLabel()}</span>
        </>
      }
      info={narrow ? undefined : `연중에는 연말 전망(실적 + 확정 예정)으로 등급을 정합니다. ${appsForecastLabel()} ${pct1(appsForecast())}.`}
      period={`${CURRENT_YEAR} 연간`}
      target={APPS_2026.target}
      targetLabel={`목표 ${APPS_2026.target}건`}
      achievement={appsAchievement()}
      achievementDigits={1}
      severity={appsSev}
    />,
  ]

  // 조작: 넓은 화면은 생키 아래, 390px은 단계 목록 바로 위
  const cohortControls = (
    <Card padding="md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span id="pipeline-cohort-label" className="text-[13px] font-semibold text-text">
              GS 1차 코호트
            </span>
            <Segmented
              ariaLabelledBy="pipeline-cohort-label"
              value={String(cohort)}
              onChange={v => setCohort(Number(v) as Cohort)}
              options={COHORTS.map(G => ({ value: String(G), label: String(G), data: { 'data-cohort': String(G) } }))}
            />
          </div>
          <p className="break-keep text-xs text-muted" aria-live="polite">
            <b className="text-text">{cohort}</b> · {COHORT_STATUS[cohort]}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <CohortTimeline cohort={cohort} />
        </div>
      </div>
    </Card>
  )

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* 결론 띠: 머리 바로 아래 한 곳. 톤 = MET 달성 등급 */}
      <SummaryCallout live tone={metSev === 'critical' ? 'negative' : metSev === 'warning' ? 'warning' : 'neutral'}>
        {CURRENT_YEAR} 단계 가운데 목표에 못 미친 곳은 <b>{shortStages.join('·')}</b>
        {shortStages.length === 1 ? ' 하나' : ` ${shortStages.length}곳`}입니다(MET 완료 <b>{cur[MET_INDEX]}계통</b>, 목표 {PIPELINE_TARGET_2026[MET_INDEX]}의{' '}
        {pct1(metAchievement())}). 품종 출원은 {APPS_2026.filed}건, {appsForecastLabel()}({pct1(appsForecast())})으로 {SEVERITY_LABEL[appsSev]}입니다.
      </SummaryCallout>

      {narrow && cohortControls}

      {/* 주 그림: 코호트 계통 흐름 + 시험 단계 확대(첫 단계 탈락이 눌러 보이지 않는 PYT 이후를 짝으로) */}
      {empty ? (
        <EmptyState title="이 코호트의 단계 기록이 없습니다" description="육종 정보 시스템에 이 GS 1차 연도의 계통 기록을 먼저 등록하세요." />
      ) : narrow ? (
        <Card title={`${cohort} GS 1차 코호트 단계 목록`} subtitle="점 위치 = 로그 척도(오른쪽 끝 = ① 후보) · 진급률(코호트) · 탈락 상위 사유">
          <MobileStageList cohort={cohort} />
        </Card>
      ) : (
        <PageGrid>
          <ChartCard
            className="col-span-12 xl:col-span-7"
            title={`${cohort} GS 1차 코호트 계통 흐름`}
            subtitle={`${c.slice(0, cohort === 2023 ? 6 : c.length).map(int).join(' → ')} · 회색 = 탈락 · 빗금 = 진급 심의 대기·진행 중`}
            height={sankeyH}
            legend={[
              { label: '단계(진급)', color: theme.accent },
              { label: '탈락', color: theme.textMuted },
              { label: '대기·진행 중(회색 빗금)', color: theme.textMuted, shape: 'missing' as const },
              ...(cohort === 2023 ? [{ label: '출원 예정(단계색 빗금)', color: theme.accent, shape: 'hatch' as const }] : []),
            ]}
            source="폭은 계통 수에 비례(선형). PYT 이후는 오른쪽 확대 그림 참고. 아주 작은 값은 최소 1.5px로 그림."
          >
            <FlowSankey cohort={cohort} from={0} height={sankeyH} ariaPrefix="" />
          </ChartCard>
          <ChartCard className="col-span-12 xl:col-span-5" title="시험 단계 확대(PYT 이후, 선형)" subtitle={`${cohort} 코호트 ③ PYT ${int(c[2])}계통부터`} height={sankeyH}>
            <FlowSankey cohort={cohort} from={2} height={sankeyH} ariaPrefix="시험 단계 확대. " />
          </ChartCard>
        </PageGrid>
      )}

      {!narrow && cohortControls}

      {/* 선택 지표 */}
      {narrow ? <MetricStrip label="선택 지표(가로 스크롤)">{tiles}</MetricStrip> : <KpiRow ariaLabel="선택 지표">{tiles}</KpiRow>}

      {/* 연간 비교(코호트 선택과 무관) */}
      <PageGrid>
        <div className="col-span-12 min-w-0 xl:col-span-7">
          {narrow ? (
            <Card title={`${CURRENT_YEAR} 연간 단계 현황`} subtitle="계통 수 · 통과율(같은 해 단계 수 비) · 점 위치 = 로그 척도">
              <MobileAnnualList />
              <p className="mt-2 text-xs text-muted">
                {metSetNote}. MET 목표 {PIPELINE_TARGET_2026[MET_INDEX]} · {pct1(metAchievement())} 미달.
              </p>
            </Card>
          ) : (
            <ChartCard
              className="h-full"
              title={`${CURRENT_YEAR} 연간 단계 현황`}
              subtitle="오른쪽 열 = 계통 수 · 통과율(같은 해 단계 수 비) · 코호트 선택과 무관"
              height={240}
              legend={[
                { label: `${CURRENT_YEAR} 계통 수`, color: theme.accent, shape: 'circle' },
                { label: '목표 미달 단계', color: theme.warning, shape: 'circle' },
                { label: `${CURRENT_YEAR} 목표`, color: theme.text, shape: 'diamond-open' },
                { label: `${PRE_GS_YEAR}(GS 도입 전)`, color: theme.text, shape: 'ring' },
              ]}
              source={`${metSetNote}. 출처: 연간 파이프라인 집계(목업).`}
            >
              <AnnualSnapshot height={240} />
            </ChartCard>
          )}
        </div>
        <div className="col-span-12 min-w-0 xl:col-span-5">
          <ChartCard
            className="h-full"
            title="GS 도입 전후 진급 구조"
            subtitle="통과율(같은 해 단계 수 비) · 2019 vs 2026"
            height={230}
            legend={[
              { label: PRE_LABEL, color: theme.textMuted },
              { label: POST_LABEL, color: theme.accent },
            ]}
            source={<span className="text-[13px] font-medium text-text">{gsConclusion()}</span>}
          >
            <GsCompare height={230} />
          </ChartCard>
        </div>
      </PageGrid>

      {!empty && (
        <PageGrid>
          {/* 탈락 사유 */}
          <div className="col-span-12 min-w-0 xl:col-span-7">
            {narrow ? (
              <Card title="탈락 사유(주원인 1개)" subtitle={`${cohort} 코호트 · 끝난 전환만`}>
                <MobileReasons cohort={cohort} />
              </Card>
            ) : (
              <ChartCard
                className="h-full"
                title="탈락 사유(주원인 1개)"
                subtitle={`${cohort} 코호트 · 끝난 전환만 · 100% 누적 · 행 아래 = 판정 근거${firstTop && doneTrs[0] ? ` · 최다 ${REASON_LABEL[firstTop.r]} ${int(firstTop.n)}(${pct1((firstTop.n / (doneTrs[0].drop as number)) * 100)})` : ''}`}
                height={Math.max(160, doneTrs.length * 46 + 30)}
                legend={REASONS.map(r => ({ label: REASON_LABEL[r], color: reasonColor(theme, r) }))}
                source="세그먼트 순서 = 범례 순서(왼쪽부터). 8% 이상 세그먼트 안에 계통 수. 탈락 사유는 주원인 1개(추정)."
              >
                <ReasonBars cohort={cohort} height={Math.max(160, doneTrs.length * 46 + 30)} />
              </ChartCard>
            )}
          </div>

          {/* 출원 후보 */}
          <div className="col-span-12 min-w-0 xl:col-span-5">
            <Card title="출원 후보·결과" subtitle={`${cohort} 코호트 · 지수 = 가람솔 대비 MET 2년 평균 쌀 수량(백미)`}>
              <CandidateTable cohort={cohort} />
            </Card>
          </div>

          {/* 진급률 표 */}
          <div className="col-span-12 min-w-0">
            <Card title="코호트 진급률" subtitle="진급률(코호트) = 다음 단계 수 / 이전 단계 수 · 선택 코호트 윤곽 · 참고 행은 횡단 통과율">
              <PromotionTable cohort={cohort} scrollHint={`옆으로 밀어 전환 ${TRANSITIONS.length}개 보기 →`} />
              <p className="mt-2 text-xs leading-relaxed text-muted">
                횡단 통과율은 같은 해 단계 수의 비라 코호트 진급률과 직접 비교할 수 없습니다. 예: {CURRENT_YEAR} 횡단 AYT→MET {pct1(rates[4] as number)}(
                {cur[4]}/{cur[3]})는 다른 해에 출발한 두 세트의 비이고, 2023 코호트 ④→⑤ 진급률 {pct1(cohortTransitions(2023)[3].rate ?? 0)}({cohortCounts(2023)[4]}/
                {cohortCounts(2023)[3]})는 같은 계통을 AYT {2023 + 1}에서 MET {2023 + 2}~{2023 + 3}까지 따라간 값입니다.
              </p>
            </Card>
          </div>
        </PageGrid>
      )}

      {/* L. 각주 */}
      <footer className="flex flex-col gap-1 border-t border-border pt-3 text-xs leading-relaxed text-muted">
        <p>목업 데이터 · 가상 프로그램. 품종명(별하랑·가람솔)과 계통명은 모두 가상입니다.</p>
        <p>
          코호트 = GS 1차(계통 선발) 연도. GS 1차·PYT = G년, AYT = G+1년, MET = G+2~G+3년(2년, 8개 지역), 출원 후보 선정 = G+3년 말, 출원 = G+4년. GS 도입 전({PRE_GS_YEAR}~2021) 코호트는 MET 3년제 → 2년제 전환기라 연간 현황으로만 비교합니다.
        </p>
        <p>MET 수는 그해 완료 세트의 계통 수입니다(1년차 세트 제외). 진급률(코호트)과 통과율(같은 해 단계 수 비)은 다른 값입니다.</p>
        <p>탈락 사유는 탈락 계통마다 주원인 1개(추정)입니다. 수량은 쌀 수량(백미, kg/10a), 지수는 대비 품종 가람솔 대비.</p>
      </footer>
    </div>
  )
}
