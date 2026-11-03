import { useCallback, useState } from 'react'
import { Clock } from 'lucide-react'
import type { TemplateMeta } from '@/gallery/types'
import {
  AlertList,
  Button,
  Card,
  EmptyState,
  ErrorState,
  KpiRow,
  KpiTile,
  PageHeader,
  SequentialScaleLegend,
  Select,
  Skeleton,
  SummaryCallout,
  Switch,
  cn,
  useElementWidth,
  useMediaQuery,
  type AlertListItem,
} from '@/design-system'
import { formatFixed, josa } from '@/lib/format'
import {
  ALLELE_DIRECTION_NOTE,
  BASE_DATE,
  DEFAULT_PAIR,
  DISTINCT_MIN,
  DISTINCT_PAIRS,
  DISTINCT_PCT,
  DUS_CHECK,
  DUS_NOTE,
  ENHANCE_SNP,
  HARD_PAIRS,
  ID_HARD_PAIRS,
  ID_ZERO_PAIRS,
  INFO_SUM,
  LINE,
  LINE_DUS_D,
  LINE_NEAREST,
  MARKERS,
  MIN_PAIRS,
  MONO_MARKERS,
  N,
  N_FUNC,
  N_ID,
  OTHER_PROGRAM_VARIETIES,
  PAIRS,
  PAIR_STATS,
  PROFILES,
  RECHECK_TEXT,
  SEEDS_PER_TEST,
  Y2026,
  diffMarkers,
  label,
  nearest,
  pairOf,
} from './data'
import { ProfileGrid } from './components/ProfileGrid'
import { DistanceMatrix } from './components/DistanceMatrix'
import { PurityPanel, fmtPurity } from './components/PurityPanel'
import { MetricStrip } from './components/MetricStrip'

export const meta: TemplateMeta = {
  slug: 'variety-identity-markers',
  category: 'viz',
  title: '품종 식별 마커 프로필',
  description:
    '출원 후보·등록·대비 품종 10개의 KASP 16마커 DNA 프로필로 품종 간 식별 가능 여부(구별 마커 수 행렬)와 식별이 어려운 쌍을 찾고, 채종 로트의 DNA 순도 검정 결과로 입고 여부를 판정하는 화면.',
  tags: ['KASP', '품종 식별', 'DNA 프로필', '종자 순도', '품종보호', '벼'],
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

const pairName = (i: number, j: number) => `${label(PROFILES[i]!)} ↔ ${label(PROFILES[j]!)}`
const hard = HARD_PAIRS[0]!
const lineNear = PROFILES[LINE_NEAREST.idx[0]!]!
const lineNearMarkers = diffMarkers(LINE.geno, lineNear.geno)
const fail26 = Y2026.fail[0]
const plotShort = (p: string) => p.replace(/^C-1\s*/, '') || p
const undetectRows = Y2026.rows.filter(r => r.undetect.length > 0)
const nFuncSame = (i: number, j: number) => N_FUNC - diffMarkers(PROFILES[i]!.geno, PROFILES[j]!.geno).filter(m => !m.startsWith('ID')).length

const ALERTS: AlertListItem[] = [
  ...HARD_PAIRS.map(p => ({
    id: `hard-${p.i}-${p.j}`,
    severity: 'warning' as const, // KPI 「식별 곤란 쌍」과 같은 수준(도메인 검토 m8: 패널 한계는 실제 순도 불합격보다 높지 않음)
    title: `${pairName(p.i, p.j)} — 구별 마커 ${p.d}개(${p.markers.join('·')})`,
    description: `기능 마커 ${N_FUNC}개 ${nFuncSame(p.i, p.j) === N_FUNC ? '모두 같음' : `중 ${nFuncSame(p.i, p.j)}개 같음`}. 2027 출원 검토 전 6K 칩 프로필(${ENHANCE_SNP.toLocaleString('ko-KR')} SNP) 비교로 보강`,
  })),
  ...MIN_PAIRS.map(p => ({
    id: `min-${p.i}-${p.j}`,
    severity: 'warning' as const,
    title: `${pairName(p.i, p.j)} — ${p.d}개(${p.markers.join('·')}), 기준 최소`,
    description: '둘 중 하나가 판독 실패하면 식별 불가',
  })),
  ...Y2026.fail.map(r => ({
    id: `fail-${r.id}`,
    severity: 'warning' as const, // KPI 「순도 불합격」과 같은 수준(로트 입고 제외로 조치됨)
    title: `순도 불합격 ${r.id}(${label(r.line)} ${plotShort(r.plot)}) 이형립 ${r.x}/${r.n}`,
    description: `순도 ${fmtPurity(r.purity)} · 허용 ${r.k}립 초과 — 입고 제외`,
  })),
  {
    id: 'undetect',
    severity: 'info',
    title: `기준 품종과 구별 마커 ${DISTINCT_MIN}개 미만인 품종의 혼입·교잡은 이형립으로 판정할 수 없음(불일치 1개 → 재분석)`,
    description: undetectRows.map(r => `${label(r.line)} 로트의 ${r.undetect.map(label).join('·')} 혼입`).join(', '),
  },
]

export default function Template() {
  const [devState, setDevState] = useState<DevState>(readDevState)
  const [pair, setPair] = useState<[number, number]>(DEFAULT_PAIR)
  const [idOnly, setIdOnly] = useState(false)
  const [year, setYear] = useState<2025 | 2026>(2026)
  const [purSel, setPurSel] = useState<string | null>(null)
  const narrow = useMediaQuery('(max-width: 639px)')
  const { ref: matBox, width: matW } = useElementWidth<HTMLDivElement>()

  const [a, b] = pair
  const selectPair = useCallback((i: number, j: number) => setPair([i, j]), [])
  const onRowHeader = useCallback((i: number) => setPair([i, nearest(i).idx[0]!]), [])
  const setA = (v: string) => {
    const i = Number(v)
    setPair(([, pb]) => [i, pb === i ? nearest(i).idx[0]! : pb])
  }
  const setB = (v: string) => {
    const j = Number(v)
    setPair(([pa]) => [pa === j ? nearest(j).idx[0]! : pa, j])
  }
  const changeYear = (y: 2025 | 2026) => {
    setYear(y)
    setPurSel(null)
  }

  // 머리(공통 PageHeader: 범위 회색 한 줄 → 제목 + 기준일 스탬프 → 데이터 한 문장). 재확인 진행 상태는 데이터 문장 끝에 텍스트로(pill 없음)
  const header = (
    <PageHeader
      context={['벼', '자식성 고정 계통']}
      title={meta.title}
      scope={
        <>
          KASP {MARKERS.length}마커(기능 {N_FUNC} · ID {N_ID}) · {N}품종·계통 ·{' '}
          <span className="inline-flex items-center gap-1 text-text">
            <Clock size={13} className="shrink-0 text-muted" aria-hidden="true" />
            {RECHECK_TEXT}
          </span>
        </>
      }
      asOf={BASE_DATE}
      details={
        narrow
          ? `식별 가능 = 모든 쌍(${PAIRS.length}쌍)에서 유전형이 다른 마커가 ${DISTINCT_MIN}개 이상(내부 기준, 추정). 최근접 품종 = 출원 예정 계통과 구별 마커 수가 가장 적은 품종. 마커 차이는 식별 참고 자료이며 DUS 심사의 구별성은 형질로 판정한다.`
          : undefined
      }
      detailsLabel="지표 기준"
    />
  )

  if (devState === 'error')
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState
          title="품종 식별 프로필을 불러오지 못했습니다"
          description="유전체 분석실 KASP 결과 응답이 없습니다. 잠시 뒤 다시 시도하세요."
          action={<Button onClick={() => setDevState('ready')}>다시 시도</Button>}
        />
      </div>
    )
  if (devState === 'loading')
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <Skeleton height={narrow ? 92 : 48} className="rounded-md" />
        <Card title="마커 프로필">
          <Skeleton height={420} />
        </Card>
        <KpiRow loading hero count={4} skeletonHeight={128} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-7" title="구별 마커 수 행렬">
            <Skeleton height={420} />
          </Card>
          <Card className="lg:col-span-5" title="식별 주의">
            <Skeleton height={260} />
          </Card>
        </div>
      </div>
    )
  if (devState === 'empty')
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState title="프로필이 없습니다" description="KASP 프로필이 등록된 품종·계통이 없습니다. 유전체 분석실에서 기준 프로필 분석을 의뢰하면 이 화면에 표시됩니다." />
      </div>
    )

  const cur = pairOf(a, b)
  const curD = idOnly ? cur.dId : cur.d
  const curMarkers = idOnly ? cur.idMarkers : cur.markers
  const gridDiff = diffMarkers(PROFILES[a]!.geno, PROFILES[b]!.geno)
  const verdictText = (d: number) => (d < DISTINCT_MIN ? '식별 곤란' : d === DISTINCT_MIN ? '식별 가능(최소)' : '식별 가능')

  // 선택 지표: 넓은 화면 KpiRow(대표 = 식별 가능 쌍), 390px 가로 띠. 띠 안에서는 ⓘ가 잘리므로 뜻은 머리 「지표 기준」으로
  const tiles = [
    <KpiTile
      key="distinct"
      size="hero"
      label="16마커로 식별 가능한 쌍"
      value={DISTINCT_PAIRS.length}
      unit={`/ ${PAIRS.length}쌍`}
      sub={`${formatFixed(DISTINCT_PCT, 1)}% · 구별 마커 ≥ ${DISTINCT_MIN}개 · 평균 ${formatFixed(PAIR_STATS.mean, 1)}개`}
      info={narrow ? undefined : `${N}품종·계통의 모든 쌍(${PAIRS.length}쌍)에서 유전형이 다른 마커 수를 세어 ${DISTINCT_MIN}개 이상이면 식별 가능(내부 기준, 추정).`}
    />,
    <KpiTile key="hard" label="식별 곤란 쌍" value={HARD_PAIRS.length} unit="쌍" sub={`${pairName(hard.i, hard.j)} · ${hard.markers.join('·')} ${hard.d}개`} severity={HARD_PAIRS.length > 0 ? 'warning' : 'ok'} />,
    <KpiTile
      key="nearest"
      label={`${josa(LINE.id, '와과')} 최근접 품종의 구별 마커`}
      value={LINE_NEAREST.d}
      unit="개"
      sub={`${label(lineNear)}(${lineNearMarkers.join('·')}) · DUS 대조 ${label(DUS_CHECK)} ${LINE_DUS_D}개`}
      info={narrow ? undefined : '출원 예정 계통과 구별 마커 수가 가장 적은 품종. 마커 차이는 식별 참고 자료이며 DUS 심사의 구별성은 형질로 판정한다.'}
    />,
    <KpiTile
      key="purity"
      label={`2026 순도 검정 합격`}
      value={Y2026.pass}
      unit={`/ ${Y2026.tests}건`}
      sub={
        fail26
          ? `불합격 ${Y2026.fail.length}(${label(fail26.line)} ${plotShort(fail26.plot)} ${fail26.x}/${fail26.n}) 입고 제외 · 입고 로트 이형립 ${Y2026.intakeX}/${Y2026.intakeN}`
          : `입고 로트 이형립 ${Y2026.intakeX}/${Y2026.intakeN}`
      }
      severity={Y2026.fail.length > 0 ? 'warning' : 'ok'}
    />,
  ]

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* 결론 띠: 머리 바로 아래 한 곳. 식별 곤란·순도 불합격이 있으면 주의 */}
      <SummaryCallout tone={HARD_PAIRS.length > 0 || Y2026.fail.length > 0 ? 'warning' : 'neutral'}>
        {PAIRS.length}쌍 중 <b>{DISTINCT_PAIRS.length}쌍</b>({formatFixed(DISTINCT_PCT, 1)}%)을 {MARKERS.length}마커로 식별할 수 있습니다.
        {HARD_PAIRS.length > 0 && (
          <>
            {' '}
            식별 곤란은 <b>{pairName(hard.i, hard.j)}</b>(구별 마커 {hard.d}개) 등 {HARD_PAIRS.length}쌍입니다.
          </>
        )}{' '}
        2026 순도 검정은 {Y2026.tests}건 중 {Y2026.pass}건 합격
        {fail26 ? (
          <>
            이고 <b>{fail26.id}</b>는 입고에서 제외했습니다.
          </>
        ) : (
          '입니다.'
        )}
      </SummaryCallout>

      {/* 주 그림: 마커 프로필 격자(전체 폭). 범례는 격자 아래 */}
      <Card
        title="KASP 16마커 프로필"
        subtitle={`행 머리를 누르면 그 품종을 A로, 최근접 품종을 B로 선택 · 선택 쌍에서 다른 마커는 테두리와 ≠ 표시 · 단형 마커(${MONO_MARKERS.join('·')})는 이 ${N}개를 구별하지 못함`}
      >
        {/* 선택 쌍이 갈리는 마커(좁은 화면에서 격자 오른쪽 끝 ID 마커가 스크롤 밖일 수 있어 문장으로도 보인다) */}
        <p className="mb-2 text-[13px] text-text" data-grid-pair-line>
          <b>A</b> {label(PROFILES[a]!)} ↔ <b>B</b> {label(PROFILES[b]!)} · 다른 마커 <b>{gridDiff.length}개</b>
          {gridDiff.length ? `(${gridDiff.join('·')})` : ''}
        </p>
        <ProfileGrid a={a} b={b} idOnly={idOnly} narrow={narrow} onRowHeader={onRowHeader} />
        <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3 text-xs text-muted">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-5 w-7 items-center justify-center rounded-sm bg-accent text-[11px] font-bold text-accent-contrast">BB</span>
              <span className="inline-flex h-5 w-7 items-center justify-center rounded-sm border border-text/55 bg-[color-mix(in_oklab,var(--color-text)_7%,var(--color-surface))] text-[11px] font-bold text-text">BB</span>
              <span className="inline-flex h-5 w-7 items-center justify-center rounded-sm bg-surface-2 text-[11px] font-bold text-muted">AA</span>
            </span>
            <span>{ALLELE_DIRECTION_NOTE}</span>
          </p>
          <p>
            마커 정보량 합 {INFO_SUM} = {PAIRS.length}쌍 구별 마커 수 합 {PAIR_STATS.sum}(평균 {formatFixed(PAIR_STATS.mean, 1)}개 · 중앙값 {PAIR_STATS.median} · 최대 {PAIR_STATS.max})
          </p>
          {narrow && (
            <p className="w-full text-text">
              A {PROFILES[a]!.name}: {PROFILES[a]!.status} · {PROFILES[a]!.source}
              <br />B {PROFILES[b]!.name}: {PROFILES[b]!.status} · {PROFILES[b]!.source}
            </p>
          )}
        </div>
      </Card>

      {/* 선택 지표 */}
      {narrow ? (
        <MetricStrip label="선택 지표(가로 스크롤)">{tiles}</MetricStrip>
      ) : (
        <KpiRow hero ariaLabel="선택 지표">
          {tiles}
        </KpiRow>
      )}

      {/* D. 행렬 + E. 식별 주의 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card
          className="min-w-0 lg:col-span-7"
          title="구별 마커 수 행렬"
          subtitle={idOnly ? `ID 마커 ${N_ID}개만 사용 · 셀을 누르면 쌍 선택` : `${MARKERS.length}마커 중 유전형이 다른 마커 수 · 셀을 누르면 쌍 선택`}
          actions={<Switch className="h-8" checked={idOnly} onChange={setIdOnly} label="ID 마커만" />}
        >
          <div className="flex flex-col gap-3" data-id-only={idOnly ? 'true' : 'false'}>
            <div className="flex flex-wrap items-end gap-2">
              <Select label="품종 A" options={PROFILES.map(p => ({ value: String(p.idx), label: label(p) }))} value={String(a)} onChange={setA} />
              <Select label="품종 B" options={PROFILES.map(p => ({ value: String(p.idx), label: label(p) }))} value={String(b)} onChange={setB} />
            </div>
            <p className="text-[13px] text-text" aria-live="polite" data-pair-line>
              <b>{pairName(a, b)}</b>: {curD}개{curMarkers.length ? `(${curMarkers.join('·')})` : ''} ·{' '}
              <span className={cn('font-semibold', curD < DISTINCT_MIN ? 'text-negative' : curD === DISTINCT_MIN ? 'text-text underline decoration-dashed' : 'text-text')}>{verdictText(curD)}</span>
              {idOnly && <span className="text-muted"> · 16마커 기준 {cur.d}개</span>}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
              <SequentialScaleLegend
                layout="inline"
                title={idOnly ? `구별 마커 수(ID ${N_ID}마커 중)` : `구별 마커 수(${MARKERS.length}마커 중)`}
                ariaLabel={`색이 진할수록 구별 마커가 많음, 0 ~ ${idOnly ? N_ID : PAIR_STATS.max}`}
                domain={[0, idOnly ? N_ID : PAIR_STATS.max]}
                ticks={[
                  { value: 0, label: '0' },
                  { value: idOnly ? N_ID : PAIR_STATS.max, label: String(idOnly ? N_ID : PAIR_STATS.max) },
                ]}
              />
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block size-3.5 rounded-[2px] border-2 border-warning"
                  style={{ background: 'repeating-linear-gradient(135deg, var(--color-surface-2) 0 3px, color-mix(in oklab, var(--color-text-muted) 45%, transparent) 3px 4.2px)' }}
                />
                &lt; {DISTINCT_MIN} 식별 곤란
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block size-3.5 rounded-[2px] border-[1.5px] border-dashed border-text" />= {DISTINCT_MIN} 최소
              </span>
              <span className="font-semibold text-text">≥ {DISTINCT_MIN} 식별 가능</span>
            </div>
            {/* 폭 측정용. 행렬은 이 폭에 맞춰 셀 크기를 정해(390px 셀 20px) 가로로 넘치지 않는다 */}
            <div ref={matBox} className="w-full">
              {matW > 0 && <DistanceMatrix width={matW} idOnly={idOnly} a={a} b={b} onSelect={selectPair} />}
            </div>
            <p className="text-xs text-muted">
              가로 번호 = 세로 축 앞 번호. 굵은 선은 역할 경계(출원 후보 · 출원·심사 · 등록 · 대비).
              {idOnly ? (
                <b className="ml-1 text-text">
                  ID 마커만: 식별 곤란 {ID_HARD_PAIRS.length}쌍(그중 0개 {ID_ZERO_PAIRS.length}쌍: {ID_ZERO_PAIRS.map(p => pairName(p.i, p.j)).join(', ')}) → 기능 마커 포함 {HARD_PAIRS.length}쌍
                </b>
              ) : (
                <span className="ml-1">
                  ID 마커만 쓰면 식별 곤란 {ID_HARD_PAIRS.length}쌍 → 기능 마커 포함 {HARD_PAIRS.length}쌍.
                </span>
              )}
            </p>
          </div>
        </Card>

        <Card className="min-w-0 lg:col-span-5" title="식별·순도 주의" subtitle="식별 곤란 쌍, 기준 최소 쌍, 순도 불합격, 검출 한계">
          <AlertList items={ALERTS} ariaLabel={`식별·순도 주의 ${ALERTS.length}건`} chevron={false} />
          <p className="mt-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-[13px] font-medium text-text">{DUS_NOTE}</p>
        </Card>
      </div>

      {/* F. 순도 검정 */}
      <Card
        title="채종 로트 DNA 순도 검정"
        subtitle={`본장 채종포 C-1 구획별 수확 전 이삭 시료 ${SEEDS_PER_TEST}립(이삭 1개당 1립) · KASP ${MARKERS.length}마커 · 합격 구획 수확분만 입고 · 행을 누르면 상세`}
      >
        <PurityPanel year={year} onYear={changeYear} selected={purSel} onSelect={setPurSel} />
      </Card>

      {/* G. 각주 */}
      <footer className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted">
        <p>① 목업 데이터입니다. 품종·계통명은 모두 가상이며, 유전자 이름은 실제이나 보유 여부는 가상입니다.</p>
        <p>② 이 화면은 프로그램 품종 {N}개만 다룹니다(다른 등록·심사 품종 {OTHER_PROGRAM_VARIETIES}개 제외).</p>
        <p>
          ③ 순도 검정 시료는 수확 전 이삭 시료({SEEDS_PER_TEST}이삭 × 1립)로 입고량에 포함하지 않습니다. 국가 종자검사 기준과 별개의 기관 내부 검정입니다.
        </p>
        <p>④ DUS 균일성(포장 관찰 이형주, 출원 요약서)과 DNA 순도 검정(이형립)은 다른 조사입니다.</p>
        <p>
          {josa(LINE.id, '와과')} 가장 가까운 품종은 {label(lineNear)}({LINE_NEAREST.d}개)이며, 마커 차이는 식별 참고 자료입니다.
        </p>
      </footer>
    </div>
  )
}
