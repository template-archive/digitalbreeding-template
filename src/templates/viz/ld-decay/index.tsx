import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'
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
  Switch,
  useMediaQuery,
  useElementWidth,
} from '@/design-system'
import { useChartTheme } from '@/charts'
import { formatFixed, formatNumber, josa } from '@/lib/format'
import {
  ADM_COUNT,
  ANALYSIS,
  BLOCK_MIN_SNP,
  BLOCK_R2,
  CHROMS,
  DECAY,
  GROUPS,
  GROUP_INDEX,
  HALF_BP,
  LIT_TEJ_KB,
  MAF_MIN,
  PRESETS,
  PROXY_R2,
  QTL_HALF_KB,
  R2_CUT,
  TRAIT_SHORT,
  bgFold,
  blockSpanKb,
  computeAll,
  kb0,
  windowLabel,
  type GroupKey,
  type LdData,
  type PresetView,
  type PresetWindow,
} from './data'
import { DEPTH_RATIO, LdHeatmap, heatmapHeight } from './components/LdHeatmap'
import { DECAY_X_MAX, DecayChart, LINE_DASHED, decaySlice } from './components/DecayChart'
import { MetricStrip } from './components/MetricStrip'
import { ChrDotPlot } from './components/ChrDotPlot'
import { GroupTable } from './components/GroupTable'
import { BlockTable, blockRows } from './components/BlockTable'
import { PeakTable } from './components/PeakTable'
import { R2Legend } from './components/R2Legend'
import { GROUP_MARK, groupColor } from './components/colors'

export const meta: TemplateMeta = {
  slug: 'ld-decay',
  category: 'viz',
  title: 'LD 구조',
  description: 'GWAS 패널의 연관불균형(LD) 감소 거리(r² = 0.2)를 하위 집단·염색체별로 비교하고, 유의 피크 구간의 LD 블록과 리드 SNP 프록시로 파인 매핑 범위를 정한다.',
  tags: ['LD', '연관불균형', 'LD 감소', 'LD 블록', 'GWAS', '파인 매핑', '벼'],
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

/** 머리 둘째 줄(데이터 한 문장) */
const SCOPE_LINE = `${ANALYSIS.panel} ${formatNumber(ANALYSIS.lines)}계통 · ${formatNumber(ANALYSIS.snps)} SNP · 연관불균형(LD) r² · ${ANALYSIS.reference} · 분석일 ${ANALYSIS.analyzedAt} · 목업 데이터`

const groupLabel = (k: GroupKey) => GROUPS.find(g => g.key === k)!.label
const groupText = (k: GroupKey) => {
  const g = GROUPS.find(x => x.key === k)!
  return `${g.short} ${formatNumber(g.n)}계통`
}

/** SNP ID·이름 뒤 조사(@/lib/format josa: 숫자 0·1·3·6·7·8은 받침) */
const topic = (s: string) => josa(s, '는은')
const withAnd = (s: string) => josa(s, '와과')

function leadSentence(win: PresetWindow, v: PresetView, group: GroupKey): string {
  const p = PRESETS[win.pi]!
  const id = win.snps[win.leadIdx]!.id
  const pre = group === 'ALL' ? '' : `${groupLabel(group)} 기준, `
  const head = `${pre}${p.name} 구간 리드 SNP ${topic(id)}`
  if (v.mono) return `${head} 이 집단에서 단형(집단 내 MAF ${formatFixed(v.leadMaf, 3)} < ${MAF_MIN})이라 블록과 프록시를 정할 수 없다.`
  if (!v.leadBlock) return `${head} r² ≥ ${BLOCK_R2} 스파인 블록 밖에 있고 프록시(r² ≥ ${PROXY_R2})는 ${v.proxies.length}개다(희소 대립유전자 리드).`
  const blk = `${head} ${blockSpanKb(win, v.leadBlock).toFixed(1)} kb 블록(${v.leadBlock.nSnp} SNP)에 있고`
  const k = p.others.findIndex((_, i) => v.otherR2[i] != null)
  if (k >= 0) {
    const o = p.others[k]!
    const oi = win.otherIdx[k]!
    const same = oi >= v.leadBlock.from && oi <= v.leadBlock.to
    const oid = win.snps[oi]!.id
    return `${blk}, ${TRAIT_SHORT[o.trait]} 리드 ${withAnd(oid)} r² ${v.otherR2[k]!.toFixed(2)}로 ${same ? '같은 블록이다' : '다른 블록이다'}.`
  }
  if (v.geneIn === true) return `${blk}, 후보 유전자(${p.planted.gene})는 블록 안에 있다.`
  if (v.geneIn === false) return `${blk}, 후보 유전자(${p.planted.gene})는 블록 끝에서 ${v.geneOutKb!.toFixed(1)} kb 밖에 있다.`
  return `${blk}, 프록시(r² ≥ ${PROXY_R2})는 ${v.proxies.length}개다.`
}

export default function Template() {
  const [devState, setDevState] = useState<DevState>(readDevState)
  const [data, setData] = useState<LdData | null>(null)
  const [calcError, setCalcError] = useState<string | null>(null)
  const [pi, setPi] = useState(0)
  const [group, setGroup] = useState<GroupKey>('ALL')
  const [chr, setChr] = useState(-1)
  const [showRaw, setShowRaw] = useState(false)
  const [blocksOpen, setBlocksOpen] = useState(true)
  const narrow = useMediaQuery('(max-width: 639px)')
  const theme = useChartTheme()
  const topRef = useRef<HTMLDivElement>(null)
  const left = useElementWidth()

  // 감소 곡선(72창 × 5집단)·프리셋(12창 × 5집단) 계산 — 첫 화면(Skeleton)을 그린 뒤 한 번
  useEffect(() => {
    if (devState !== 'ready' || data || calcError) return
    const id = window.setTimeout(() => {
      try {
        setData(computeAll())
      } catch (e) {
        setCalcError(e instanceof Error ? e.message : String(e))
      }
    }, 30)
    return () => window.clearTimeout(id)
  }, [devState, data, calcError])

  const gi = GROUP_INDEX[group]
  const selectPreset = useCallback((next: number) => {
    setPi(next)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
  const selectChr = useCallback((ci: number) => setChr(c => (c === ci ? -1 : ci)), [])

  const heatW = Math.max(0, left.width - 34)
  const chartH = heatmapHeight(heatW || 640)
  const legendH = narrow ? 92 : heatW < 720 ? 50 : 26
  const decayH = narrow ? 300 : 380
  const dotH = narrow ? 320 : 330

  // 머리(공통 PageHeader): 범위 → 제목 + 기준일 → 데이터 한 문장 → 필터·화면 연동 설명은 「자세히」
  const header = (
    <PageHeader
      context={['벼 · 연관불균형(LD) 구조', 'GWAS 패널']}
      title={meta.title}
      scope={SCOPE_LINE}
      asOf={ANALYSIS.baseDate}
      details={
        <>
          SNP 필터: 소수 대립유전자 빈도(MAF) ≥ {ANALYSIS.mafMin}, 콜레이트 ≥ {Math.round(ANALYSIS.callRateMin * 100)}%, 근교계 0/1 유전형. 히트맵·블록 목록·블록 KPI·바로 가기 표는 피크
          구간과 집단 선택을 따르고, 감소 곡선의 염색체 선택은 첫 KPI(패널 전체 감소 거리)만 바꿉니다.
          {narrow && ` LD 감소 거리: 적합 곡선 r² = b + a/(1 + d/h)가 r² = ${R2_CUT}와 만나는 거리이고, b는 다른 염색체 SNP 쌍(비연관)의 평균 r²로 고정했습니다.`}
        </>
      }
    />
  )

  const groupOptions = GROUPS.map(g => ({ value: g.key, label: `${g.short} ${g.n}` }))
  const controls = (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
      <Select label="피크 구간" value={String(pi)} onChange={v => setPi(Number(v))} options={PRESETS.map(p => ({ value: String(p.pi), label: p.label }))} />
      {narrow ? (
        <Select label="집단" value={group} onChange={setGroup} options={groupOptions} />
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted">집단</span>
          <Segmented ariaLabel="집단" value={group} onChange={setGroup} options={groupOptions} size="sm" />
        </div>
      )}
    </div>
  )

  if (devState === 'error' || calcError) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState
          title="LD 계산 결과를 불러오지 못했습니다"
          description={calcError ? `r² 계산 중 오류가 났습니다(${calcError}).` : '유전형 행렬(.bed)과 SNP 위치 파일을 읽는 중 오류가 났습니다. 잠시 뒤 다시 시도하세요.'}
          action={
            <Button
              variant="primary"
              onClick={() => {
                setCalcError(null)
                setDevState('ready')
              }}
            >
              다시 시도
            </Button>
          }
        />
      </div>
    )
  }
  if (devState === 'empty') {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState title="LD 분석 결과가 없습니다" description="이 패널의 유전형 QC를 마친 뒤 LD 계산(r², 1 Mb 창)을 실행하세요. GWAS 유의 좌위가 있으면 피크 구간 히트맵이 함께 만들어집니다." />
      </div>
    )
  }

  const loading = devState === 'loading' || !data
  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <Skeleton height={narrow ? 92 : 48} className="rounded-md" />
        <PageGrid>
          <div ref={left.ref} className="col-span-12 flex min-w-0 flex-col gap-4 xl:col-span-7">
            <Skeleton height={chartH + legendH + 130} className="rounded-lg" />
          </div>
          <div className="col-span-12 flex min-w-0 flex-col gap-4 xl:col-span-5">
            <Skeleton height={decayH + 120} className="rounded-lg" />
          </div>
          <div className="col-span-12">
            <KpiRow loading hero count={4} skeletonHeight={118} />
          </div>
          <Skeleton height={260} className="col-span-12 rounded-lg" />
        </PageGrid>
        <p className="text-xs text-muted" role="status">
          72개 창(12개 염색체 × 1 Mb 6개)과 피크 구간 12개의 r²를 계산하는 중입니다.
        </p>
      </div>
    )
  }

  const { decay, windows, views } = data
  const win = windows[pi]!
  const view = views[pi]![gi]!
  const preset = PRESETS[pi]!
  const groups = decay.groups
  const all = groups[0]!
  const subs = groups.slice(1)
  const subMin = subs.reduce((a, b) => ((a.fit.d02 ?? 0) <= (b.fit.d02 ?? 0) ? a : b))
  const subMax = subs.reduce((a, b) => ((a.fit.d02 ?? 0) >= (b.fit.d02 ?? 0) ? a : b))
  const ratio = (subMax.fit.d02 ?? 0) / (subMin.fit.d02 ?? 1)
  const chrFitAll = chr < 0 ? all.fit : all.chrFits[chr]!
  const chrName = chr < 0 ? '12개 염색체 통합' : `${CHROMS[chr]!.id} · 1 Mb 창 ${DECAY.windowsPerChr}개`
  const leadId = win.snps[win.leadIdx]!.id
  const wl = windowLabel(win)
  const leadKb = view.leadBlock ? blockSpanKb(win, view.leadBlock).toFixed(1) : null
  const gene = preset.planted.gene
  const geneNote =
    view.geneIn == null ? (gene ? '' : ' · 후보 유전자 없음') : view.geneIn ? ` · ${gene} 블록 안` : ` · ${gene} 블록 밖 ${view.geneOutKb!.toFixed(1)} kb`
  const snpText = view.nPoly < win.snps.length ? `다형 ${view.nPoly}/${win.snps.length} SNP` : `${win.snps.length} SNP`
  const largestKb = view.largest ? blockSpanKb(win, view.largest).toFixed(1) : null

  const slice = decaySlice(decay, chr)
  const decayAria = `LD 감소 곡선${chr < 0 ? '' : `(${CHROMS[chr]!.id})`}, r² ${R2_CUT} 교차 거리: ${slice
    .map((s, k) => `${k === 0 ? '전체' : groupLabel(s.key)} ${kb0(s.fit.d02)}${k === 0 ? ' kb' : ''}`)
    .join(', ')}`
  const decayTable = {
    columns: ['집단', 'n', '근거리 r²', '배경 r²', '반감 거리(kb)', 'd₀.₂(kb)', '쌍 수'],
    rows: groups.map((g, k) => [groupLabel(g.key), g.n, formatFixed(g.near, 3), formatFixed(g.bg, 3), formatFixed(slice[k]!.fit.h, 1), kb0(slice[k]!.fit.d02), g.pairs]),
  }
  const heatAria = `${wl} LD 히트맵, ${snpText}, 블록 ${view.blocks.length}개, ${
    view.mono ? `리드 ${leadId}는 ${groupLabel(group)}에서 단형` : view.leadBlock ? `리드 ${leadId} 블록 ${leadKb} kb(${view.leadBlock.nSnp} SNP)` : `리드 ${leadId}는 블록 밖`
  }, 프록시 ${view.mono ? '계산 안 함' : `${view.proxies.length}개`}${group === 'ALL' ? '' : ` · ${groupLabel(group)}`}`
  const brows = blockRows(win, view)
  const heatTable = {
    columns: ['블록', '시작(Mb)', '끝(Mb)', '폭(kb)', 'SNP 수', '리드 포함'],
    rows: brows.map(r => [`B${r.no}`, r.start.toFixed(3), r.end.toFixed(3), r.span.toFixed(1), r.b.nSnp, r.lead ? '예' : '아니오']),
  }
  const blockCaption = `r² 스파인 블록(첫·끝 SNP가 블록 안 모든 SNP와 r² ≥ ${BLOCK_R2}, ${BLOCK_MIN_SNP} SNP 이상)`
  const groupLegend = GROUPS.map(g => ({ key: g.key, label: `${g.label}`, color: groupColor(theme, g.key) }))
  const allFold = bgFold(all)
  const subFolds = subs.map(bgFold)

  // 선택 지표: 넓은 화면 KpiRow(대표 = 패널 전체 감소 거리), 390px 가로 띠. 띠 안에서는 ⓘ가 잘리므로 뜻은 머리 「자세히」로
  const tiles = [
    <KpiTile
      key="all"
      size="hero"
      label="패널 전체 LD 감소 거리"
      value={kb0(chrFitAll.d02)}
      unit="kb"
      sub={`r² = ${R2_CUT} 교차 · ${chr < 0 ? '12개 염색체 통합' : `${CHROMS[chr]!.id} 1 Mb 창 ${DECAY.windowsPerChr}개`} · 반감 ${formatFixed(chrFitAll.h, 1)} kb`}
      info={narrow ? undefined : `적합 곡선 r² = b + a/(1 + d/h)가 r² = ${R2_CUT}와 만나는 거리입니다. b는 다른 염색체 SNP 쌍(비연관)의 평균 r²로 고정했습니다. 감소 곡선의 염색체 선택을 따릅니다.`}
    />,
    <KpiTile
      key="subs"
      label="하위 집단 LD 감소 거리"
      value={`${kb0(subMin.fit.d02)}~${kb0(subMax.fit.d02)}`}
      unit="kb"
      sub={`${groupLabel(subMin.key)} ${kb0(subMin.fit.d02)} · ${groupLabel(subMax.key)} ${kb0(subMax.fit.d02)} · ${ratio.toFixed(1)}배`}
      info={narrow ? undefined : '12개 염색체 통합 기준. 자식성·병목을 겪은 온대 자포니카의 LD가 가장 길고 인디카가 가장 짧습니다.'}
    />,
    <KpiTile key="blocks" label="선택 구간 LD 블록" value={view.blocks.length} unit="개" sub={`${wl} · ${snpText}${largestKb ? ` · 최대 ${largestKb} kb` : ''}`} badge={group === 'ALL' ? undefined : <Badge tone="neutral">{groupLabel(group)}</Badge>} />,
    <KpiTile
      key="lead"
      label="리드 SNP 블록"
      value={view.mono ? '단형' : leadKb ?? '블록 밖'}
      unit={view.mono || !leadKb ? undefined : 'kb'}
      sub={
        view.mono
          ? `${groupLabel(group)} 집단 내 MAF ${formatFixed(view.leadMaf, 3)} < ${MAF_MIN} · r² 계산 안 함`
          : view.leadBlock
            ? `${view.leadBlock.nSnp} SNP · 프록시(r² ≥ ${PROXY_R2}) ${view.proxies.length}개${geneNote}`
            : `프록시(r² ≥ ${PROXY_R2}) ${view.proxies.length}개 · 희소 대립유전자 리드`
      }
      badge={view.mono ? <Badge tone="warning">단형</Badge> : undefined}
    />,
  ]

  return (
    <div className="flex flex-col gap-4">
      <div ref={topRef} className="flex scroll-mt-4 flex-col gap-4">
        {header}

        {/* 결론 띠: 머리 바로 아래 한 곳. 피크 구간·집단에 따라 둘째 문장이 바뀐다 */}
        <SummaryCallout live>
          자식성 벼답게 LD가 길다 — 패널 전체 r² = {R2_CUT} 교차 <b>{kb0(all.fit.d02)} kb</b>, {groupLabel(subMax.key)} <b>{kb0(subMax.fit.d02)} kb</b>는{' '}
          {groupLabel(subMin.key)} <b>{kb0(subMin.fit.d02)} kb</b>의 <b>{ratio.toFixed(1)}배</b>. {leadSentence(win, view, group)}
        </SummaryCallout>

        {narrow && <div className="rounded-lg border border-border bg-surface px-4 py-3 shadow-1">{controls}</div>}
      </div>

      <PageGrid>
        {/* 주 그림: 피크 구간 LD 히트맵 */}
        <div ref={left.ref} className="col-span-12 min-w-0 xl:col-span-7">
          <ChartCard
            className="h-full"
            title={`LD 히트맵 — ${preset.label}`}
            subtitle={`${wl}(리드 ± ${HALF_BP / 1000} kb) · ${snpText} · SNP 순서 등간격 · ${groupText(group)}`}
            height={chartH + legendH + (view.mono ? 52 : 0) + (narrow ? 0 : 58)}
            source={`블록 = Haploview solid spine 규칙을 D′ 대신 r²로 바꾼 단순화 · 위 트랙: 물리 위치(Mb)와 SNP 순서를 잇는 연결선, 괄호 = GWAS 결과 뷰어 QTL 구간(리드 ± ${QTL_HALF_KB} kb) · SNP 순서 간격 ${Math.round(DEPTH_RATIO * 100)}% 안의 쌍만 표시(먼 쌍은 r²가 낮아 생략)`}
          >
            <div className="flex h-full flex-col">
              {view.mono && (
                <div role="status" className="mb-2 flex shrink-0 items-start gap-2 rounded-md border border-info/40 bg-info/10 px-3 py-2 text-[13px] text-text">
                  <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-info" />
                  <span>
                    {groupLabel(group)}에서는 리드 SNP가 단형(집단 내 MAF {formatFixed(view.leadMaf, 3)} &lt; {MAF_MIN})이라 r²를 계산하지 않습니다 · 다형 SNP {view.nPoly}/{win.snps.length}
                  </span>
                </div>
              )}
              <LdHeatmap win={win} view={view} groupText={groupText(group)} width={heatW || 640} height={chartH} ariaLabel={heatAria} fallbackTable={heatTable} />
              <div className="mt-2 flex shrink-0 flex-col gap-2 border-t border-border pt-2">
                {!narrow && controls}
                <R2Legend />
              </div>
            </div>
          </ChartCard>
        </div>

        <div className="col-span-12 min-w-0 xl:col-span-5">
          <ChartCard
            className="h-full"
            title="LD 감소 곡선"
            subtitle={`${chrName} · 10 kb 구간 평균(점)과 적합 곡선(선) · 범례 값 = 적합 곡선과 r² = ${R2_CUT}의 교차 거리`}
            actions={
              <Select
                label="염색체"
                value={String(chr)}
                onChange={v => setChr(Number(v))}
                options={[{ value: '-1', label: '12개 염색체 통합' }, ...CHROMS.map((c, i) => ({ value: String(i), label: c.id }))]}
              />
            }
            legend={GROUPS.map((g, k) => ({ label: `${g.label} ${kb0(slice[k]!.fit.d02)} kb`, color: groupColor(theme, g.key), shape: LINE_DASHED[g.key] ? ('dashed' as const) : ('line' as const) }))}
            height={decayH + 40}
            source={`x축은 ${DECAY_X_MAX} kb까지(계산은 1 Mb) · 적합식 r² = b + a/(1 + d/h), b = 비연관 쌍 평균 r² · 선택 집단(${groupLabel(group)})을 굵게 표시`}
          >
            <div className="flex h-full flex-col">
              <Switch className="mb-2 h-8 shrink-0" checked={showRaw} onChange={setShowRaw} label={`쌍별 r² 점 표시(${groupLabel(group)}, 약 4,000쌍 솎음)`} />
              <DecayChart decay={decay} chr={chr} group={group} showRaw={showRaw} height={decayH} ariaLabel={decayAria} fallbackTable={decayTable} />
            </div>
          </ChartCard>
        </div>

        {/* 선택 지표 */}
        <div className="col-span-12 min-w-0">
          {narrow ? (
            <MetricStrip label="선택 지표(가로 스크롤)">{tiles}</MetricStrip>
          ) : (
            <KpiRow hero ariaLabel="선택 지표">
              {tiles}
            </KpiRow>
          )}
        </div>

        <section className="col-span-12 flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-1 xl:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold leading-snug text-text">
                LD 블록 목록 <span className="text-muted tabular-nums">{view.blocks.length}개</span>
              </h3>
              <p className="mt-0.5 text-xs text-muted">{blockCaption}</p>
            </div>
            <Button size="sm" variant="ghost" aria-expanded={blocksOpen} aria-controls="ld-block-table" onClick={() => setBlocksOpen(o => !o)} icon={<ChevronDown size={14} aria-hidden="true" className={blocksOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />}>
              {blocksOpen ? '접기' : '펼치기'}
            </Button>
          </div>
          <div id="ld-block-table" hidden={!blocksOpen}>
            <BlockTable win={win} view={view} narrow={narrow} caption={`${wl} ${groupLabel(group)} ${blockCaption}`} />
          </div>
        </section>

        <div className="col-span-12 min-w-0 xl:col-span-5">
          <ChartCard
            className="h-full"
            title="염색체별 LD 감소 거리"
            subtitle={`각 염색체 1 Mb 창 ${DECAY.windowsPerChr}개 · b = 통합 배경 r² 고정 · 세로 점선 = 12개 염색체 통합값 · 점·행을 누르면 감소 곡선이 그 염색체로`}
            height={dotH}
            source="모든 염색체에서 온대 자포니카가 가장 오른쪽(가장 긴 LD) · 회색 선 = 그 염색체의 집단 간 범위"
          >
            <div className="flex h-full flex-col">
              {/* 집단 기호 범례(공통 Legend shape = 점 그림 기호) */}
              <Legend className="mb-1 shrink-0" items={groupLegend.map(g => ({ label: g.label, color: g.color, shape: GROUP_MARK[g.key].legend }))} />
              <div className="min-h-0 flex-1">
                <ChrDotPlot decay={decay} chr={chr} group={group} height={dotH - 28} onSelectChr={selectChr} />
              </div>
            </div>
          </ChartCard>
        </div>

        <section className="col-span-12 flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1">
          <div>
            <h3 className="text-[15px] font-semibold leading-snug text-text">집단 비교(12개 염색체 통합)</h3>
            <p className="mt-0.5 text-xs text-muted">행을 누르거나 Enter로 그 집단을 선택 · 배경 r² 아래 = 1/n과 배율(배경 r² ÷ 1/n)</p>
          </div>
          <GroupTable groups={groups} selected={group} onSelect={setGroup} />
          <ul className="flex list-disc flex-col gap-1 pl-4 text-xs text-muted">
            <li>
              혼합형 {ADM_COUNT}계통은 패널 전체에만 포함하고 집단 곡선은 그리지 않습니다. 아우스는 n = {groups[4]!.n}이라 배경 r²가 높습니다(≈ 1/n ={' '}
              {formatFixed(1 / groups[4]!.n, 3)}).
            </li>
            <li>온대 자포니카는 자식성·병목으로 LD가 길다(문헌 &gt; {LIT_TEJ_KB} kb, Mather 등 2007). 열대 자포니카·인디카 순으로 짧아지는 순서는 문헌과 같습니다.</li>
            <li>
              패널 전체 배경 r² {formatFixed(all.bg, 3)}는 1/n({formatFixed(1 / all.n, 4)})의 약 {formatFixed(allFold, 1)}배입니다. 집단 안에서는{' '}
              {formatFixed(Math.min(...subFolds), 2)}~{formatFixed(Math.max(...subFolds), 2)}배라, 차이는 집단 구조(아종 간 대립유전자 빈도 차)가 만든 장거리 LD입니다 →
              GWAS에 PC·GRM 보정이 필요합니다(집단 구조 분석 화면).
            </li>
            <li>
              GWAS 결과 뷰어의 QTL 구간 &ldquo;리드 ± {QTL_HALF_KB} kb&rdquo;는 패널 전체 감소 거리 {kb0(all.fit.d02)} kb보다 넓은 보수적 근사로, 이 화면과 모순되지 않습니다.
            </li>
          </ul>
        </section>

        <section className="col-span-12 flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-[15px] font-semibold leading-snug text-text">GWAS 피크 구간 바로 가기</h3>
              <p className="mt-0.5 text-xs text-muted">
                GWAS 결과 뷰어 유의 좌위(본페로니) 리드 SNP ± {HALF_BP / 1000} kb · {groupText(group)} 기준 · 행을 누르거나 Enter로 히트맵 이동 · 출수기 Hd1과 간장 리드는 같은 창이라 한 행
              </p>
            </div>
          </div>
          <PeakTable windows={windows} views={views} groupIndex={gi} current={pi} onSelect={selectPreset} />
          <p className="text-xs text-muted">
            희소 대립유전자 리드(예: GW2)는 r²의 상한이 낮아 블록 밖에 있거나 프록시가 적은 것이 정상입니다. 도열병 저항성 리드가 자포니카에서 단형인 것은 인디카·야생종 유래
            저항성 유전자의 도입 이력과 맞습니다.
          </p>
        </section>
      </PageGrid>

      <p className="text-xs text-muted">
        유전형은 하플로타입 모형으로 만든 목업이며 SNP ID·위치·−log10 p만 GWAS 결과 뷰어와 같습니다. 그래서 SNP별 MAF는 표시하지 않습니다. 계통·자원은 모두 가상입니다.
      </p>
    </div>
  )
}
