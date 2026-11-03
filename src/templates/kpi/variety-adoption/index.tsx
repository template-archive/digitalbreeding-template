import { useState } from 'react'
import { Info as InfoIcon } from 'lucide-react'
import type { TemplateMeta } from '@/gallery/types'
import {
  AlertList,
  Card,
  ChartCard,
  ConclusionBundle,
  ConclusionPanel,
  KpiRow,
  KpiTile,
  PageGrid,
  PageHeader,
  Segmented,
  Select,
  useMediaQuery,
  type AlertListItem,
} from '@/design-system'
import { useChartTheme } from '@/charts'
import { formatDelta, josa } from '@/lib/format'
import {
  AREA_CONFIRM,
  AREA_SERIES,
  AREA_YEARS,
  AS_OF,
  BYEOLHARANG,
  CENTRAL,
  CUR,
  GARAMSOL,
  KPI,
  NATIONAL,
  NEULSOLCHAN,
  P1,
  PLAN_YEAR,
  PREV,
  PROVINCE,
  PROV_SERIES,
  REPLANT_W,
  STD_LAG,
  SUPPLY_CRITICAL,
  SUPPLY_RATE,
  supplyStatus,
  SUPPLY_SHORT,
  SUPPLY_TOTAL,
  SURVEY,
  SURVEY_N,
  TARGET_2026,
  TARGET_CAUTION,
  TARGET_RATE,
  TARGET_SUM,
  VARIETIES,
  farmArea,
  firstFarmYear,
  main5FarmArea,
  seriesArea,
  regYearOf,
  stdFarmYear,
  targetStatus,
  totalArea,
} from './data'
import { AreaTrendChart } from './components/AreaTrendChart'
import { StageTimeline } from './components/StageTimeline'
import { StagePanels } from './components/StagePanels'
import { ProvinceChart, type ProvMode } from './components/ProvinceChart'
import { ReplaceChart } from './components/ReplaceChart'
import { TargetBullets } from './components/TargetBullets'
import { SurveyTable } from './components/SurveyTable'
import { SupplyTable } from './components/SupplyTable'
import { PanelSeverity, PanelTrend } from './components/PanelTrend'
import { ha, n, pc, seriesColor, sg } from './components/fmt'

export const meta: TemplateMeta = {
  slug: 'variety-adoption',
  category: 'kpi',
  title: '품종 보급 현황',
  description: '우리 품종이 국내 벼 재배 면적의 얼마를 차지하고 목표를 채웠는지, 내년 봄 보급종이 수요를 채우는지, 신품종이 종자 증식을 거쳐 언제 농가에 닿는지 봅니다.',
  tags: ['품종 보급', '보급종', '종자 증식', '재배 면적', '점유율', '수급', '벼'],
  organism: '벼',
  status: 'review',
  updatedAt: '2026-11-02',
}

/** 결론 묶음 안 KPI 줄: 1440 2×2 · 768 4칸 · 390 2열(ConclusionBundle 기본 격자는 390에서 1열이라 KpiRow로 감싼다) */
const TILE_COLS = { md: 4, lg: 2 }

/** 소수 1자리, .0이면 정수로(경보 문구용) */
const t1 = (v: number) => {
  const s = n(v, 1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

export default function VarietyAdoptionTemplate() {
  const theme = useChartTheme()
  const narrow = useMediaQuery('(max-width: 639px)')
  const [varietyId, setVarietyId] = useState(GARAMSOL.id)
  const [provMode, setProvMode] = useState<ProvMode>('all')
  const selected = VARIETIES.find(v => v.id === varietyId) ?? GARAMSOL

  const lagStd = STD_LAG
  const neulFarm = firstFarmYear(NEULSOLCHAN)!
  const byeolFarm = firstFarmYear(BYEOLHARANG)!
  const shortNames = SUPPLY_SHORT.map(r => r.name)

  const alerts: AlertListItem[] = [
    ...SUPPLY_SHORT.map(r => ({
      id: `supply-${r.id}`,
      severity: supplyStatus(r.rate) as AlertListItem['severity'],
      title: `${r.name} ${PLAN_YEAR} 보급종 ${t1(-r.gap)} t 부족`,
      description: `공급 ${n(r.supply, 1)} t / 수요 예측 ${n(r.demand, 1)} t · 정식 신청(11~12월) 전 지역 배분 조정 필요`,
      value: `수급률 ${pc(r.rate, 1)}`,
    })),
    ...TARGET_2026.filter(r => r.rate < TARGET_CAUTION).map(r => ({
      id: `target-${r.v.id}`,
      severity: targetStatus(r.rate) as AlertListItem['severity'], // G 불릿과 같은 기준(< 90 경보)
      title: `${r.v.name} 보급 목표 달성률`,
      description: `${CUR} 재배 면적 ${ha(r.actual)} / 목표 ${ha(r.target)} ha`,
      value: pc(r.rate, 1),
    })),
  ]
  const infos = [
    `${NEULSOLCHAN.name} ${NEULSOLCHAN.regMonth} 등록 — 원원종 ${n(P1(NEULSOLCHAN, CUR), 3)} t 생산, 농가 공급 ${neulFarm}`,
    `${BYEOLHARANG.name} 사전 증식 착수 — 농가 공급 ${byeolFarm} 목표(표준 ${stdFarmYear(BYEOLHARANG)})`,
  ]

  // 결론 패널 태그: 공급 수급률·보급 목표 달성률 중 더 나쁜 심각도(KPI 타일과 같은 기준)
  const sevs = [supplyStatus(SUPPLY_TOTAL.rate), targetStatus(TARGET_RATE)]
  const worst = sevs.includes('critical') ? 'critical' : sevs.includes('warning') ? 'warning' : 'ok'
  const trendYears = AREA_YEARS.filter(y => y <= CUR)
  // 옆 경보 카드 높이에 맞춰 카드 아래 빈 띠를 없앤다. 390은 카드가 쌓여 그대로
  const areaH = narrow ? 340 : 436

  return (
    <div className="flex flex-col gap-4">
      {/* 머리(공통 PageHeader): 범위·소속 회색 줄 → 제목 + 기준일 → 데이터 한 문장 */}
      <PageHeader
        context={['벼 · 자식성', '중부 평야지 벼 육종 프로그램']}
        title={meta.title}
        scope={`등록 ${VARIETIES.filter(v => v.reg).length}품종 + 출원 1품종(사전 증식) · ${CUR} 재배 면적은 추정(보급종 공급량 기반 + 시군 보고, 확정 ${AREA_CONFIRM}) · 품종명은 가상`}
        asOf={AS_OF}
        details={
          <>
            재배 면적 = 보급종 공급 면적 + 0.6 × 전년 공급 면적 + 0.3 × 전전년 공급 면적(자가채종 이월) + 시범 재배. 공급 면적 = 보급종 공급량 ÷ 파종량 4 kg/10a. {CUR}년 {ha(KPI.area)} ha는 시범 {ha(KPI.pilot)} ha를 포함하고,{' '}
            {AREA_SERIES.slice(0, 2)
              .map(s => `${s.label} ${ha(seriesArea(s.members, CUR))}`)
              .join(' · ')}{' '}
            ha 등 {VARIETIES.filter(v => v.reg).length}품종 중 {VARIETIES.filter(v => farmArea(v, CUR) > 0).length}품종이 재배됩니다.
          </>
        }
      />

      {/* A. 결론 묶음: 재배 면적 판단 + 면적 추세, 받치는 지표 4개. 재재배 의향은 H 평가 카드, 등록 → 첫 농가는 C 타임라인 카드에 있다 */}
      <ConclusionBundle
        panel={
          <ConclusionPanel
            label={
              <>
                {CUR} 추정 · 전년 대비 {formatDelta(KPI.areaDelta, { digits: 0, unit: ' ha' })}({sg(KPI.areaDeltaPct, 1)}%) <PanelSeverity severity={worst} />
              </>
            }
            valueLabel={`프로그램 품종 재배 면적 · 시범 ${ha(KPI.pilot)} ha 포함`}
            value={ha(KPI.area)}
            unit="ha"
            statement={
              <>
                국내 벼 면적의 <b>{pc(KPI.share, 2)}</b>(전년 {pc(KPI.sharePrev, 2)})이고 보급 목표의 {pc(TARGET_RATE, 1)}를 채웠습니다. {PLAN_YEAR}년 봄 보급종 <b>{n(SUPPLY_TOTAL.supply, 0)} t</b>은 수요 예측의 <b>{pc(SUPPLY_TOTAL.rate, 1)}</b>로 {shortNames.join('·')}이 부족합니다. 신품종은 등록 후 <b>{lagStd}년</b> 뒤 농가에 닿고 {josa(BYEOLHARANG.name, '는은')} 사전 증식으로 <b>{byeolFarm}</b>(표준 {stdFarmYear(BYEOLHARANG)})을 목표로 합니다.
              </>
            }
            aside={
              <PanelTrend
                title="재배 면적 ha(첫 공급 뒤 증가)"
                points={trendYears.map(y => ({ label: String(y), value: totalArea(y) }))}
                format={ha}
                ariaLabel={`프로그램 품종 재배 면적: ${trendYears[0]}년 ${ha(totalArea(trendYears[0]!))} ha에서 ${CUR}년 ${ha(KPI.area)} ha, 전년 ${ha(KPI.areaPrev)} ha.`}
              />
            }
          />
        }
      >
        <KpiRow cols={TILE_COLS} className="col-span-full">
          <KpiTile
            size="compact"
            label="국내 벼 면적 점유율"
            value={KPI.share}
            digits={2}
            unit="%"
            delta={KPI.shareDelta}
            deltaUnit="%p"
            deltaDigits={2}
            deltaLabel="전년 대비"
            sub={<span className="break-keep">{`국내 ${ha(NATIONAL[CUR]!)} ha(추정) · ${PREV} ${pc(KPI.sharePrev, 2)}`}</span>}
            period={String(CUR)}
            info="프로그램 품종 재배 면적 ÷ 국내 벼 재배 면적 × 100. 국내 면적 2022~2025 통계청(2025 잠정), 2026 추정."
          />
          <KpiTile
            size="compact"
            label="보급 목표 달성률"
            value={TARGET_RATE}
            digits={1}
            unit="%"
            sub={<span className="break-keep">{`보급 ${TARGET_2026.length}품종 ${ha(main5FarmArea(CUR))} / ${ha(TARGET_SUM)} ha`}</span>}
            achievement={TARGET_RATE}
            achievementDigits={1}
            targetLabel={`목표 ${ha(TARGET_SUM)} ha`}
            severity={targetStatus(TARGET_RATE)}
            period={String(CUR)}
            info={`품종별 재배 면적 ÷ 보급 목표. 합계는 보급 ${TARGET_2026.length}품종만(시범 제외). ${TARGET_CAUTION}% 미만 경보, ${TARGET_CAUTION}~100% 주의.`}
          />
          <KpiTile
            size="compact"
            label={`${GARAMSOL.name} 대체율`}
            value={KPI.replace}
            digits={1}
            unit="%"
            delta={KPI.replaceDelta}
            deltaUnit="%p"
            deltaDigits={1}
            deltaLabel="전년 대비"
            sub="중부 3도, 구 주력 품종 대비"
            period={String(CUR)}
            info={`중부 3도(${CENTRAL.join('·')})에서 ${GARAMSOL.name} 면적 ÷ (${GARAMSOL.name} + 구 주력 중만생 품종 면적) × 100.`}
          />
          <KpiTile
            size="compact"
            label={`${PLAN_YEAR} 보급종 공급 계획`}
            value={SUPPLY_TOTAL.supply}
            digits={0}
            unit="t"
            sub={<span className="break-keep">{`${ha(SUPPLY_TOTAL.supplyHa)} ha분 · 부족 ${SUPPLY_SHORT.length}품종`}</span>}
            achievement={SUPPLY_TOTAL.rate}
            achievementDigits={1}
            achievementLabel="수급률"
            targetLabel={`수요 예측 ${n(SUPPLY_TOTAL.demand)} t`}
            severity={supplyStatus(SUPPLY_TOTAL.rate)}
            period={`${PLAN_YEAR} 봄`}
            info={`공급 = ${CUR}년산 보급종 생산 × ${n(SUPPLY_RATE, 2)}(정선·검사 후). 수요 예측 = ${CUR} 신청 실적 + 지역 협의(추정).`}
          />
        </KpiRow>
      </ConclusionBundle>

      {/* B + J */}
      <PageGrid>
        <ChartCard
          className="col-span-12 lg:col-span-8"
          title="프로그램 품종 재배 면적 추이"
          subtitle={`${AREA_YEARS[0]}~${CUR} 실적(${CUR} 추정) · ${PLAN_YEAR} 전망은 빗금(계획 공급 기준) · 막대 위 = 합계 · 그해 국내 면적 대비 점유율`}
          height={areaH}
          legend={[
            ...AREA_SERIES.map((s, i) => ({ label: s.label, color: seriesColor(theme, i, s.key === 'new') })),
            { label: `${PLAN_YEAR} 전망`, color: 'var(--color-text-muted)', shape: 'hatch' as const },
          ]}
          source={`${PLAN_YEAR} 점유율은 국내 면적 ${CUR} 유지 가정. 등록 직후 면적은 0이고 첫 농가 재배는 등록 ${STD_LAG}년 뒤(${GARAMSOL.name} ${GARAMSOL.reg} → ${firstFarmYear(GARAMSOL)}). ${GARAMSOL.reg! + 2}년 ${GARAMSOL.name} ${ha(GARAMSOL.pilot[GARAMSOL.reg! + 2] ?? 0)} ha는 시범 재배.`}
        >
          <AreaTrendChart height={areaH} narrow={narrow} />
        </ChartCard>
        <Card className="col-span-12 lg:col-span-4" title={`경보·주의 ${alerts.length}건`} subtitle={`${PLAN_YEAR} 공급 수급률 오름차순 → 목표 달성률`}>
          <AlertList items={alerts} ariaLabel="품종 보급 경보·주의 목록" density="compact" chevron={false} />
          <ul className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3" aria-label="보급 정보">
            {infos.map(t => (
              <li key={t} className="flex items-start gap-1.5 text-xs text-text">
                <InfoIcon size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-info" />
                <span>
                  <span className="sr-only">정보: </span>
                  {t}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">수급률 &lt; {SUPPLY_CRITICAL}% 경보 · {SUPPLY_CRITICAL}~100% 주의 · 목표 달성률 &lt; {TARGET_CAUTION}% 경보</p>
        </Card>
      </PageGrid>

      {/* G + E */}
      <PageGrid>
        <Card className="col-span-12 flex flex-col lg:col-span-4" title={`보급 목표 달성(${CUR})`} subtitle={`보급 ${TARGET_2026.length}품종 · 실적 막대 + 목표 눈금`}>
          <TargetBullets />
        </Card>
        <ChartCard
          className="col-span-12 lg:col-span-8"
          title="도별 보급률"
          subtitle={`${CUR} 도 안 프로그램 품종 면적 ÷ 도 벼 재배 면적(추정) · 막대 끝 = 보급률 · 품종 면적 / 도 면적`}
          height={340}
          actions={
            <Segmented
              size="sm"
              ariaLabel="도별 보급률 보기 방식"
              options={[
                { value: 'all', label: '전체' },
                { value: 'variety', label: '품종별' },
              ]}
              value={provMode}
              onChange={v => setProvMode(v as ProvMode)}
            />
          }
          legend={
            provMode === 'variety'
              ? PROV_SERIES.map((s, i) => ({ label: s.label, color: seriesColor(theme, i, s.key === 'new') }))
              : [
                  { label: '중부 평야지(프로그램 지역)', color: theme.categorical[0]! },
                  { label: '그 밖의 도', color: theme.categorical[7]! },
                  { label: '보급 없음', color: theme.border },
                ]
          }
          source={`도 면적 ${CUR} = ${PREV} 도별 면적 × (${ha(NATIONAL[CUR]!)} / ${ha(NATIONAL[PREV]!)}) 균등 축소(추정). 도 안 면적 = Σ 품종 면적 × 품종별 도 배분 비율(추정). 합계 ${ha(PROVINCE.reduce((s, r) => s + r.progArea, 0))} / ${ha(PROVINCE.reduce((s, r) => s + r.provArea, 0))} ha.`}
        >
          <ProvinceChart height={340} mode={provMode} />
        </ChartCard>
      </PageGrid>

      {/* I */}
      <Card
        title={`${PLAN_YEAR} 보급종 공급 계획`}
        subtitle={`${CUR}년산 보급종 → ${PLAN_YEAR} 봄 공급 · 합계 ${n(SUPPLY_TOTAL.supply, 1)} t(${ha(SUPPLY_TOTAL.supplyHa)} ha분) / 수요 ${n(SUPPLY_TOTAL.demand)} t = 수급률 ${pc(SUPPLY_TOTAL.rate, 1)}`}
      >
        <SupplyTable narrow={narrow} />
      </Card>

      {/* C */}
      <Card
        title="종자 증식 단계 타임라인"
        subtitle={`기본식물 → 원원종 → 원종 → 보급종 생산 → 농가 재배(단계마다 1작기) · 품종 ${VARIETIES.length}${narrow ? `개, ${CUR}년 진행 단계` : `행 × 2019~2030 · 칸에 마우스를 올리면 생산량·채종 면적`}`}
      >
        {/* 등록 → 첫 농가 재배(KPI 줄에서 옮김): 표준 일정과 사전 증식 단축 */}
        <p className="mb-3 text-[13px] leading-relaxed text-text tabular-nums">
          등록 → 첫 농가 재배 표준 <b>{lagStd}년</b> · {NEULSOLCHAN.name} {regYearOf(NEULSOLCHAN)} 등록 → {neulFarm} 농가 · <b>{BYEOLHARANG.name}</b> 사전 증식 → <b>{byeolFarm}</b>(표준 {stdFarmYear(BYEOLHARANG)},{' '}
          {stdFarmYear(BYEOLHARANG) - byeolFarm}년 단축)
        </p>
        <StageTimeline narrow={narrow} />
      </Card>

      {/* D + F */}
      <PageGrid>
        <Card
          className="col-span-12 lg:col-span-8"
          title="선택 품종 단계별 생산·공급량"
          subtitle={`원원종 · 원종 · 보급종(t), 2019~${PLAN_YEAR} · 각 패널 y축 0부터`}
          actions={
            <Select
              label="품종"
              options={VARIETIES.map(v => ({ value: v.id, label: `${v.name}(${v.reg ? v.reg : '출원'})` }))}
              value={varietyId}
              onChange={setVarietyId}
            />
          }
        >
          <StagePanels v={selected} height={narrow ? 200 : 296} />
        </Card>
        <ChartCard
          className="col-span-12 lg:col-span-4"
          title={`${GARAMSOL.name} 대체율`}
          subtitle={`${GARAMSOL.name} / (${GARAMSOL.name} + 구 주력 중만생 품종), ${CENTRAL.join("·")} · 위 = 대체율(%), 아래 = 중부 3도 면적(ha)`}
          height={268}
          legend={[
            { label: '대체율', color: theme.categorical[0]!, shape: 'line' },
            { label: `${GARAMSOL.name} 면적`, color: theme.categorical[0]! },
            { label: '구 주력 품종 면적', color: theme.categorical[7]! },
          ]}
          source={`구 주력 품종은 외부 육성 중만생 품종(이름 미표기, 가상). ${GARAMSOL.name} 중부 3도 배분 비율 ${n(CENTRAL.reduce((s, p) => s + (GARAMSOL.share[p] ?? 0), 0), 2)}.`}
        >
          <ReplaceChart height={268} />
        </ChartCard>
      </PageGrid>

      {/* H */}
      <Card title="농가·RPC 평가" subtitle={`${SURVEY.meta.crop}년산 · ${SURVEY.meta.surveyedAt} 조사 · 5점 척도 평균 ± 95% 신뢰구간(추정)`}>
        {/* 농가 재재배 의향(KPI 줄에서 옮김): 응답 수 가중 평균 */}
        <p className="mb-3 text-[13px] text-text tabular-nums">
          농가 재재배 의향 <b>{pc(REPLANT_W, 1)}</b>
          <span className="text-muted">
            {' '}
            · {SURVEY.rows.length}품종 · n {SURVEY_N} · 응답 수 가중(&ldquo;내년에도 이 품종을 심겠다&rdquo; 응답 비율, 가상 설문)
          </span>
        </p>
        <SurveyTable />
        <p className="mt-2 text-xs text-muted">
          {josa(SURVEY.meta.pending, '는은')} {CUR} 첫 공급, {SURVEY.meta.nextSurvey} 조사 예정. RPC = 미곡종합처리장 수매 담당 평가, 10곳 미만은 &lsquo;참고&rsquo;(신뢰구간 표시 안 함).
        </p>
      </Card>
    </div>
  )
}

