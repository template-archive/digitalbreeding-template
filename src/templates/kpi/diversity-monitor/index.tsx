import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { TemplateMeta } from '@/gallery/types'
import {
  AlertList,
  Card,
  ChartCard,
  ConclusionBundle,
  ConclusionPanel,
  DataTable,
  EmptyState,
  KinBadge,
  KpiRow,
  KpiTile,
  Legend,
  PageGrid,
  PageHeader,
  SeverityTag,
  Skeleton,
  Slider,
  useMediaQuery,
  type AlertListItem,
  type DataTableColumn,
} from '@/design-system'
import { useChartTheme } from '@/charts'
import { formatDelta } from '@/lib/format'
import {
  AS_OF,
  DF0,
  DFGEN_YR_CAUTION,
  DFGEN_MAX,
  DFGEN_YR_LIMIT,
  DG0,
  FIXED_CAUTION_N,
  FIXED_SINCE_GS,
  F_LINE_MEAN_2026,
  GS_START,
  F_LINE_RANGE_2026,
  FBAR_AXIS,
  FIXED_WATCH_START,
  GROUPS,
  G_MEAN_2026,
  HE_AXIS,
  HE_HORIZON_YEARS,
  H_REF,
  KIN_2026,
  L_SC,
  M,
  MARKERS,
  NE_WATCH_YEARS,
  N_TRAIN_2026,
  OCS_B,
  OCS_K,
  OCS_RANGE,
  RATIO,
  TH,
  YEARS,
  YEAR_ROWS,
  dFgen,
  dFyr,
  dfyStatus,
  fixStatus,
  neStatus,
  FBAR,
  L,
  NE,
  he,
  heGroup,
  neCi,
  ocsGain,
  scenarios,
  type LimitBadge,
  type Scenario,
  type YearRow,
} from './data'
import { STATUS_LABEL, n, pct, sg } from './components/fmt'
import { FbarChart, HeChart, InbreedingChart, MarkerChart, NeChart } from './components/TrendCharts'
import { FrontierChart, GroupHeChart } from './components/ScenarioCharts'
import { PanelSeverity, PanelTrend } from './components/PanelTrend'

export const meta: TemplateMeta = {
  slug: 'diversity-monitor',
  category: 'kpi',
  title: '유전 다양성 모니터',
  description: '부모 재순환 집단의 유효 집단 크기(Ne)·근교 증가율(ΔF)·기대 이형접합도(He)가 경보 기준 안에 있는지, GS 도입 뒤 손실이 왜 빨라졌는지, 최적 기여 선발(OCS)로 얼마를 지킬 수 있는지 봅니다.',
  tags: ['유전 다양성', '유효 집단 크기', 'Ne', '근교 증가율', '공조계수', '기대 이형접합도', 'OCS', '벼'],
  organism: '벼',
  status: 'review',
  updatedAt: '2026-11-02',
}

const Y = 2026 as const
const P = 2025 as const

function readPreviewState(): 'loading' | 'empty' | null {
  if (typeof location === 'undefined') return null
  const s = new URLSearchParams(location.search).get('state')
  return s === 'loading' || s === 'empty' ? s : null
}

/** 경보 목록에서 해당 영역으로 스크롤·포커스 */
function focusSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  el.focus({ preventScroll: true })
}

/** 스크롤 대상 래퍼(포커스 가능) */
function Anchor({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <div id={id} tabIndex={-1} className={`min-w-0 scroll-mt-4 rounded-lg outline-offset-2 [&>section]:h-full ${className ?? ''}`}>
      {children}
    </div>
  )
}

/** 결론 문장의 숫자는 모두 상수에서 만든다. OCS 문장은 슬라이더 기본값(OCS_RANGE.def) 기준 */
const Y0 = YEARS[0]
/** 희소 마커가 가장 많았던 연도 */
const RARE_PEAK = YEARS.reduce<(typeof YEARS)[number]>((a, b) => (MARKERS[b].rare > MARKERS[a].rare ? b : a), YEARS[0])
const OCS_DEF_ROW = scenarios(OCS_RANGE.def)[2]!

/** 결론 묶음 안 KPI 줄: 1440 2×2 · 768 4칸 · 390 2열(ConclusionBundle 기본 격자는 390에서 1열이라 KpiRow로 감싼다) */
const TILE_COLS = { md: 4, lg: 2 }

const LIMIT_SEVERITY: Record<LimitBadge, 'ok' | 'warning' | 'critical'> = { 충족: 'ok', 주의: 'warning', 초과: 'critical' }

const SYMBOL: Record<Scenario['key'], string> = { trunc: '●', expand: '■', ocs: '◆' }

const SCENARIO_COLUMNS: DataTableColumn<Scenario>[] = [
  {
    key: 'label',
    header: '시나리오',
    sortable: false,
    format: (_v, r) => (
      <span className="flex flex-col">
        <span className="font-semibold text-text">
          <span aria-hidden="true" className={r.key === 'ocs' ? 'text-accent' : 'text-muted'}>
            {SYMBOL[r.key]}
          </span>{' '}
          {r.label}
        </span>
        <span className="text-xs text-muted">{r.detail}</span>
      </span>
    ),
  },
  { key: 'dF', header: '세대당 ΔF', align: 'right', sortable: false, format: (_v, r) => pct(r.dF, 2) },
  { key: 'ne', header: 'Ne', align: 'right', sortable: false, format: (_v, r) => n(r.ne) },
  { key: 'dFyr', header: '연간 ΔF', align: 'right', sortable: false, format: (_v, r) => `${pct(r.dFyr, 2)}/년` },
  {
    key: 'dG',
    header: 'ΔG (kg/10a/년)',
    align: 'right',
    sortable: false,
    format: (_v, r) => (
      <span className="whitespace-nowrap">
        <b className="text-text">{n(r.dG, 1)}</b> <span className="text-muted">({n(r.dGpct, 2)}%/년)</span>
      </span>
    ),
  },
  { key: 'dGchange', header: 'ΔG 변화', align: 'right', sortable: false, format: (_v, r) => (r.dGchange === null ? <span className="text-muted">기준</span> : `${sg(r.dGchange * 100, 1)}%`) },
  { key: 'he2036', header: `${Y + HE_HORIZON_YEARS} He(${HE_HORIZON_YEARS}년)`, align: 'right', sortable: false, format: (_v, r) => n(r.he2036, 3) },
  { key: 'heLoss', header: 'He 손실', align: 'right', sortable: false, format: (_v, r) => `${sg(-r.heLoss * 100, 1)}%` },
  { key: 'badge', header: '연간 상한', sortable: false, format: (_v, r) => <SeverityTag severity={LIMIT_SEVERITY[r.badge]} label={r.badge} /> },
]

/** 390px: 결론 열(연간 상한 판정)이 스크롤 끝에 숨지 않게 시나리오 → 판정 → 연간 ΔF → ΔG만 */
const SCENARIO_COLUMNS_NARROW = (['label', 'badge', 'dFyr', 'dG'] as const).map(k => SCENARIO_COLUMNS.find(c => c.key === k)!)

const YEAR_COLUMNS: DataTableColumn<YearRow>[] = [
  { key: 'year', header: '연도', format: (_v, r) => <span className="font-semibold text-text">{r.year === Y ? `${r.year}(잠정)` : r.year}</span> },
  { key: 'L', header: 'L(년)', align: 'right', format: (_v, r) => n(r.L, 1) },
  { key: 'ne', header: 'Ne (95% 구간)', align: 'right', format: (_v, r) => <span className="whitespace-nowrap">{r.ne} <span className="text-muted">({r.ci[0]}~{r.ci[1]})</span></span> },
  { key: 'dFgen', header: 'ΔF세대 %', align: 'right', format: (_v, r) => n(r.dFgen * 100, 2) },
  { key: 'dFyr', header: 'ΔF연 %', align: 'right', format: (_v, r) => n(r.dFyr * 100, 2) },
  { key: 'fbar', header: 'f̄', align: 'right', format: (_v, r) => n(r.fbar, 3) },
  { key: 'he', header: 'He', align: 'right', format: (_v, r) => n(r.he, 3) },
  { key: 'fixed', header: '고정 마커', align: 'right' },
  { key: 'rare', header: '희소 마커', align: 'right' },
  {
    key: 'status',
    header: '상태',
    sortable: false,
    format: (_v, r) =>
      r.status === 'ok' ? (
        <SeverityTag severity="ok" label="정상" />
      ) : (
        <span className="flex flex-wrap items-center gap-1">
          {(['critical', 'warning'] as const).map(s => {
            const f = r.flags.filter(x => x.status === s)
            return f.length ? (
              <SeverityTag key={s} severity={s} label={`${STATUS_LABEL[s]}(${f.map(x => x.label).join(', ')})`} />
            ) : null
          })}
        </span>
      ),
  },
]

/** 390px: 결론 열(상태)을 연도 바로 뒤로 당기고 보조 열(L·세대당 ΔF·f̄·희소 마커)은 뺀다 */
const YEAR_COLUMNS_NARROW = (['year', 'status', 'ne', 'dFyr', 'he', 'fixed'] as const).map(k => YEAR_COLUMNS.find(c => c.key === k)!)

export default function DiversityMonitorTemplate() {
  const preview = useMemo(readPreviewState, [])
  const [loading, setLoading] = useState(true)
  const [ocs, setOcs] = useState(OCS_RANGE.def)
  const theme = useChartTheme()
  const narrow = useMediaQuery('(max-width: 639px)')
  const c0 = theme.categorical[0]!
  const c3 = theme.categorical[3] ?? theme.categorical[1]!
  const c4 = theme.categorical[4] ?? theme.categorical[1]!

  useEffect(() => {
    if (preview === 'loading') return
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [preview])

  const sc = useMemo(() => scenarios(ocs), [ocs])
  const ocsRow = sc[2]!

  // A. 머리(공통 PageHeader: 범위·소속 회색 줄 → 제목 + 기준일 → 데이터 한 문장)
  const header = (
    <PageHeader
      context={['벼 · 자식성', '중부 평야지 벼 육종 프로그램']}
      title={meta.title}
      scope={`부모 재순환 집단(부모 선발 후보) · 6K SNP 칩 ${n(M)} SNP · VanRaden 유전체 관계 행렬(GRM) · ${GS_START} 유전체 선발(GS) 도입`}
      asOf={`${AS_OF} · ${Y}은 진행 중(잠정)`}
      details={
        <>
          근교 증가율(ΔF)은 부모 간 평균 공조계수(f̄)의 세대당 증가율과 같은 뜻입니다. 자식성 벼는 부모 계통 자체가 근교계(F ≈ 1)라 집단의 근교 진행을 f̄로 봅니다. 연간 ΔF = 1 − (1 − 세대당 ΔF)^(1/L)이고, 상한 {pct(TH.dFyrMax, 2)}/년은 25년 동안 He 손실 10% 이내에 해당합니다. 세대당 상한 {pct(DFGEN_MAX, 1)}/세대는 Ne {TH.neMin}과 같습니다.
        </>
      }
    />
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <span className="sr-only">유전 다양성 지표를 불러오는 중입니다</span>
        <ConclusionBundle panel={<Skeleton height={300} />}>
          <KpiRow loading count={4} cols={TILE_COLS} skeletonHeight={144} className="col-span-full" />
        </ConclusionBundle>
        <PageGrid>
          <Skeleton className="col-span-12 lg:col-span-4" height={380} />
          <Skeleton className="col-span-12 lg:col-span-8" height={380} />
        </PageGrid>
      </div>
    )
  }

  if (preview === 'empty') {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState title="부모 후보 유전형 자료가 없습니다" description="부모 선발 후보 집단의 SNP 유전형을 분석하고 GRM을 계산하면 다양성 지표가 표시됩니다." />
      </div>
    )
  }

  const alerts: AlertListItem[] = [
    {
      id: 'dfyr',
      severity: 'critical',
      title: '연간 근교 증가율이 상한을 넘었습니다',
      description: `세대당 ${pct(dFgen(Y), 2)}는 상한 ${pct(DFGEN_MAX, 1)} 안이지만 세대 간격 ${n(L[Y], 1)}년으로 연간 ${pct(dFyr(Y), 2)}/년(상한 ${pct(TH.dFyrMax, 2)}/년, L ${n(L[Y], 1)}년에서 세대당 ${pct(DFGEN_YR_LIMIT, 2)}에 해당). ${P} ${pct(dFyr(P), 2)}/년(${STATUS_LABEL[dfyStatus(P)]})에 이어 상승`,
      value: `${pct(dFyr(Y), 2)}/년`,
      onClick: () => focusSection('dm-inbreeding'),
      actionLabel: '— 근교 증가율 차트로 이동',
    },
    {
      id: 'ne',
      severity: 'warning',
      title: '유효 집단 크기(Ne)가 주의 구간입니다',
      description: `Ne ${NE[Y]}(95% 구간 ${neCi(Y)[0]}~${neCi(Y)[1]}, 하한 ${TH.neMin} 포함). ${NE_WATCH_YEARS[0]}년부터 ${NE_WATCH_YEARS.length}년 연속 주의(${NE_WATCH_YEARS.map(y => NE[y]).join(' → ')})`,
      value: `Ne ${NE[Y]}`,
      onClick: () => focusSection('dm-ne'),
      actionLabel: '— Ne 추이 차트로 이동',
    },
    {
      id: 'he',
      severity: 'warning',
      title: '그룹 A·B의 기대 이형접합도가 하한 아래입니다',
      description: `A 중만생 다수성 ${n(heGroup(GROUPS[0].f), 3)}, B 조생 고품질 ${n(heGroup(GROUPS[1].f), 3)} < ${n(TH.heMin, 2)}. C 저항성 공여 ${n(heGroup(GROUPS[2].f), 3)} — C 그룹 부모 활용이 다양성 유지에 기여`,
      value: `He ${n(heGroup(GROUPS[1].f), 3)}~${n(heGroup(GROUPS[0].f), 3)}`,
      onClick: () => focusSection('dm-group-he'),
      actionLabel: '— 그룹별 He 차트로 이동',
    },
    {
      id: 'fixed',
      severity: 'warning',
      title: `고정 마커 비율이 ${pct(TH.fixedShare, 0)}를 넘었습니다`,
      description: `${n(M)} 중 ${MARKERS[Y].fixed}개(${pct(MARKERS[Y].fixed / M, 1)}), GS 도입 후(${GS_START - 1}→${Y}) ${sg(FIXED_SINCE_GS)}, ${Y} 신규 ${sg(MARKERS[Y].fixed - MARKERS[P].fixed)}`,
      value: `${MARKERS[Y].fixed}개`,
      onClick: () => focusSection('dm-markers'),
      actionLabel: '— 마커 차트로 이동',
    },
  ]

  const heLossRef = 1 - he(Y) / H_REF
  // 경보 카드 높이(항목 4건)와 맞춘다. 390은 차트 높이 240~280 규칙
  const neH = narrow ? 280 : 430

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* B. 결론 묶음: 대표 연간 ΔF 판단 + 추세, 받치는 지표 4개. 세대당 ΔF는 대표 값의 구성 요소라 패널 값 이름 줄로 합쳤다(KPI 5개 이하) */}
      <ConclusionBundle
        panel={
          <ConclusionPanel
            label={
              <>
                {Y} · 전년 대비 {formatDelta((dFyr(Y) - dFyr(P)) * 100, { digits: 2, unit: '%p' })} <PanelSeverity severity={dfyStatus(Y)} />
              </>
            }
            valueLabel={`연간 근교 증가율(ΔF) · 세대당 ${pct(dFgen(Y), 2)}/세대(${formatDelta((dFgen(Y) - dFgen(P)) * 100, { digits: 2, unit: '%p' })})`}
            value={n(dFyr(Y) * 100, 2)}
            unit="%/년"
            statement={
              <>
                상한 {pct(TH.dFyrMax, 2)}/년을 넘었습니다. {Y0} 대비 세대당 {n(RATIO.gen, 1)}배에 세대 간격 단축({n(L[Y0], 1)}→{n(L[Y], 1)}년)까지 겹쳐 연간 <b>{n(RATIO.yr, 1)}배</b>가 됐습니다. 최적 기여 선발(OCS)로 세대당 ΔF를 {n(OCS_RANGE.def, 2)}%로 묶으면 연간 유전적 개량량(ΔG)을 <b>{n(-(OCS_DEF_ROW.dGchange ?? 0) * 100, 1)}%</b>만 줄이고 상한 안으로 돌아옵니다.
              </>
            }
            aside={
              <PanelTrend
                title="연간 ΔF %/년 · 흐린 막대 GS 도입 전 · 점선 상한"
                points={YEARS.map(y => ({ label: String(y), value: dFyr(y) * 100, dim: y < GS_START }))}
                refs={[{ value: TH.dFyrMax * 100, label: `상한 ${n(TH.dFyrMax * 100, 2)}` }]}
                format={v => n(v, 2)}
                ariaLabel={`연간 근교 증가율: ${Y0}년 ${pct(dFyr(Y0), 2)}/년에서 ${Y}년 ${pct(dFyr(Y), 2)}/년으로 ${n(RATIO.yr, 1)}배, 상한 ${pct(TH.dFyrMax, 2)}/년 초과.`}
              />
            }
          />
        }
      >
        <KpiRow cols={TILE_COLS} className="col-span-full">
          <KpiTile
            size="compact"
            label="유효 집단 크기(Ne)"
            value={NE[Y]}
            sub={<span className="break-keep">95% 구간 {neCi(Y)[0]}~{neCi(Y)[1]} · 하한 {TH.neMin}</span>}
            delta={NE[Y] - NE[P]}
            deltaUnit=""
            deltaDigits={0}
            deltaLabel="전년 대비"
            better="up"
            severity={neStatus(Y)}
            period={String(Y)}
            info={`실현 유효 집단 크기 Ne = 1 / (2 · 세대당 ΔF). 경보 < ${TH.neMin}, 주의 < ${TH.neCaution}(프로그램 내부 기준).`}
          />
          <KpiTile
            size="compact"
            label="평균 공조계수(f̄)"
            value={n(FBAR[Y], 3)}
            sub={<span className="break-keep">부모 후보 {KIN_2026.lines}계통 · G {n(G_MEAN_2026, 2)}(2f 척도)</span>}
            delta={FBAR[Y] - FBAR[P]}
            deltaUnit=""
            deltaDigits={3}
            deltaLabel="전년 대비"
            better="down"
            period={String(Y)}
            info={`부모 후보 간 비대각 공조계수 평균(f = G/2, VanRaden GRM, 기준 빈도 = ${Y} 훈련 집단). 무작위 교배 F₁ 자손의 기대 근교계수와 같습니다.`}
          />
          <KpiTile
            size="compact"
            label="기대 이형접합도(He)"
            value={n(he(Y), 3)}
            sub={<span className="break-keep">훈련 집단 {n(H_REF, 2)} 대비 {sg(-heLossRef * 100, 1)}% · 하한 {n(TH.heMin, 2)}</span>}
            delta={he(Y) - he(P)}
            deltaUnit=""
            deltaDigits={3}
            deltaLabel="전년 대비"
            better="up"
            period={String(Y)}
            info={`He = ${n(H_REF, 2)} × (1 − f̄). ${n(H_REF, 2)}은 훈련 집단 평균 2pq(추정).`}
          />
          <KpiTile
            size="compact"
            label="고정 마커"
            value={MARKERS[Y].fixed}
            unit="개"
            sub={<span className="break-keep">{n(M)} 중 {pct(MARKERS[Y].fixed / M, 1)} · GS 이후 {sg(FIXED_SINCE_GS)}</span>}
            delta={MARKERS[Y].fixed - MARKERS[P].fixed}
            deltaUnit="개"
            deltaDigits={0}
            deltaLabel="전년 대비"
            better="down"
            severity={fixStatus(Y)}
            period={String(Y)}
            info={`부모 후보 집단에서 MAF = 0인 SNP. 주의 ≥ ${pct(TH.fixedShare, 0)}(${n(FIXED_CAUTION_N)}개).`}
          />
        </KpiRow>
      </ConclusionBundle>

      {/* C + D */}
      <PageGrid>
        <Card className="col-span-12 lg:col-span-4" title={`경보·주의 ${alerts.length}건`} subtitle={`${Y} 부모 후보 집단 · 항목을 누르면 해당 차트로 이동`}>
          <AlertList items={alerts} ariaLabel={`${Y} 다양성 경보·주의 목록`} density="compact" />
          <ul className="mt-3 flex flex-col gap-0.5 border-t border-border pt-2 text-xs text-muted">
            <li>Ne 경보 &lt; {TH.neMin} · 주의 &lt; {TH.neCaution}</li>
            <li>연간 ΔF 경보 &gt; {pct(TH.dFyrMax, 2)}/년 · 주의 &gt; {pct(TH.dFyrCaution, 2)}/년</li>
            <li>He 하한 {n(TH.heMin, 2)}</li>
            <li>고정 마커 주의 ≥ {pct(TH.fixedShare, 0)}</li>
          </ul>
        </Card>
        <Anchor id="dm-ne" className="col-span-12 lg:col-span-8">
          <ChartCard
            title="유효 집단 크기(Ne) 추이"
            subtitle="실현 Ne = 1/(2ΔF세대) · 띠 = 95% 구간(마커 부트스트랩)"
            height={neH}
            legend={[
              { label: 'Ne', color: c0, shape: 'line' },
              { label: '95% 구간', color: c0 },
              { label: '주의 구간', color: theme.warning, shape: 'circle' },
            ]}
            source={`GS 도입 후 선발 강화(상위 20% → 10%)와 GEBV 상위 가계 집중으로 Ne가 ${NE[Y0]} → ${NE[Y]}로 줄었습니다.`}
          >
            <NeChart height={neH} />
          </ChartCard>
        </Anchor>
      </PageGrid>

      {/* E + H */}
      <PageGrid>
        <Anchor id="dm-inbreeding" className="col-span-12 lg:col-span-6">
          <ChartCard
            title="근교 증가율(ΔF) — 세대당 vs 연간"
            subtitle="연간 = 1 − (1 − 세대당)^(1/L)"
            height={290}
            legend={[
              { label: '세대당 ΔF', color: c0, shape: 'line' },
              { label: '연간 ΔF', color: c3, shape: 'dashed' },
            ]}
            source={
              <span className="block rounded-md bg-surface-2 px-2 py-1.5 text-[13px] text-text tabular-nums">
                2019 → 2026: <b>연간 {n(RATIO.yr, 1)}배</b> ≈ 세대당 {n(RATIO.gen, 1)}배(선발 강화·가계 집중) × 세대 간격 단축 {n(RATIO.L, 1)}배({n(L[Y0], 1)} → {n(L[Y], 1)}년)
              </span>
            }
          >
            <InbreedingChart height={290} />
          </ChartCard>
        </Anchor>
        <Anchor id="dm-markers" className="col-span-12 lg:col-span-6">
          <ChartCard
            title="마커 고정·희소"
            subtitle={`부모 후보 집단 빈도 · 고정 MAF = 0, 희소(소실 위험) 0 < MAF < 0.05 · ${n(M)} SNP`}
            height={290}
            legend={[
              { label: '고정 마커', color: c0 },
              { label: '고정 주의 초과', color: theme.warning },
              { label: '희소 마커', color: c4, shape: 'line' },
            ]}
            source={`고정 마커 ${Y0} ${MARKERS[Y0].fixed} → ${Y} ${MARKERS[Y].fixed}개(${FIXED_WATCH_START}부터 주의 ${pct(TH.fixedShare, 0)} 초과), 희소 마커 ${MARKERS[Y0].rare} → ${MARKERS[Y].rare}개(최대 ${RARE_PEAK} ${MARKERS[RARE_PEAK].rare}).`}
          >
            <MarkerChart height={290} />
          </ChartCard>
        </Anchor>
      </PageGrid>

      {/* F① + F② + G */}
      <PageGrid>
        <ChartCard
          className="col-span-12 md:col-span-6 lg:col-span-4"
          title="평균 공조계수(f̄) 추이"
          subtitle={`부모 후보 간 비대각 평균 · 기준 빈도 = ${Y} 훈련 집단(${n(N_TRAIN_2026)}계통) · 다음 세대 F₁ 기대 근교계수와 같음`}
          height={240}
          source={`축 ${n(FBAR_AXIS[0], 2)}~${n(FBAR_AXIS[1], 2)}. 기준 빈도에 대한 상대값이라 절대 IBD 확률이 아니며 추이를 봅니다.`}
        >
          <FbarChart height={240} />
        </ChartCard>
        <ChartCard
          className="col-span-12 md:col-span-6 lg:col-span-4"
          title="기대 이형접합도(He) 추이"
          subtitle={`He = ${n(H_REF, 2)} × (1 − f̄) · 집단 전체`}
          height={240}
          source={`축 ${n(HE_AXIS[0], 2)}~${n(HE_AXIS[1], 2)}. ${Y0} ${n(he(Y0), 3)} → ${Y} ${n(he(Y), 3)}(${sg(((he(Y) - he(Y0)) / he(Y0)) * 100, 1)}%).`}
        >
          <HeChart height={240} />
        </ChartCard>
        <Anchor id="dm-group-he" className="col-span-12 lg:col-span-4">
          <ChartCard title={`그룹별 He(${Y})`} subtitle="그룹 내 평균 공조계수로 계산 · 유전적 관계 히트맵 그룹 평균과 같은 기준" height={240} source="x축 0~0.5(이대립 SNP 최대). 하한 미만 그룹은 주의.">
            <GroupHeChart height={240} />
          </ChartCard>
        </Anchor>
      </PageGrid>

      {/* I + J: 시나리오 표를 12열로 내려 근연 요약 옆 빈 영역을 없앴다 */}
      <PageGrid>
        <Card className="col-span-12 flex flex-col lg:col-span-4" title={`부모 후보 근연 요약(${Y})`} subtitle={`부모 선발 후보 ${KIN_2026.lines}계통 · 근교계수(F)와 공조계수(f)`}>
          <div className="mb-3 rounded-md bg-surface-2 px-3 py-2">
            <div className="text-xs text-muted">평균 공조계수 f̄</div>
            <div className="text-2xl font-bold tabular-nums text-text">
              {n(FBAR[Y], 3)} <span className="text-sm font-medium text-muted">= 평균 G {n(G_MEAN_2026, 2)} ÷ 2</span>
            </div>
          </div>
          {/* 넓은 화면은 옆 시나리오 카드 높이까지 행을 고르게 늘린다(카드 안 빈 띠 없음) */}
          <div className="min-h-0 flex-1">
          <table className="h-full w-full text-sm tabular-nums">
            <caption className="sr-only">{Y} 부모 후보 근연 쌍·군집과 근교계수 요약</caption>
            <tbody className="divide-y divide-border">
              <tr>
                <th scope="row" className="py-2 text-left font-normal">
                  <KinBadge level="warn" /> <span className="ml-1 text-xs text-muted">f ≥ 0.375</span>
                </th>
                <td className="py-2 text-right font-semibold text-text">{KIN_2026.warn}쌍</td>
              </tr>
              <tr>
                <th scope="row" className="py-2 text-left font-normal">
                  <KinBadge level="caution" /> <span className="ml-1 text-xs text-muted">0.25 ≤ f &lt; 0.375</span>
                </th>
                <td className="py-2 text-right font-semibold text-text">{KIN_2026.caution}쌍</td>
              </tr>
              <tr>
                <th scope="row" className="py-2 text-left font-normal text-text">근연 군집</th>
                <td className="py-2 text-right font-semibold text-text">{KIN_2026.clusters}개</td>
              </tr>
              <tr>
                <th scope="row" className="py-2 text-left font-normal text-text">부모 계통 근교계수(F) 평균</th>
                <td className="py-2 text-right font-semibold text-text">
                  {n(F_LINE_MEAN_2026, 3)} <span className="text-xs font-normal text-muted">({n(F_LINE_RANGE_2026[0], 3)}~{n(F_LINE_RANGE_2026[1], 3)})</span>
                </td>
              </tr>
            </tbody>
          </table>
          </div>
          <p className="pt-3 text-xs text-muted">유전적 관계 히트맵(2026-10-22 GRM)과 같은 값. 자식성 근교계라 F ≈ 1은 정상이며 다양성은 f̄로 봅니다.</p>
        </Card>

        <Card
          className="col-span-12 lg:col-span-8"
          title="관리 조치 시나리오 — 다음 교배 주기(2027 1차)"
          subtitle={`세대 간격 L ${n(L_SC, 1)}년 고정 · 최적 기여 선발(OCS) 목표를 움직여 이득-다양성 균형을 비교`}
        >
          <Slider
            label="OCS 목표 세대당 ΔF"
            min={OCS_RANGE.min}
            max={OCS_RANGE.max}
            step={OCS_RANGE.step}
            value={ocs}
            onChange={setOcs}
            format={v => `${n(v, 2)}%`}
            ticks={[0.5, 0.75, 1]}
            pageStep={0.25}
            prominent
            valueText={v => {
              const o = scenarios(v)[2]!
              return `OCS 목표 세대당 ΔF ${n(v, 2)}%, Ne ${n(o.ne)}, ΔG ${n(o.dG, 1)} kg/10a/년`
            }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>
              OCS 결과: Ne <b className="text-text">{n(ocsRow.ne)}</b> · 연간 ΔF <b className="text-text">{pct(ocsRow.dFyr, 2)}/년</b> · ΔG <b className="text-text">{n(ocsRow.dG, 1)}</b> kg/10a/년({sg((ocsRow.dGchange ?? 0) * 100, 1)}%)
            </span>
            <SeverityTag severity={LIMIT_SEVERITY[ocsRow.badge]} label={`연간 상한 ${ocsRow.badge}`} />
          </div>
          <div className="mt-3 h-[250px] min-w-0">
            <FrontierChart height={250} scenarios={sc} />
          </div>
          <Legend
            className="mt-2"
            items={[
              { label: '현행 절단 선발', color: theme.text, shape: 'circle' },
              { label: '부모 수 확대(상위 15%)', color: theme.categorical[1]! },
              { label: 'OCS 선택값', color: theme.accent, shape: 'diamond' },
              { label: 'OCS 이득-다양성 경계', color: c0, shape: 'line' },
              { label: `Ne ${TH.neMin} 하한 ${pct(DFGEN_MAX, 2)}`, color: theme.negative, shape: 'line' },
              { label: `연간 상한 환산 ${pct(DFGEN_YR_LIMIT, 2)}`, color: theme.warning, shape: 'dashed' },
              { label: `충족 ~${n(DFGEN_YR_CAUTION * 100, 3)}%(≤ ${pct(TH.dFyrCaution, 2)}/년)`, color: 'color-mix(in oklab, var(--color-positive) 20%, var(--color-surface))' },
              { label: `주의 ${n(DFGEN_YR_CAUTION * 100, 3)}~${n(DFGEN_YR_LIMIT * 100, 3)}%(${pct(TH.dFyrCaution, 2)}~${pct(TH.dFyrMax, 2)}/년)`, color: 'color-mix(in oklab, var(--color-warning) 30%, var(--color-surface))' },
              { label: `초과 ${n(DFGEN_YR_LIMIT * 100, 3)}% 초과`, color: 'color-mix(in oklab, var(--color-negative) 20%, var(--color-surface))' },
            ]}
          />
        </Card>

        <Card className="col-span-12" title="시나리오 비교" subtitle={`OCS 목표 세대당 ΔF ${n(ocs, 2)}% · 세대 간격 L ${n(L_SC, 1)}년 고정 · ${HE_HORIZON_YEARS}년 뒤 He까지`}>
          <DataTable dense rows={sc} rowKey="key" stickyColumn="label" caption={`관리 조치 시나리오별 근교 증가율·Ne·ΔG·${HE_HORIZON_YEARS}년 뒤 He 비교`} columns={narrow ? SCENARIO_COLUMNS_NARROW : SCENARIO_COLUMNS} />
          <p className="mt-2 text-xs text-muted">
            OCS 경계는 단순 모형(추정): ΔG = {n(OCS_K, 2)} × {n(DG0, 1)} × (ΔF/{n(DF0 * 100, 2)})^{n(OCS_B, 1)}. 같은 ΔF({pct(sc[1]!.dF, 2)})에서 OCS ΔG는 {n(ocsGain(sc[1]!.dF), 1)}({sg((ocsGain(sc[1]!.dF) / DG0 - 1) * 100, 1)}%)으로 부모 수 확대({sg((sc[1]!.dGchange ?? 0) * 100, 1)}%)보다 낫습니다. 현행 ΔG {n(DG0, 1)} kg/10a/년은 프로그램 개요 {Y} 값과 같습니다.
          </p>
        </Card>
      </PageGrid>

      {/* K. 연도별 표 */}
      <Card title="연도별 다양성 지표" subtitle={`부모 선발 후보 집단 · ${Y0}~${Y} · 상태 = 항목별 상태 중 가장 심한 것 · 그룹 He 판정은 ${Y}만`}>
        <DataTable
          dense
          rows={[...YEAR_ROWS].reverse()}
          rowKey="year"
          stickyColumn="year"
          caption="연도별 세대 간격·유효 집단 크기·근교 증가율·평균 공조계수·기대 이형접합도·마커 수와 상태"
          columns={narrow ? YEAR_COLUMNS_NARROW : YEAR_COLUMNS}
        />
        <p className="mt-2 text-xs text-muted">
          {Y0}~{GS_START - 1} 부모 후보는 보관 DNA로 같은 기준 빈도에 대해 소급 계산했습니다. 기준 TH: Ne {TH.neMin}/{TH.neCaution}, 연간 ΔF {pct(TH.dFyrMax, 2)}/{pct(TH.dFyrCaution, 2)}, He {n(TH.heMin, 2)}, 고정 {pct(TH.fixedShare, 0)}.
        </p>
      </Card>
    </div>
  )
}
