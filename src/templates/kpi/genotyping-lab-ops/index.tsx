import { useEffect, useMemo, useState } from 'react'
import { AlertOctagon, AlertTriangle, Clock } from 'lucide-react'
import type { TemplateMeta } from '@/gallery/types'
import { AlertList, Button, Card, ChartCard, ConclusionBundle, ConclusionPanel, EmptyState, ErrorState, KpiRow, KpiTile, PageGrid, PageHeader, Segmented, Skeleton } from '@/design-system'
import { formatDelta } from '@/lib/format'
import {
  ALERT_PLATE_KASP,
  ANNUAL_TARGET,
  AS_OF,
  AS_OF_DAY,
  CALL_RATE_THRESHOLD,
  CATALOG_RANGE,
  CURRENT_MONTH,
  F6_EXPECTED_HET,
  FAIL_COUNT,
  FINAL_6K,
  GBS_RESEQ_DUE,
  HET_THRESHOLD,
  KASP_RERUN_DUE,
  MEAN_CALL_RATE_6K,
  MONTHLY,
  MONTHLY_TARGET,
  NONPARENT_THRESHOLD,
  OCT_PROGRESS_TARGET,
  PLATE_ALERT_PCT,
  PLATE_COUNT,
  PLATE_SUMMARIES,
  PLATFORMS,
  PLATFORM_KEYS,
  PREV_YEAR,
  PROGRESS_TARGET,
  QC_PASS,
  SAMPLES,
  SEED,
  TAT_MEAN,
  TAT_TARGET,
  TOTAL_SAMPLES,
  UNRESOLVED_ALERT_PLATES,
  UNRESOLVED_PLATES,
  UNRESOLVED_SAMPLES,
  YEAR,
  annualPct,
  octProgressPct,
  prevYearDeltaPct,
  progressPct,
  qcPassPct,
  round1,
  type Month,
} from './data'
import { MonthlyThroughputChart } from './components/MonthlyThroughputChart'
import { CallRateHistogram } from './components/CallRateHistogram'
import { QcPassPanel } from './components/QcPassPanel'
import { TatTrendChart } from './components/TatTrendChart'
import { PlatformShare } from './components/PlatformShare'
import { UnresolvedBreakdown } from './components/UnresolvedBreakdown'
import { PanelSeverity, PanelTrend } from './components/PanelTrend'
import { FailTable, type PlatformFilter, type StatusFilter } from './components/FailTable'
import { d1, int, pct1, platformVar } from './components/shared'

export const meta: TemplateMeta = {
  slug: 'genotyping-lab-ops',
  category: 'kpi',
  title: '유전체 분석실 운영 현황',
  description: '분석실 책임자가 올해 처리 실적·콜레이트·QC 통과율·처리 소요 시간(TAT)과 미해결 재분석 플레이트를 한 화면에서 점검합니다.',
  tags: ['유전형 분석', '분석실', 'SNP 칩', 'KASP', 'GBS', '콜레이트', 'TAT', 'QC', '벼'],
  organism: '벼',
  status: 'review',
  updatedAt: '2026-11-02',
}

function readPreviewState(): 'loading' | 'empty' | 'error' | null {
  if (typeof location === 'undefined') return null
  const s = new URLSearchParams(location.search).get('state')
  return s === 'loading' || s === 'empty' || s === 'error' ? s : null
}

const alertKasp = PLATE_SUMMARIES.find(p => p.id === ALERT_PLATE_KASP)
const gbsPending = PLATE_SUMMARIES.find(p => p.platform === 'GBS' && p.unresolved > 0)
const oct = MONTHLY[MONTHLY.length - 1]
const kaspOverMonths = MONTHLY.filter(r => r.tat.KASP !== null && round1(r.tat.KASP) > TAT_TARGET.KASP).map(r => r.month)
const tat6k = Math.round(TAT_MEAN['6K'])
const PERIOD_START = `${AS_OF.slice(0, 4)}-01-01`
const peakMonth = MONTHLY.reduce((a, b) => (b.total > a.total ? b : a))
const progressSev = progressPct >= 100 ? 'ok' : progressPct >= 90 ? 'warning' : 'critical'
/** 결론 묶음 안 KPI 줄: 1440 2×2 · 768 4칸 · 390 2열 */
const TILE_COLS = { md: 4, lg: 2 }

export default function GenotypingLabOpsTemplate() {
  const preview = useMemo(readPreviewState, [])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(preview === 'error')
  const [log, setLog] = useState(false)
  const [month, setMonth] = useState<Month | null>(null)
  const [crOnly, setCrOnly] = useState(false)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [platform, setPlatform] = useState<PlatformFilter>('all')

  useEffect(() => {
    if (preview === 'loading') return
    const t = setTimeout(() => setLoading(false), 500)
    return () => clearTimeout(t)
  }, [preview])

  const scrollToTable = () => {
    const el = document.getElementById('glo-fails')
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }
  const selectMonth = (m: Month) => {
    setMonth(prev => (prev === m ? null : m))
  }
  const selectBelow = () => {
    setCrOnly(true)
    setPlatform('6K')
    setStatus('all')
    scrollToTable()
  }
  const showUnresolved = () => {
    setStatus('open')
    setCrOnly(false)
    setMonth(null)
    setPlatform('all')
    scrollToTable()
  }

  // A. 머리(공통 PageHeader: 범위·소속 회색 줄 → 제목 + 기준일 → 데이터 한 문장 → 접힌 플랫폼 설명)
  const header = (
    <PageHeader
      context={['벼 · 6K SNP 칩 · KASP · GBS', '중부 평야지 벼 육종 프로그램 분석실(가상)']}
      title={meta.title}
      scope={`${PERIOD_START} ~ ${AS_OF} 누계 · ${PLATFORM_KEYS.length}개 플랫폼의 처리량, 콜레이트, 처리 소요 시간(TAT)과 재분석 현황`}
      asOf={AS_OF}
      details={
        <>
          벼(<i>Oryza sativa</i>) · 6K 단일 염기 다형성(SNP) 칩, KASP(경쟁적 대립유전자 특이 PCR) 패널, 유전체 축소 표현 시퀀싱(GBS) 3개 플랫폼의 처리량, 콜레이트(call rate),
          처리 소요 시간(TAT)과 재분석 현황. 6K는 유전체 선발(GS), KASP는 마커 보조 선발(MAS)·F1 진위 검정·품종 순도 검정용입니다.
        </>
      }
    />
  )

  if (failed) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState
          title="데이터를 불러오지 못했습니다"
          description="실험실 정보 관리 시스템(LIMS) 응답이 없습니다. 잠시 후 다시 시도하세요."
          action={<Button onClick={() => setFailed(false)}>다시 시도</Button>}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <span className="sr-only">분석실 운영 데이터를 불러오는 중입니다</span>
        <ConclusionBundle panel={<Skeleton height={300} />}>
          <KpiRow loading count={4} cols={TILE_COLS} skeletonHeight={144} className="col-span-full" />
        </ConclusionBundle>
        <PageGrid>
          <Skeleton className="col-span-12 lg:col-span-8" height={380} />
          <Skeleton className="col-span-12 lg:col-span-4" height={380} />
          <Skeleton className="col-span-12 lg:col-span-7" height={340} />
          <Skeleton className="col-span-12 lg:col-span-5" height={340} />
          <Skeleton className="col-span-12" height={320} />
        </PageGrid>
      </div>
    )
  }

  if (preview === 'empty') {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState title="표시할 분석 실적이 없습니다" description="선택한 기간에 결과가 제공된 플레이트가 없습니다. LIMS에서 플레이트 결과 등록을 확인하세요." />
      </div>
    )
  }

  const watch = [
    alertKasp && {
      tone: 'critical' as const,
      icon: AlertOctagon,
      title: `${alertKasp.id} 실패율 ${pct1(alertKasp.failRate)}(> ${PLATE_ALERT_PCT}%)`,
      body: `Pi9 마커 군집 분리 불량 — 프라이머 믹스 lot 교체 후 재분석 중(${KASP_RERUN_DUE.slice(5).replace('-', '/')} 예정)`,
      onClick: showUnresolved,
    },
    {
      tone: 'warning' as const,
      icon: AlertTriangle,
      title: `${CURRENT_MONTH}월 처리 진도 ${pct1(octProgressPct)}`,
      body: `${int(oct.total)} / ${int(OCT_PROGRESS_TARGET)}샘플(${AS_OF_DAY}일 기준 진도 목표). 6K 캠페인 종료 후 KASP만 처리 중`,
      onClick: () => {
        setMonth(CURRENT_MONTH)
        scrollToTable()
      },
    },
    gbsPending && {
      tone: 'warning' as const,
      icon: Clock,
      title: `${gbsPending.id} ${gbsPending.unresolved}샘플 재시퀀싱 대기`,
      body: `리드 수 부족·결측률 초과 · 재시퀀싱 ${GBS_RESEQ_DUE.slice(5).replace('-', '/')} 예정`,
      onClick: showUnresolved,
    },
    {
      tone: 'warning' as const,
      icon: Clock,
      title: `KASP TAT ${kaspOverMonths.map(m => `${m}월`).join('·')} 목표 ${TAT_TARGET.KASP}일 초과`,
      body: `기간 평균 ${d1(TAT_MEAN.KASP)}일은 목표 이내. ${kaspOverMonths[0]}~${kaspOverMonths[kaspOverMonths.length - 1]}월 초과는 6K 캠페인과 장비 경합, ${kaspOverMonths[kaspOverMonths.length - 1] + 1}월 이후 목표 안으로 복귀`,
      onClick: undefined,
    },
  ].filter(Boolean) as { tone: 'critical' | 'warning'; icon: typeof Clock; title: string; body: string; onClick?: () => void }[]

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* B. 결론 묶음: 누계 처리량 판단 + 월별 추세, 받치는 지표 4개 */}
      <ConclusionBundle
        panel={
          <ConclusionPanel
            label={
              <>
                1~{CURRENT_MONTH}월 · 전년 동기 {int(PREV_YEAR.total)} 대비 {formatDelta(prevYearDeltaPct, { digits: 1, unit: '%' })}{' '}
                <PanelSeverity severity={progressSev} label={progressSev === 'ok' ? '누계 진도 달성' : undefined} />
              </>
            }
            valueLabel="누계 처리량 · 전 플랫폼"
            value={int(TOTAL_SAMPLES)}
            unit="샘플"
            statement={
              <>
                진도 목표 {int(PROGRESS_TARGET)}의 <b>{pct1(progressPct)}</b>를 처리했지만(연 목표 {int(ANNUAL_TARGET)}의 {pct1(annualPct)}) {CURRENT_MONTH}월은 진도 {pct1(octProgressPct)}로 늦습니다. 6K 평균 콜레이트{' '}
                {d1(MEAN_CALL_RATE_6K)}%, 1차 QC 통과율 {pct1(qcPassPct('6K'))}로 기준을 넘었고, 미해결 재분석은 <b>{UNRESOLVED_SAMPLES}샘플</b>(플레이트 경보 {UNRESOLVED_ALERT_PLATES}건 포함)입니다.
              </>
            }
            aside={
              <PanelTrend
                title={`월별 처리량(샘플) · ${CURRENT_MONTH}월 진행 중`}
                points={MONTHLY.map(r => ({ label: `${r.month}월`, value: r.total }))}
                refs={[{ value: MONTHLY_TARGET, label: `월 목표 ${int(MONTHLY_TARGET)}` }]}
                format={int}
                ariaLabel={`월별 처리량: 최대 ${peakMonth.month}월 ${int(peakMonth.total)}샘플, 월 목표 ${int(MONTHLY_TARGET)}샘플, 진행 중인 ${CURRENT_MONTH}월 ${int(oct.total)}샘플(진도 목표 ${int(OCT_PROGRESS_TARGET)}).`}
              />
            }
          />
        }
      >
        <KpiRow cols={TILE_COLS} className="col-span-full">
          <KpiTile
            size="compact"
            plainLabel="6K 평균 콜레이트"
            label="평균 콜레이트 · 6K"
            value={d1(MEAN_CALL_RATE_6K)}
            unit="%"
            sub={`기준 ≥ ${CALL_RATE_THRESHOLD}% · ${int(SAMPLES['6K'])}샘플`}
            delta={round1(MEAN_CALL_RATE_6K) - PREV_YEAR.callRate6K}
            deltaDigits={1}
            deltaUnit="%p"
            deltaLabel={`전년 ${d1(PREV_YEAR.callRate6K)}% 대비`}
            better="up"
            range={{ ...CATALOG_RANGE.callRate, value: MEAN_CALL_RATE_6K, label: `카탈로그 평균 범위 ${CATALOG_RANGE.callRate.lo}–${CATALOG_RANGE.callRate.hi}%` }}
            info={`샘플별 호출 성공 마커 수 / 칩 전체 ${int(PLATFORMS['6K'].markers)}마커의 평균(1차 분석).`}
          />
          <KpiTile
            size="compact"
            plainLabel="6K 1차 QC 통과율"
            label="1차 QC 통과율 · 6K"
            value={d1(qcPassPct('6K'))}
            unit="%"
            sub={<span className="break-keep">{`${int(QC_PASS['6K'])}/${int(SAMPLES['6K'])} · 재분석 후 ${int(FINAL_6K)}/${int(SAMPLES['6K'])} 확보 · 전 플랫폼 ${pct1(qcPassPct('all'))}`}</span>}
            delta={round1(qcPassPct('6K')) - PREV_YEAR.qcPass6K}
            deltaDigits={1}
            deltaUnit="%p"
            deltaLabel={`전년 ${d1(PREV_YEAR.qcPass6K)}% 대비`}
            better="up"
            range={{ ...CATALOG_RANGE.qcPass, value: qcPassPct('6K'), label: `카탈로그 범위 ${CATALOG_RANGE.qcPass.lo}–${CATALOG_RANGE.qcPass.hi}%` }}
            info={`콜레이트 ≥ ${CALL_RATE_THRESHOLD}%, 이형접합도 ≤ ${HET_THRESHOLD}%, 비부모 대립유전자 ≤ ${NONPARENT_THRESHOLD}%를 모두 만족한 샘플 비율.`}
          />
          <KpiTile
            size="compact"
            plainLabel="6K 평균 처리 소요 시간(TAT)"
            label="평균 TAT · 6K"
            value={String(tat6k)}
            unit="일"
            sub={<span className="break-keep">{`KASP ${d1(TAT_MEAN.KASP)}일 · GBS ${d1(TAT_MEAN.GBS)}일 · 낮을수록 좋음`}</span>}
            delta={tat6k - PREV_YEAR.tat6K}
            deltaDigits={0}
            deltaUnit="일"
            deltaLabel={`전년 ${PREV_YEAR.tat6K}일 대비`}
            better="down"
            targetLabel={`목표 ≤ ${TAT_TARGET['6K']}일`}
            achievement={(TAT_TARGET['6K'] / TAT_MEAN['6K']) * 100}
            achievementDigits={1}
            severity={TAT_MEAN['6K'] <= TAT_TARGET['6K'] ? 'ok' : 'warning'}
            info="샘플 접수일~결과 제공일(달력일)의 샘플 수 가중 평균."
          />
          <KpiTile
            size="compact"
            plainLabel="미해결 재분석 샘플"
            label="미해결 재분석"
            value={String(UNRESOLVED_SAMPLES)}
            unit="샘플"
            sub={
              <>
                전 플랫폼 · 플레이트 {UNRESOLVED_PLATES}장(경보 {UNRESOLVED_ALERT_PLATES}) · 6K 미해결 0
                <UnresolvedBreakdown />
              </>
            }
            severity={UNRESOLVED_ALERT_PLATES > 0 ? 'critical' : undefined}
            info="재분석 상태가 대기·진행 중·재채취 요청·재시퀀싱 대기인 실패 샘플. 아래 실패 샘플 목록의 '미해결' 필터 샘플 행 수와 같습니다."
          />
        </KpiRow>
      </ConclusionBundle>

      <PageGrid>
        {/* C. 월별 처리량 */}
        <ChartCard
          className="col-span-12 lg:col-span-8"
          title="월별 처리량"
          subtitle={`${YEAR}년 1~${CURRENT_MONTH}월 · 결과 제공일 기준 신규 샘플 · 플랫폼 누적 · 막대를 누르면 실패 목록을 그 달로 필터${month ? ` (현재 ${month}월)` : ''}`}
          source={`점선 = 월 목표 ${int(MONTHLY_TARGET)} · ${CURRENT_MONTH}월 빗금 막대 = 진행 중(${CURRENT_MONTH}/${AS_OF_DAY}), 가로 표식 = 진도 목표 ${int(OCT_PROGRESS_TARGET)}`}
          height={300}
          legend={PLATFORM_KEYS.map(k => ({ label: PLATFORMS[k].name, color: platformVar(k) }))}
          actions={
            month !== null ? (
              <Button size="sm" onClick={() => setMonth(null)}>
                {month}월 필터 해제
              </Button>
            ) : undefined
          }
        >
          <MonthlyThroughputChart height={300} selected={month} onSelect={selectMonth} />
        </ChartCard>

        {/* H. 경보·주의 */}
        <Card className="col-span-12 lg:col-span-4" title={`경보·주의 ${watch.length}건`} subtitle={`${AS_OF} 기준 · 조치가 필요한 항목`}>
          <AlertList
            density="compact"
            chevron={false}
            actionLabel="— 실패 샘플 목록에서 보기"
            items={watch.map(w => ({ id: w.title, severity: w.tone, icon: w.icon, title: w.title, description: w.body, onClick: w.onClick }))}
          />
        </Card>

        {/* C. 6K 콜레이트 분포 */}
        <ChartCard
          className="col-span-12 lg:col-span-7"
          title="6K 콜레이트 분포"
          subtitle={`1차 분석 ${int(SAMPLES['6K'])}샘플 · 0.5%p 구간 · 기준 미달 막대를 누르면 실패 목록 필터`}
          source={`콜레이트 = 호출 성공 마커 / 칩 전체 ${int(PLATFORMS['6K'].markers)}마커 · 재분석 결과는 포함하지 않음`}
          height={300}
          legend={[
            { label: `QC 통과 구간(≥ ${CALL_RATE_THRESHOLD}%)`, color: 'var(--viz-cat-1)' },
            { label: '기준 미달', color: 'var(--color-warning)' },
            { label: `QC 기준 ${CALL_RATE_THRESHOLD}%`, color: 'var(--color-negative)', shape: 'line' },
            { label: '평균', color: 'var(--color-text)', shape: 'dashed' },
          ]}
          actions={<Segmented size="sm" ariaLabel="y축 척도" options={[{ value: 'lin', label: '선형' }, { value: 'log', label: '로그' }]} value={log ? 'log' : 'lin'} onChange={v => setLog(v === 'log')} />}
        >
          <CallRateHistogram height={300} log={log} onSelectBelow={selectBelow} />
        </ChartCard>

        {/* D. QC 통과율 */}
        <QcPassPanel className="col-span-12 lg:col-span-5" />

        {/* E. TAT 추이 */}
        <ChartCard
          className="col-span-12 lg:col-span-7"
          title="처리 소요 시간(TAT) 추이"
          subtitle="플랫폼별 월 평균(샘플 가중) · 처리 없는 달은 비움"
          source={`기간 평균: 6K ${d1(TAT_MEAN['6K'])}일 · KASP ${d1(TAT_MEAN.KASP)}일 · GBS ${d1(TAT_MEAN.GBS)}일 · 점선 = 같은 색 플랫폼의 목표(${PLATFORM_KEYS.map(k => TAT_TARGET[k]).join('·')}일)`}
          height={280}
          legend={[
            // GBS는 측정 월이 띄엄띄엄이라 선 없이 점만 그린다
            ...PLATFORM_KEYS.map(k => ({ label: PLATFORMS[k].name, color: platformVar(k), shape: k === 'GBS' ? ('circle' as const) : ('line' as const) })),
            { label: '목표 초과', color: 'var(--color-negative)', shape: 'ring' as const },
          ]}
        >
          <TatTrendChart height={280} />
        </ChartCard>

        {/* F. 플랫폼별 비중 */}
        <PlatformShare className="col-span-12 lg:col-span-5" />

        {/* G. 실패 샘플 목록 */}
        <div id="glo-fails" className="col-span-12 scroll-mt-4">
          <FailTable
            month={month}
            onClearMonth={() => setMonth(null)}
            crOnly={crOnly}
            onClearCr={() => setCrOnly(false)}
            status={status}
            onStatus={setStatus}
            platform={platform}
            onPlatform={setPlatform}
          />
        </div>
      </PageGrid>

      <ul className="flex flex-col gap-1 text-xs text-muted">
        <li>· 모든 수치는 가상 분석실의 목업 데이터입니다(시드 {SEED}). 계통·개체 ID는 가상입니다.</li>
        <li>· 처리량은 결과 제공일 기준 신규 샘플(재분석 제외)입니다. 6K {YEAR}년 캠페인(4~7월, {PLATE_COUNT['6K']}개 플레이트)은 종료되었고 미통과 {FAIL_COUNT['6K']}샘플은 재분석해 {int(FINAL_6K)}계통 모두 유전체 추정 육종가(GEBV)를 산출했습니다.</li>
        <li>· 6K 콜레이트는 칩 전체 {int(PLATFORMS['6K'].markers)}마커 기준이며, 마커 QC(소수 대립유전자 빈도(MAF) &lt; 0.05 또는 마커 콜레이트 &lt; {CALL_RATE_THRESHOLD}% 제거) 후 GEBV 계산에는 {int(PLATFORMS['6K'].markersUsed ?? 0)}마커를 씁니다.</li>
        <li>· F6 이형접합도 기준 {HET_THRESHOLD}%는 잔여 이형접합 기대값 {d1(F6_EXPECTED_HET)}%((1/2)⁵)를 감안한 혼입 판정 기준입니다.</li>
      </ul>
    </div>
  )
}
