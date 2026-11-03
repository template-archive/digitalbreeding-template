import { useMemo, useState } from 'react'
import type { TemplateMeta } from '@/gallery/types'
import {
  AlertList,
  Button,
  Card,
  ChartCard,
  ConclusionBundle,
  ConclusionPanel,
  EmptyState,
  ErrorState,
  KpiRow,
  KpiTile,
  Legend,
  PageGrid,
  PageHeader,
  Skeleton,
  useMediaQuery,
  type AlertListItem,
} from '@/design-system'
import { useChartTheme } from '@/charts'
import {
  ALERT_OVER,
  ALERT_UNDER,
  AS_OF,
  AS_OF_LABEL,
  CPG_PRED_CHANGE,
  CPG_REAL_CHANGE,
  CPG_REALIZED,
  CUM_PCT_TREND,
  DG_RATIO_PRED,
  DG_RATIO_REAL,
  DIRECT,
  DIRECT_SHARE,
  FX,
  FX_SCENARIO,
  FY,
  GBS_PLAN_MONTHS,
  GROUP_SUM,
  ITEMS,
  KASP_ALERT,
  KASP_IN_PROGRESS_IDS,
  MONTHLY,
  NEXT_FY,
  OCT_DAY,
  PER_LINE,
  PLAN_GROUPS,
  PLAN_TOTAL,
  PLOT_COST,
  SEED_OPS_ALERT,
  T2019,
  T2026,
  T2027,
  T_PEAK,
  TOTAL,
  ANNUAL_RATIO,
  INDIRECT_RATE,
  BUDGET_2027,
  USD_KRW,
  statusOf,
} from './data'
import { MonthlyCumChart } from './components/MonthlyCumChart'
import { BudgetBullets, CompositionBar } from './components/BudgetBullets'
import { CostPerGainChart, PerLineChart, REALIZED_LEGEND } from './components/EfficiencyTrend'
import { PlatformTable } from './components/PlatformTable'
import { Plan2027Table } from './components/Plan2027Table'
import { PanelSeverity, PanelTrend } from './components/PanelTrend'
import { eok, man, n, pc, perLineColor, sg, spc } from './components/fmt'

export const meta: TemplateMeta = {
  slug: 'program-budget',
  category: 'kpi',
  title: '육종 프로그램 예산·효율',
  description: '올해 예산이 계획대로 쓰이는지, 어느 비목이 넘치거나 남는지, 디지털 전환 뒤 개량 1 kg/10a당 직접비가 얼마나 줄었는지 보고 2027 예산안을 비교합니다.',
  tags: ['예산', '집행률', '비용 효율', '계통당 선발 평가비', '유전형 분석 단가', '2027 예산안', '벼'],
  organism: '벼',
  status: 'review',
  updatedAt: '2026-11-02',
}

type PreviewState = 'loading' | 'empty' | 'error' | null
function readPreviewState(): PreviewState {
  if (typeof location === 'undefined') return null
  const s = new URLSearchParams(location.search).get('state')
  return s === 'loading' || s === 'empty' || s === 'error' ? s : null
}

function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
}

const SEP = MONTHLY[8]!

/** 결론 묶음 안 KPI 줄: 1440 2×2 · 768 4칸 · 390 2열(ConclusionBundle 기본 격자는 390에서 1열이라 KpiRow로 감싼다) */
const TILE_COLS = { md: 4, lg: 2 }

const PER_LINE_LEGEND = { advance: '세대 진전(전통)', phenoEval: '관찰 포장 평가(전통)', speedAdvance: '속성세대진전', genotyping: '유전형 분석', prediction: '예측' } as const

export default function ProgramBudgetTemplate() {
  const theme = useChartTheme()
  const narrow = useMediaQuery('(max-width: 639px)')
  const preview = useMemo(readPreviewState, [])
  const [failed, setFailed] = useState(preview === 'error')
  const [focusId, setFocusId] = useState<string | null>(null)

  const focusItem = (id: string) => {
    setFocusId(id)
    scrollToId(`pb-row-${id}`)
  }

  const alerts: AlertListItem[] = [
    {
      id: 'kasp',
      severity: 'critical',
      title: `KASP 패널 연말 전망 ${pc(KASP_ALERT.fcPct)} · ${n(KASP_ALERT.over)}만 원 초과`,
      description: `진행 중 ${KASP_ALERT.inProgress}장(${KASP_IN_PROGRESS_IDS})과 11~12월 ${KASP_ALERT.later}장을 더하면 ${KASP_ALERT.fcPlates}장 ${man(KASP_ALERT.fcSamples)}샘플(계획 ${KASP_ALERT.planPlates}장 ${man(KASP_ALERT.planSamples)}). MAS F2 개체 증가.`,
      onClick: () => focusItem('kasp'),
      actionLabel: '— 비목 행 보기',
    },
    {
      id: 'total',
      severity: 'critical',
      title: `총액 연말 전망 ${pc(TOTAL.fcPct)} · ${man(TOTAL.over)}만 원 초과`,
      description: `종자 관리·연구 활동비 불용 예상 ${man(SEED_OPS_ALERT.unused)}만 원을 KASP로 전용해도 ${man(TOTAL.over)}만 원 부족(비목 전용 검토).`,
      onClick: () => scrollToId('pb-budget-items'),
      actionLabel: '— 비목별 집행 보기',
    },
    {
      id: 'seedOps',
      severity: 'warning',
      title: `종자 관리·연구 활동비 연말 전망 ${pc(SEED_OPS_ALERT.fcPct)} · 불용 위험`,
      description: `실적이 계획의 ${pc(SEED_OPS_ALERT.actVsPlan)}(국외 출장 취소·회의 온라인 전환). 잔액 ${man(SEED_OPS_ALERT.remain)}만 원.`,
      onClick: () => focusItem('seedOps'),
      actionLabel: '— 비목 행 보기',
    },
    {
      id: 'fx',
      severity: 'info',
      title: `${NEXT_FY} 6K 칩 단가 환율 민감도`,
      description: `${NEXT_FY}안 ${n(BUDGET_2027.chipUnit)}만 원(≈${Math.round(FX.usd)} USD) 기준, 환율 ${man(FX_SCENARIO)}원이면 ${man(FX.base)} → ${man(FX.scenario)}만 원(${spc(FX.pct)}).`,
      onClick: () => scrollToId('pb-plan-2027'),
      actionLabel: `— ${NEXT_FY}안 표 보기`,
    },
  ]

  // 머리(공통 PageHeader): 범위·소속 회색 줄 → 제목 + 기준일 → 데이터 한 문장. '금액 추정'은 배지 대신 scope 텍스트
  const header = (
    <PageHeader
      context={['벼 · 중부 평야지 벼 육종 프로그램(가상)', `${FY} 회계연도`]}
      title={meta.title}
      scope={`금액은 모두 추정(만 원 단위 계산 · ${FY} 불변가격 · 1 USD = ${man(USD_KRW)}원) · 집행·연말 전망은 기준일 기준, 효율은 ${T2019.year}~${FY} 실적과 ${NEXT_FY}안`}
      asOf={AS_OF}
      details={`연말 전망은 비목별 연말 전망의 합입니다. 비목 전망 = 실적 누계 + (예산 − 계획 누계). 유전형 분석은 플레이트 기준(6K 완료, KASP ${KASP_ALERT.fcPlates}장, GBS ${GBS_PLAN_MONTHS.length}장). 전망 > ${ALERT_OVER}% 경보, < ${ALERT_UNDER}% 주의.`}
    />
  )

  if (failed) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState
          title="예산 데이터를 불러오지 못했습니다"
          description="연구비 관리 시스템 응답이 없습니다. 잠시 후 다시 시도하세요."
          action={
            <Button variant="secondary" onClick={() => setFailed(false)}>
              다시 시도
            </Button>
          }
        />
      </div>
    )
  }

  if (preview === 'loading') {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <span className="sr-only">예산 집행 데이터를 불러오는 중입니다</span>
        <ConclusionBundle panel={<Skeleton height={300} />}>
          <KpiRow loading count={4} cols={TILE_COLS} skeletonHeight={144} className="col-span-full" />
        </ConclusionBundle>
        <PageGrid>
          <Skeleton className="col-span-12 lg:col-span-7" height={420} />
          <Skeleton className="col-span-12 lg:col-span-5" height={420} />
          <Skeleton className="col-span-12" height={340} />
        </PageGrid>
      </div>
    )
  }

  if (preview === 'empty') {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState title={`${FY} 예산 데이터가 없습니다`} description="회계연도 예산 편성과 전표 연동을 확인하세요." />
      </div>
    )
  }

  const curLabel = `${T2026.year}`
  const realLabel = `실현 기준 ${man(CPG_REALIZED[2026])}만 원(${spc(CPG_REAL_CHANGE)})`

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* 결론 묶음: 문제 지표인 연말 전망이 대표. 효율 결론 문장은 연도별 효율 카드 첫 줄로 옮겼다 */}
      <ConclusionBundle
        panel={
          <ConclusionPanel
            label={
              <>
                예산 대비 · {eok(TOTAL.forecast)}억 원 · {man(TOTAL.over)}만 원 초과 예상 <PanelSeverity severity={statusOf(TOTAL.fcPct)} />
              </>
            }
            valueLabel="연말 전망(추정)"
            value={n(TOTAL.fcPct)}
            unit="%"
            statement={
              <>
                {AS_OF_LABEL}까지 <b>{eok(TOTAL.actToDate)}억 원</b>을 집행해 예산 {eok(TOTAL.budget)}억 원의 <b>{pc(TOTAL.execPct)}</b>(계획 누계 {pc(TOTAL.planPct)})입니다. 연말 전망은 <b>{pc(TOTAL.fcPct)}</b>로 {man(TOTAL.over)}만 원 넘칠 것으로 보이며, KASP 패널(전망 {pc(KASP_ALERT.fcPct)})이 원인입니다.
              </>
            }
            aside={
              <PanelTrend
                kind="line"
                title={`예산 대비 누계 % · ${AS_OF_LABEL} 뒤는 전망 · 점선 예산`}
                points={CUM_PCT_TREND.map(t => ({ label: t.month === 12 ? '12월말 전망' : `${t.month}월말`, value: t.pct }))}
                refs={[{ value: 100, label: `예산 ${eok(TOTAL.budget)}억` }]}
                format={v => pc(v)}
                min={0}
                ariaLabel={`예산 대비 누계 집행: ${AS_OF_LABEL} 실적 ${pc(TOTAL.execPct)}에서 연말 전망 ${pc(TOTAL.fcPct)}로 예산 ${ALERT_OVER}%를 넘습니다.`}
              />
            }
          />
        }
      >
        <KpiRow cols={TILE_COLS} className="col-span-full">
          <KpiTile
            size="compact"
            label="집행률"
            value={TOTAL.execPct}
            digits={1}
            unit="%"
            period={`~${AS_OF_LABEL} · 추정`}
            sub={<span className="break-keep">실적 누계 {eok(TOTAL.actToDate)}억 · 잔액 {eok(TOTAL.remain)}억 원</span>}
            achievement={TOTAL.vsPlan}
            achievementDigits={1}
            achievementLabel="계획 대비"
            targetLabel={`계획 누계 ${pc(TOTAL.planPct)}`}
            info={`실적 누계 ÷ 연간 예산. 유전형 분석은 결과 납품(검수) 월, 나머지는 전표 월 기준. 10월 계획은 ${OCT_DAY}/31로 일할.`}
          />
          <KpiTile
            size="compact"
            label={`${FY} 연간 예산`}
            value={TOTAL.budget / 1e4}
            digits={2}
            unit="억 원"
            period="추정"
            sub={
              <>
                <span className="break-keep">직접비(소모성 경비) {eok(DIRECT.budget)}억 · {pc(DIRECT_SHARE)}</span>
                <span className="block break-keep">인건비·감가상각 {eok(GROUP_SUM.C.budget)}억 별도</span>
              </>
            }
            info={`${ITEMS.length}개 비목 합 ${man(TOTAL.budget)}만 원. 직접비(소모성 경비) = 비교 기준 항목 + 비교 기준 외 소모성 경비. 인건비·시설 감가상각은 직접비 정의 밖(별도 집계), 간접비 = (직접비(소모성 경비) + 인건비) × ${Math.round(INDIRECT_RATE * 100)}%.`}
          />
          <KpiTile
            size="compact"
            label="계통당 선발 평가비"
            value={T2026.perLine}
            digits={1}
            unit="만 원"
            period={curLabel}
            sub={
              <>
                <span className="break-keep">{T2019.year} {n(T2019.perLine)}만 원 · {T_PEAK.year} 정점 {n(T_PEAK.perLine)}만 원</span>
                <span className="mt-1 block break-keep text-[11px]">비교 기준 직접비 정의</span>
              </>
            }
            info={`후보 1계통을 선발 결정까지 데려가는 직접비. ${FY} = 속성세대진전 ${n(PER_LINE[2026].speedAdvance!)} + 유전형 분석 ${n(PER_LINE[2026].genotyping!)} + 예측 ${n(PER_LINE[2026].prediction!)}만 원.`}
          />
          <KpiTile
            size="compact"
            label="개량 1 kg/10a당 연간 직접비"
            value={Math.round(T2026.cpg)}
            digits={0}
            unit="만 원"
            period={`${curLabel} · 예측 기준`}
            delta={CPG_PRED_CHANGE}
            deltaUnit="%"
            deltaDigits={1}
            better="down"
            deltaLabel={`예측 기준 · ${T2019.year} ${man(T2019.cpg)}만 원 대비`}
            sub={
              <>
                <span className="break-keep">{realLabel}</span>
                <span className="mt-1 block break-keep text-[11px]">비교 기준 직접비 정의 · 낮을수록 좋음</span>
              </>
            }
            info={`비교 기준 직접비 ÷ 연간 유전적 개량량(ΔG). 예측 ΔG = i · r · σA / L(${FY} ${n(T2026.dG, 2)} kg/10a/년), 실현 기준은 실현 추세 기울기.`}
          />
        </KpiRow>
      </ConclusionBundle>

      {/* B + F | C */}
      <PageGrid>
        <div className="col-span-12 flex min-w-0 flex-col gap-4 lg:col-span-7">
          <ChartCard
            title="월별 누계 집행"
            subtitle={`${FY}년 1~12월 · 억 원(추정) · 실적은 ${AS_OF_LABEL}까지, 이후는 연말 전망`}
            height={narrow ? 280 : 360}
            legend={[
              { label: '계획 누계', color: theme.textMuted, shape: 'dashed' },
              { label: '실적 누계', color: theme.categorical[0]!, shape: 'line' },
              { label: `연말 전망(${pc(TOTAL.fcPct)})`, color: theme.negative, shape: 'dashed' },
              { label: `예산 ${eok(TOTAL.budget)}억`, color: theme.text, shape: 'line' },
              ...(narrow ? [{ label: `기준일 ${AS_OF_LABEL}`, color: theme.textMuted, shape: 'dashed' as const }] : []),
            ]}
            source={`9월말 실적 ${eok(SEP.act!)}억 원(${pc((SEP.act! / TOTAL.budget) * 100, 2)}) · 계획 ${eok(SEP.plan)}억 원. 10월 계획은 ${AS_OF_LABEL}까지 일할(${OCT_DAY}/31).`}
          >
            <MonthlyCumChart height={narrow ? 280 : 360} narrow={narrow} />
          </ChartCard>
          <Card title={`경보·주의 ${alerts.filter(a => a.severity !== 'info').length}건`} subtitle={`경보 ${alerts.filter(a => a.severity === 'critical').length} · 주의 ${alerts.filter(a => a.severity === 'warning').length} · 정보 ${alerts.filter(a => a.severity === 'info').length} · 누르면 해당 행으로 이동`}>
            <AlertList items={alerts.filter(a => a.severity !== 'info')} ariaLabel="예산 경보·주의 목록" density="compact" />
            <AlertList className="mt-2" items={alerts.filter(a => a.severity === 'info')} ariaLabel={`정보 ${alerts.filter(a => a.severity === 'info').length}건`} density="compact" />
            <p className="mt-3 text-xs text-muted">비목·총액 연말 전망 &gt; 예산 {ALERT_OVER}% 경보(초과) · &lt; {ALERT_UNDER}% 주의(불용) · 운영 규칙(추정)</p>
          </Card>
        </div>
        <Card
          className="col-span-12 lg:col-span-5"
          title="비목별 구성·집행"
          subtitle={`${FY} 예산 ${man(TOTAL.budget)}만 원(추정) · 막대 = 예산 대비 실적 누계, 눈금 = 연말 전망`}
        >
          <div id="pb-budget-items" className="flex scroll-mt-20 flex-col gap-4">
            <CompositionBar />
            <BudgetBullets focusId={focusId} />
          </div>
        </Card>
      </PageGrid>

      {/* D */}
      <Card
        title="연도별 효율 추이"
        subtitle={`${T2019.year}~${FY} 실적 · ${NEXT_FY}안 빗금·점선 · 비교 기준 직접비 정의로만 계산 · ${T2019.year + 1}~${FY - 1} 계통당 단가와 ${NEXT_FY}안은 추정`}
      >
        <p className="mb-4 max-w-[84ch] break-keep text-sm leading-relaxed text-text tabular-nums">
          비교 기준 직접비는 {eok(T2019.annual)} → {eok(T2026.annual)}억 원({n(ANNUAL_RATIO, 2)}배)으로 늘었지만 개량 1 kg/10a당 연간 직접비는 <b>{man(T2019.cpg)} → {man(T2026.cpg)}만 원</b>({spc(CPG_PRED_CHANGE)}, 예측 기준)으로 줄었습니다.
        </p>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-text">계통당 선발 평가비(만 원/계통)</h3>
            <Legend
              className="my-1 gap-x-3"
              items={(['advance', 'phenoEval', 'speedAdvance', 'genotyping', 'prediction'] as const).map(k => ({ label: PER_LINE_LEGEND[k], color: perLineColor(theme, k) }))}
            />
            <div style={{ height: narrow ? 240 : 280 }}>
              <PerLineChart height={narrow ? 240 : 280} narrow={narrow} />
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-text">개량 1 kg/10a당 연간 직접비(만 원)</h3>
            <Legend
              className="my-1 gap-x-3"
              items={[
                { label: '예측 ΔG 기준', color: theme.categorical[0]!, shape: 'line' },
                { label: `${NEXT_FY}안(계획 ΔG ${n(T2027.dG, 2)})`, color: theme.categorical[0]!, shape: 'dashed' },
                { label: REALIZED_LEGEND, color: theme.categorical[1]!, shape: 'diamond' },
              ]}
            />
            <div style={{ height: narrow ? 240 : 280 }}>
              <CostPerGainChart height={narrow ? 240 : 280} narrow={narrow} />
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          비교 기준 직접비 = 단계별 1세트 × 1년, 인건비·시설 감가상각·교배 작업비 제외. {FY} 불변가격. 연간 유전적 개량량 배율 {n(DG_RATIO_PRED)}배(예측) · 실현 {n(DG_RATIO_REAL)}배.
        </p>
      </Card>

      {/* E */}
      <Card title="유전형 분석 플랫폼" subtitle={`샘플당 비용(DNA 추출 포함)·마커당 비용·${FY} 실적(추정) · 1 USD = ${man(USD_KRW)}원`}>
        <PlatformTable />
      </Card>

      {/* G */}
      <Card
        title={`${NEXT_FY} 예산안 비교`}
        subtitle={`초안(추정) · 만 원 · 합계 ${man(PLAN_TOTAL.b26)} → ${man(PLAN_TOTAL.b27)}(${sg(PLAN_TOTAL.delta)}, ${spc(PLAN_TOTAL.deltaPct)}) · 증감률 머리글로 정렬`}
      >
        <div id="pb-plan-2027" className="scroll-mt-20">
          <Plan2027Table />
        </div>
        <p className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-[13px] text-text tabular-nums">
          {NEXT_FY} 비교 기준 직접비 <b>{eok(PLAN_GROUPS.A.b27)}억 원</b> · 계통당 <b>{n(T2027.perLine)}만 원</b> · 개량 1 kg/10a당 <b>{man(T2027.cpg)}만 원</b>(계획 ΔG {n(T2027.dG, 2)}, {FY} 목표 구성 유지 가정)
        </p>
      </Card>

      {/* H */}
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-xs leading-relaxed text-muted">
        <li>
          금액은 모두 가상 프로그램의 추정치(만 원, {FY} 불변가격)입니다. 유전형 분석은 결과 납품 월, 나머지는 전표 월 기준이며 10월은 {OCT_DAY}일까지입니다. 시설·장비 감가상각은 현금 지출이 아닌 월할 배부액(비현금)이며
          집행률·연말 전망에 같은 방식으로 넣습니다.
        </li>
        <li>
          비교 기준 직접비({man(T2026.annual)}만 원)는 「전통 육종 vs 디지털육종」 화면과 같은 정의입니다: 세대 진전 후보 {man(T2026.candidates)}계통 × 계통당 선발 평가비 {n(T2026.perLine)}만 원 + 시험구 {man(T2026.plots.total)}구 × {PLOT_COST}만 원. 시험구는 단계별 1개
          세트·1년 기준(겹쳐 심는 MET 1년차 세트 제외)이고 인건비·시설 감가상각·교배 작업비는 넣지 않습니다.
        </li>
        <li>
          이 화면의 &lsquo;직접비(소모성 경비)&rsquo;는 현장·분석 소모성 경비만 뜻합니다. 국가 R&amp;D 회계의 직접비(인건비 포함)와 다르며, 인건비·시설 감가상각은 &lsquo;직접비 정의 밖&rsquo;으로 따로 집계합니다. 간접비 = (직접비(소모성 경비) + 인건비) ×{' '}
          {Math.round(INDIRECT_RATE * 100)}%.
        </li>
        <li>
          개량 1 kg/10a당 연간 직접비는 예측 ΔG(i · r · σA / L) 기준이며, 실현 추세 기준으로는 {man(CPG_REALIZED[2019])}만 → {man(CPG_REALIZED[2026])}만 원({spc(CPG_REAL_CHANGE)})입니다. 연간 유전적 개량량 배율은 {n(DG_RATIO_PRED)}배(예측) · 실현{' '}
          {n(DG_RATIO_REAL)}배입니다.
        </li>
      </ol>
    </div>
  )
}

