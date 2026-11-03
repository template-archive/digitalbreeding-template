import { useEffect, useMemo, useState } from 'react'
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
  Segmented,
  Select,
  SequentialScaleLegend,
  Skeleton,
  Switch,
  useMediaQuery,
  type AlertListItem,
} from '@/design-system'
import { useChartTheme } from '@/charts'
import { formatDelta, formatFixed, formatPValue } from '@/lib/format'
import {
  ALERT_LABEL,
  ALERT_RULES,
  ALERTS,
  AS_OF,
  COLD_T,
  CORR_BY_KEY,
  CORRELATIONS,
  DEFAULT_FACTOR,
  DEFAULT_SITE,
  DEFAULT_YEAR,
  ENVS,
  envOf,
  envsOf,
  FACTORS,
  GDD_BASE,
  HARVEST_CUM,
  HEAT_STERILE_T,
  HEAT_T,
  INDEX_ABS_MAX,
  INDEX_MAX,
  INDEX_MIN,
  lowestResiduals,
  mmdd,
  N_ENV,
  NORMAL_BAND,
  R_CRIT,
  RIPEN_DAYS,
  RIPEN_OPT_RANGE,
  SITES,
  SUMMARY,
  WIN_HALF,
  WX_SEED,
  YEARS,
  ZONES,
  type Env,
  type FactorKey,
  type WxAlert,
  type Year,
} from './data'
import { f1, f2, n0, pct0, s0, s1 } from './components/fmt'
import { PanelSeverity, PanelTrend } from './components/PanelTrend'
import { SiteMap } from './components/SiteMap'
import { SiteCards } from './components/SiteCards'
import { MonthlyChart, MONTHLY_MODES, monthlyColor, type MonthlyMode } from './components/MonthlyChart'
import { DailyChart } from './components/DailyChart'
import { corrText, FactorBars, FactorScatter, regressionText } from './components/FactorCharts'
import { EnvTable } from './components/EnvTable'

export const meta: TemplateMeta = {
  slug: 'trial-site-environment',
  category: 'kpi',
  title: '시험지 기상·환경',
  description: '지역 적응 시험(MET) 8개 지역 × 2년의 재배기 기상을 평년과 비교하고, 환경 지수(지역·연도 수량 차이)를 설명하는 기상 요인과 해석에 주의할 이상 기상을 정리합니다.',
  tags: ['MET', '지역 적응 시험', '기상', '유효적산온도', '환경 지수', '이상 기상', '벼'],
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

/** 결론 묶음 안 KPI 줄: 1440 2열(셋째 타일 전체 폭) · 768 3칸 · 390 2열(ConclusionBundle 기본 격자는 390에서 1열이라 KpiRow로 감싼다) */
const TILE_COLS = { md: 3, lg: 2 }
/** 경보 목록 접힘 기본 건수: 지도 카드와 높이를 맞춘다 */
const ALERT_PREVIEW = 5

const otherYear = (y: Year): Year => (y === YEARS[0] ? YEARS[1] : YEARS[0])

/** 경보 근거 문구(수치는 원값에서 한 번 반올림) */
function alertDescription(a: WxAlert): string {
  switch (a.type) {
    case 'heat35':
      return `출수 ±${WIN_HALF}일 최고 ≥ ${HEAT_STERILE_T} °C ${a.n}일 · 최고 ${f1(a.max!)} °C · ${mmdd(a.k)}부터 · 기준 ${ALERT_RULES.heat35.crit}일 이상 경보`
    case 'coldMeiosis':
      return `감수분열기~출수기(출수 전 ${WIN_HALF}일~출수일) 최저 ≤ ${COLD_T} °C ${a.n}일 · 최저 ${f1(a.min!)} °C · ${mmdd(a.k)}부터 · 기준 ${ALERT_RULES.coldMeiosis.crit}일 이상 경보`
    case 'heavyRain':
      return `일 강수량 ${n0(a.mm!)} mm · 기준 ${ALERT_RULES.heavyRain.warn} mm 주의, ${ALERT_RULES.heavyRain.crit} mm 경보(호우특보 근사)`
    case 'sun40':
      return `출수 후 ${RIPEN_DAYS}일 일조 평년의 ${pct0(a.pct!)} · 기준 ${ALERT_RULES.sun40.warn}% 이하 주의, ${ALERT_RULES.sun40.crit}% 이하 경보`
    case 'gddDef':
      return `유효적산온도 평년 대비 ${s0(a.dev!)} °C·일 · 기준 ${s0(ALERT_RULES.gddDef.warn)} 이하 주의 · 수확 ${mmdd(a.k)}`
  }
}
/** 경보 제목 옆 핵심 수치 */
function alertHeadline(a: WxAlert): string {
  switch (a.type) {
    case 'heat35':
      return `≥ ${HEAT_STERILE_T} °C ${a.n}일`
    case 'coldMeiosis':
      return `≤ ${COLD_T} °C ${a.n}일`
    case 'heavyRain':
      return `${n0(a.mm!)} mm`
    case 'sun40':
      return `평년의 ${pct0(a.pct!)}`
    case 'gddDef':
      return `${s0(a.dev!)} °C·일`
  }
}

export default function TrialSiteEnvironmentTemplate() {
  const preview = useMemo(readPreviewState, [])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState<Year>(DEFAULT_YEAR)
  const [siteId, setSiteId] = useState(DEFAULT_SITE)
  const [monthly, setMonthly] = useState<MonthlyMode>('temp')
  const [factor, setFactor] = useState<FactorKey>(DEFAULT_FACTOR)
  const [allYears, setAllYears] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const wide = useMediaQuery('(min-width: 768px)')
  const xl = useMediaQuery('(min-width: 1280px)')
  const theme = useChartTheme()

  useEffect(() => {
    if (preview === 'loading') return
    const t = setTimeout(() => setLoading(false), 400)
    return () => clearTimeout(t)
  }, [preview])

  const S = SUMMARY[year]
  const P = SUMMARY[otherYear(year)]
  const env = envOf(year, siteId)
  const site = env.site
  const alerts = ALERTS[year]
  const best = CORRELATIONS.reduce((a, b) => (Math.abs(b.r) > Math.abs(a.r) ? b : a))
  const low4 = lowestResiduals(best.key, 4)
  const lowSites = [...new Set(low4.map(l => l.env.site.short))]

  const select = (id: string) => setSiteId(id)
  const selectEnv = (e: Env) => {
    setSiteId(e.site.id)
    if (e.year !== year) setYear(e.year)
  }

  // A. 머리(공통 PageHeader: 범위·소속 회색 줄 → 제목 + 기준일·연도·지역 필터 → 데이터 한 문장 → 접힌 정의)
  const header = (
    <PageHeader
      context={['벼 · 중부 평야지 프로그램', '지역 적응 시험(MET) 2년차']}
      title={meta.title}
      scope={`지역 적응 시험(MET) ${SITES.length}개 지역 × ${YEARS[0]}~${YEARS[1]} 재배기(이앙~수확) 기상을 평년과 비교 · 기상 값은 목업(가상 관측)`}
      asOf={AS_OF}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            ariaLabel="연도"
            options={YEARS.map(y => ({ value: String(y), label: String(y) }))}
            value={String(year)}
            onChange={v => setYear(Number(v) as Year)}
          />
          <Select label="지역" hideLabel options={SITES.map(s => ({ value: s.id, label: s.name }))} value={siteId} onChange={select} />
        </div>
      }
      details={
        <>
          재배기는 이앙일부터 수확일까지입니다. 유효적산온도(GDD, growing degree days)는 기준 {GDD_BASE} °C로 이 기간을 합산하고, 평년은 1991~2020(인근 ASOS 관측소 근사, 추정)입니다. 기상 값은 목업(가상 관측)입니다.
        </>
      }
    />
  )

  if (preview === 'error') {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState title="기상 자료를 불러오지 못했습니다" description="기상 관측 연계(ASOS·현장 기상대) 응답이 없습니다. 잠시 후 다시 시도하거나 시험 관리자에게 문의하세요." />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <span className="sr-only">시험지 기상 자료를 불러오는 중입니다</span>
        <ConclusionBundle panel={<Skeleton height={280} />}>
          <KpiRow loading count={3} cols={TILE_COLS} skeletonHeight={134} className="col-span-full" />
        </ConclusionBundle>
        <PageGrid>
          <Skeleton className="col-span-12 lg:col-span-8" height={440} />
          <Skeleton className="col-span-12 lg:col-span-4" height={440} />
        </PageGrid>
      </div>
    )
  }

  if (preview === 'empty') {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState title="이 연도의 시험지 기상 자료가 없습니다" description="시험지별 기상 관측(이앙~수확)이 등록되면 평년 비교·환경 지수 해석·이상 기상 경보가 표시됩니다." />
      </div>
    )
  }

  const alertItems: AlertListItem[] = alerts.map(a => ({
    id: a.id,
    severity: a.severity,
    title: `${a.env.site.name} · ${ALERT_LABEL[a.type]} (${alertHeadline(a)})`,
    description: alertDescription(a),
    value: mmdd(a.k),
    onClick: () => select(a.env.site.id),
    actionLabel: `— ${a.env.site.name} 선택`,
  }))

  const bestF = FACTORS.find(f => f.key === best.key)!
  const sigList = CORRELATIONS.filter(c => c.sig)
  const critAlerts = alerts.filter(a => a.severity === 'critical')
  const fCorr = CORR_BY_KEY[factor]
  const fLabel = FACTORS.find(f => f.key === factor)!.label
  const tableRows = allYears ? ENVS : envsOf(year)
  const band = NORMAL_BAND
  const alertSeverity = S.critical > 0 ? 'critical' : S.warning > 0 ? 'warning' : 'ok'
  const alertDelta = year === YEARS[1] ? S.alerts - P.alerts : null
  // 패널 추세는 program-overview와 같은 규칙: 처음 연도부터 선택 연도까지. 2025는 비교할 앞 연도가 없어 도식을 두지 않는다
  const trendYears = YEARS.filter(y => y <= year)
  const shownAlerts = alertsOpen || alertItems.length <= ALERT_PREVIEW + 1 ? alertItems : alertItems.slice(0, ALERT_PREVIEW)

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* B. 결론 묶음: 이상 기상 판단 + 받치는 재배기 기상 3개 */}
      <ConclusionBundle
        panel={
          <ConclusionPanel
            label={
              <>
                {year} · 경보 {S.critical} · 주의 {S.warning} · <span className="whitespace-nowrap">{alertDelta !== null ? `전년 대비 ${formatDelta(alertDelta, { digits: 0, unit: '건' })}` : `${P.year} ${P.alerts}건`}</span> <PanelSeverity severity={alertSeverity} />
              </>
            }
            valueLabel="이상 기상"
            value={String(S.alerts)}
            unit="건"
            statement={
              <>
                {critAlerts.length > 0 && (
                  <>
                    <b>경보 {critAlerts.length}건</b>(성적 해석 유의): {critAlerts.map(a => `${a.env.site.short} ${ALERT_LABEL[a.type]}`).join(', ')}.{' '}
                  </>
                )}
                환경 지수를 가장 잘 설명하는 요인은 <b>{bestF.label}</b>(r = {f2(best.r)}, p = {formatPValue(best.p)})이고, 일조로 설명되지 않는 큰 하락 {low4.length}개 환경은 모두 {lowSites.join('·')}입니다(출수기 고온·감수분열기 저온).
              </>
            }
            aside={
              trendYears.length > 1 ? (
                <PanelTrend
                  title="연도별 이상 기상 건수"
                  kind="line"
                  min={0}
                  points={trendYears.map(y => ({ label: String(y), value: SUMMARY[y].alerts }))}
                  format={v => `${n0(v)}건`}
                  ariaLabel={`연도별 이상 기상: ${trendYears.map(y => `${y}년 ${SUMMARY[y].alerts}건`).join(', ')}.`}
                />
              ) : undefined
            }
          />
        }
      >
        <KpiRow cols={TILE_COLS} className="col-span-full">
          <KpiTile
            label={`유효적산온도(GDD, 기준 ${GDD_BASE} °C)`}
            plainLabel="유효적산온도"
            value={n0(S.gdd)}
            unit="°C·일"
            period={`${year} · ${SITES.length}개 지역 평균`}
            sub={`평년 대비 ${s0(S.gddDev)} · ${P.year} ${s0(P.gddDev)}`}
            range={{ min: band.gdd.min, max: band.gdd.max, lo: band.gdd.lo, hi: band.gdd.hi, value: S.gddDev, label: `평년 편차 눈금 · 띠 = 평년 ±${band.gdd.hi} °C·일` }}
            info={`Σ max(0, 일평균기온 − ${GDD_BASE}), 이앙~수확. 평년 편차는 같은 재배기 날짜의 평년 합 대비(원값 차를 한 번 반올림). 수확 적기 판단의 '출수 후 ${n0(HARVEST_CUM)} °C·일'은 기준 0 °C 누적이라 다릅니다.`}
          />
          <KpiTile
            label="강수량(재배기)"
            value={n0(S.pr)}
            unit="mm"
            period={`${year} · 평균`}
            sub={`평년의 ${pct0(S.prPct)} · ${P.year} ${pct0(P.prPct)}`}
            range={{ min: band.pct.min, max: band.pct.max, lo: band.pct.lo, hi: band.pct.hi, value: S.prPct, label: `평년비 눈금 · 띠 = 평년 ${band.pct.lo}~${band.pct.hi}%` }}
            info={`평년비 = ${SITES.length}개 지역 평균 실측 / 평균 평년(Σ/Σ, 지역 % 평균이 아님).`}
          />
          <KpiTile
            label="일조시간(재배기)"
            value={n0(S.sun)}
            unit="h"
            period={`${year} · 평균`}
            sub={`평년의 ${pct0(S.sunPct)} · 등숙기 ${pct0(S.s40Pct)}(${P.year} ${pct0(P.s40Pct)})`}
            range={{ min: band.pct.min, max: band.pct.max, lo: band.pct.lo, hi: band.pct.hi, value: S.sunPct, label: `평년비 눈금 · 띠 = 평년 ${band.pct.lo}~${band.pct.hi}%` }}
            info={`등숙기 일조는 환경 지수와 상관이 가장 큰 요인입니다(r = ${f2(CORR_BY_KEY.s40.r)}).`}
          />
        </KpiRow>
      </ConclusionBundle>

      {/* C 지역 배치 + G 경보 */}
      <PageGrid>
        <Card
          className="col-span-12 lg:col-span-8"
          title={`시험지 배치와 환경 지수 · ${year}`}
          subtitle="환경 지수 = 지역·연도 평균 수량 − 전체 평균(kg/10a, 쌀 수량, 다환경 시험 GxE·안정성 화면과 같은 정의) · 점·카드를 누르면 지역 선택"
        >
          {/* 지도 옆 2열 카드는 카드 칸이 넉넉한 xl(1280px 이상)에서만. 768~1279px는 지도 + 범례 줄을 위에, 카드 2열을 아래에(지역명이 잘리지 않게).
              지도는 위경도 비율이라 폭을 다 못 쓰므로 768~1279px에서 범례를 지도 옆에 두어 좌우 빈 띠를 없앤다 */}
          <div className="flex flex-col gap-3 xl:flex-row">
            {wide && (
              <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center xl:w-[46%] xl:flex-col xl:items-stretch">
                <div className="min-w-0 md:w-3/5 xl:w-full">
                  <SiteMap year={year} selected={siteId} onSelect={select} height={xl ? 440 : 400} />
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted md:flex-1 md:flex-col md:items-start xl:flex-none xl:flex-row xl:items-center">
                  <SequentialScaleLegend
                    layout="inline"
                    title="환경 지수"
                    ariaLabel={`점 색 = 환경 지수, 음수 ${s1(-INDEX_ABS_MAX)}에서 양수 ${s1(INDEX_ABS_MAX)}까지, 0은 중간색`}
                    colors={theme.diverging}
                    domain={[-INDEX_ABS_MAX, INDEX_ABS_MAX]}
                    ticks={[
                      { value: -INDEX_ABS_MAX, label: s0(-INDEX_ABS_MAX) },
                      { value: INDEX_ABS_MAX, label: s0(INDEX_ABS_MAX) },
                    ]}
                  />
                  <Legend items={[{ label: '굵은 테두리 = 이상 기상 지역', color: 'var(--color-text)', shape: 'ring' }]} />
                  <span>위경도 근사 · 경계선 생략</span>
                </div>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <SiteCards year={year} selected={siteId} onSelect={select} />
              <p className="mt-2 text-xs text-muted tabular-nums">
                {ZONES.map(z => `${z.label} ${SITES.filter(s => s.zone === z.key).length}`).join(' · ')} · 범위 {s1(INDEX_MIN.index)}({INDEX_MIN.site.short} {INDEX_MIN.year})~{s1(INDEX_MAX.index)}({INDEX_MAX.site.short} {INDEX_MAX.year}) · 연도 평균{' '}
                {YEARS.map(y => `${y} ${s1(SUMMARY[y].indexMean)}`).join(' · ')}
              </p>
            </div>
          </div>
        </Card>
        <Card
          className="col-span-12 lg:col-span-4"
          title={`경보·주의 ${S.alerts}건 · ${year}`}
          subtitle={`경보 ${S.critical} · 주의 ${S.warning} · 날짜 내림차순 · 누르면 지역 선택`}
        >
          <div data-alerts-open={alertsOpen || undefined}>
            <AlertList items={shownAlerts} ariaLabel={`${year}년 이상 기상 ${S.alerts}건`} density="compact" emptyText="이 연도에 기준을 넘은 이상 기상이 없습니다" />
          </div>
          {alertItems.length > ALERT_PREVIEW + 1 && (
            <Button size="sm" variant="ghost" className="mt-2" aria-expanded={alertsOpen} onClick={() => setAlertsOpen(o => !o)}>
              {alertsOpen ? '접기' : `전체 ${alertItems.length}건 보기`}
            </Button>
          )}
          <p className="mt-3 border-t border-border pt-2 text-xs text-muted">
            임계값은 추정. 호우 기준은 호우주의보(12시간 {ALERT_RULES.heavyRain.warn} mm)·경보({ALERT_RULES.heavyRain.crit} mm)를 일 강수량으로 근사.
          </p>
        </Card>
      </PageGrid>

      {/* D 월별 + E 일별 */}
      <PageGrid>
        <ChartCard
          className="col-span-12 lg:col-span-5"
          title={`월별 ${MONTHLY_MODES.find(m => m.value === monthly)!.label} · ${site.name} ${year}`}
          subtitle={`실측 vs 평년(1991~2020 근사) · 재배기 ${mmdd(env.tp)}~${mmdd(env.hv)}`}
          actions={<Segmented size="sm" ariaLabel="월별 지표" options={MONTHLY_MODES} value={monthly} onChange={setMonthly} />}
          legend={[
            { label: '실측', color: monthlyColor(theme, monthly), shape: monthly === 'temp' ? 'line' : 'square' },
            { label: '평년', color: theme.textMuted, shape: 'dashed' },
          ]}
          height={300}
          source="툴팁의 편차는 원값 차를 한 번 반올림한 값입니다."
        >
          <MonthlyChart env={env} mode={monthly} height={300} />
        </ChartCard>
        <ChartCard
          className="col-span-12 lg:col-span-7"
          title={`일별 기온 · ${site.name} ${year}`}
          subtitle={`이앙 ${mmdd(env.tp)} · 출수 ${mmdd(env.hd)} · 수확 ${mmdd(env.hv)}(${env.seasonDays}일) · 고온 ${env.heat}일(≥ ${HEAT_STERILE_T} °C ${env.heat35}) · 저온 ${env.cold}일`}
          legend={[
            { label: '최고~최저', color: theme.categorical[0]! },
            { label: '일평균', color: theme.text, shape: 'line' },
            { label: `출수 ±${WIN_HALF}일`, color: theme.warning },
            { label: `최고 ≥ ${HEAT_STERILE_T} °C`, color: theme.negative, shape: 'diamond' },
            { label: `최저 ≤ ${COLD_T} °C(출수 ±${WIN_HALF}일)`, color: theme.info, shape: 'circle' },
          ]}
          height={300}
          source={`고온 일수 = 출수 ±${WIN_HALF}일 최고 ≥ ${HEAT_T} °C, 저온 일수 = 최저 ≤ ${COLD_T} °C. 장해형 냉해 경보는 출수 전 ${WIN_HALF}일~출수일만 봅니다. 출수일은 대비 품종 가람솔 기준.`}
        >
          <DailyChart env={env} height={300} />
        </ChartCard>
      </PageGrid>

      {/* F 기상 요인–환경 지수 */}
      <PageGrid>
        <ChartCard
          className="col-span-12 lg:col-span-5"
          title="기상 요인과 환경 지수의 상관"
          subtitle={`Pearson r, n = ${N_ENV}(지역 ${SITES.length} × 연도 ${YEARS.length}) · 점선 = 유의 임계 ±${formatFixed(R_CRIT, 3)} · * p < 0.05 · 막대를 누르면 산점도 요인 변경`}
          legend={[
            { label: '유의(p < 0.05)', color: theme.accent },
            { label: '비유의', color: theme.textMuted },
          ]}
          height={320}
          source={`유의 요인은 ${sigList.map(c => `${c.label}(r ${f2(c.r)}, p ${formatPValue(c.p)})`).join('·')}뿐입니다.`}
        >
          <FactorBars factor={factor} onFactor={setFactor} height={320} />
        </ChartCard>
        <ChartCard
          className="col-span-12 lg:col-span-7"
          title={`${fLabel} × 환경 지수 · ${corrText(factor)}`}
          subtitle={`${regressionText(factor)} · ${N_ENV}개 환경 · 선택 연도 진하게 · 라벨 = 잔차 하위 ${low4.length}개`}
          actions={
            <Select
              label="요인"
              hideLabel
              options={FACTORS.map(f => ({ value: f.key, label: f.label }))}
              value={factor}
              onChange={v => setFactor(v as FactorKey)}
            />
          }
          legend={[
            { label: String(YEARS[0]), color: theme.categorical[0]!, shape: 'circle' },
            { label: String(YEARS[1]), color: theme.categorical[1]! },
            { label: fCorr.sig ? '최소제곱 회귀선' : '최소제곱 회귀선(비유의, 점선)', color: theme.text, shape: fCorr.sig ? 'line' : 'dashed' },
          ]}
          height={320}
          source={`상관은 인과가 아님 · 환경 지수에는 지역 주효과(토양·관리)가 포함 · 고온·저온 영향은 ${lowSites.length}개 지역에 몰려 있어 선형 r로는 유의하지 않음(고온 일수 r ${f2(CORR_BY_KEY.heat.r)}, 저온 일수 r ${f2(CORR_BY_KEY.cold.r)}).`}
        >
          <FactorScatter factor={factor} year={year} siteId={siteId} height={320} />
        </ChartCard>
      </PageGrid>

      {/* H 환경 요약 표 */}
      <Card
        title={allYears ? `환경 요약 · ${YEARS[0]}~${YEARS[1]} (${ENVS.length}개 환경)` : `환경 요약 · ${year}`}
        subtitle="환경 지수 내림차순 · 행을 누르면 지역 선택"
        actions={<Switch checked={allYears} onChange={setAllYears} label={`${YEARS.length}개 연도 모두`} />}
      >
        <EnvTable rows={tableRows} showYear={allYears} selected={e => e.site.id === siteId && e.year === year} onSelect={selectEnv} />
        <p className="mt-2 text-xs text-muted">
          평년 편차는 같은 재배기 날짜의 평년 합 대비(편차는 원값 기준이라 실측·평년을 각각 반올림해 빼면 1 차이 날 수 있음) · 등숙기 = 출수 후 1~{RIPEN_DAYS}일, 적온 {RIPEN_OPT_RANGE[0]}~
          {RIPEN_OPT_RANGE[1]} °C(추정) · 수확일 = 출수 후 일평균기온 누적 {n0(HARVEST_CUM)} °C·일 도달일 · 기상 값은 목업(가상 관측), 시드 {WX_SEED}
        </p>
      </Card>
    </div>
  )
}
