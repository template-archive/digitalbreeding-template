import { useCallback, useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
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
  Select,
  Skeleton,
  SummaryCallout,
  useMediaQuery,
} from '@/design-system'
import { useChartTheme } from '@/charts'
import { formatNumber } from '@/lib/format'
import {
  ADM_COUNT,
  ANALYSIS,
  BEST_K,
  CV_ERROR,
  GROUP_ORDER,
  GROUPS,
  GWAS_PCS,
  K_COMPONENTS,
  K_VALUES,
  LINES,
  N,
  PRUNED_SNPS,
  PVE,
  Q_ASSIGN,
  SUMMARY_BY_KEY,
  TOTAL_SNPS,
  orderLines,
  pveCum,
  type GroupKey,
  type KValue,
  type SortMode,
} from './data'
import { PcaScatter, pcAxisTitle, type BrushMode, type PcPair } from './components/PcaScatter'
import { MetricStrip } from './components/MetricStrip'
import { ScreeChart } from './components/ScreeChart'
import { AdmixtureBars } from './components/AdmixtureBars'
import { CvMiniChart } from './components/CvMiniChart'
import { GroupTable } from './components/GroupTable'
import { SelectedTable } from './components/SelectedTable'
import { componentColor, groupColor } from './components/colors'

export const meta: TemplateMeta = {
  slug: 'population-structure',
  category: 'viz',
  title: '집단 구조 분석',
  description: 'GWAS 패널의 PCA·ADMIXTURE 결과로 하위 집단 구성, GWAS 모형에 넣을 주성분 수의 적절성, 혼합형 계통의 위치를 확인한다.',
  tags: ['집단 구조', 'PCA', 'ADMIXTURE', '하위 집단', 'GWAS', '벼'],
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

/** 머리 둘째 줄(데이터 범위 한 문장). 기준일은 제목 줄 오른쪽 스탬프 */
const SCOPE_LINE = `${formatNumber(N)}계통 · 집단 구조 분석 SNP ${formatNumber(PRUNED_SNPS)}개(${formatNumber(TOTAL_SNPS)}개에서 연관불균형(LD) 가지치기, r² > 0.2) · 주성분 분석(PCA) + ADMIXTURE(K = 2~6) · GWAS 모형 ${ANALYSIS.model} · 분석일 ${ANALYSIS.analyzedAt}`

const PAIRS: { value: PcPair; label: string }[] = [
  { value: '12', label: 'PC1 × PC2' },
  { value: '13', label: 'PC1 × PC3' },
  { value: '23', label: 'PC2 × PC3' },
]
const SORTS: { value: SortMode; label: string }[] = [
  { value: 'group', label: '하위 집단 순' },
  { value: 'pc1', label: 'PC1 순' },
  { value: 'selected', label: '선택 계통 먼저' },
]

const PAIR_NOTE: Record<PcPair, string> = {
  '12': 'PC1이 자포니카형(오른쪽)과 인디카형(왼쪽)을, PC2가 온대 자포니카(위)와 열대 자포니카(아래)를 가른다',
  '13': 'PC3이 아우스(아래)를 인디카(위)에서 떼어 낸다',
  '23': 'PC2는 열대 자포니카를, PC3은 아우스를 각각 한쪽 끝으로 분리한다',
}

/** GWAS 결과 뷰어의 λGC 범위(형질별, 피크 ±1 Mb 제외 계산) — program-baseline 공유 기준값. 결론 문장에서 쓴다 */
const GWAS_LAMBDA_RANGE = [0.99, 1.06] as const

const BRUSH_WIDE: { value: BrushMode; label: string }[] = [
  { value: 'rect', label: '사각형' },
  { value: 'lasso', label: '자유형' },
]
/** 390px: 기본은 드래그해도 페이지가 스크롤된다. 모양을 고르면 그때부터 드래그가 선택이 된다 */
const BRUSH_NARROW: { value: BrushMode; label: string }[] = [{ value: 'off', label: '스크롤' }, ...BRUSH_WIDE]

const pct1 = (n: number) => `${((n / N) * 100).toFixed(1)}%`

export default function Template() {
  const [devState, setDevState] = useState<DevState>(readDevState)
  const [pair, setPair] = useState<PcPair>('12')
  const [brushChoice, setBrushChoice] = useState<BrushMode | null>(null)
  const [k, setK] = useState<KValue>(4)
  const [sort, setSort] = useState<SortMode>('group')
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [hidden, setHidden] = useState<ReadonlySet<GroupKey>>(() => new Set())
  const narrow = useMediaQuery('(max-width: 639px)')
  const theme = useChartTheme()
  const brushMode: BrushMode = brushChoice ?? (narrow ? 'off' : 'rect')

  const clear = useCallback(() => setSelected(new Set()), [])
  useEffect(() => {
    if (selected.size === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clear()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, clear])

  const onBrush = useCallback((ids: string[]) => setSelected(new Set(ids)), [])
  const groupIds = useCallback((g: GroupKey) => LINES.filter(l => l.group === g).map(l => l.id), [])
  const isGroupActive = useCallback(
    (g: GroupKey) => {
      const ids = groupIds(g)
      return selected.size === ids.length && ids.every(id => selected.has(id))
    },
    [selected, groupIds],
  )
  const onToggleGroup = useCallback((g: GroupKey) => setSelected(isGroupActive(g) ? new Set() : new Set(groupIds(g))), [isGroupActive, groupIds])
  const toggleHidden = (g: GroupKey) =>
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })

  const order = useMemo(() => orderLines(sort, selected), [sort, selected])
  const selectedLines = useMemo(() => order.filter(l => selected.has(l.id)), [order, selected])

  // 카드 높이: 차트 + 조작·범례·선택 줄. 390px 차트 면은 약 290px
  const pcaHeight = narrow ? 500 : 530
  const screeHeight = narrow ? 200 : 500
  const barHeight = narrow ? 200 : 240
  const [xi, yi] = [Number(pair[0]) - 1, Number(pair[1]) - 1]

  // 머리(공통 PageHeader: 범위 회색 한 줄 → 제목 + 기준일 스탬프 → 데이터 범위 한 문장)
  const pcInfo = `최적 K = ${BEST_K}이면 집단 ${BEST_K}개를 가르는 데 PC ${BEST_K - 1}개가 필요하다. PC1~PC3이 네 집단을 모두 분리하고 PC4부터 설명 분산이 ${PVE[3]}% 이하로 평평하므로 GWAS 모형 ${ANALYSIS.model}의 PC 수는 충분하다.`
  const header = (
    <PageHeader context={['벼', ANALYSIS.panel]} title={meta.title} scope={SCOPE_LINE} asOf={ANALYSIS.baseDate} details={narrow ? pcInfo : undefined} detailsLabel="공변량 PC 수 판단" />
  )

  if (devState === 'error') {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState
          title="집단 구조 분석 결과를 불러오지 못했습니다"
          description="PCA 고유벡터(.eigenvec)와 ADMIXTURE Q 파일을 읽는 중 오류가 났습니다. 잠시 뒤 다시 시도하세요."
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
        <Skeleton height={narrow ? 92 : 48} className="rounded-md" />
        <PageGrid>
          <Skeleton height={pcaHeight + 90} className="col-span-12 rounded-lg xl:col-span-8" />
          <Skeleton height={screeHeight + 90} className="col-span-12 rounded-lg xl:col-span-4" />
          <Skeleton height={barHeight + 140} className="col-span-12 rounded-lg" />
        </PageGrid>
        <KpiRow loading hero count={4} skeletonHeight={128} />
      </div>
    )
  }
  if (devState === 'empty') {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState title="분석 결과가 없습니다" description="이 패널로 실행한 PCA·ADMIXTURE 결과가 아직 없습니다. 유전형 QC를 마친 뒤 집단 구조 분석을 실행하세요." />
      </div>
    )
  }

  const s = SUMMARY_BY_KEY
  const cum = pveCum(GWAS_PCS)
  const groupLegend = GROUP_ORDER.map(g => ({ g, label: `${GROUPS[g].label} ${s[g].count}`, color: groupColor(theme, g) }))
  const pcaAria = `PCA 산점도 ${pcAxisTitle(xi)} × ${pcAxisTitle(yi)}, ${N}계통. ${PAIR_NOTE[pair]}. 혼합형 ${ADM_COUNT}계통은 집단 사이에 놓인다.`

  // 조작: 넓은 화면은 차트 아래, 390px은 차트 바로 위
  const pcaControls = (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented ariaLabel="주성분 쌍" value={pair} onChange={setPair} options={PAIRS} size="sm" />
      <Segmented ariaLabel="드래그 선택 모양" value={brushMode} onChange={setBrushChoice} options={narrow ? BRUSH_NARROW : BRUSH_WIDE} size="sm" />
    </div>
  )

  // 선택 지표: 넓은 화면 KpiRow, 390px 가로 띠. 띠 안에서는 위로 열리는 ⓘ가 잘리므로 뜻은 머리 「자세히」로
  const tiles = [
    <KpiTile
      key="pcs"
      size="hero"
      label="GWAS 공변량 PC"
      value={GWAS_PCS}
      unit="개"
      sub={`PC1~PC${GWAS_PCS} 누적 설명 분산 ${cum.toFixed(1)}%`}
      badge={<Badge tone="positive">K − 1 = {BEST_K - 1} 충족</Badge>}
      info={narrow ? undefined : pcInfo}
    />,
    <KpiTile key="k" label="하위 집단 수" value={BEST_K} unit="개" sub={`최적 K = ${BEST_K} · 교차 검증(CV) 오차 최소 ${CV_ERROR[BEST_K].toFixed(4)}`} />,
    <KpiTile key="adm" label="혼합형 계통" value={ADM_COUNT} unit="계통" sub={`${pct1(ADM_COUNT)} · 최대 Q < ${Q_ASSIGN.toFixed(2)}`} />,
    <KpiTile key="n" label="분석 규모" value={formatNumber(N)} unit="계통" sub={`SNP ${formatNumber(PRUNED_SNPS)}개(LD 가지치기)`} />,
  ]

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* 결론 띠(공통 SummaryCallout: 머리 바로 아래 한 곳) */}
      <SummaryCallout>
        패널은 4개 하위 집단(온대 자포니카 <b>{s.TEJ.count}</b> · 열대 자포니카 <b>{s.TRJ.count}</b> · 인디카 <b>{s.IND.count}</b> · 아우스 <b>{s.AUS.count}</b>)과 혼합형{' '}
        <b>{ADM_COUNT}</b>계통으로 나뉩니다. PC1~PC3이 네 집단을 모두 가르므로 GWAS 모형의 PC 3개는 집단 구조 보정에 충분합니다(λGC {GWAS_LAMBDA_RANGE[0].toFixed(2)}~{GWAS_LAMBDA_RANGE[1].toFixed(2)}, GWAS 결과 뷰어).
      </SummaryCallout>

      <PageGrid>
        <ChartCard
          className="col-span-12 xl:col-span-8"
          title={`PCA — ${pcAxisTitle(xi)} × ${pcAxisTitle(yi)}`}
          subtitle={PAIR_NOTE[pair]}
          height={pcaHeight}
          source="값 = 고유벡터(plink --pca), 점 퍼짐은 설명 분산에 비례하지 않음 · 축 제목의 %가 각 PC의 설명 분산 · 범례를 누르면 집단 표시/숨김"
        >
          <div className="flex h-full flex-col">
            {narrow && <div className="mb-2">{pcaControls}</div>}
            <div className="min-h-0 flex-1">
              <PcaScatter pair={pair} mode={brushMode} hidden={hidden} selected={selected} onBrush={onBrush} height="100%" narrow={narrow} ariaLabel={pcaAria} />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-2">
              {!narrow && pcaControls}
              <ul className="flex flex-wrap gap-1.5 touch:gap-2" aria-label="하위 집단 표시">
                {groupLegend.map(it => {
                  const off = hidden.has(it.g)
                  return (
                    <li key={it.g}>
                      <button
                        type="button"
                        aria-pressed={!off}
                        onClick={() => toggleHidden(it.g)}
                        className={`touch-hit inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors ${off ? 'border-border text-muted line-through' : 'border-border bg-surface-2 text-text'}`}
                      >
                        <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: off ? 'transparent' : it.color, boxShadow: `inset 0 0 0 1.5px ${it.color}` }} />
                        {it.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
            {/* 선택 상태·안내 */}
            <div className="mt-2 flex min-h-8 flex-wrap items-center gap-2 text-xs" aria-live="polite">
              {selected.size > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-text/40 bg-active py-0.5 pl-3 pr-1 text-[13px] text-text">
                  <span className="tabular-nums">
                    {formatNumber(N)}계통 중 <b>{selected.size}</b>계통 선택
                  </span>
                  <button
                    type="button"
                    onClick={clear}
                    className="touch-hit inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-text hover:bg-surface"
                  >
                    <X size={12} aria-hidden="true" />
                    선택 해제
                  </button>
                </span>
              ) : (
                <span className="break-keep text-muted">
                  {narrow
                    ? '하위 집단 요약 표의 행을 누르면 그 집단을 고릅니다. 모양을 사각형·자유형으로 바꾸면 점을 드래그해 고릅니다.'
                    : 'PCA에서 드래그해 계통을 고르면 ADMIXTURE 막대와 표가 함께 바뀝니다. 요약 표의 행을 눌러 집단 전체를 고를 수도 있습니다.'}
                </span>
              )}
            </div>
          </div>
        </ChartCard>

        {narrow && (
          <div className="col-span-12 min-w-0">
            <MetricStrip label="선택 지표(가로 스크롤)">{tiles}</MetricStrip>
          </div>
        )}

        <ChartCard
          className="col-span-12 xl:col-span-4"
          title="주성분별 설명 분산"
          subtitle={`PC1~PC${GWAS_PCS} 누적 ${cum.toFixed(1)}% · PC4부터 ${PVE[3]}% 이하로 평평`}
          legend={[
            { label: `GWAS 공변량(PC1~PC${GWAS_PCS})`, color: theme.text },
            { label: 'PC4~PC10', color: `color-mix(in srgb, ${theme.textMuted} 45%, transparent)` },
          ]}
          height={screeHeight}
          source={`PC1~PC10 누적 ${pveCum(10).toFixed(1)}% · 설명 분산은 예시 값`}
        >
          <ScreeChart height={screeHeight} narrow={narrow} />
        </ChartCard>

        {!narrow && (
          <div className="col-span-12 min-w-0">
            <KpiRow hero ariaLabel="선택 지표">
              {tiles}
            </KpiRow>
          </div>
        )}

        <ChartCard
          className="col-span-12"
          title={`ADMIXTURE 조상 성분 — K = ${k}`}
          subtitle={`계통 ${N}개 · 막대 하나가 한 계통 · K를 바꿔도 계통 순서는 유지(K끼리 비교)`}
          actions={<CvMiniChart currentK={k} />}
          height={barHeight + (narrow ? 150 : 92)}
          source="자식성 근교계라 하디-바인베르크 가정을 만족하지 않으므로 Q는 조상 성분 비율의 근사입니다 · CV 오차는 5겹 교차 검증(예시 값)"
        >
          <div className="flex h-full flex-col">
            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Segmented ariaLabel="ADMIXTURE K" value={String(k)} onChange={v => setK(Number(v) as KValue)} options={K_VALUES.map(v => ({ value: String(v), label: `K=${v}` }))} size="sm" />
              <Select label="정렬" value={sort} onChange={setSort} options={SORTS} />
              <Legend items={K_COMPONENTS[k].map(c => ({ label: c.label, color: componentColor(theme, c.color) }))} />
            </div>
            <div className="min-h-0 flex-1">
              <AdmixtureBars k={k} order={order} sort={sort} selected={selected} narrow={narrow} />
            </div>
          </div>
        </ChartCard>

        <section className="col-span-12 flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1 xl:col-span-7">
          <div>
            <h3 className="text-[15px] font-semibold leading-snug text-text">하위 집단 요약</h3>
            <p className="mt-0.5 text-xs text-muted">
              소속 판정: K = 4에서 최대 Q ≥ {Q_ASSIGN.toFixed(2)}, 미만은 혼합형 · 행을 누르거나 Enter로 그 집단 전체를 선택
            </p>
          </div>
          <GroupTable selected={selected} onToggleGroup={onToggleGroup} isGroupActive={isGroupActive} />
        </section>

        {/* 선택 계통 카드는 옆 요약 표 높이로 늘이지 않는다(빈 상태에서 빈 띠 방지) */}
        <section className="col-span-12 flex min-w-0 flex-col gap-3 self-start rounded-lg border border-border bg-surface p-4 shadow-1 xl:col-span-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-[15px] font-semibold leading-snug text-text">선택 계통</h3>
              <p className="mt-0.5 text-xs text-muted">ADMIXTURE 막대와 같은 순서 · PC 값은 고유벡터(소수 4자리)</p>
            </div>
            {selected.size > 0 && (
              <span className="text-xs text-muted tabular-nums">
                {selectedLines.length}계통
              </span>
            )}
          </div>
          <SelectedTable lines={selectedLines} />
        </section>
      </PageGrid>

      <p className="text-xs text-muted">
        계통명·자원 번호는 모두 가상이며 실존 계통·품종과 관계없습니다. 설명 분산·CV 오차는 예시 값입니다. 집단 구조 분석 SNP {formatNumber(PRUNED_SNPS)}개는 {ANALYSIS.ldPrune} 후 남은 수입니다.
      </p>
    </div>
  )
}
