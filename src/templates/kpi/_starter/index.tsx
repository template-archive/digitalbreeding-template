import { useMemo, useState } from 'react'
import type { TemplateMeta } from '@/gallery/types'
import {
  AlertList,
  Badge,
  Card,
  ChartCard,
  DataTable,
  KpiRow,
  KpiTile,
  Legend,
  MobileSummary,
  PageGrid,
  PageHeader,
  ScaledCanvas,
  ScrollRegion,
  SeverityTag,
  Stepper,
  SummaryCallout,
  u,
  type DataTableColumn,
} from '@/design-system'
import { EChart, useChartTheme, type EChartsOption } from '@/charts'
import { formatNumber } from '@/lib/format'
import { CHECK_LINES, CHECK_STEPS, GS_START, YEARS, conventional, genomic, kpis, type CheckLine } from './data'

export const meta: TemplateMeta = {
  slug: '_starter',
  category: 'kpi',
  title: '기반 검증용 스타터',
  description: '디자인 시스템·차트 래퍼·갤러리 계약이 함께 동작하는지 확인하는 내부 예제입니다.',
  tags: ['내부', '유전 획득량', '벼'],
  organism: '벼',
  status: 'draft',
  updatedAt: '2026-10-30',
}

const pct = (now: number, prev: number) => Number((((now - prev) / prev) * 100).toFixed(1))

const VERDICT_TONE = { 진급: 'positive', 보류: 'neutral', 탈락: 'negative' } as const
// 좁은 화면 열 우선순위: 결론 열(지수·판정)을 남기고 출수·간장·그룹은 hideBelow로 뺀다
const CHECK_COLUMNS: DataTableColumn<CheckLine>[] = [
  { key: 'id', header: '계통', format: v => <span className="font-semibold">{String(v)}</span> },
  { key: 'group', header: '그룹', hideBelow: 'lg' },
  { key: 'heading', header: '출수(일)', numeric: true, hideBelow: 'sm' },
  { key: 'height', header: '간장(cm)', numeric: true, hideBelow: 'sm' },
  // 머리에 여러 조각(Fragment): 오른쪽 정렬 열에서도 어순 유지('쌀 수량 (kg/10a)')
  {
    key: 'yield',
    header: (
      <>
        쌀 수량 <span className="font-normal">(kg/10a)</span>
      </>
    ),
    numeric: true,
  },
  { key: 'index', header: '대비 지수(%)', numeric: true, format: v => formatNumber(v as number, { digits: 1 }) },
  { key: 'verdict', header: '판정', format: v => <Badge tone={VERDICT_TONE[v as CheckLine['verdict']]}>{String(v)}</Badge> },
]

// 카드 머리 동작 묶음이 좁은 화면에서 안쪽 줄바꿈되는지(Card·ChartCard actions)
const CHECK_ACTIONS = ['진급 기준 105%', '보류 99~105%', '탈락 99% 미만', '대비 가람솔 A-3']

export default function StarterTemplate() {
  const theme = useChartTheme()
  const [c1, c2] = theme.categorical

  const option = useMemo<EChartsOption>(
    () => ({
      grid: { left: 24, right: 24, top: 28, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        valueFormatter: v => (typeof v === 'number' ? `${formatNumber(v, { digits: 1 })} kg/10a` : '–'),
      },
      xAxis: { type: 'category', data: YEARS.map(String), boundaryGap: false },
      yAxis: { type: 'value', name: '평균 육종가 (kg/10a)', nameLocation: 'middle', nameGap: 36 },
      series: [
        {
          name: '전통 선발',
          type: 'line',
          data: conventional,
          lineStyle: { color: c1, width: 2 },
          itemStyle: { color: c1 },
        },
        {
          name: '유전체 선발',
          type: 'line',
          data: genomic,
          connectNulls: false,
          lineStyle: { color: c2, width: 2.5 },
          itemStyle: { color: c2 },
          markLine: {
            symbol: 'none',
            silent: true,
            lineStyle: { color: theme.textMuted, type: 'dashed' },
            label: { formatter: '유전체 선발 도입', color: theme.textMuted, position: 'end', distance: 6 },
            data: [{ xAxis: String(YEARS[GS_START]) }],
          },
        },
      ],
    }),
    [c1, c2, theme.textMuted],
  )

  const last = YEARS.length - 1
  const gainUplift = pct(kpis.geneticGain.value, kpis.geneticGain.previous)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        context="벼 · 수량(kg/10a) · 내부 검증용"
        title="벼 수량 육종 프로그램 요약"
        scope="2017–2026 연간 유전 획득량은 유전체 선발 도입(2021) 뒤 늘었다 · 목업 데이터"
        asOf="2026-10-30"
        details="이 화면은 내부 검증용입니다. 아래 「공통 컴포넌트 점검」은 좁은 화면 안내·열 숨김·터치 영역·캔버스 요약 카드처럼 폭에 따라 달라지는 공통 동작을 한곳에서 확인합니다."
      />
      <KpiRow>
        <KpiTile
          label="연간 유전 획득량"
          value={kpis.geneticGain.value}
          digits={1}
          unit="kg/10a/년"
          delta={gainUplift}
          deltaLabel="전통 선발 대비"
          better="up"
          spark={kpis.geneticGain.spark}
          period="2021–2026"
          info="연도별 평균 육종가 회귀 기울기. 유전체 선발 도입 이후 구간 기준."
        />
        <KpiTile
          label="GEBV 선발 정확도"
          value={kpis.accuracy.value}
          digits={2}
          delta={pct(kpis.accuracy.value, kpis.accuracy.previous)}
          deltaLabel="전년 대비"
          better="up"
          target={kpis.accuracy.target}
          spark={kpis.accuracy.spark}
          period="2026"
          info="검증 집단에서 GEBV와 관측 표현형의 상관을 √h²로 나눈 값."
        />
        <KpiTile
          label="평균 세대 간격"
          value={kpis.generationInterval.value}
          digits={1}
          unit="년"
          delta={pct(kpis.generationInterval.value, kpis.generationInterval.previous)}
          deltaLabel="전년 대비"
          better="down"
          target={kpis.generationInterval.target}
          spark={kpis.generationInterval.spark}
          period="2026"
          info="부모 선발 시점의 평균 나이. 짧을수록 연간 유전 획득량이 커진다."
        />
      </KpiRow>
      <SummaryCallout>
        유전체 선발 도입(2021) 뒤 연간 유전 획득량이 <b>{kpis.geneticGain.previous} → {kpis.geneticGain.value} kg/10a/년</b>으로 늘었습니다.
      </SummaryCallout>
      <PageGrid>
        <ChartCard
          className="col-span-12"
          title="연도별 평균 육종가 추이"
          subtitle="수량(kg/10a), 2017년 기준 편차"
          source="출처: 목업 데이터(시드 20261023)"
          height={320}
          legend={[
            { label: '전통 선발', color: c1 ?? '', shape: 'line' },
            { label: '유전체 선발', color: c2 ?? '', shape: 'line' },
          ]}
        >
          <EChart
            option={option}
            height="100%"
            ariaLabel={`유전체 선발 도입(2021) 이후 연간 유전 획득량이 ${kpis.geneticGain.previous}에서 ${kpis.geneticGain.value} kg/10a로 증가했다.`}
            fallbackTable={{
              columns: ['연도', '전통 선발', '유전체 선발'],
              rows: YEARS.map((y, i) => [y, conventional[i]!, genomic[i] ?? '–']),
            }}
          />
        </ChartCard>
      </PageGrid>
      <p className="text-xs text-muted">
        2026년 유전체 선발 경로의 누적 개량량은 {formatNumber(genomic[last] ?? 0, { digits: 1 })} kg/10a입니다.
      </p>
      <CommonCheck />
    </div>
  )
}

/** 공통 컴포넌트 점검(2026-10-30 디자인 개선 A단계): 폭에 따라 달라지는 공통 동작을 한곳에서 본다 */
function CommonCheck() {
  const [step, setStep] = useState<string>('qc')
  return (
    <section aria-labelledby="starter-check" className="flex flex-col gap-4 border-t border-border pt-4">
      <h2 id="starter-check" className="text-base font-semibold text-text">
        공통 컴포넌트 점검
      </h2>
      <KpiRow ariaLabel="심각도 점검 지표">
        <KpiTile label="유효 집단 크기(Ne)" value={52} sub="하한 50 · 목표 없음" severity="warning" period="2026" />
        <KpiTile label="연간 근교 증가율" value="0.44" unit="%/년" sub="상한 0.42%/년" severity="critical" period="2026" />
        <KpiTile label="부모 후보 근연 쌍" value={3} unit="쌍" sub="f ≥ 0.375" severity="ok" period="2026" />
        <KpiTile label="채종 로트 순도" value="99.6" unit="%" sub="기준 99.0% 이상" period="2026" />
      </KpiRow>
      <Stepper ariaLabel="시험포장 진행 단계" items={CHECK_STEPS.map(s => ({ ...s }))} current={step} onChange={setStep} />
      <PageGrid>
        <Card
          className="col-span-12 lg:col-span-7"
          title="시험 계통 판정"
          subtitle="640px 미만: 출수·간장 숨김 · 1024px 미만: 그룹 숨김 · 숫자 열 오른쪽 정렬 · 넘치면 안내 + 오른쪽 페이드 · 계통 열 고정 + 현재 행 윤곽"
          actions={CHECK_ACTIONS.map(a => (
            <Badge key={a} tone="neutral">
              {a}
            </Badge>
          ))}
        >
          <DataTable columns={CHECK_COLUMNS} rows={CHECK_LINES} rowKey="id" dense caption="시험 계통 판정(점검용)" stickyColumn="id" activeRow={r => r.id === CHECK_LINES[1]!.id} />
        </Card>
        <Card className="col-span-12 lg:col-span-5" title="경보·주의 3건" subtitle="값은 제목 옆, 좁은 목록에서는 제목 아래">
          <AlertList
            items={[
              { id: 'f', severity: 'critical', title: '연간 근교 증가율이 상한을 넘었습니다', value: '0.44%/년', description: '상한 0.42%/년' },
              { id: 'ne', severity: 'warning', title: '유효 집단 크기(Ne)', value: 'Ne 52', description: '하한 50에 근접' },
              // 긴 값: 값 길이 기준으로 더 넓은 목록에서도 제목 아래로
              { id: 'he', severity: 'warning', title: '그룹 A·B의 기대 이형접합도가 하한 아래입니다', value: 'He 0.337~0.340', description: '하한 0.35', onClick: () => {} },
              { id: 'k', severity: 'info', title: 'KASP 결과 대기 2계통', value: '대기', description: '11-04 회신 예정' },
            ]}
          />
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            표·카드 심각도 표시: <SeverityTag severity="critical" /> <SeverityTag severity="warning" /> <SeverityTag severity="ok" label="정상" /> <SeverityTag severity="info" />
          </p>
        </Card>
      </PageGrid>
      <Card title="범례 견본(Legend)" subtitle="사각·선·점선·원·빈 원·다이아몬드·삼각형·빗금·결측">
        <Legend
          items={[
            { label: '사각', color: 'var(--viz-cat-1)' },
            { label: '선', color: 'var(--viz-cat-2)', shape: 'line' },
            { label: '점선', color: 'var(--color-text-muted)', shape: 'dashed' },
            { label: '선발(원)', color: 'var(--color-accent)', shape: 'circle' },
            { label: '비선발(빈 원)', color: 'var(--color-text-muted)', shape: 'ring' },
            { label: '리드 SNP(다이아몬드)', color: 'var(--color-accent)', shape: 'diamond' },
            { label: '한계 위반(삼각형)', color: 'var(--color-negative)', shape: 'triangle' },
            { label: '출원 예정(빗금)', color: 'var(--viz-cat-1)', shape: 'hatch' },
            { label: '대기·결측', color: '', shape: 'missing' },
          ]}
        />
      </Card>
      <Card title="가로 스크롤 영역(ScrollRegion)" subtitle="표가 아닌 넓은 그림: 넘칠 때만 안내 + 오른쪽 페이드 · 선택 칸 = select-ring · 아래는 테두리 있는 스크롤 컨테이너(페이드가 테두리 안쪽)">
        <ScrollRegion label="연도별 칸 테두리(가로 스크롤)" className="rounded-md border border-border" wrapperClassName="mb-3">
          <div className="grid min-w-[880px] grid-cols-10 gap-1 p-2">
            {YEARS.map(y => (
              <div key={y} className="rounded-sm bg-surface-2 px-2 py-2 text-center text-xs tabular-nums">
                {y}
              </div>
            ))}
          </div>
        </ScrollRegion>
        <ScrollRegion label="연도별 칸(가로 스크롤)">
          <div className="grid min-w-[880px] grid-cols-10 gap-1">
            {YEARS.map((y, i) => (
              <div key={y} className={`rounded-md border px-2 py-3 text-center text-xs tabular-nums ${i === GS_START ? 'select-ring border-transparent bg-[var(--viz-seq-5)] text-accent-contrast' : 'border-border'}`}>
                {y}
              </div>
            ))}
          </div>
        </ScrollRegion>
      </Card>
      <ScaledCanvas
        width={1920}
        height={540}
        ariaLabel="유전체 선발 도입 뒤 연간 유전 획득량이 늘었다는 점검용 캔버스"
        className="bg-bg text-text"
        summary={
          <MobileSummary
            title="점검용 캔버스 요약"
            items={[
              { key: 'g', label: '연간 유전 획득량', value: formatNumber(kpis.geneticGain.value, { digits: 1 }), detail: <span className="text-[14px] text-muted"> kg/10a/년</span>, primary: true },
              { key: 'r', label: '선발 정확도', value: `${kpis.accuracy.value}` },
            ]}
            footer="캔버스가 잘리는 폭(768px 포함)에서만 보입니다"
          />
        }
      >
        <div style={{ padding: u(48), display: 'flex', flexDirection: 'column', gap: u(16) }}>
          <p style={{ fontSize: u(28) }} className="font-semibold text-muted">
            점검용 캔버스 1920 × 540
          </p>
          <p style={{ fontSize: u(72) }} className="font-extrabold text-accent tabular-nums">
            {kpis.geneticGain.previous} → {kpis.geneticGain.value} kg/10a/년
          </p>
          <p style={{ fontSize: u(24) }} className="text-muted">
            최소 배율 0.6(1152px)보다 좁으면 위에 요약 카드와 안내가 나오고 오른쪽 끝에 페이드가 생긴다.
          </p>
        </div>
      </ScaledCanvas>
    </section>
  )
}
