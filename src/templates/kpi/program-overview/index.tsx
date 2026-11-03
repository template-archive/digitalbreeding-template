import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { TemplateMeta } from '@/gallery/types'
import { ProgramDataPreview } from '@/features/template-data/ProgramDataPreview'
import type { ProgramDataset } from '@/features/template-data/contract'
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
  Select,
  Skeleton,
  useMediaQuery,
  type BadgeTone,
  type DataTableColumn,
} from '@/design-system'
import { formatDelta, formatNumber } from '@/lib/format'
import {
  APPLICATIONS,
  APPS,
  APP_TARGET,
  AS_OF,
  GS_MODEL,
  GS_START,
  REALIZED_END_YEAR,
  REALIZED_RATIO,
  CV_FOLDS,
  CV_REPS,
  CV_ROUNDS,
  H2_SINGLE_REP,
  L,
  L_T,
  MET_FIRST_YEAR_SET,
  MET_INDEX,
  MET_TARGET,
  MU,
  PIPELINE,
  PROVISIONAL_YEAR,
  R,
  R_T,
  SEED,
  TRAIN_N,
  YEARS,
  accuracyLabel,
  achievements,
  appsForecastAch,
  appsPending,
  buildAlerts,
  metCohortPass,
  dG,
  dGTargetPct,
  dGpct,
  filedYear,
  rangeMeanPct,
  severity,
  traitAccuracy,
  yearsInRange,
  type Application,
  type AppStatus,
  type KpiKey,
  type Year,
} from './data'
import { AlertList } from './components/AlertList'
import { GainChart } from './components/GainChart'
import { ComponentsPanel } from './components/ComponentsPanel'
import { TraitAccuracyChart } from './components/TraitAccuracyChart'
import { PipelineChart } from './components/PipelineChart'
import { PanelSeverity, PanelTrend } from './components/PanelTrend'
import { ApplicationsChart } from './components/ApplicationsChart'

export const meta: TemplateMeta = {
  slug: 'program-overview',
  category: 'kpi',
  title: '육종 프로그램 KPI 개요',
  description: '올해 연간 유전적 개량량(ΔG)이 목표에 도달했는지, 미달이라면 어느 구성 요소와 파이프라인 단계 때문인지 한 화면에서 점검합니다.',
  tags: ['유전적 개량량', 'ΔG', '예측 정확도', '세대 간격', '파이프라인', '신품종', '벼'],
  organism: '벼',
  status: 'review',
  updatedAt: '2026-11-02',
}

type SectionKey = 'gain' | 'components' | 'traits' | 'pipeline' | 'apps'
const ALERT_TARGET: Record<KpiKey, SectionKey> = { dg: 'gain', r: 'components', l: 'components', apps: 'apps', met: 'pipeline' }

const n = (v: number, d: number) => formatNumber(v, { digits: d })
const yearOptions = YEARS.map(y => ({ value: String(y), label: y === PROVISIONAL_YEAR ? `${y}(잠정)` : String(y) }))

/** 결론 묶음 안 KPI 줄: 1440 2×2 · 768 4칸 · 390 2열(ConclusionBundle 기본 격자는 390에서 1열이라 KpiRow로 감싼다) */
const TILE_COLS = { md: 4, lg: 2 }

const STATUS_TONE: Record<AppStatus, BadgeTone> = { 등록: 'positive', '재배심사 중': 'info', '서류심사 중': 'neutral', 출원: 'neutral' }

const APP_COLUMNS: DataTableColumn<Application>[] = [
  // 날짜(ISO)·숫자 열은 오른쪽 정렬(numeric, 앱 화면 규칙 7.4)
  { key: 'filedAt', header: '출원일', width: 96, numeric: true },
  { key: 'name', header: '품종명(가칭)', format: v => <span className="font-semibold">{String(v)}</span> },
  // 390px: 결론 열 '상태'가 스크롤 끝에 숨지 않게 계통명·주요 특성·개발 기간을 뺀다(출원일 · 품종명 · 상태)
  { key: 'line', header: '계통명', hideBelow: 'sm', format: v => <span className="font-mono text-xs text-muted">{String(v)}</span> },
  { key: 'trait', header: '주요 특성', hideBelow: 'sm' },
  { key: 'devYears', header: '개발 기간', numeric: true, hideBelow: 'sm', format: (v, r) => <span title={`${r.crossYear}년 교배`}>{String(v)}년</span> },
  {
    key: 'status',
    header: '상태',
    format: (v, r) => (
      <Badge tone={STATUS_TONE[v as AppStatus]}>
        {String(v)}
        {r.regYear ? ` ${r.regYear}` : ''}
      </Badge>
    ),
  },
]

function readPreviewState(): 'loading' | 'empty' | 'error' | null {
  if (typeof location === 'undefined') return null
  const s = new URLSearchParams(location.search).get('state')
  return s === 'loading' || s === 'empty' || s === 'error' ? s : null
}

/** 경보 항목에서 이동해 올 수 있는 영역. 이동 시 잠시 강조한다. */
function Anchor({ id, flash, className, children, refs }: { id: SectionKey; flash: SectionKey | null; className: string; children: ReactNode; refs: React.MutableRefObject<Partial<Record<SectionKey, HTMLDivElement | null>>> }) {
  return (
    <div
      ref={el => {
        refs.current[id] = el
      }}
      id={`po-${id}`}
      tabIndex={-1}
      className={[className, 'scroll-mt-4 rounded-lg outline-none transition-shadow duration-500', flash === id ? 'select-ring' : ''].join(' ')}
    >
      {children}
    </div>
  )
}

export default function ProgramOverviewTemplate({ data }: { data?: ProgramDataset } = {}) {
  return data ? <ProgramDataPreview data={data} /> : <DemoTemplate />
}

function DemoTemplate() {
  const preview = useMemo(readPreviewState, [])
  const narrow = useMediaQuery('(max-width: 639px)')
  const [start, setStart] = useState<Year>(2022)
  const [end, setEnd] = useState<Year>(2026)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(preview === 'error')
  const [flash, setFlash] = useState<SectionKey | null>(null)
  const refs = useRef<Partial<Record<SectionKey, HTMLDivElement | null>>>({})

  useEffect(() => {
    if (preview === 'loading') return
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [preview])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 1600)
    return () => clearTimeout(t)
  }, [flash])

  const onStart = (v: string) => {
    const y = Number(v) as Year
    setStart(y)
    if (y > end) setEnd(y)
  }
  const onEnd = (v: string) => {
    const y = Number(v) as Year
    setEnd(y)
    if (y < start) setStart(y)
  }

  const goTo = useCallback((key: KpiKey) => {
    const s = ALERT_TARGET[key]
    const el = refs.current[s]
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    el.focus({ preventScroll: true })
    setFlash(s)
  }, [])

  const years = useMemo(() => yearsInRange(start, end), [start, end])
  const prev = (end > YEARS[0] ? end - 1 : null) as Year | null
  const ach = achievements(end)
  const alerts = useMemo(() => buildAlerts(end), [end])
  const traits = useMemo(() => traitAccuracy(end), [end])
  const apps = useMemo(
    () => APPLICATIONS.filter(a => filedYear(a) >= start && filedYear(a) <= end).sort((a, b) => b.filedAt.localeCompare(a.filedAt)),
    [start, end],
  )
  const empty = preview === 'empty'
  const prov = end === PROVISIONAL_YEAR
  const period = `${end}${prov ? ' 잠정' : ''}`
  const preGsMean = rangeMeanPct(2019, 2021)
  // 경보 카드 높이(항목 5건)와 맞춘다. 390은 차트 높이 240~280 규칙
  const gainH = narrow ? 280 : 380
  const rLabel = accuracyLabel(end)

  // A. 머리(공통 PageHeader: 범위·소속 회색 한 줄 → 제목 + 오른쪽 기준일·연도 필터 → 데이터 한 문장)
  const header = (
    <PageHeader
      context={['벼 · 쌀 수량(kg/10a)', '중부 평야지 벼 육종 프로그램']}
      title={meta.title}
      scope={`${YEARS[0]}~${GS_START - 1} 표현형 선발 → ${GS_START}년 유전체 선발(GS)·속성세대진전 도입 · KPI·경보는 종료 연도, 추세 차트는 선택 기간 기준`}
      asOf={`${AS_OF} · ${PROVISIONAL_YEAR}년은 잠정`}
      actions={
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="연도 범위">
          <Select label="시작 연도" options={yearOptions} value={String(start)} onChange={onStart} />
          <span aria-hidden="true" className="text-muted">
            –
          </span>
          <Select label="종료 연도" options={yearOptions} value={String(end)} onChange={onEnd} />
        </div>
      }
    />
  )

  if (failed) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState
          title="KPI 데이터를 불러오지 못했습니다"
          description="육종 정보 시스템 응답이 없습니다. 잠시 후 다시 시도하세요."
          action={<Button onClick={() => setFailed(false)}>다시 시도</Button>}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <span className="sr-only">KPI 데이터를 불러오는 중입니다</span>
        <ConclusionBundle panel={<Skeleton height={300} />}>
          <KpiRow loading count={4} cols={TILE_COLS} skeletonHeight={144} className="col-span-full" />
        </ConclusionBundle>
        <PageGrid>
          <Skeleton className="col-span-12 lg:col-span-4" height={360} />
          <Skeleton className="col-span-12 lg:col-span-8" height={360} />
          <Skeleton className="col-span-12" height={260} />
        </PageGrid>
      </div>
    )
  }

  if (empty) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState title="표시할 KPI 데이터가 없습니다" description="선택한 프로그램에 등록된 연도별 실적이 없습니다. 육종 정보 시스템에서 연차 실적을 먼저 입력하세요." />
      </div>
    )
  }

  // ---- KPI 값 ----
  const met = PIPELINE[end][MET_INDEX]
  const metCp = metCohortPass(end)
  const metY1 = MET_FIRST_YEAR_SET[end]
  const dgDelta = prev ? dGpct(end) - dGpct(prev) : null
  const rDelta = prev ? R[end] - R[prev] : null
  const lDelta = prev ? L[end] - L[prev] : null
  const appDelta = prev ? APPS[end] - APPS[prev] : null
  const metDelta = prev ? met - PIPELINE[prev][MET_INDEX] : null
  // 공통 KpiTile 변화량 옵션: null이면 '—'(비교 연도 없음)
  const dl = (v: number | null, digits: number, unit: string, better: 'up' | 'down' = 'up') =>
    ({ delta: v, deltaDigits: digits, deltaUnit: unit, deltaLabel: '전년 대비', better }) as const

  const gainRatio = end >= GS_START ? dGpct(end) / preGsMean : null
  // 패널 추세는 필터와 관계없이 처음 연도부터: GS 도입 전 대비 판단을 막대로 보이려고
  const trendYears = YEARS.filter(y => y <= end)

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* B. 결론 묶음: 대표 ΔG 판단 + 추세, 받치는 지표 4개 */}
      <ConclusionBundle
        panel={
          <ConclusionPanel
            label={
              <>
                {period} · {n(dG(end), 1)} kg/10a/년{dgDelta !== null && ` · 전년 대비 ${formatDelta(dgDelta, { digits: 2, unit: '%p' })}`} <PanelSeverity severity={severity(ach.dg)} />
              </>
            }
            valueLabel="연간 유전적 개량량(ΔG) · 수량 기준"
            value={n(dGpct(end), 2)}
            unit="%/년"
            statement={
              <>
                {end}년 목표 {n(dGTargetPct(end), 2)}%/년의 <b>{n(ach.dg, 1)}%</b>
                {ach.dg >= 100 ? '로 목표를 달성했습니다.' : '에 그쳤습니다.'}
                {gainRatio !== null && <> GS 도입 전(2019~2021 평균 {n(preGsMean, 2)}%/년)보다 {n(gainRatio, 1)}배(예측){end === REALIZED_END_YEAR ? ` · 실현 ${n(REALIZED_RATIO, 1)}배` : ''} 높습니다.</>}
                {alerts.length > 0 && <> 목표 미달 지표 {alerts.length}건.</>}
              </>
            }
            aside={
              <PanelTrend
                title="ΔG %/년 · 흐린 막대 GS 도입 전 · 점선 목표"
                points={trendYears.map(y => ({ label: String(y), value: dGpct(y), dim: y < GS_START }))}
                stepTarget={trendYears.map(y => dGTargetPct(y))}
                format={v => n(v, 2)}
                ariaLabel={`연도별 ΔG: ${trendYears[0]}년 ${n(dGpct(trendYears[0]), 2)}%/년에서 ${end}년 ${n(dGpct(end), 2)}%/년, ${end}년 목표 ${n(dGTargetPct(end), 2)}%/년.`}
              />
            }
          />
        }
      >
        <KpiRow cols={TILE_COLS} className="col-span-full">
          <KpiTile
            size="compact"
            plainLabel={`${rLabel}(r)`}
            label={`${rLabel}(r)`}
            value={n(R[end], 2)}
            sub={<span className="break-keep">{end >= GS_START ? `${GS_MODEL} · 훈련 집단 ${n(TRAIN_N[end] ?? 0, 0)}계통` : '표현형 선발 √h²'}</span>}
            period={period}
            {...dl(rDelta, 2, '', 'up')}
            targetLabel={`목표 ${n(R_T[end], 2)}`}
            achievementDigits={1}
            achievement={ach.r}
            severity={severity(ach.r)}
            info={end >= GS_START ? `corr(GEBV, y)/√h², ${GS_MODEL} ${CV_FOLDS}-fold × ${CV_ROUNDS}회 교차 검증 평균.` : `표현형 선발 정확도 √h²(초기 세대 단반복 수량 h²=${n(H2_SINGLE_REP, 2)}).`}
          />
          <KpiTile
            size="compact"
            plainLabel="세대 간격(L)"
            label="세대 간격(L)"
            value={n(L[end], 1)}
            unit="년"
            sub="낮을수록 좋음"
            period={period}
            {...dl(lDelta, 1, '년', 'down')}
            targetLabel={`목표 ${n(L_T[end], 1)}년`}
            achievementDigits={1}
            achievement={ach.l}
            severity={severity(ach.l)}
            info="부모 선발부터 다음 부모 선발까지의 육종 사이클 길이. 달성률 = 목표 / 실적."
          />
          <KpiTile
            size="compact"
            plainLabel="신품종 출원"
            label="신품종 출원"
            value={String(APPS[end])}
            unit="건"
            sub={prov ? `연중 누계(${AS_OF.slice(5).replace('-', '/')} 기준)` : '연간 품종보호 출원'}
            period={period}
            {...dl(appDelta, 0, '건', 'up')}
            targetLabel={`목표 ${APP_TARGET[end]}건`}
            achievementDigits={1}
            achievement={ach.apps}
            severity={severity(appsForecastAch(end))}
            info={
              appsPending(end) > 0
                ? `연중에는 연말 전망(실적 + 확정 예정)으로 등급을 정합니다. 전망 ${APPS[end] + appsPending(end)}/${APP_TARGET[end]}건 ${n(appsForecastAch(end), 1)}%.`
                : undefined
            }
          />
          <KpiTile
            size="compact"
            plainLabel="지역 적응 시험(MET) 완료"
            label={narrow ? 'MET 완료' : '지역 적응 시험(MET) 완료'}
            value={String(met)}
            unit="계통"
            sub={metCp ? `${metCp.aytYear} AYT ${metCp.ayt}계통 중` : '그해 시험을 마친 계통'}
            info={`그해 지역 적응 시험을 마친 세트(출원 후보 선정 대상).${metY1 !== undefined ? ` ${end} 포장에는 1년차 세트 ${metY1}계통이 함께 있어 포장 계통은 ${met + metY1}입니다.` : ''}`}
            period={period}
            {...dl(metDelta, 0, '계통', 'up')}
            targetLabel={`목표 ${MET_TARGET[end]}계통`}
            achievementDigits={1}
            achievement={ach.met}
            severity={severity(ach.met)}
          />
        </KpiRow>
      </ConclusionBundle>

      <PageGrid>
        {/* C. 경보 */}
        <div className="col-span-12 lg:col-span-4">
          <AlertList year={end} items={alerts} onSelect={goTo} />
        </div>

        {/* D. 연도별 ΔG */}
        <Anchor id="gain" flash={flash} refs={refs} className="col-span-12 lg:col-span-8">
          <ChartCard
            className="h-full"
            title="연도별 연간 유전적 개량량(ΔG)"
            subtitle={`${start}~${end} · %/년(수량 기준, μ=${MU} kg/10a)${start < GS_START ? ' · 흐린 막대는 GS 도입 전' : ''}`}
            source="ΔG = i · r · σA / L로 계산 · 목표선 = i목표 · r목표 · σA실적 / L목표 · 목업 데이터"
            height={gainH}
            legend={[
              { label: 'ΔG 실적', color: 'var(--viz-cat-1)' },
              { label: 'ΔG 목표', color: 'var(--color-text)', shape: 'dashed' },
              { label: `${start === end ? start : `${start}~${end}`} 평균 ${n(rangeMeanPct(start, end), 2)}%/년`, color: 'var(--color-text-muted)', shape: 'dashed' },
            ]}
          >
            <GainChart years={years} height={gainH} />
          </ChartCard>
        </Anchor>

        {/* E. 구성 요소 */}
        <Anchor id="components" flash={flash} refs={refs} className="col-span-12">
          <ComponentsPanel years={years} />
        </Anchor>

        {/* F. 형질별 예측 정확도 */}
        <Anchor id="traits" flash={flash} refs={refs} className="col-span-12 lg:col-span-6">
          <ChartCard
            className="h-full"
            title="형질별 GS 예측 정확도(r)"
            subtitle={end >= GS_START ? `${end}년 · ${GS_MODEL} · ${CV_FOLDS}-fold × ${CV_ROUNDS}회 · 훈련 집단 ${n(TRAIN_N[end] ?? 0, 0)}계통` : `${end}년`}
            source={end >= GS_START ? `막대 = 평균 r, 오차 막대 = 교차 검증 ±SD, 점 = 반복 ${CV_REPS}회 · 강조 막대(쌀 수량)는 ΔG 식의 r` : undefined}
            height={300}
          >
            {traits.length === 0 ? (
              <EmptyState className="h-full" title={`GS 도입(${GS_START}) 이전 연도입니다`} description={`종료 연도를 ${GS_START}년 이후로 고르면 형질별 예측 정확도를 볼 수 있습니다.`} />
            ) : (
              <TraitAccuracyChart traits={traits} year={end} height={300} />
            )}
          </ChartCard>
        </Anchor>

        {/* G. 파이프라인 */}
        <Anchor id="pipeline" flash={flash} refs={refs} className="col-span-12 lg:col-span-6">
          <ChartCard
            className="h-full"
            title="품종 개발 파이프라인"
            subtitle={`${end}년 단계별 계통 수(MET = 그해 완료 세트) · 라벨 = 계통 수 · 같은 해 단계 수 비`}
            legend={[
              { label: '계통 수', color: 'var(--viz-cat-1)' },
              { label: '목표 미달 단계', color: 'var(--color-negative)' },
              { label: end === PROVISIONAL_YEAR ? '단계별 목표' : `MET 완료 목표(다른 단계 목표는 ${PROVISIONAL_YEAR}년만 설정)`, color: 'var(--color-text)', shape: 'diamond-open' },
            ]}
            height={narrow ? 320 : 300}
          >
            <PipelineChart year={end} height={narrow ? 320 : 300} />
          </ChartCard>
        </Anchor>

        {/* H. 출원·등록 */}
        <Anchor id="apps" flash={flash} refs={refs} className="col-span-12 lg:col-span-6">
          <ChartCard
            className="h-full"
            title="신품종 출원·등록"
            subtitle={`${start}~${end} · 연간 건수${years.includes(PROVISIONAL_YEAR as Year) ? ` · ${PROVISIONAL_YEAR}년은 연중 누계(흐린 막대)` : ''}`}
            source={`등록 건수에는 ${YEARS[0]}년 이전 출원분 포함 · 목업 데이터`}
            height={340}
            legend={[
              { label: '출원', color: 'var(--viz-cat-1)' },
              { label: '등록', color: 'var(--viz-cat-2)' },
              { label: '출원 목표', color: 'var(--color-text)', shape: 'dashed' },
            ]}
          >
            <ApplicationsChart years={years} height={340} />
          </ChartCard>
        </Anchor>

        {/* I. 출원 목록 */}
        <Card className="col-span-12 lg:col-span-6" title="출원 목록" subtitle={`출원일 ${start}~${end} · 최신순 · ${apps.length}건`}>
          <DataTable
            columns={APP_COLUMNS}
            rows={apps}
            rowKey="id"
            dense
            pageSize={apps.length > 10 ? 7 : undefined}
            key={`${start}-${end}`}
            stickyColumn={{ key: 'name', below: 'md' }}
            caption={`${start}~${end}년 신품종 출원 목록`}
            emptyText="선택한 기간에 출원 건이 없습니다"
          />
          <p className="mt-2 text-xs text-muted">품종명은 모두 가상이며 실존 품종과 관계없습니다. 개발 기간 = 최초 교배 연도~출원 연도.</p>
        </Card>
      </PageGrid>

      <p className="text-xs text-muted">
        목업 데이터(시드 {SEED}) · 모든 수치와 품종명은 가상이며 실존 프로그램·품종과 관계없습니다 · ΔG는 쌀 수량(kg/10a) 기준, 선발 강도(i)는 부모 선발 비율 p 기준.
      </p>
    </div>
  )
}
