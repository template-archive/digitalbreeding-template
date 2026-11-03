import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { TemplateMeta } from '@/gallery/types'
import {
  AlertList,
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
  SectionHeader,
  Select,
  Skeleton,
  Switch,
  useMediaQuery,
  type DataTableColumn,
} from '@/design-system'
import { useChartTheme } from '@/charts'
import { formatDelta } from '@/lib/format'
import {
  AS_OF,
  FACTORS,
  FACTOR_CAUSE,
  FIRST_YEAR,
  GS_START,
  I,
  L,
  LAST_YEAR,
  MIN_SPAN,
  MU,
  N_COHORT,
  PROVISIONAL_YEAR,
  R,
  SHARE_MIN_DELTA,
  SIGMA_A,
  TRAITS,
  TRAIT_BY_KEY,
  YEARS,
  dG,
  dGTrait,
  dGpct,
  isDesirable,
  lmdiRange,
  periodStats,
  type PeriodStats,
  type Segment,
  type Trait,
  type TraitKey,
  type Year,
} from './data'
import { n, pctOfMu, sg, span, spanShort, tv } from './components/fmt'
import { TrendChart, slopeLabel } from './components/TrendChart'
import { CompareBars } from './components/CompareBars'
import { INDEX_SERIES, IndexChart } from './components/IndexChart'
import { WaterfallChart } from './components/WaterfallChart'
import { AnnualContribChart } from './components/AnnualContribChart'
import { DirectionBadge } from './components/DirectionBadge'
import { PanelSeverity, PanelTrend } from './components/PanelTrend'

export const meta: TemplateMeta = {
  slug: 'genetic-gain-tracker',
  category: 'kpi',
  title: '유전적 개량량 추적',
  description: '코호트 유전적 추세가 GS 도입 뒤 얼마나 가팔라졌는지, 육종가 방정식 예측과 맞는지, ΔG 증가가 i·r·σA·L 중 무엇에서 왔는지 점검합니다.',
  tags: ['유전적 개량량', 'ΔG', '유전적 추세', '실현율', '육종가 방정식', 'LMDI', '상관 반응', '벼'],
  organism: '벼',
  status: 'review',
  updatedAt: '2026-11-02',
}

const yearOptions = YEARS.map(y => ({ value: String(y), label: y === PROVISIONAL_YEAR ? `${y}(잠정)` : String(y) }))
const traitOptions = TRAITS.map(t => ({ value: t.key, label: t.label }))
/** 결론 묶음 안 KPI 줄: 1440 2열(셋째 타일 전체 폭) · 768 3칸 · 390 2열 */
const TILE_COLS = { md: 3, lg: 2 }

function readPreviewState(): 'loading' | 'empty' | 'error' | null {
  if (typeof location === 'undefined') return null
  const s = new URLSearchParams(location.search).get('state')
  return s === 'loading' || s === 'empty' || s === 'error' ? s : null
}

// ---------------- 비교 표(D) ----------------

interface CompareRow {
  key: 'trad' | 'gs' | 'ratio'
  label: string
  period: string
  i: string
  r: string
  sigmaA: string
  L: string
  pred: string
  slope: string
  realization: string
}

function compareRows(s: PeriodStats): CompareRow[] {
  const t = s.trait
  const y = t.key === 'yield'
  const pd = y ? 2 : t.digits + 1
  const row = (seg: Segment | null, key: 'trad' | 'gs', label: string): CompareRow => {
    if (!seg)
      return { key, label, period: '선택 기간에 없음', i: '—', r: '—', sigmaA: '—', L: '—', pred: '—', slope: '—', realization: '—' }
    return {
      key,
      label,
      period: key === 'gs' ? `${span(seg.predYears)} (회귀 ${span(seg.cohorts)})` : span(seg.cohorts),
      i: n(seg.comp.i, 3),
      r: n(seg.comp.r, 2),
      sigmaA: n(seg.comp.sigmaA, y ? 2 : 1),
      L: n(seg.comp.L, 2),
      pred: y ? `${n(seg.predMean, pd)} (${n(pctOfMu(seg.predMean), 2)}%)` : sg(seg.predMean, pd),
      slope: y ? n(seg.slope, pd) : sg(seg.slope, pd),
      realization: `${n(seg.realization, 1)}%`,
    }
  }
  const rows = [row(s.trad, 'trad', '전통 육종'), row(s.gs, 'gs', '유전체 선발(GS)')]
  if (s.trad && s.gs) {
    const a = s.trad
    const b = s.gs
    rows.push({
      key: 'ratio',
      label: '배율(GS/전통)',
      period: '',
      i: n(b.comp.i / a.comp.i, 2),
      r: n(b.comp.r / a.comp.r, 2),
      sigmaA: n(b.comp.sigmaA / a.comp.sigmaA, 2),
      L: n(b.comp.L / a.comp.L, 2),
      pred: `${n(b.predMean / a.predMean, 2)}배`,
      slope: `${n(b.slope / a.slope, 2)}배`,
      realization: '—',
    })
  }
  return rows
}

// ---------------- 형질별 요약 표(I) ----------------

interface TraitRow {
  key: TraitKey
  trait: Trait
  stats: PeriodStats
}

const segVal = (t: Trait, s: Segment | null, pick: (s: Segment) => number, d = t.key === 'yield' ? 1 : t.digits) => (s ? tv(t, pick(s), d) : '—')

const T_COL: Record<'label' | 'labelUnit' | 'unit' | 'better' | 'gsSlope' | 'gsPred' | 'real' | 'tradSlope' | 'pheno' | 'dir', DataTableColumn<TraitRow>> = {
  label: { key: 'label', header: '형질', sortable: false, format: (_v, r) => <span className="font-semibold text-text">{r.trait.label}</span> },
  // 좁은 화면: 단위 열을 빼고 형질 이름 아래에 단위를 붙인다
  labelUnit: {
    key: 'label',
    header: '형질',
    sortable: false,
    format: (_v, r) => (
      <span className="flex flex-col leading-tight">
        <span className="font-semibold text-text">{r.trait.label}</span>
        <span className="text-xs text-muted">{r.trait.unit}/년</span>
      </span>
    ),
  },
  unit: { key: 'unit', header: '단위', sortable: false, format: (_v, r) => <span className="text-muted">{r.trait.unit}/년</span> },
  better: { key: 'better', header: '바람직한 방향', sortable: false, format: (_v, r) => r.trait.betterLabel },
  gsSlope: { key: 'gsSlope', header: 'GS 실현 기울기', numeric: true, sortable: false, format: (_v, r) => segVal(r.trait, r.stats.gs, s => s.slope) },
  gsPred: {
    key: 'gsPred',
    header: 'GS 예측(상관 반응) 평균',
    numeric: true,
    sortable: false,
    format: (_v, r) => segVal(r.trait, r.stats.gs, s => s.predMean, r.trait.key === 'yield' ? 2 : r.trait.digits + 1),
  },
  real: { key: 'real', header: '실현율', numeric: true, sortable: false, format: (_v, r) => (r.stats.gs ? `${n(r.stats.gs.realization, 1)}%` : '—') },
  tradSlope: { key: 'tradSlope', header: '전통 실현 기울기', numeric: true, sortable: false, format: (_v, r) => segVal(r.trait, r.stats.trad, s => s.slope) },
  pheno: {
    key: 'pheno',
    header: '표현형 기울기(환경 포함)',
    numeric: true,
    sortable: false,
    format: (_v, r) => <span className="text-muted">{tv(r.trait, r.stats.phenoSlope)}</span>,
  },
  dir: {
    key: 'dir',
    header: '방향',
    sortable: false,
    format: (_v, r) => {
      const v = r.stats.gs?.slope ?? r.stats.geneticSlope
      return <DirectionBadge trait={r.trait} value={v} selection={r.trait.key === 'yield'} />
    },
  },
}
const TRAIT_COLUMNS: DataTableColumn<TraitRow>[] = [T_COL.label, T_COL.unit, T_COL.better, T_COL.gsSlope, T_COL.gsPred, T_COL.real, T_COL.tradSlope, T_COL.pheno, T_COL.dir]
// 390px: 결론 열(방향·GS 실현 기울기·실현율)을 앞으로, 단위·바람직한 방향 열은 뺀다
const TRAIT_COLUMNS_NARROW: DataTableColumn<TraitRow>[] = [T_COL.labelUnit, T_COL.dir, T_COL.gsSlope, T_COL.real, T_COL.gsPred, T_COL.tradSlope, T_COL.pheno]

// ---------------- 결론 문장 ----------------

function conclusion(s: PeriodStats): ReactNode {
  const t = s.trait
  const unitYr = `${t.unit}`
  const fmtSlope = (seg: Segment) => (t.key === 'yield' ? `연 ${n(seg.slope, 1)} ${unitYr}(${n(pctOfMu(seg.slope), 2)}%/년)` : `연 ${sg(seg.slope, t.digits)} ${unitYr}`)
  let first: ReactNode
  if (s.gs && s.trad) {
    first = (
      <>
        {t.label} 유전적 추세는 GS 도입 후({span(s.gs.cohorts)} 코호트) {fmtSlope(s.gs)}로 전통 육종기({span(s.trad.cohorts)}) {t.key === 'yield' ? `${n(s.trad.slope, 1)} ${unitYr}(${n(pctOfMu(s.trad.slope), 2)}%/년)` : `${sg(s.trad.slope, t.digits)} ${unitYr}`}의 <b>{n(s.gs.slope / s.trad.slope, 1)}배</b>입니다.
      </>
    )
  } else if (s.gs) {
    first = `${t.label} 유전적 추세는 GS 코호트(${span(s.gs.cohorts)})에서 ${fmtSlope(s.gs)}입니다.`
  } else if (s.trad) {
    first = `${t.label} 유전적 추세는 전통 육종기(${span(s.trad.cohorts)}) ${fmtSlope(s.trad)}입니다(선택 기간에 GS 코호트 없음).`
  } else first = ''
  let second: ReactNode
  if (t.key === 'yield') {
    const c = lmdiRange(s.start, s.end)
    const delta = dG(s.end) - dG(s.start)
    if (Math.abs(delta) < SHARE_MIN_DELTA) second = `${s.start}→${s.end} 예측 ΔG 변화는 ${sg(delta, 2)} kg/10a/년으로 작아 요소별 비중을 따지지 않습니다.`
    else {
      const top = FACTORS.reduce((a, b) => (Math.sign(delta) * c[b] > Math.sign(delta) * c[a] ? b : a))
      second = (
        <>
          {s.start}→{s.end} 예측 ΔG {delta > 0 ? '증가분' : '감소분'} {n(Math.abs(delta), 1)} kg/10a/년 중 <b>{n((c[top] / delta) * 100, 1)}%</b>는 {FACTOR_CAUSE[top]}에서 왔습니다.
        </>
      )
    }
  } else {
    const cr = dGTrait(t, s.end)
    second = `수량 선발에 따른 상관 반응으로 ${t.subject} 연 ${sg(cr, t.digits)} ${t.unit}씩 ${isDesirable(t, cr) ? '바람직한' : '바람직하지 않은'} 방향으로 움직이고 있습니다.`
  }
  return (
    <>
      {first} {second}
    </>
  )
}

/** 결론 패널 왼쪽 위 범위 줄의 전년 대비 변화 */
const deltaText = (v: number, digits: number, unit: string) => `전년 대비 ${formatDelta(v, { digits, unit })}`

// ---------------- 템플릿 ----------------

export default function GeneticGainTrackerTemplate() {
  const preview = useMemo(readPreviewState, [])
  const theme = useChartTheme()
  const narrow = useMediaQuery('(max-width: 639px)')
  const [traitKey, setTraitKey] = useState<TraitKey>('yield')
  const [start, setStart] = useState<Year>(FIRST_YEAR)
  const [end, setEnd] = useState<Year>(LAST_YEAR)
  const [showPheno, setShowPheno] = useState(true)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(preview === 'error')
  const wide = useMediaQuery('(min-width: 1024px)')

  useEffect(() => {
    if (preview === 'loading') return
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [preview])

  // 기간: 종료 − 시작 ≥ 2(코호트 3개 이상) 강제
  const onStart = (v: string) => {
    let s = Number(v) as Year
    let e = end
    if (e - s < MIN_SPAN) e = (s + MIN_SPAN) as Year
    if (e > LAST_YEAR) {
      e = LAST_YEAR
      s = (LAST_YEAR - MIN_SPAN) as Year
    }
    setStart(s)
    setEnd(e)
  }
  const onEnd = (v: string) => {
    let e = Number(v) as Year
    let s = start
    if (e - s < MIN_SPAN) s = (e - MIN_SPAN) as Year
    if (s < FIRST_YEAR) {
      s = FIRST_YEAR
      e = (FIRST_YEAR + MIN_SPAN) as Year
    }
    setStart(s)
    setEnd(e)
  }

  /** 경보 항목: 형질을 고르고 유전적 추세 차트로 이동 */
  const selectTrait = (k: TraitKey) => {
    setTraitKey(k)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById('ggt-trend')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }

  const trait = TRAIT_BY_KEY[traitKey]
  const stats = useMemo(() => periodStats(trait, start, end), [trait, start, end])
  const traitRows = useMemo<TraitRow[]>(() => TRAITS.map(t => ({ key: t.key, trait: t, stats: periodStats(t, start, end) })), [start, end])
  const cmpRows = useMemo(() => compareRows(stats), [stats])
  // 경보·주의: 수량 선발의 상관 반응이 바람직하지 않은 방향인 형질(형질 표 방향 배지와 같은 판정)
  const adverse = useMemo(
    () =>
      traitRows.flatMap(({ trait: t, stats: st }) => {
        const v = st.gs?.slope ?? st.geneticSlope
        return t.key === 'yield' || isDesirable(t, v) ? [] : [{ t, v, cohorts: st.gs?.cohorts ?? st.years }]
      }),
    [traitRows],
  )
  const years = stats.years
  const isYield = trait.key === 'yield'
  const prov = end === PROVISIONAL_YEAR

  const colors = useMemo(
    () => ({
      genetic: theme.text,
      trad: theme.categorical[1]!,
      gs: theme.categorical[0]!,
      pheno: theme.textMuted,
      // 파랑·주황은 GS·전통 전용이라 L(1/L)은 자홍(범주 7색)
      index: { i: theme.categorical[3]!, r: theme.categorical[2]!, sigmaA: theme.categorical[4]!, invL: theme.categorical[6]!, dG: theme.text },
      factor: { i: theme.categorical[3]!, r: theme.categorical[2]!, sigmaA: theme.categorical[4]!, L: theme.categorical[6]! },
      pred: theme.categorical[7] ?? theme.textMuted,
    }),
    [theme],
  )

  // A. 머리(공통 PageHeader: 범위·소속 회색 한 줄 → 제목 + 오른쪽 기준일·필터 → 데이터 한 문장)
  const header = (
    <PageHeader
      context={[`벼 · ${trait.label}(${trait.unit})`, '중부 평야지 벼 육종 프로그램']}
      title={meta.title}
      scope={`${FIRST_YEAR}~${GS_START - 1} 표현형 선발 → ${GS_START}년 유전체 선발(GS)·속성세대진전 도입 · 실현 추세는 코호트 평균 유전체 추정 육종가(GEBV), 예측은 육종가 방정식의 연간 유전적 개량량(ΔG)`}
      asOf={`${AS_OF} · ${PROVISIONAL_YEAR}년은 잠정`}
      actions={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Select label="형질" options={traitOptions} value={traitKey} onChange={v => setTraitKey(v as TraitKey)} />
          <div className="flex items-center gap-2" role="group" aria-label="코호트 기간">
            <Select label="시작" options={yearOptions} value={String(start)} onChange={onStart} />
            <span aria-hidden="true" className="text-muted">
              –
            </span>
            <Select label="종료" options={yearOptions} value={String(end)} onChange={onEnd} />
          </div>
          <Switch checked={showPheno} onChange={setShowPheno} label="표현형 추세" className="h-8" />
        </div>
      }
    />
  )

  if (failed) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState
          title="유전적 추세 데이터를 불러오지 못했습니다"
          description="GBLUP 재추정 결과 서버가 응답하지 않습니다. 잠시 후 다시 시도하세요."
          action={<Button onClick={() => setFailed(false)}>다시 시도</Button>}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <span className="sr-only">유전적 추세 데이터를 불러오는 중입니다</span>
        <ConclusionBundle panel={<Skeleton height={320} />}>
          <KpiRow loading count={3} cols={TILE_COLS} skeletonHeight={150} className="col-span-full" />
        </ConclusionBundle>
        <Skeleton height={150} />
        <PageGrid>
          <Skeleton className="col-span-12 lg:col-span-8" height={420} />
          <Skeleton className="col-span-12 lg:col-span-4" height={420} />
        </PageGrid>
      </div>
    )
  }

  if (preview === 'empty') {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState title="표시할 코호트가 없습니다" description="선택한 프로그램에 GEBV를 재추정한 코호트가 없습니다. 세대 진전 후보의 유전형 분석과 GBLUP 재추정을 먼저 실행하세요." />
      </div>
    )
  }

  // ---- KPI 값 ----
  const prevYear = (end - 1) as Year
  const crEnd = dGTrait(trait, end)
  const crPrev = dGTrait(trait, prevYear)
  const period = `${end}${prov ? ' 잠정' : ''}`
  const noGs = '선택 기간에 GS 코호트가 없습니다'
  const noTrad = '선택 기간에 전통 육종 코호트가 없습니다'
  const dirBadge = (v: number) => (isYield ? undefined : <DirectionBadge trait={trait} value={v} />)
  // 패널 추세는 필터 시작 연도와 관계없이 처음 연도부터: GS 도입 전 대비 변화를 보이려고
  const trendYears = YEARS.filter(y => y <= end)
  const panelValue = (y: Year) => (isYield ? dGpct(y) : dGTrait(trait, y))
  const panelFmt = (v: number) => (isYield ? n(v, 2) : sg(v, trait.digits))
  const compareH = wide ? 326 : 240
  const slopeUnit = `${trait.unit}/년`
  const segSub = (s: Segment) => <span className="break-keep">{isYield ? `${n(pctOfMu(s.slope), 2)}%/년 · 실현율 ${n(s.realization, 1)}%` : `예측 ${sg(s.predMean, trait.digits + 1)} · 실현율 ${n(s.realization, 1)}%`}</span>
  const segValue = (s: Segment) => (isYield ? n(s.slope, 1) : sg(s.slope, trait.digits))

  // ---- 식 띠 ----
  const formulaName = isYield ? 'ΔG = i · r · σA / L' : 'CR = i · r수량 · rg · σA / L'
  const formula = isYield
    ? `${n(I[end], 3)} × ${n(R[end], 2)} × ${n(SIGMA_A[end], 1)} / ${n(L[end], 1)} = ${n(dG(end), 1)} kg/10a/년(${n(dGpct(end), 2)}%/년)`
    : `${n(I[end], 3)} × ${n(R[end], 2)} × ${trait.rg < 0 ? `(${sg(trait.rg, 2)})` : n(trait.rg, 2)} × ${n(trait.sigmaA ?? 0, 1)} / ${n(L[end], 1)} = ${sg(crEnd, trait.digits)} ${trait.unit}/년`

  const fghNote = '쌀 수량 기준 — 다른 형질은 수량 선발의 상관 반응이라 같은 요소 i·r·L로 움직입니다'

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* B. 결론 묶음: 대표 ΔG(또는 상관 반응) 판단 + 추세, 받치는 지표 3개 */}
      <ConclusionBundle
        panel={
          <ConclusionPanel
            label={
              <>
                {period} · {isYield ? `${n(dG(end), 1)} kg/10a/년` : `rg ${sg(trait.rg, 2)}(추정)`} · {deltaText(isYield ? dGpct(end) - dGpct(prevYear) : crEnd - crPrev, isYield ? 2 : trait.digits, isYield ? '%p' : '')}
                {!isYield && (
                  <>
                    {' '}
                    <PanelSeverity severity={isDesirable(trait, crEnd) ? 'ok' : 'warning'} label={isDesirable(trait, crEnd) ? '바람직' : '비바람직'} />
                  </>
                )}
              </>
            }
            valueLabel={isYield ? `연간 유전적 개량량(ΔG, 예측) · μ ${MU} 대비` : '연간 개량량(상관 반응, 예측)'}
            value={isYield ? n(dGpct(end), 2) : sg(crEnd, trait.digits)}
            unit={isYield ? '%/년' : `${trait.unit}/년`}
            statement={conclusion(stats)}
            aside={
              <PanelTrend
                kind={isYield ? 'bar' : 'line'}
                title={isYield ? 'ΔG %/년 · 흐린 막대 GS 도입 전' : `상관 반응 ${trait.unit}/년(예측)`}
                points={trendYears.map(y => ({ label: String(y), value: panelValue(y), dim: y < GS_START }))}
                height={narrow ? 88 : undefined}
                format={panelFmt}
                ariaLabel={`연도별 ${isYield ? 'ΔG' : '상관 반응'}: ${trendYears[0]}년 ${panelFmt(panelValue(trendYears[0]!))}에서 ${end}년 ${panelFmt(panelValue(end))} ${isYield ? '%/년' : `${trait.unit}/년`}.`}
              />
            }
          />
        }
      >
        <KpiRow cols={TILE_COLS} className="col-span-full">
          <KpiTile
            label="실현 유전적 추세(GS)"
            value={stats.gs ? segValue(stats.gs) : '—'}
            unit={stats.gs ? slopeUnit : undefined}
            sub={stats.gs ? segSub(stats.gs) : noGs}
            period={stats.gs ? `코호트 ${spanShort(stats.gs.cohorts)}` : undefined}
            badge={stats.gs ? dirBadge(stats.gs.slope) : undefined}
          />
          <KpiTile
            label="실현 유전적 추세(전통)"
            value={stats.trad ? segValue(stats.trad) : '—'}
            unit={stats.trad ? slopeUnit : undefined}
            sub={stats.trad ? segSub(stats.trad) : noTrad}
            period={stats.trad ? `코호트 ${spanShort(stats.trad.cohorts)}` : undefined}
            badge={stats.trad ? dirBadge(stats.trad.slope) : undefined}
          />
          <KpiTile
            label="누적 유전적 개량"
            value={sg(stats.cumulative, trait.digits)}
            unit={trait.unit}
            sub={isYield ? `${sg(pctOfMu(stats.cumulative), 1)}%, ${start} 코호트 대비` : `${start} 코호트 대비`}
            period={`코호트 ${start}→${String(end).slice(2)}`}
            badge={dirBadge(stats.cumulative)}
          />
        </KpiRow>
      </ConclusionBundle>

      {/* 경보·주의: 비바람직 상관 반응(항목을 누르면 그 형질의 추세로 이동) */}
      <Card title={`경보·주의 ${adverse.length}건`} subtitle={`선택 기간 ${start}~${end} · 수량 선발의 상관 반응이 바람직하지 않은 방향인 형질`}>
        <AlertList
          className="lg:grid lg:grid-cols-3"
          density="compact"
          ariaLabel={`비바람직 상관 반응 ${adverse.length}건`}
          emptyText="상관 반응이 바람직하지 않은 형질이 없습니다"
          actionLabel="— 이 형질의 추세 보기"
          items={adverse.map(({ t, v, cohorts }) => ({
            id: t.key,
            severity: 'warning' as const,
            title: `${t.label} 비바람직`,
            value: `${sg(v, t.digits)} ${t.unit}/년`,
            description: `${t.betterLabel} 바람직 · 코호트 ${span(cohorts)} 기울기 · rg ${sg(t.rg, 2)}(추정)`,
            onClick: () => selectTrait(t.key),
          }))}
        />
      </Card>

      {/* C + D */}
      <PageGrid>
        <div id="ggt-trend" className="col-span-12 min-w-0 scroll-mt-4 lg:col-span-8">
        <ChartCard
          className="h-full"
          title={`${trait.label} 유전적 추세 — 전통 육종 vs 유전체 선발(GS)`}
          subtitle={`유전적 추세 = 코호트 평균 GEBV(${AS_OF.slice(0, 7)} GBLUP) · 표현형 = 생산력 검정 평균(환경 효과 포함). ${FIRST_YEAR} 코호트 평균 = 0 · 최근 코호트(${LAST_YEAR - 2}~${LAST_YEAR}) 표현형은 예비 시험 값`}
          height={340}
          legend={[
            { label: `유전적 추세(전체 기울기 ${tv(trait, stats.geneticSlope)}/년)`, color: colors.genetic, shape: 'line' },
            ...(stats.trad ? [{ label: `전통 회귀(${span(stats.trad.cohorts)})${narrow ? ` ${slopeLabel(stats.trad, stats).replace('전통 ', '')}` : ''}`, color: colors.trad, shape: 'line' as const }] : []),
            ...(stats.gs ? [{ label: `GS 회귀(${span(stats.gs.cohorts)})${narrow ? ` ${slopeLabel(stats.gs, stats).replace('GS ', '')}` : ''}`, color: colors.gs, shape: 'line' as const }] : []),
            ...(showPheno ? [{ label: `표현형 추세(기울기 ${tv(trait, stats.phenoSlope)} ${slopeUnit}, 환경 효과 포함)`, color: colors.pheno, shape: 'dashed' as const }] : []),
          ]}
          source={`코호트 계통 수: ${FIRST_YEAR}~${GS_START - 1} 소급 유전형 분석 ${YEARS.filter(y => y < GS_START).map(y => N_COHORT[y]).join('·')}계통(추정), ${GS_START}~ 세대 진전 후보 전체. 절대 수준은 다른 화면의 GEBV·시험 평균과 비교할 수 없습니다(기준이 다름).`}
        >
          <TrendChart stats={stats} showPheno={showPheno} height={340} colors={colors} />
        </ChartCard>
        </div>

        <ChartCard
          className="col-span-12 self-start md:col-span-6 lg:col-span-4 lg:self-stretch"
          title="예측 대비 실현"
          subtitle={isYield ? '기간 평균 예측 ΔG vs 실현 유전적 추세 기울기' : '기간 평균 상관 반응(예측) vs 실현 기울기'}
          height={compareH}
          legend={[
            { label: '예측 평균', color: colors.pred },
            ...(stats.trad ? [{ label: '전통 실현 기울기', color: colors.trad }] : []),
            ...(stats.gs ? [{ label: 'GS 실현 기울기', color: colors.gs }] : []),
          ]}
          source={
            stats.trad && stats.gs ? (
              <span>
                실현 기울기 배율 <b className="text-text">{n(stats.gs.slope / stats.trad.slope, 1)}배</b> · 기간 평균 예측 배율 {n(stats.gs.predMean / stats.trad.predMean, 2)}배. 실현 개량량은 예측보다 낮은 것이 일반적입니다.
              </span>
            ) : (
              '선택 기간에 한쪽 구간만 있어 배율을 계산하지 않습니다.'
            )
          }
        >
          <CompareBars stats={stats} height={compareH} colors={colors} />
        </ChartCard>

        <Card
          className="col-span-12 md:col-span-6 lg:col-span-12"
          title="전통 vs GS 구성 요소 비교"
          subtitle={`${trait.label} · 선택 기간 ${start}~${end}. i·r·L은 수량(부모 선발 형질) 기준`}
        >
          <DataTable
            dense
            rows={cmpRows}
            rowKey="key"
            stickyColumn="label"
            rowProps={r => (r.key === 'ratio' ? { className: 'font-semibold' } : {})}
            caption={`${trait.label} 전통 육종과 GS의 구성 요소·예측·실현 비교`}
            columns={(() => {
              const c: Record<Exclude<keyof CompareRow, 'key'>, DataTableColumn<CompareRow>> = {
                label: { key: 'label', header: '구분', sortable: false, format: v => <span className="font-semibold">{String(v)}</span> },
                period: { key: 'period', header: '기간', sortable: false, hideBelow: 'sm', format: v => <span className="whitespace-nowrap text-muted">{String(v)}</span> },
                i: { key: 'i', header: '선발 강도(i)', numeric: true, sortable: false },
                r: { key: 'r', header: '정확도(r)', numeric: true, sortable: false },
                sigmaA: { key: 'sigmaA', header: isYield ? 'σA (kg/10a)' : `σA,형질(고정, ${trait.unit})`, numeric: true, sortable: false },
                L: { key: 'L', header: '세대 간격(L, 년)', numeric: true, sortable: false },
                pred: { key: 'pred', header: isYield ? '예측 ΔG 평균 (kg/10a/년)' : `상관 반응 평균 (${slopeUnit})`, numeric: true, sortable: false },
                slope: { key: 'slope', header: `실현 기울기 (${slopeUnit})`, numeric: true, sortable: false, format: v => <span className="font-semibold">{String(v)}</span> },
                realization: { key: 'realization', header: '실현율', numeric: true, sortable: false },
              }
              // 390px: 결론 열(실현 기울기·실현율·예측)을 구성 요소보다 앞으로, 기간 열은 숨김(hideBelow)
              return narrow
                ? [c.label, c.slope, c.realization, c.pred, c.i, c.r, c.sigmaA, c.L]
                : [c.label, c.period, c.i, c.r, c.sigmaA, c.L, c.pred, c.slope, c.realization]
            })()}
          />
          <p className="mt-2 text-xs text-muted">
            {stats.gs
              ? `${isYield ? '예측 ΔG 평균' : '상관 반응 평균'}은 연도별 값의 평균이며 GS 구성 요소 평균으로 계산한 값(${tv(trait, (stats.gs.comp.i * stats.gs.comp.r * stats.gs.comp.sigmaA * (isYield ? 1 : trait.rg)) / stats.gs.comp.L, isYield ? 2 : trait.digits + 1)})과 다릅니다. GS 회귀는 GS 첫 선발 직전 코호트(${GS_START - 1})에서 시작합니다. `
              : ''}
            실현율 = 실현 기울기 / 예측 평균 × 100. 실현이 예측보다 낮은 것은 일반적입니다(예측 정확도 과대 추정·선발 후 분산 감소·G×E).
          </p>
        </Card>
      </PageGrid>

      {/* E. 식 띠 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-surface-2 px-3 py-2.5">
        <Badge tone="info">{end}년</Badge>
        <p className="min-w-0 text-[13px] text-text tabular-nums sm:text-sm">
          <span className="font-semibold">{formulaName}</span>
          <span className="text-muted"> = </span>
          <span className="font-semibold">{formula}</span>
        </p>
        <span className="text-xs text-muted sm:ml-auto">선발 강도(i) · 선발·예측 정확도(r) · 상가적 유전 표준편차(σA) · 세대 간격(L)</span>
      </div>

      {/* F·G·H */}
      <SectionHeader
        title="ΔG는 무엇 때문에 늘었나 — 구성 요소와 분해"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone="neutral">수량 기준(부모 선발 형질)</Badge>
            <span>{isYield ? '로그 평균 디비지아 지수(LMDI) 분해: 네 기여의 합 = ΔG 변화(잔차 0)' : fghNote}</span>
          </span>
        }
      />
      <PageGrid>
        <ChartCard
          className="col-span-12 md:col-span-6 lg:col-span-4"
          title="구성 요소 지수"
          subtitle={`${start} = 100 · 1/L은 높을수록 ΔG에 유리`}
          height={260}
          legend={INDEX_SERIES.map(s => ({ label: s.legend, color: colors.index[s.key], shape: 'line' as const }))}
          source={(() => {
            const iL = L[start] / L[end]
            return `${end}: i ${n((I[end] / I[start]) * 100, 1)} · r ${n((R[end] / R[start]) * 100, 1)} · σA ${n((SIGMA_A[end] / SIGMA_A[start]) * 100, 1)} · 1/L ${n(iL * 100, 1)} · ΔG ${n((dG(end) / dG(start)) * 100, 1)}`
          })()}
        >
          <IndexChart years={years} height={260} colors={colors.index} />
        </ChartCard>
        <ChartCard
          className="col-span-12 md:col-span-6 lg:col-span-4"
          title={`${start}→${end} ΔG 변화의 요소별 기여(쌀 수량)`}
          subtitle={`kg/10a/년 · 막대 위 비중은 |ΔG 변화| ≥ ${SHARE_MIN_DELTA}일 때만 표시`}
          height={260}
          legend={[
            { label: '시작·종료 ΔG', color: theme.textMuted },
            { label: '양(+) 기여', color: theme.positive },
            { label: '음(−) 기여', color: theme.warning },
          ]}
        >
          <WaterfallChart start={start} end={end} height={260} />
        </ChartCard>
        <ChartCard
          className="col-span-12 lg:col-span-4"
          title="전년 대비 ΔG 변화의 요소별 기여"
          subtitle="0 위 = 양(+) 기여, 0 아래 빈 막대 = 음(−) 기여"
          height={260}
          legend={[...FACTORS.map(f => ({ label: f === 'sigmaA' ? 'σA' : f, color: colors.factor[f] })), { label: '순변화', color: theme.text, shape: 'diamond' as const }]}
        >
          <AnnualContribChart years={years} height={260} colors={colors.factor} />
        </ChartCard>
      </PageGrid>

      {/* I. 형질별 요약 */}
      <Card title="형질별 유전적 추세 요약" subtitle={`선택 기간 ${start}~${end} · 형질 단위/년 · 테두리 = 선택 형질`}>
        <DataTable
          dense
          rows={traitRows}
          rowKey="key"
          stickyColumn={{ key: 'label', below: 'md' }}
          activeRow={r => r.key === traitKey}
          caption="형질별 실현 기울기·예측·실현율·표현형 기울기와 변화 방향"
          columns={narrow ? TRAIT_COLUMNS_NARROW : TRAIT_COLUMNS}
        />
        <p className="mt-2 text-xs text-muted">
          rg·σA(수량 외 형질)는 추정값입니다. 수량 외 형질의 예측은 수량 선발에 따른 상관 반응 CR = i · r수량 · rg · σA,형질 / L. 방향 배지는 색과 문자를 함께 씁니다.
        </p>
      </Card>
    </div>
  )
}

