import { useCallback, useMemo, useState } from 'react'
import type { TemplateMeta } from '@/gallery/types'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  KpiRow,
  KpiTile,
  PageHeader,
  ScrollRegion,
  Segmented,
  Select,
  Skeleton,
  SummaryCallout,
  Switch,
  type DataTableSort,
  useElementWidth,
  useMediaQuery,
} from '@/design-system'
import {
  BASE_DATE,
  DEFAULT_SELECTION,
  GRM_DATE,
  H_E,
  LINES,
  N,
  ORDERS,
  PAIRS,
  PAIR_BY_KEY,
  PAIR_FILTER_COUNT,
  PAIR_FILTER_LABEL,
  PAIR_FILTER_TEST,
  SNP_COUNT,
  SORT_LABEL,
  SUMMARY,
  TRAIN_N,
  TREE,
  KIN_CLUSTERS,
  fmt2,
  fmt3,
  fmtInt,
  pairKey,
  type Pair,
  type PairFilter,
  type SortKey,
} from './data'

/** 「G 척도·계산식」·척도 줄 숫자(직접 쓰지 않는다): 음수 G 쌍 수·최솟값, 척도 예시 = 기본 선택 쌍(YR22-0412 × YR22-0415) */
const NEG_G_PAIRS = PAIRS.filter(p => p.G < 0)
const NEG_G_MIN = Math.min(...NEG_G_PAIRS.map(p => p.G))
const SCALE_EXAMPLE = PAIR_BY_KEY.get(pairKey(...DEFAULT_SELECTION))!
import { KinshipHeatmap, computeLayout, type Cell } from './components/KinshipHeatmap'
import { ScaleLegend } from './components/ScaleLegend'
import { PairDetail } from './components/PairDetail'
import { DEFAULT_SORT, PAGE_SIZE, PairTable, sortPairs } from './components/PairTable'
import { GroupMeanTable } from './components/GroupMeanTable'
import { MetricStrip } from './components/MetricStrip'

export const meta: TemplateMeta = {
  slug: 'kinship-heatmap',
  category: 'viz',
  title: '유전적 관계 히트맵',
  description:
    '교배 부모 후보 60계통의 유전체 관계 행렬(GRM)을 군집 순 히트맵과 덴드로그램으로 보고, 근연 군집과 두 계통의 관계 계수 G(2f 척도)·공조계수 f를 계보 기대값과 비교하는 화면.',
  tags: ['GRM', '유전체 관계', '공조계수', '근연', 'UPGMA', '히트맵', '벼'],
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

const SORT_OPTIONS: { value: SortKey; label: string }[] = (['cluster', 'gebv', 'group'] as SortKey[]).map(v => ({ value: v, label: SORT_LABEL[v] }))
const halfSibBlocks = KIN_CLUSTERS.filter(c => c.ids.length === 6).length
const FILTER_OPTIONS: { value: PairFilter; label: string }[] = (['flagged', 'warn', 'ped', 'all'] as PairFilter[]).map(v => ({
  value: v,
  label: `${PAIR_FILTER_LABEL[v]}(${fmtInt(PAIR_FILTER_COUNT[v])})`,
}))

/** 390px 계통 선택(셀 5px은 정확히 누를 수 없다). 이름순 */
const LINE_OPTIONS = LINES.map(l => ({ value: String(l.idx), label: l.name })).sort((a, b) => a.label.localeCompare(b.label, 'ko', { numeric: true }))

export default function Template() {
  const narrowScreen = useMediaQuery('(max-width: 639px)')
  const [devState, setDevState] = useState<DevState>(readDevState)
  const [sort, setSort] = useState<SortKey>('cluster')
  const [showDiag, setShowDiag] = useState(false)
  const [cell, setCell] = useState<Cell>({ row: DEFAULT_SELECTION[0], col: DEFAULT_SELECTION[1] })
  const [filter, setFilter] = useState<PairFilter>('flagged')
  const [tableSort, setTableSort] = useState<DataTableSort | null>(DEFAULT_SORT)
  const [page, setPage] = useState(0)
  const { ref: chartBoxRef, width } = useElementWidth<HTMLDivElement>()
  const layout = computeLayout(width, sort)

  const rows = useMemo(() => PAIRS.filter(PAIR_FILTER_TEST[filter]), [filter])
  const sorted = useMemo(() => sortPairs(rows, tableSort), [rows, tableSort])
  const selKey = cell.row === cell.col ? null : pairKey(cell.row, cell.col)
  const selInTable = selKey !== null && rows.some(p => p.key === selKey)

  /** 셀 선택: 상세 갱신 + 표에서 그 쌍이 있는 쪽으로 이동 */
  const selectCell = useCallback(
    (c: Cell) => {
      setCell(c)
      if (c.row === c.col) return
      const k = sorted.findIndex(p => p.key === pairKey(c.row, c.col))
      if (k >= 0) setPage(Math.floor(k / PAGE_SIZE))
    },
    [sorted],
  )
  const selectRow = useCallback((p: Pair) => setCell({ row: p.i, col: p.j }), [])

  const changeFilter = (f: PairFilter) => {
    setFilter(f)
    const nextSorted = sortPairs(PAIRS.filter(PAIR_FILTER_TEST[f]), tableSort)
    const k = selKey ? nextSorted.findIndex(p => p.key === selKey) : -1
    setPage(k >= 0 ? Math.floor(k / PAGE_SIZE) : 0)
  }

  // 머리(공통 PageHeader): 범위 → 제목 + 기준일 → 데이터 한 문장 → G 척도 계산식·음수 G 설명은 「자세히」
  // (척도 핵심 한 줄은 히트맵 카드 안 범례 위에 항상 보인다)
  const header = (
    <PageHeader
      context={['벼 · 자식성 고정 근교계', '2027년 1차 교배 계획 부모 후보']}
      title={meta.title}
      scope={`부모 후보 ${N}계통 · VanRaden 유전체 관계 행렬(GRM) · 6K SNP 칩 ${fmtInt(SNP_COUNT)} SNP · 계산 ${GRM_DATE} · 목업 데이터`}
      asOf={BASE_DATE}
      detailsLabel="G 척도·계산식"
      details={
        <div className="flex flex-col gap-1.5">
          <p>
            <b className="text-text">VanRaden 방법 1</b>: G = ZZ′ / (2 Σ p<sub>k</sub>(1 − p<sub>k</sub>)), Z = M − 2p. M은 대체 대립유전자 수(0/1/2), p는 훈련 집단 {fmtInt(TRAIN_N)}
            계통에서 추정한 대립유전자 빈도.
          </p>
          <p>
            근교계 두 계통 P, Q: G<sub>PQ</sub> = 2·f<sub>PQ</sub>. 자기 관계 G<sub>PP</sub> = 1 + F<sub>P</sub>, F = 1 − H<sub>o</sub> / H<sub>e</sub>(H<sub>e</sub> = {fmt2(H_E)}, 추정).
          </p>
          <p>
            기준 집단(훈련 집단) 평균보다 먼 쌍은 G가 음수입니다. 이 후보 집단에서는 C 저항성 공여와 A·B 사이 {fmtInt(NEG_G_PAIRS.length)}쌍이 음수(최소 {fmt2(NEG_G_MIN)})이며, 히트맵은 0과 같은 최저 색으로 칠하고
            툴팁·표에 실제 값을 보입니다.
          </p>
          <p>근연 등급은 f 척도로 판정: f ≥ 0.375(G ≥ 0.75) 강한 근연, 0.25 ≤ f &lt; 0.375(0.50 ≤ G &lt; 0.75) 근연 주의.</p>
        </div>
      }
    />
  )

  if (devState === 'error') {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState
          title="유전체 관계 행렬을 불러오지 못했습니다"
          description="유전체 분석실 GRM 계산 결과(2026-10-22) 응답이 없습니다. 잠시 뒤 다시 시도하세요."
          action={<Button onClick={() => setDevState('ready')}>다시 시도</Button>}
        />
      </div>
    )
  }
  if (devState === 'loading') {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <Skeleton height={narrowScreen ? 92 : 48} className="rounded-md" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2" title="60 × 60 유전체 관계 행렬" subtitle="관계 행렬을 불러오는 중…">
            <div className="mx-auto aspect-square w-full max-w-[640px]">
              <Skeleton height="100%" />
            </div>
          </Card>
          <Card title="셀 상세">
            <Skeleton height={320} />
          </Card>
        </div>
        <KpiRow loading hero count={5} skeletonHeight={112} />
        <Card title="근연 쌍 표">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} height={28} />
            ))}
          </div>
        </Card>
      </div>
    )
  }
  if (devState === 'empty') {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState
          title="관계를 계산할 계통이 2개 이상 필요합니다"
          description="부모 후보 목록에 유전형이 있는 계통이 2개 미만입니다. 교배 조합 설계 화면에서 후보를 추가하면 관계 행렬이 표시됩니다."
        />
      </div>
    )
  }

  const order = ORDERS[sort]

  // 선택 지표: 대표 = 강한 근연 쌍(결론 숫자). 후보 수·SNP 수는 머리 문장에 있다. 390px은 가로 띠(ⓘ가 잘려 뜻은 「G 척도·계산식」으로)
  const tiles = [
    <KpiTile key="warn" size="hero" label="강한 근연 쌍" value={SUMMARY.warn} unit="쌍" sub={`f ≥ 0.375 · 모두 같은 가계 · 전체 ${fmtInt(SUMMARY.pairs)}쌍 중`} />,
    <KpiTile key="caution" label="근연 주의 쌍" value={SUMMARY.caution} unit="쌍" sub="0.25 ≤ f < 0.375" />,
    <KpiTile
      key="clusters"
      label="근연 군집"
      value={SUMMARY.clusters}
      unit="개"
      sub="평균 f ≥ 0.25 · 2계통 이상"
      info={narrowScreen ? undefined : 'UPGMA 덴드로그램(거리 1 − f)을 0.75(평균 f 0.25)에서 잘랐을 때 2계통 이상인 군집 수.'}
    />,
    <KpiTile
      key="meanG"
      label="평균 관계 G(비대각)"
      value={fmt2(SUMMARY.meanG)}
      sub={`f ${fmt2(SUMMARY.meanF)} · 2f 척도 · 범위 ${fmt2(SUMMARY.minG)} ~ ${fmt2(SUMMARY.maxG)}`}
      info={narrowScreen ? undefined : '대각을 뺀 1,770쌍의 G 평균. f = G/2로 읽는다.'}
    />,
    <KpiTile
      key="diag"
      label="평균 대각 1 + F"
      value={fmt2(SUMMARY.meanDiag)}
      sub={`F ${fmt3(SUMMARY.minF)} ~ ${fmt3(SUMMARY.maxF)}`}
      info={narrowScreen ? undefined : '자기 관계 G = 1 + F. F₆ 이상 고정 근교계라 2에 가깝다.'}
    />,
  ]

  // 조작: 넓은 화면은 히트맵 아래, 390px은 히트맵 바로 위
  const controls = (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted">정렬</span>
        <Segmented ariaLabel="히트맵 정렬" size="sm" options={SORT_OPTIONS} value={sort} onChange={setSort} />
      </div>
      <Switch className="h-8" checked={showDiag} onChange={setShowDiag} label="대각(1 + F) 강조" />
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* 결론 띠: 머리 바로 아래 한 곳 */}
      <SummaryCallout>
        <b>강한 근연 {SUMMARY.warn}쌍</b>·근연 주의 {SUMMARY.caution}쌍. <b>근연 군집 {SUMMARY.clusters}개</b>가 대각을 따라 진한 블록으로 보인다: 반형제 가계 묶음(6계통) {halfSibBlocks}개, 같은 가계(2~3계통){' '}
        {SUMMARY.clusters - halfSibBlocks}개. 덴드로그램 첫 분기(평균 거리 {fmt3(TREE.h)})는 A·B {TREE.left!.ids.length}계통 | C 저항성 공여 {TREE.right!.ids.length}계통이다.
      </SummaryCallout>

      {/* 주 그림 + 셀 상세·그룹 평균(오른쪽 한 열로 쌓아 늘어나지 않게) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          className="min-w-0 lg:col-span-2"
          title="60 × 60 유전체 관계 행렬"
          subtitle={`군집 순 = 비가중 평균 연결 군집(UPGMA, 거리 1 − f) 잎 순서 · GEBV 순 = 쌀 수량 유전체 추정 육종가(GEBV) 내림차순${layout.narrow ? '' : ' · 셀을 누르면 상세'}`}
        >
          <div className="flex flex-col gap-3">
            {narrowScreen && controls}
            {layout.narrow && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Select label="계통 1" value={String(cell.row)} onChange={v => selectCell({ row: Number(v), col: cell.col })} options={LINE_OPTIONS} />
                <Select label="계통 2" value={String(cell.col)} onChange={v => selectCell({ row: cell.row, col: Number(v) })} options={LINE_OPTIONS} />
                <p className="break-keep text-xs text-muted">셀이 작아 위 두 칸이나 아래 근연 쌍 목록에서 고릅니다{sort === 'cluster' ? ' · 군집 순 정렬 중' : ''}</p>
              </div>
            )}
            <ScrollRegion scrollRef={chartBoxRef} className="w-full" label="유전체 관계 히트맵(가로 스크롤)" hint="옆으로 밀어 히트맵 전체 보기 →">
              {width > 0 && <KinshipHeatmap order={order} sort={sort} showDiag={showDiag} selected={cell} onSelect={selectCell} width={width} />}
            </ScrollRegion>
            <div className="flex flex-col gap-3 border-t border-border pt-3">
              {!narrowScreen && controls}
              <ScaleLegend showDiag={showDiag} />
              {sort === 'group' && <p className="text-xs text-muted">굵은 선: 그룹 경계(A 30 / B 20 / C 10)</p>}
              {/* 척도 핵심: 계산식·음수 G는 머리 「G 척도·계산식」 */}
              <p className="break-keep text-xs leading-relaxed text-muted">
                관계 계수 G = 유전체 관계 행렬(GRM) 값, 근교계 사이 <b className="text-text">2f 척도</b>(<b className="text-text">G {fmt2(SCALE_EXAMPLE.G)} ↔ 공조계수(f) {fmt2(SCALE_EXAMPLE.f)}</b>). 계보 공조계수(계통도
                탐색기)와는 <b className="text-text">G/2</b>로 비교하고, 대각 1 + 근교계수(F)(근교계 ≈ 2)는 색 척도에서 뺍니다.
              </p>
            </div>
            <p className="sr-only" aria-live="polite">
              선택: {LINES[cell.row]!.name} × {LINES[cell.col]!.name}
              {cell.row === cell.col
                ? `, 자기 관계 G ${fmt2(1 + LINES[cell.row]!.F)}`
                : `, G ${fmt2(PAIR_BY_KEY.get(pairKey(cell.row, cell.col))!.G)}, f ${fmt2(PAIR_BY_KEY.get(pairKey(cell.row, cell.col))!.f)}`}
            </p>
          </div>
        </Card>
        <div className="flex min-w-0 flex-col gap-4 self-start">
          <PairDetail cell={cell} className="min-w-0" />
          <Card className="min-w-0" title="그룹별 평균 관계" subtitle="비대각 G 평균(괄호 f = G/2) · 쌍 수">
            <GroupMeanTable />
          </Card>
        </div>
      </div>

      {/* 선택 지표 */}
      {narrowScreen ? (
        <MetricStrip label="선택 지표(가로 스크롤)">{tiles}</MetricStrip>
      ) : (
        <KpiRow hero ariaLabel="선택 지표">
          {tiles}
        </KpiRow>
      )}

      <Card className="min-w-0" title="근연 쌍 표" subtitle="G 내림차순 · 행을 누르면 히트맵 선택 셀과 셀 상세가 바뀐다">
        <div className="-mx-1 mb-3 overflow-x-auto px-1 pb-1 touch:py-2">
          <Segmented ariaLabel="근연 쌍 필터" size="sm" options={FILTER_OPTIONS} value={filter} onChange={changeFilter} />
        </div>
        {selKey !== null && !selInTable && (
          <p className="mb-2 text-xs text-muted">
            선택 쌍 {LINES[cell.row]!.name} × {LINES[cell.col]!.name}은(는) 현재 필터({PAIR_FILTER_LABEL[filter]})에 없습니다.
          </p>
        )}
        <PairTable
          rows={rows}
          sorted={sorted}
          sort={tableSort}
          onSortChange={s => {
            setTableSort(s)
            setPage(0)
          }}
          page={page}
          onPageChange={setPage}
          selectedKey={selKey}
          onSelect={selectRow}
        />
      </Card>

      <footer className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted">
        <p>
          G는 VanRaden 유전체 관계 행렬(GRM) 값(근교계 사이 2f 척도). 계보 f는 자식성 공조계수 재귀식(같은 가계 (1 + f부모)/2, 반형제 가계 0.25) 기대값이며, 그 밖의 쌍은 계보상 공통
          조상 미기록이다.
        </p>
        <p>H_e = 0.40과 GRM 계산일 {GRM_DATE}은 목업 가정값이다. 수량 GEBV는 쌀 수량(kg/10a) 기준.</p>
        <p>계통명은 모두 가상이며 실존 계통·품종과 관계없습니다.</p>
      </footer>
    </div>
  )
}
