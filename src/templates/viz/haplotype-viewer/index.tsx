import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import type { TemplateMeta } from '@/gallery/types'
import {
  BottomSheet,
  Button,
  Card,
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
import { formatNumber, josa } from '@/lib/format'
import {
  ANALYSIS,
  FAV_LOCI,
  GORDER,
  HALF_BP,
  LOCI,
  NAMED_MIN,
  PLANTED,
  SUBPOP_LABEL,
  SUBPOP_N,
  breedOrder,
  computeAll,
  favSummary,
  kb1,
  lineLabel,
  locusSummary,
  mb2,
  panelOrder,
  type HapData,
  type LocusKey,
  type LocusResult,
  type SortMode,
} from './data'
import { GenotypeGrid, type ColorMode, type ColRange, type GridRow } from './components/GenotypeGrid'
import { FreqBars, freqLabelMin, pct1 } from './components/FreqBars'
import { MetricStrip } from './components/MetricStrip'
import { HapTable } from './components/HapTable'
import { SummaryTable } from './components/SummaryTable'
import { EffectCard, effectPhrase } from './components/EffectCard'
import { OptionToggle } from './components/OptionToggle'
import { gridColors, hapColorMap, subpopColor } from './components/colors'

export const meta: TemplateMeta = {
  slug: 'haplotype-viewer',
  category: 'viz',
  title: '마커·하플로타입 뷰어',
  description: 'GWAS 유의 좌위의 리드 LD 블록 하플로타입과 하위 집단별 빈도를 보고, 교배 부모 후보·출원 후보·대비 품종이 유리 대립유전자를 갖는지 확인한다.',
  tags: ['하플로타입', '유전형', 'SNP', 'LD 블록', 'MAS', 'sd1', 'Pi-ta', 'Pi9', '벼'],
  organism: '벼',
  status: 'review',
  updatedAt: '2026-11-02',
}

type DevState = 'ready' | 'loading' | 'empty' | 'error'
type LineSet = 'panel' | 'breed'

function readDevState(): DevState {
  if (typeof window === 'undefined') return 'ready'
  const s = new URLSearchParams(window.location.search).get('state')
  return s === 'loading' || s === 'empty' || s === 'error' ? s : 'ready'
}

/** 머리 둘째 줄(데이터 한 문장): 패널·SNP 규모·분석일 */
const SCOPE_LINE = `${ANALYSIS.panel} ${formatNumber(ANALYSIS.lines)}계통 · ${formatNumber(ANALYSIS.snps)} SNP · 근교계 0/1 유전형 · ${ANALYSIS.reference} · 분석일 ${ANALYSIS.analyzedAt} · 목업 데이터`
/** 「자세히」: 필터·블록 정의(긴 방법 문장) */
const METHOD_LINE = `단일 염기 다형성(SNP) 필터: 소수 대립유전자 빈도(MAF) ≥ ${ANALYSIS.mafMin}, 콜레이트 ≥ ${Math.round(ANALYSIS.callRateMin * 100)}%. 이형접합은 결측으로 둔다. 리드 블록 = 연관불균형(LD) r² 스파인 블록(LD 구조 화면, 패널 전체).`

const HALF_KB = HALF_BP / 1000

const locusLabel = (key: LocusKey) => {
  const d = LOCI.find(l => l.key === key)!
  const p = PLANTED.find(x => x.id === d.planted)!
  return `${d.key} · ${d.traits} (${p.chr} ${mb2(p.bp)} Mb)`
}

/** 효과 대상 형질 말 */
const TRAIT_WORD = { dth: '출수', cl: '간장', tgw: '천립중', blast: '병반 점수' } as const

/** 받침 조사(괄호 뒤): 괄호 안 마지막 낱말로 판단 */
const after = (word: string, pair: '는은' | '가이') => josa(word, pair).slice(word.length)

function targetPhrase(L: LocusResult): string {
  const eff = effectPhrase(L)
  return L.def.kind === 'fav' ? `${L.def.effectName}(${TRAIT_WORD[L.planted.trait]} ${eff}) 유리 하플로타입` : `${L.def.effectName}(${eff}) 하플로타입`
}

function conclusion(L: LocusResult, data: HapData): string {
  const s = locusSummary(L, data)
  const lead = L.snps[L.leadIdx]!.id
  const lp = L.planted.logP.toFixed(1)
  const tn = s.targetHaps.map(h => h.name).join('·')
  const n = data.panel.length
  const fs = favSummary(data)
  const favKeys = FAV_LOCI.join('·')
  const first = `${L.def.key} 리드 ${lead}(−log10 p ${lp})${after(lp, '는은')} ${kb1(L.leadBlockKb)} kb 블록(${L.leadBlock.nSnp} SNP) 안에 있고, ${targetPhrase(L)} ${josa(tn, '가이')} 패널의 ${pct1(s.targetHapLines, n)}%(${s.targetHapLines}계통)다.`
  const all3 = fs.all3 === 0 ? `${josa(favKeys, '를을')} 모두 가진 계통은 없다.` : `${josa(favKeys, '를을')} 모두 가진 계통은 ${fs.all3}계통이다.`
  const second =
    L.def.kind === 'fav'
      ? `부모 후보 ${fs.nParents}계통 중 ${s.parentCarry}계통이 유리 대립유전자를 갖지만 ${all3}`
      : `부모 후보 ${fs.nParents}계통 중 ${s.parentCarry}계통이 ${L.def.effectName} 대립유전자를 갖고, ${all3}`
  return `${first} ${second}`
}

export default function Template() {
  const [devState, setDevState] = useState<DevState>(readDevState)
  const [data, setData] = useState<HapData | null>(null)
  const [calcError, setCalcError] = useState<string | null>(null)
  const [locus, setLocus] = useState<LocusKey>('sd1')
  const [lineSet, setLineSet] = useState<LineSet>('panel')
  const [sort, setSort] = useState<SortMode>('hap')
  const [colRange, setColRange] = useState<ColRange>('window')
  const [colorMode, setColorMode] = useState<ColorMode>('allele')
  const [hiHap, setHiHap] = useState<string | null>(null)
  const [hiLine, setHiLine] = useState<string | null>(null)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const narrow = useMediaQuery('(max-width: 639px)')
  const theme = useChartTheme()
  const gridCardRef = useRef<HTMLDivElement>(null)
  const pendingScroll = useRef(false)

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

  const L = data?.loci.find(x => x.def.key === locus) ?? null
  const hapColors = useMemo(() => (L ? hapColorMap(L, theme) : {}), [L, theme])
  const gColors = useMemo(() => gridColors(theme), [theme])

  const rows = useMemo<GridRow[]>(() => {
    if (!data || !L) return []
    if (lineSet === 'panel') {
      return panelOrder(L, data, sort === 'gebv' ? 'hap' : sort).map(i => {
        const p = data.panel[i]!
        return { key: p.id, label: lineLabel(p), subpop: p.group, subpopEstimated: false, a: L.panel[i]! }
      })
    }
    return breedOrder(L, data, sort).map(i => {
      const b = data.breed[i]!
      return { key: b.id, label: lineLabel(b), subpop: b.subpop, subpopEstimated: b.subpopEstimated, a: L.breed[i]! }
    })
  }, [data, L, lineSet, sort])

  const changeLocus = (k: LocusKey) => {
    setLocus(k)
    setHiHap(null)
  }
  const changeLineSet = (v: LineSet) => {
    setLineSet(v)
    if (v === 'panel') {
      setHiLine(null)
      if (sort === 'gebv') setSort('hap')
    }
  }
  const pickHap = useCallback((h: string) => setHiHap(cur => (cur === h ? null : h)), [])
  const pickLine = useCallback((id: string) => {
    setLineSet('breed')
    setHiLine(cur => {
      const next = cur === id ? null : id
      pendingScroll.current = next != null
      return next
    })
  }, [])
  const onRowY = useCallback((y: number | null) => {
    if (!pendingScroll.current || y == null || !gridCardRef.current) return
    pendingScroll.current = false
    const canvas = gridCardRef.current.querySelector('canvas')
    if (!canvas) return
    const top = canvas.getBoundingClientRect().top + window.scrollY + y - 160
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }, [])

  // 머리(공통 PageHeader): 범위 → 제목 + 기준일 → 데이터 한 문장 → 소개·방법 문단은 「자세히」(390 첫 화면을 밀지 않게)
  const header = (
    <PageHeader
      context={['벼 · 5개 유전자 구간', '교배 부모 후보·출원 후보·대비 품종']}
      title={meta.title}
      scope={SCOPE_LINE}
      asOf={ANALYSIS.baseDate}
      details={
        <>
          <p>
            GWAS 결과 뷰어의 유의 좌위와 LD 구조 화면의 블록을 이어, 리드 블록의 하플로타입 구조를 보고 마커 보조 선발(MAS) 대상 대립유전자를 교배 부모 후보(쌀 수량
            유전체 추정 육종가(GEBV) 기준, 교배 조합 설계 화면)·출원 후보·대비 품종이 갖는지 확인한다. 결과는 2027년 1차 교배 계획의 부모 조합 판단에 쓴다.
          </p>
          <p className="mt-1.5">{METHOD_LINE}</p>
        </>
      }
    />
  )

  const sortOptions = [
    { value: 'hap' as const, label: '하플로타입' },
    { value: 'subpop' as const, label: '하위 집단' },
    { value: 'gebv' as const, label: 'GEBV', disabled: lineSet === 'panel' },
  ]
  const locusSelect = <Select label="유전자 구간" value={locus} onChange={changeLocus} options={LOCI.map(l => ({ value: l.key, label: locusLabel(l.key) }))} />
  const displayOptions = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted">계통 집합</span>
        <Segmented
          ariaLabel="계통 집합"
          size="sm"
          value={lineSet}
          onChange={changeLineSet}
          options={[
            { value: 'panel', label: `다양성 패널 ${formatNumber(ANALYSIS.lines)}` },
            { value: 'breed', label: `육종 계통 ${data?.breed.length ?? 67}` },
          ]}
        />
      </div>
      <OptionToggle
        label="정렬"
        compact={narrow}
        value={sort}
        onChange={setSort}
        options={sortOptions}
        note={lineSet === 'panel' ? '다양성 패널은 GEBV 없음(훈련 집단 밖)' : undefined}
      />
      <OptionToggle
        label="열 범위"
        compact={narrow}
        value={colRange}
        onChange={setColRange}
        options={[
          { value: 'window', label: `창 전체(±${HALF_KB} kb)` },
          { value: 'block', label: '리드 블록' },
        ]}
      />
      <OptionToggle
        label="색 기준"
        compact={narrow}
        value={colorMode}
        onChange={setColorMode}
        options={[
          { value: 'allele', label: '주·소수 대립유전자' },
          { value: 'compare', label: '표적 하플로타입과 비교' },
        ]}
      />
    </>
  )

  if (devState === 'error' || calcError) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState
          title="하플로타입 분석 결과를 불러오지 못했습니다"
          description={calcError ? `창 유전형·블록 계산 중 오류가 났습니다(${calcError}).` : '패널 유전형(.bed)과 육종 계통 임퓨테이션 결과를 읽는 중 오류가 났습니다. 잠시 뒤 다시 시도하세요.'}
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
        <EmptyState title="분석할 유전자 구간이 없습니다" description="GWAS 유의 좌위와 LD 블록 계산(LD 구조 화면)을 먼저 실행하세요. 리드 블록이 정해진 좌위가 이 화면의 유전자 구간 목록에 나타납니다." />
      </div>
    )
  }

  if (devState === 'loading' || !data || !L) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <Skeleton height={narrow ? 92 : 52} className="rounded-md" />
        <PageGrid>
          <Skeleton height={780} className="col-span-12 rounded-lg xl:col-span-8" />
          <div className="col-span-12 flex flex-col gap-4 xl:col-span-4">
            <Skeleton height={340} className="rounded-lg" />
            <Skeleton height={380} className="rounded-lg" />
          </div>
        </PageGrid>
        <KpiRow loading hero count={4} skeletonHeight={128} />
        <p className="text-xs text-muted" role="status">
          유전자 구간 5개(±{HALF_KB} kb)의 유전형과 r² 블록, 하플로타입을 계산하는 중입니다.
        </p>
      </div>
    )
  }

  const s = locusSummary(L, data)
  const fs = favSummary(data)
  const nP = data.panel.length
  const fav = L.def.kind === 'fav'
  const noFav = fav ? '' : ' (유리 판정 안 함)'
  const tn = s.targetHaps.map(h => h.name).join('·')
  const geneTxt = L.geneIn ? `${L.planted.gene} 블록 안` : L.geneOutKb != null ? `${L.planted.gene} 블록 밖 ${kb1(L.geneOutKb)} kb` : ''
  const nCols = colRange === 'block' ? L.leadBlock.nSnp : L.snps.length
  const setName = lineSet === 'panel' ? `다양성 패널 ${formatNumber(nP)}계통` : `육종 계통 ${data.breed.length}계통`
  const gridAria = `${L.def.key} 구간 ${L.planted.chr} ${mb2(L.lo)}~${mb2(L.hi)} Mb 유전형 격자, ${setName} × ${nCols} SNP, 리드 블록 ${kb1(L.leadBlockKb)} kb(${L.leadBlock.nSnp} SNP), 하플로타입 ${L.named.length}개, ${fav ? '유리' : `효과(${L.def.effectName})`} 하플로타입 ${tn} ${pct1(s.targetHapLines, nP)}%`
  const missRate = ((100 * L.missCells) / (L.snps.length * nP)).toFixed(2)

  const alleleLegend =
    colorMode === 'allele'
      ? [
          { label: '주 대립유전자', color: gColors.major },
          { label: '소수 대립유전자', color: gColors.minor },
          { label: '결측(이형접합 포함)', color: theme.textMuted, shape: 'missing' as const },
        ]
      : [
          { label: `표적 하플로타입(${L.repTarget.name})과 같음`, color: gColors.same },
          { label: '다름', color: gColors.diff },
          { label: '결측(이형접합 포함)', color: theme.textMuted, shape: 'missing' as const },
        ]
  const subpopLegend = GORDER.map(g => ({ label: SUBPOP_LABEL[g], color: subpopColor(theme, g) }))
  const hapLegend = L.cats.map(c => ({
    label: `${c}${s.targetHaps.some(h => h.name === c) ? '(표적)' : ''}`,
    color: hapColors[c] ?? theme.textMuted,
    shape: hapColors[c] ? undefined : ('missing' as const),
  }))

  const favDist = fs.dist.map((n, k) => `${k}개 ${n}`).join(' · ')
  const summaryLine = `부모 후보 유리 대립유전자 수: ${favDist} — sd1+Pi-ta ${fs.sdPita.n}계통(${fs.sdPita.groups}), sd1+Pi9 ${fs.sdPi9.n}계통(${fs.sdPi9.ids.join(', ')}), Pi-ta+Pi9 ${fs.pitaPi9.n}`

  // 선택 지표: 넓은 화면 KpiRow(대표 = 패널 보유), 390px 가로 띠
  const tiles = [
    <KpiTile
      key="carry"
      size="hero"
      label={fav ? '유리 대립유전자 보유(패널)' : `효과 대립유전자 보유 · ${L.def.effectShort}(패널)${noFav}`}
      value={`${s.carryPanel}/${nP}`}
      sub={`${pct1(s.carryPanel, nP)}% · 표적 하플로타입 ${tn} ${pct1(s.targetHapLines, nP)}% · 온대 자포니카 중 보유 ${pct1(s.carryTej, SUBPOP_N.TEJ)}%`}
    />,
    <KpiTile key="block" label="리드 블록" value={kb1(L.leadBlockKb)} unit="kb" sub={`${L.leadBlock.nSnp} SNP · B${L.leadBlockNo}/${L.blocks.length} · ${geneTxt}`} />,
    <KpiTile key="haps" label="하플로타입" value={L.named.length} unit="개" sub={`${NAMED_MIN}계통 이상 · 서로 다른 조합 ${L.distinctComplete} · 희귀 ${s.rareN} · 미정 ${s.undetN}`} />,
    <KpiTile
      key="parents"
      label={fav ? '부모 후보 보유' : `부모 후보 ${L.def.effectShort} 보유${noFav}`}
      value={`${s.parentCarry}/${fs.nParents}`}
      sub={(['A', 'B', 'C'] as const).map(g => `${g} ${s.parentByGroup[g][0]}/${s.parentByGroup[g][1]}`).join(' · ')}
    />,
  ]

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* 결론 띠: 머리 바로 아래 한 곳. 유전자 구간에 따라 문장이 바뀐다 */}
      <SummaryCallout live>{conclusion(L, data)}</SummaryCallout>

      {/* 390px: 유전자 구간만 격자 바로 위에 두고 나머지는 시트로(조작 카드가 첫 차트를 1,154px 아래로 밀었다) */}
      {narrow && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3 shadow-1">
          {locusSelect}
          <Button size="sm" icon={<SlidersHorizontal size={14} aria-hidden="true" />} onClick={() => setOptionsOpen(true)}>
            표시 옵션
          </Button>
        </div>
      )}

      <PageGrid>
        <div ref={gridCardRef} className="col-span-12 min-w-0 xl:col-span-8">
          <Card
            title={`유전형 격자 — ${L.def.key} 구간 ${L.planted.chr} ${mb2(L.lo)}~${mb2(L.hi)} Mb`}
            subtitle={`행 = ${setName}(${sortOptions.find(o => o.value === sort)!.label} 순), 열 = ${colRange === 'block' ? `리드 블록 SNP ${nCols}개` : `창 SNP ${nCols}개`} · 결측 ${formatNumber(L.missCells)}셀(${missRate}%)`}
          >
            <GenotypeGrid
              L={L}
              rows={rows}
              showLabels={lineSet === 'breed'}
              colRange={colRange}
              colorMode={colorMode}
              highlightHap={hiHap}
              highlightRow={lineSet === 'breed' ? hiLine : null}
              hapColors={hapColors}
              theme={theme}
              narrow={narrow}
              ariaLabel={gridAria}
              onRowY={onRowY}
            />
            <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
              {!narrow && (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                  {locusSelect}
                  {displayOptions}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Legend items={alleleLegend} />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="font-medium">왼쪽 띠: 하위 집단 · 하플로타입</span>
                  <Legend items={subpopLegend} />
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              위 트랙: 물리 위치(Mb)와 SNP 열을 잇는 선, ▼ 리드 SNP, 세로 눈금 후보 유전자, 괄호 = LD 구조 화면의 r² ≥ 0.5 스파인 블록(굵은 선 = 리드 블록).
              {colorMode === 'compare' && ' 블록 밖 SNP는 표적 하플로타입 계통들의 다수 대립유전자를 기준으로 비교한다(같은 조상 구간이 블록 밖으로 얼마나 이어지는지).'}
              {lineSet === 'breed'
                ? ` 육종 계통 중 다양성 패널 구성원 6계통은 패널 유전형, 나머지 61계통은 6K SNP 칩(${formatNumber(ANALYSIS.chipSnps)} SNP) → 패널 참조 임퓨테이션(추정)이다. 옅은 하위 집단 띠 = 육종 그룹으로 추정. 부모 후보 GBS(${ANALYSIS.gbsBatch})는 ${ANALYSIS.gbsDate} 분석 예정.`
                : ` 패널 행 높이 1.5 px(행 라벨 없음) — 행을 가리키거나 누르면 계통·대립유전자·하플로타입을 보인다.`}
            </p>
          </Card>
        </div>
        <div className="col-span-12 flex min-w-0 flex-col gap-4 xl:col-span-4">
          <EffectCard L={L} data={data} />
          <ChartCard
            title="하플로타입 빈도"
            subtitle="하위 집단·패널 전체·육종 계통, 100% 누적 · 범주를 누르면 격자 강조"
            height={narrow ? 350 : 340}
            legend={hapLegend}
            source={`(표적) = 표적 하플로타입 · 막대 라벨은 ${freqLabelMin(narrow)}% 이상 구간만`}
          >
            <FreqBars L={L} data={data} theme={theme} hapColors={hapColors} highlightHap={hiHap} onPick={pickHap} height={narrow ? 350 : 340} narrow={narrow} />
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

        <div className="col-span-12 min-w-0">
          <Card
            title={`하플로타입 표 — ${L.def.key} 리드 블록 B${L.leadBlockNo}(${L.snps[L.leadBlock.from]!.id}~${L.snps[L.leadBlock.to]!.id})`}
            subtitle={`M = 주 대립유전자, m = 소수 대립유전자(패널 관측 빈도 기준), 윤곽 칸 = 리드 SNP · 결측 보정 배정 ${s.imputedPanel}계통 · 행을 누르면 격자 강조`}
          >
            <HapTable L={L} data={data} hapColors={hapColors} gridColors={gColors} highlightHap={hiHap} onPick={pickHap} />
          </Card>
        </div>

        <div className="col-span-12 min-w-0">
          <Card title={`유리 대립유전자 보유 요약 — 육종 계통 ${data.breed.length} × ${LOCI.length}좌위`} subtitle={summaryLine}>
            <SummaryTable data={data} selected={locus} activeLine={lineSet === 'breed' ? hiLine : null} onPickLine={pickLine} />
            <div className="mt-3 flex flex-col gap-1 text-xs text-muted">
              <p>● 보유 · ○ 비보유 · ◐ 리드 SNP 결측, 하플로타입으로 추정(보유) · ○ 비보유(추정) · 판정 불가 = 희귀·미정 하플로타입이고 리드 결측. Hd1·GS3 열은 효과 대립유전자(지연형·증가형) 보유를 중립 표기한다(— = 비보유).</p>
              <p>† 계통도 탐색기 2026-10 재추정(MET 표현형 포함). 부모 후보는 교배 조합 설계 화면의 유전체 예측값.</p>
              <p>* 집단 구조 미분석, 육종 그룹으로 추정(A·B·출원 후보 = 온대 자포니카, C = 혼합형).</p>
              <p>
                Pib(Chr02)는 GWAS 유의 좌위가 아니어서 이 화면의 {LOCI.length}좌위에 없다. 유리 수는 유리형 {FAV_LOCI.length}좌위({FAV_LOCI.join('·')})만 센다(Hd1·GS3는 목표 범위형). 계통별 보유 여부는 가상(목업)이다.
              </p>
            </div>
          </Card>
        </div>
      </PageGrid>

      <BottomSheet open={narrow && optionsOpen} onClose={() => setOptionsOpen(false)} labelledBy="hap-options-title" backdropLabel="표시 옵션 닫기">
        <h2 id="hap-options-title" className="mb-3 text-[15px] font-semibold text-text">
          표시 옵션
        </h2>
        <div className="flex flex-col gap-3 pb-2">{displayOptions}</div>
      </BottomSheet>
    </div>
  )
}

