import { useCallback, useEffect, useMemo, useState } from 'react'
import { Minimize2 } from 'lucide-react'
import type { TemplateMeta } from '@/gallery/types'
import {
  Badge,
  Button,
  Card,
  ChartCard,
  ErrorState,
  KpiRow,
  KpiTile,
  Legend,
  PageGrid,
  PageHeader,
  Segmented,
  Select,
  Skeleton,
  SummaryCallout,
  useMediaQuery,
  type LegendItem,
} from '@/design-system'
import { useChartTheme } from '@/charts'
import { formatNumber, formatPValue } from '@/lib/format'
import {
  ANALYSIS,
  CRITERIA,
  M,
  N,
  SUGGESTIVE,
  TRAITS,
  countAtLeast,
  getTraitResult,
  lambdaStatus,
  sigLineOf,
  type Criterion,
  type Lead,
  type TraitKey,
} from './data'
import { ManhattanChart } from './components/ManhattanChart'
import { MetricStrip } from './components/MetricStrip'
import { QqChart } from './components/QqChart'
import { PeakTable } from './components/PeakTable'
import { formatBeta, locus } from './components/format'

export const meta: TemplateMeta = {
  slug: 'gwas-manhattan',
  category: 'viz',
  title: 'GWAS 결과 뷰어',
  description: '형질별 전장 유전체 연관 분석 결과에서 유의 좌위의 위치, 집단 구조 보정(λGC·QQ), 리드 SNP의 효과와 후보 유전자를 확인한다.',
  tags: ['GWAS', '맨해튼', 'QQ 플롯', 'λGC', '벼', 'QTL'],
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

/** 머리 둘째 줄(데이터 한 문장): 패널·규모·필터·모델·표현형 연도 */
const SCOPE_LINE = `${ANALYSIS.organism} ${formatNumber(N)}계통 · ${formatNumber(M)} SNP(${ANALYSIS.filter}) · ${ANALYSIS.model} · 표현형 ${ANALYSIS.phenotypeYear}년 · 목업 데이터`

export default function Template() {
  const devState = useMemo(readDevState, [])
  const [traitKey, setTraitKey] = useState<TraitKey>('dth')
  const [criterion, setCriterion] = useState<Criterion>('bonferroni')
  const [zoomChr, setZoomChr] = useState<string | null>(null)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const narrow = useMediaQuery('(max-width: 639px)')
  const theme = useChartTheme()

  // 형질 key 단위 캐시(data.ts 내부 Map) — 형질을 바꿀 때만 다시 계산
  const result = useMemo(() => getTraitResult(traitKey, { nullOnly: devState === 'empty' }), [traitKey, devState])
  const trait = result.trait
  const crit = CRITERIA.find(c => c.value === criterion)!
  const sigLine = sigLineOf(criterion)

  const sigSnpCount = countAtLeast(result.sortedDesc, sigLine)
  const sigLeads = result.leads.filter(l => l.logP >= sigLine)
  const sugLeads = result.leads.filter(l => l.logP < sigLine)
  const lambdaText = (Math.round(result.lambda * 100) / 100).toFixed(2)
  const lambdaState = lambdaStatus(result.lambda)
  const lambdaNote = `피크 ±1 Mb 제외, n=${formatNumber(result.lambdaN)} SNP`

  const onTrait = (k: TraitKey) => {
    setTraitKey(k)
    setSelectedLeadId(null) // 확대 염색체는 유지
  }
  const onZoom = useCallback((chr: string) => {
    setZoomChr(chr)
    setSelectedLeadId(null)
  }, [])
  const onSelectLead = useCallback((l: Lead) => {
    setZoomChr(l.chr)
    setSelectedLeadId(l.id)
  }, [])
  const resetZoom = useCallback(() => {
    setZoomChr(null)
    setSelectedLeadId(null)
  }, [])

  useEffect(() => {
    if (!zoomChr) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resetZoom()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomChr, resetZoom])

  const lociText = sigLeads.map(l => `${l.chr} ${l.gene ?? l.id}`).join(', ')
  const manhattanAria = zoomChr
    ? `${trait.short} 맨해튼 플롯 ${zoomChr} 확대, 리드 SNP ${result.leads.filter(l => l.chr === zoomChr).length}개, 유의선 ${sigLine.toFixed(2)}`
    : `${trait.short} 맨해튼 플롯, ${formatNumber(M)} SNP, 유의 좌위 ${sigLeads.length}개${lociText ? `(${lociText})` : ''}, 유의선 ${sigLine.toFixed(2)}`
  const qqAria = `${trait.short} QQ 플롯(전체 SNP), λGC = ${lambdaText}(유의 피크 ${result.lambdaPeaks}개 ±1 Mb 제외, n=${formatNumber(result.lambdaN)} SNP), 기대 −log10(p) 2 미만 구간은 대각선과 신뢰 띠를 따르고 피크 SNP만 위로 벗어남`
  const fallbackTable = {
    columns: ['상태', 'SNP ID', '위치', 'p값', '후보 유전자'],
    rows: result.leads.map(l => [l.logP >= sigLine ? '유의' : '제안', l.id, locus(l), formatPValue(l.p), l.gene ?? '—']),
  }

  // 견본 모양 = 차트 마크 모양(SNP 점 = 원, 리드 SNP = 다이아몬드, QTL 구간 = 면, 공통 Legend shape)
  const legend: LegendItem[] = zoomChr
    ? [
        { label: zoomChr, color: theme.chromosome[(Number(zoomChr.slice(3)) + 1) % 2]!, shape: 'circle' },
        { label: 'QTL 구간 ±200 kb', color: theme.accent },
        { label: `유의선 ${sigLine.toFixed(2)}`, color: theme.threshold, shape: 'line' },
        { label: '제안선 5.00', color: theme.textMuted, shape: 'dashed' },
      ]
    : [
        { label: '홀수 염색체', color: theme.chromosome[0], shape: 'circle' },
        { label: '짝수 염색체', color: theme.chromosome[1], shape: 'circle' },
        { label: '리드 SNP(유의)', color: theme.accent, shape: 'diamond' },
        { label: `유의선 ${sigLine.toFixed(2)}`, color: theme.threshold, shape: 'line' },
        { label: '제안선 5.00', color: theme.textMuted, shape: 'dashed' },
      ]

  // 조작: 넓은 화면은 맨해튼 아래, 390px은 맨해튼 바로 위
  const controls = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Select label="형질" value={traitKey} onChange={onTrait} options={TRAITS.map(t => ({ value: t.key, label: t.label }))} />
      <Segmented ariaLabel="전장 유전체 유의 기준" value={criterion} onChange={setCriterion} options={CRITERIA.map(c => ({ value: c.value, label: c.label }))} />
    </div>
  )

  const lambdaInfo = `알려진 연관 구간을 빼고 계산: 본페로니 유의 리드 SNP ${result.lambdaPeaks}개의 ±1 Mb 안 SNP를 제외한 ${formatNumber(result.lambdaN)}개 SNP의 p값 중앙값으로 λ = [Φ⁻¹(1 − p중앙/2)]² / 0.4549. 전체 SNP 기준 λ는 ${result.lambdaAll.toFixed(2)}. 0.95~1.10 정상, 1.10 초과는 집단 구조 미보정, 0.95 미만은 과보정 의심.`

  // 머리(공통 PageHeader): 범위·소속 → 제목 + 분석일 → 데이터 한 문장. 390px은 지표 띠 안 ⓘ가 잘리므로 λGC 정의를 자세히로 옮긴다
  const header = (
    <PageHeader
      context={['벼 · 전장 유전체 연관 분석(GWAS)', ANALYSIS.panel]}
      title={meta.title}
      scope={SCOPE_LINE}
      asOfLabel="분석일"
      asOf={ANALYSIS.analyzedAt}
      details={narrow ? lambdaInfo : undefined}
      detailsLabel="λGC 계산 방법"
    />
  )

  if (devState === 'error') {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState title="GWAS 결과를 불러오지 못했습니다" description="분석 결과 파일(형질별 SNP 통계)을 읽는 중 오류가 났습니다. 잠시 뒤 다시 시도하세요." />
      </div>
    )
  }

  if (devState === 'loading') {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <Skeleton height={narrow ? 72 : 44} className="rounded-md" />
        <Skeleton height={narrow ? 420 : 560} className="rounded-lg" />
        <PageGrid>
          <div className="col-span-12 flex min-w-0 flex-col gap-4 xl:col-span-8">
            <KpiRow loading hero count={3} skeletonHeight={132} />
            <Skeleton height={280} className="rounded-lg" />
          </div>
          <Skeleton height={narrow ? 320 : 440} className="col-span-12 rounded-lg xl:col-span-4" />
        </PageGrid>
      </div>
    )
  }

  const top = sigLeads[0]

  // 선택 지표: 유의 좌위 수가 대표(결론 숫자). 분석 규모는 머리 데이터 한 문장에 있다
  const tiles = [
    <KpiTile key="loci" size="hero" label="유의 좌위 수" value={sigLeads.length} unit="개" deltaLabel={`제안 좌위 ${sugLeads.length}개 · ±500 kb LD 묶음(clumping)`} />,
    <KpiTile key="snps" label="유의 SNP 수" value={sigSnpCount} unit="개" deltaLabel={`−log10(p) ≥ ${sigLine.toFixed(2)} · LD 이웃 포함`} />,
    <KpiTile
      key="lambda"
      label="유전체 팽창 계수 λGC"
      plainLabel="λGC"
      value={lambdaText}
      sub={lambdaNote}
      badge={<Badge tone={lambdaState.tone}>{lambdaState.label}</Badge>}
      range={{ min: 0.85, max: 1.25, lo: 0.95, hi: 1.1, value: Number(lambdaText), label: '정상 범위 0.95–1.10' }}
      info={narrow ? undefined : lambdaInfo}
    />,
  ]

  const manhattanHeight = narrow ? 280 : 440

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* 결론 띠: 머리 바로 아래 한 곳. 형질·기준에 따라 바뀐다 */}
      <SummaryCallout live>
        <b>{trait.short}</b>
        {sigLeads.length > 0 ? (
          <>
            {' '}
            — 유의 좌위 <b>{sigLeads.length}</b>개({lociText}).
            {top && (
              <>
                {' '}
                최강 신호는 {top.chr} <b>{top.gene ? <i>{top.gene}</i> : top.id}</b> 부근 리드 SNP(p = {formatPValue(top.p)}, β {formatBeta(top.beta, trait.unit)}, PVE{' '}
                {(top.pve * 100).toFixed(1)}%).
              </>
            )}
          </>
        ) : (
          <> — 기준 {crit.desc}을 넘는 좌위가 없습니다.</>
        )}{' '}
        효과 방향: {trait.direction}. λGC {lambdaText}(피크 ±1 Mb 제외).
      </SummaryCallout>

      <Card
        title={zoomChr ? `맨해튼 플롯 — ${zoomChr} 확대` : `맨해튼 플롯 — ${trait.short}`}
        subtitle={zoomChr ? '휠·드래그로 구간 확대, Esc 또는 버튼으로 전체 유전체 복귀' : '점을 누르면 해당 염색체로 확대합니다'}
        actions={
          zoomChr ? (
            <Button size="sm" onClick={resetZoom} icon={<Minimize2 size={14} aria-hidden="true" />}>
              전체 유전체로
            </Button>
          ) : undefined
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-border pb-3">{controls}</div>
        <div className="min-w-0" style={{ height: manhattanHeight }}>
          <ManhattanChart
            result={result}
            sigLine={sigLine}
            sigDesc={crit.desc}
            compact={narrow}
            zoomChr={zoomChr}
            selectedLeadId={selectedLeadId}
            onZoom={onZoom}
            height={manhattanHeight}
            ariaLabel={manhattanAria}
            fallbackTable={fallbackTable}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border pt-3">
          <Legend items={legend} />
        </div>
        <p className="mt-2 break-keep text-xs text-muted">
          {zoomChr
            ? `x축: ${zoomChr} 물리 위치(Mb, ${ANALYSIS.reference}) · 음영 = QTL 구간 ±200 kb · 리드 SNP는 ±500 kb 안 최솟값 p`
            : `x축: ${ANALYSIS.reference} 염색체 누적 위치 · 리드 SNP는 ±500 kb 안 최솟값 p`}
        </p>
      </Card>

      {narrow && <MetricStrip label="선택 지표(가로 스크롤)">{tiles}</MetricStrip>}

      <PageGrid>
        <div className="col-span-12 flex min-w-0 flex-col gap-4 xl:col-span-8">
          {!narrow && (
            <KpiRow hero ariaLabel="선택 지표">
              {tiles}
            </KpiRow>
          )}

          <section className="flex min-w-0 flex-1 flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold leading-snug text-text">피크 SNP — {trait.short}</h3>
                <p className="mt-0.5 break-keep text-xs text-muted">
                  리드 SNP: ±500 kb 안 최솟값 p, β는 소수 대립유전자 동형 − 주 대립유전자 동형 평균 차({trait.unit}). 행을 누르면 해당 염색체로 확대합니다.
                </p>
              </div>
              <span className="text-xs text-muted tabular-nums">
                제안선 {SUGGESTIVE.toFixed(2)} 이상 {result.leads.length}개 · 유의 {sigLeads.length}개
              </span>
            </div>
            <PeakTable leads={result.leads} trait={trait} sigLine={sigLine} selectedLeadId={selectedLeadId} onSelect={onSelectLead} narrow={narrow} />
          </section>
        </div>

        <ChartCard
          className="col-span-12 xl:col-span-4"
          title="QQ 플롯"
          subtitle="집단 구조 보정 확인: 피크를 빼면 대각선을 따라야 함"
          legend={[
            { label: '95% 신뢰 띠', color: `color-mix(in srgb, ${theme.textMuted} 30%, transparent)` },
            { label: `유의 SNP(≥ ${sigLine.toFixed(2)})`, color: theme.text, shape: 'circle' },
            { label: '리드 SNP', color: theme.accent, shape: 'diamond' },
          ]}
          height={narrow ? 300 : 340}
          source={`전체 ${formatNumber(M)} SNP를 그림(λ만 피크 ±1 Mb 제외) · 기대 −log10(p) < 2 구간은 20개 중 1개만 표시 · 두 축 범위가 달라 y = x 선 기울기는 45°가 아님`}
        >
          <QqChart result={result} lambdaText={lambdaText} lambdaNote={lambdaNote} sigLine={sigLine} height={narrow ? 300 : 340} ariaLabel={qqAria} />
        </ChartCard>
      </PageGrid>
    </div>
  )
}
