import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TemplateMeta } from '@/gallery/types'
import {
  Badge,
  BottomSheet,
  Card,
  ChartCard,
  DivergingBar,
  EmptyState,
  ErrorState,
  KpiRow,
  KpiTile,
  PageGrid,
  PageHeader,
  Segmented,
  Select,
  SeverityTag,
  Skeleton,
  Slider,
  SummaryCallout,
  useMediaQuery,
  type LegendItem,
  type SliderTick,
} from '@/design-system'
import { useChartTheme } from '@/charts'
import { formatNumber, formatSigned } from '@/lib/format'
import {
  BASE_DATE,
  CORR_WITH_YIELD,
  DEFAULT_PRESET,
  DG_PCT_MAX,
  DIVERSITY_MIN,
  L,
  MU,
  N,
  PRESETS,
  R_ACC,
  SIGMA_A,
  TRAINING_N,
  TRAITS,
  TRAIT_KEYS,
  computeSelection,
  iOf,
  nSelOf,
  normalizeWeights,
  type Mode,
  type PresetKey,
  type TraitKey,
  type Weights,
} from './data'
import { SelectionHistogram } from './components/SelectionHistogram'
import { TraitScatter } from './components/TraitScatter'
import { WeightPanel, type PresetValue } from './components/WeightPanel'
import { RankTable } from './components/RankTable'
import { LineDetail } from './components/LineDetail'
import { MetricStrip } from './components/MetricStrip'

export const meta: TemplateMeta = {
  slug: 'gebv-selection',
  category: 'viz',
  title: 'GEBV 기반 선발',
  description: '선발 비율과 경제적 가중치를 정하면 GEBV 분포 위의 선발 기준선, 선발 강도, 기대 연간 유전적 개량량과 형질별 손익이 함께 바뀌는 부모 선발 화면.',
  tags: ['GEBV', 'GBLUP', '선발 강도', '선발 지수', '육종가 방정식', '벼'],
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

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: 'yield', label: '수량 GEBV' },
  { value: 'index', label: '다형질 선발 지수' },
]
/** 선발 비율 눈금(5%는 좁은 화면에서 1%와 겹쳐 숨김). ←→ 1%, PageUp/PageDown 5% */
const P_TICKS: SliderTick[] = [{ value: 1 }, { value: 5, hideBelow: 'sm' }, { value: 10 }, { value: 20 }, { value: 50 }]

const Y_TRAITS: Exclude<TraitKey, 'yield'>[] = ['culm', 'blast', 'taste']

const sameWeights = (a: Weights, b: Weights) => TRAIT_KEYS.every(t => Math.abs(a[t] - b[t]) < 1e-9)

export default function Template() {
  const devState = useMemo(readDevState, [])
  const [booting, setBooting] = useState(true)
  const [mode, setMode] = useState<Mode>('yield')
  const [pPct, setPPct] = useState(10)
  const [weights, setWeights] = useState<Weights>(PRESETS[DEFAULT_PRESET].w)
  const [yTrait, setYTrait] = useState<Exclude<TraitKey, 'yield'>>('taste')
  const [selectedName, setSelectedName] = useState<string | null>('YR22-0412')
  const narrow = useMediaQuery('(max-width: 639px)')
  const [weightsOpen, setWeightsOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const theme = useChartTheme()

  useEffect(() => {
    const id = window.setTimeout(() => setBooting(false), 400)
    return () => window.clearTimeout(id)
  }, [])
  useEffect(() => {
    if (mode === 'index') setWeightsOpen(true)
  }, [mode])

  const p = pPct / 100
  const nSel = nSelOf(p)
  const i = iOf(p)
  const wn = useMemo(() => normalizeWeights(weights), [weights])
  const result = useMemo(() => computeSelection(mode, p, weights), [mode, p, weights])
  // 표·상세는 지수가 정의되지 않아도(가중치 0) 수량 기준 순위로 보여 준다
  const tableResult = useMemo(() => result ?? computeSelection('yield', p, weights)!, [result, p, weights])
  const preset: PresetValue = (Object.keys(PRESETS) as PresetKey[]).find(k => sameWeights(PRESETS[k].w, weights)) ?? 'custom'
  const lowDiversity = nSel < DIVERSITY_MIN

  const onWeight = useCallback((t: TraitKey, v: number) => setWeights(w => ({ ...w, [t]: Math.round(v * 100) / 100 })), [])
  const onPreset = useCallback((k: PresetKey) => setWeights(PRESETS[k].w), [])
  // 390px: 상세는 표 아래가 아니라 누른 자리에서 하단 시트로 연다
  const onSelectLine = useCallback(
    (name: string | null) => {
      setSelectedName(name)
      setSheetOpen(narrow && name !== null)
    },
    [narrow],
  )

  const chartH = narrow ? 260 : 360
  const valueText = `선발 비율 ${pPct}%, ${nSel}계통, 선발 강도 ${i.toFixed(3)}`
  const isYield = mode === 'yield'

  // A. 머리(공통 PageHeader): 범위 → 제목 + 기준일 → 데이터 한 문장 → 육종가 방정식 매개변수는 「자세히」
  const header = (
    <PageHeader
      context={['벼 · 쌀 수량 GEBV(kg/10a)', '부모 선발(2027년 1차 교배용)']}
      title={meta.title}
      scope={`유전체 추정 육종가(GEBV) · GBLUP · 후보 ${formatNumber(N)}계통 · 훈련 집단 ${formatNumber(TRAINING_N)}계통 · 기준 = 훈련 집단 평균 0 · 목업 데이터`}
      asOf={BASE_DATE}
      details={
        <>
          육종가 방정식 매개변수(2026년 수량): 예측 정확도(r) {R_ACC}(GBLUP 5-fold × 10회 교차 검증) · 상가적 유전 표준편차(σA) {SIGMA_A} kg/10a · 세대 간격(L) {L}년 · 기준 평균
          수량(μ) {MU} kg/10a. 수량 모드의 ΔG는 이론값 i·r·σA/L, 지수 모드는 표본 실현값 S/L입니다.{narrow && ' 선발 강도 i = φ(x)/p, x = Φ⁻¹(1 − p)(무한 집단 정규 절단 가정).'}
        </>
      }
    />
  )

  if (devState === 'error') {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState title="GEBV 예측 결과를 불러오지 못했습니다" description="GBLUP 예측 파일(후보 계통별 GEBV·신뢰도)을 읽는 중 오류가 났습니다. 잠시 뒤 다시 시도하세요." />
      </div>
    )
  }
  if (devState === 'empty') {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState title="선발할 후보 계통이 없습니다" description="유전형 분석과 GEBV 예측을 마친 계통이 아직 없습니다. 예측을 실행한 뒤 다시 확인하세요." />
      </div>
    )
  }
  if (devState === 'loading' || booting) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <Skeleton height={narrow ? 92 : 48} className="rounded-md" />
        <PageGrid>
          <Skeleton height={chartH + 90} className="col-span-12 rounded-lg lg:col-span-8" />
          <Skeleton height={chartH + 90} className="col-span-12 rounded-lg lg:col-span-4" />
        </PageGrid>
        <Skeleton height={96} className="rounded-lg" />
        <KpiRow loading hero count={4} skeletonHeight={120} />
      </div>
    )
  }

  const pTxt = `${pPct}%`
  const noIndex = result === null
  const S = result?.S
  const dGTxt = result ? result.dG.toFixed(1) : '–'
  const dGPctTxt = result ? `${result.dGpct.toFixed(2)}%/년` : '–'
  const dGFormula = isYield
    ? `ΔG = i·r·σA/L = ${i.toFixed(3)} × ${R_ACC} × ${SIGMA_A} / ${L}`
    : `수량 실현 선발 차 S / L = ${S ? S.yield.toFixed(1) : '–'} / ${L}(표본 기반)`
  const dGOver = result !== null && result.dGpct > DG_PCT_MAX
  const selItem = selectedName ? tableResult.byName.get(selectedName) ?? null : null

  const histLegend: LegendItem[] = [
    { label: `선발(상위 ${pTxt})`, color: theme.accent },
    { label: '비선발', color: `color-mix(in srgb, ${theme.textMuted} 40%, transparent)` },
    { label: '선발 기준선', color: theme.text, shape: 'line' },
    { label: '평균선(전체·선발)', color: theme.textMuted, shape: 'dashed' },
  ]
  const scatterLegend: LegendItem[] = [
    // 견본 모양 = 산점 마크 모양(선발 채운 원 · 비선발 빈 원, 공통 Legend shape)
    { label: '선발', color: theme.accent, shape: 'circle' },
    { label: '비선발', color: theme.textMuted, shape: 'ring' },
    isYield ? { label: '수량 기준선', color: theme.text, shape: 'line' } : { label: '두 형질 부분 지수(나머지 형질 고정)', color: theme.textMuted, shape: 'dashed' },
  ]
  const emptyIndex = <EmptyState title="가중치를 하나 이상 0보다 크게 설정하세요" description="다형질 선발 지수는 정규화 가중치 합이 1이어야 계산됩니다." className="h-full" />

  const diffDomain = result ? Math.max(0.5, ...TRAIT_KEYS.map(t => Math.abs(result.Sz[t]))) * 1.1 : 1

  const losing = result ? TRAIT_KEYS.filter(t => result.Sz[t] < 0).map(t => TRAITS[t].short) : []

  // 조작: 넓은 화면은 분포 아래, 390px은 분포 바로 위
  const conditionBar = (
    <Card padding="md">
      <div className="grid gap-x-8 gap-y-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
        <div className="flex flex-col gap-1.5">
          <span id="gebv-mode-label" className="text-xs font-medium text-muted">
            선발 기준
          </span>
          <Segmented ariaLabel="선발 기준" value={mode} onChange={setMode} options={MODE_OPTIONS} />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Slider
            label="선발 비율(p)"
            min={1}
            max={50}
            step={1}
            value={pPct}
            onChange={setPPct}
            format={v => `${v}%`}
            ticks={P_TICKS}
            pageStep={5}
            valueText={valueText}
            prominent
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-text">
            <span className="tabular-nums">
              {formatNumber(N)}계통 중 <b>{nSel}계통</b> 선발 · 선발 강도(i) = <b>{i.toFixed(3)}</b>
            </span>
            {lowDiversity && (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <SeverityTag severity="warning" />
                선발 수 {DIVERSITY_MIN}계통 미만 — 유전 다양성(Ne) 손실 위험
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  )

  const dGInfo = (
    <>
      실현 선발 차 S(수량) = {S ? `${formatSigned(S.yield, 1)} kg/10a` : '–'}, 기대 반응 R = i·r·σA = {(i * R_ACC * SIGMA_A).toFixed(2)} kg/10a/사이클. 예측 정확도 r = {R_ACC}는
      GBLUP 5-fold × 10회 교차 검증 평균. 계산 기준이 모드마다 다릅니다: 수량 모드는 이론값(i·r·σA/L), 지수 모드는 표본 실현값(S/L). 두 모드를 비교할 때는 실현 S/L끼리
      비교하세요{isYield && S ? ` (수량 모드 실현 S/L = ${(S.yield / L).toFixed(1)} kg/10a/년)` : ''}. 작물 수량의 현실적 범위는 0.5~{DG_PCT_MAX}%/년입니다.
    </>
  )

  // 선택 지표: 넓은 화면 KpiRow(대표 ΔG), 390px 가로 띠
  const tiles = [
    <KpiTile
      key="dg"
      size="hero"
      label="기대 연간 유전적 개량량(ΔG)"
      value={dGTxt}
      unit="kg/10a/년"
      sub={
        <span className="flex flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-1.5">
            <b className="text-text">{dGPctTxt}</b>
            {dGOver && <Badge tone="warning">{isYield ? '이론값 · ' : ''}카탈로그 범위(0.5~{DG_PCT_MAX}%/년) 초과</Badge>}
          </span>
          <span>{dGFormula}</span>
        </span>
      }
      info={narrow ? undefined : dGInfo}
    />,
    <KpiTile key="n" label="선발 계통 수" value={`${nSel} / ${formatNumber(N)}`} unit="계통" sub={`선발 비율(p) ${pTxt}`} />,
    <KpiTile
      key="i"
      label="선발 강도(i)"
      value={i.toFixed(3)}
      sub={`상위 ${pTxt} 절단`}
      info={narrow ? undefined : 'i = φ(x)/p, x = Φ⁻¹(1 − p). 무한 집단 정규 절단 가정(유한 집단 보정 없음).'}
    />,
    <KpiTile
      key="cut"
      label={isYield ? '기준 GEBV' : '기준 지수'}
      value={noIndex ? '–' : isYield ? formatSigned(result.cutoff, 1) : `I ≥ ${formatSigned(result.cutoff, 2)}`}
      unit={isYield && !noIndex ? 'kg/10a 이상' : undefined}
      sub={`${isYield ? '수량 GEBV' : '선발 지수(SD 단위)'} 순위 ${nSel}번째 계통 값`}
    />,
  ]

  const detailProps = { item: selItem, mode: noIndex ? ('yield' as const) : mode, wn, nSel }

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* 결론 띠: 머리 바로 아래 한 곳. 선발 조건에 따라 바뀐다 */}
      <SummaryCallout live tone={lowDiversity ? 'warning' : 'neutral'}>
        {noIndex ? (
          <>가중치를 하나 이상 0보다 크게 설정해야 선발 결과를 계산할 수 있습니다.</>
        ) : (
          <>
            상위 {pTxt} <b>{nSel}계통</b>을 {isYield ? '수량 GEBV로' : '다형질 선발 지수로'} 뽑으면 기대 ΔG는 <b>{dGTxt} kg/10a/년</b>({dGPctTxt})입니다.{' '}
            {losing.length > 0 ? (
              <>
                손해 형질은 <b>{losing.join('·')}</b>입니다.
              </>
            ) : (
              <>손해 형질은 없습니다.</>
            )}
            {lowDiversity && <> 선발 수가 {DIVERSITY_MIN}계통 미만이라 유전 다양성 손실을 주의하세요.</>}
          </>
        )}
      </SummaryCallout>

      {narrow && conditionBar}

      <PageGrid>
        {/* 주 그림: 분포 */}
        <ChartCard
          className="col-span-12 lg:col-span-8"
          title={isYield ? '수량 GEBV 분포와 선발 기준선' : '다형질 선발 지수 분포와 선발 기준선'}
          subtitle={`후보 ${formatNumber(N)}계통 · 구간 폭 ${isYield ? '4 kg/10a' : '0.1 SD'} · 선 = 커널 밀도(KDE)`}
          legend={noIndex ? undefined : histLegend}
          height={chartH}
          source="GEBV 기준점: 훈련 집단 평균 0. 후보 평균 +10.0은 이후 세대 개량분(목업)"
        >
          {result ? <SelectionHistogram result={result} mode={mode} selectedName={selectedName} height={chartH} compact={narrow} /> : emptyIndex}
        </ChartCard>

        {/* 형질별 선발 차 */}
        <Card className="col-span-12 self-start lg:col-span-4" title="형질별 선발 차" subtitle="선발 집단 평균 − 후보 평균, 표준화(SD) · 양수 = 바람직한 방향">
          {result && S ? (
            <div className="flex flex-col gap-4">
              {TRAIT_KEYS.map(t => {
                const def = TRAITS[t]
                return (
                  <DivergingBar
                    key={t}
                    label={def.short}
                    value={result.Sz[t]}
                    domain={diffDomain}
                    valueText={`${formatSigned(result.Sz[t], 2)} SD · ${formatSigned(S[t], def.digits)} ${def.unit}`}
                    negativeTag={<Badge tone="warning">손해</Badge>}
                  />
                )
              })}
              <p className="text-xs leading-relaxed text-muted">
                수량–식미 GEBV 상관 r = {formatSigned(CORR_WITH_YIELD.taste, 2)}, 수량–간장 r = {formatSigned(CORR_WITH_YIELD.culm, 2)}.{' '}
                {isYield
                  ? '수량 GEBV만으로 뽑으면 식미가 떨어지고 간장이 길어집니다. 다형질 선발 지수로 가중치를 나눠 보세요.'
                  : '수량 GEBV만으로 뽑을 때(수량 모드)는 식미가 떨어지고 간장이 길어집니다. 위 막대는 현재 가중치로 선발했을 때의 손익입니다.'}
              </p>
            </div>
          ) : (
            emptyIndex
          )}
        </Card>
      </PageGrid>

      {!narrow && conditionBar}

      {/* 선택 지표 */}
      {narrow ? (
        <MetricStrip label="선택 지표(가로 스크롤)">{tiles}</MetricStrip>
      ) : (
        <KpiRow hero ariaLabel="선택 지표">
          {tiles}
        </KpiRow>
      )}

      <PageGrid>
        {/* 경제적 가중치 */}
        <WeightPanel
          className="col-span-12 lg:col-span-4"
          weights={weights}
          wn={wn}
          preset={preset}
          onWeight={onWeight}
          onPreset={onPreset}
          disabled={isYield}
          collapsible={narrow}
          open={weightsOpen}
          onToggle={() => setWeightsOpen(o => !o)}
        />

        {/* 산점도 */}
        <ChartCard
          className="col-span-12 lg:col-span-8"
          title={`두 형질 GEBV — 수량 × ${TRAITS[yTrait].short}`}
          subtitle={`GEBV 상관 r = ${formatSigned(CORR_WITH_YIELD[yTrait], 2)} · 600계통`}
          legend={noIndex ? undefined : scatterLegend}
          actions={<Select label="y축 형질" value={yTrait} onChange={setYTrait} options={Y_TRAITS.map(t => ({ value: t, label: TRAITS[t].short }))} />}
          height={chartH}
        >
          {result ? (
            <TraitScatter
              result={result}
              mode={mode}
              yTrait={yTrait}
              wn={wn}
              corr={CORR_WITH_YIELD[yTrait]}
              selectedName={selectedName}
              onSelect={onSelectLine}
              height={chartH}
              compact={narrow}
            />
          ) : (
            emptyIndex
          )}
        </ChartCard>

        {/* 순위 표 */}
        <Card
          className={narrow ? 'col-span-12' : 'col-span-12 lg:col-span-8'}
          title="후보 계통 순위"
          subtitle={`${isYield || noIndex ? '수량 GEBV' : '다형질 선발 지수'} 내림차순 · 신뢰도(r²) < 0.20은 "낮음" · z는 바람직한 방향 +(간장·도열병 부호 반전)`}
        >
          <RankTable ranked={tableResult.ranked} mode={mode} selectedName={selectedName} onSelect={onSelectLine} />
        </Card>

        {/* 계통 상세: 390px은 행·점을 누르면 하단 시트 */}
        {!narrow && <LineDetail className="col-span-12 self-start lg:col-span-4 lg:sticky lg:top-4" {...detailProps} />}
      </PageGrid>

      <BottomSheet open={narrow && sheetOpen} onClose={() => setSheetOpen(false)} labelledBy="gebv-detail-title" header="계통 상세">
        <LineDetail className="border-0 p-0 shadow-none" titleId="gebv-detail-title" {...detailProps} />
      </BottomSheet>

      <p className="text-xs text-muted">
        계통명은 모두 가상이며 실존 계통·품종과 관계없습니다. 유전자(Pi-ta·Pib·Pi9·Pigm) 보유 표시도 가상입니다. 모든 수치는 목업입니다.
      </p>
    </div>
  )
}
