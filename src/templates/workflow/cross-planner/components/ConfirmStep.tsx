import { AlertTriangle, ArrowLeftRight, BadgeCheck, CircleAlert, Minus, X } from 'lucide-react'
import { AlertList, Badge, Button, Card, DataTable, EmptyState, KinBadge, Stat, type AlertListItem, type DataTableColumn } from '@/design-system'
import {
  HEADING_GAP,
  PLAN,
  fmt1,
  fmt2,
  type CrossPred,
  type PlanSummary,
  type PlanWarning,
  type PlannedCross,
} from '../data'

export interface ConfirmRow {
  key: string
  order: number
  id: string | null
  female: string
  male: string
  mu: number
  sigma: number
  uc: number
  f: number
  headingGap: number
  pred: CrossPred
  warnCount: number
}

export interface ConfirmStepProps {
  rows: ConfirmRow[]
  summary: PlanSummary
  warnings: PlanWarning[]
  overuse: Set<string>
  confirmed: boolean
  hasKinWarn: boolean
  onSwap: (key: string) => void
  onRemove: (key: string) => void
  onBack: () => void
  plan: PlannedCross[]
  /** 767px 이하: 조합 표를 좁은 열 배열(조합·UC·편집)로 */
  mobile: boolean
}

export function ConfirmStep({ rows, summary, warnings, overuse, confirmed, hasKinWarn, onSwap, onRemove, onBack, mobile }: ConfirmStepProps) {
  if (rows.length === 0)
    return (
      <Card>
        <EmptyState
          title="담은 조합이 없습니다"
          description="② 조합 검토에서 행렬의 셀을 골라 「조합 담기」를 누르거나 추천 조합을 담으세요."
          action={<Button onClick={onBack}>조합 검토로 돌아가기</Button>}
        />
      </Card>
    )

  const nameCls = (name: string) => (overuse.has(name) ? 'font-semibold text-warning' : 'font-semibold')
  // 경보·주의 배지(근연은 KinBadge 체계, 개화기·편중은 주의 배지)
  const flags = (r: ConfirmRow) => (
    <span className="inline-flex flex-wrap gap-1">
      {r.pred.level !== 'ok' && <KinBadge level={r.pred.level} />}
      {r.headingGap > HEADING_GAP && <Badge tone="warning">개화기</Badge>}
      {(overuse.has(r.female) || overuse.has(r.male)) && <Badge tone="warning">편중</Badge>}
      {r.warnCount === 0 && <span className="text-muted">—</span>}
    </span>
  )
  const editCol = (iconOnly: boolean): DataTableColumn<ConfirmRow> => ({
    key: 'actions',
    header: '편집',
    sortable: false,
    align: 'right' as const,
    format: (_: unknown, r: ConfirmRow) => (
      <span className={iconOnly ? 'inline-flex gap-2' : 'inline-flex gap-1'}>
        <Button size="sm" variant="secondary" onClick={() => onSwap(r.key)} aria-label={`${r.female} × ${r.male} 모본·부본 바꾸기`} title="모본·부본 바꾸기">
          <ArrowLeftRight size={12} aria-hidden="true" />
          {!iconOnly && '♀♂ 바꾸기'}
        </Button>
        <Button size="sm" variant={iconOnly ? 'secondary' : 'ghost'} onClick={() => onRemove(r.key)} aria-label={`${r.female} × ${r.male} 빼기`} title="빼기">
          {iconOnly ? <X size={13} aria-hidden="true" /> : <Minus size={12} aria-hidden="true" />}
          {!iconOnly && '빼기'}
        </Button>
      </span>
    ),
  })

  // 넓은 화면: 열 그대로(768~1023px는 순번·σ·출수기 차를 숨겨 경보·주의·편집이 화면 안에 들어오게)
  const wideColumns: DataTableColumn<ConfirmRow>[] = [
    ...(confirmed ? [{ key: 'id', header: '조합 ID', format: (v: unknown) => <strong className="text-text">{String(v)}</strong> }] : []),
    { key: 'order', header: '순번', numeric: true, hideBelow: 'lg' },
    { key: 'female', header: '모본(♀)', format: v => <span className={nameCls(String(v))}>{String(v)}</span> },
    { key: 'male', header: '부본(♂)', format: v => <span className={nameCls(String(v))}>{String(v)}</span> },
    { key: 'mu', header: 'μ', numeric: true, format: v => fmt1(v as number) },
    { key: 'sigma', header: 'σ', numeric: true, hideBelow: 'lg', format: v => fmt1(v as number) },
    { key: 'uc', header: 'UC', numeric: true, format: v => <strong>{fmt1(v as number)}</strong> },
    { key: 'f', header: 'f', numeric: true, format: v => fmt2(v as number) },
    { key: 'headingGap', header: '출수기 차(일)', numeric: true, hideBelow: 'lg' },
    { key: 'warnCount', header: '경보·주의', format: (_, r) => flags(r) },
    ...(!confirmed ? [editCol(false)] : []),
  ]

  // 좁은 화면(≤767px): 결론 열(UC·경보·주의·편집)이 가로 스크롤 뒤에 숨지 않게 조합 한 칸(♀·♂·μ·f·배지) + UC + 아이콘 편집
  const narrowColumns: DataTableColumn<ConfirmRow>[] = [
    {
      key: 'order',
      header: '조합(♀ × ♂)',
      format: (_, r) => (
        <div className="flex flex-col gap-0.5 py-0.5">
          {confirmed && r.id && <strong className="text-text">{r.id}</strong>}
          <span>
            <span className="mr-1 text-xs text-muted tabular-nums">{r.order}.</span>
            <span aria-hidden="true">♀ </span>
            <span className="sr-only">모본 </span>
            <span className={nameCls(r.female)}>{r.female}</span>
          </span>
          <span className="pl-4">
            <span aria-hidden="true">♂ </span>
            <span className="sr-only">부본 </span>
            <span className={nameCls(r.male)}>{r.male}</span>
          </span>
          <span className="text-xs text-muted tabular-nums">
            μ {fmt1(r.mu)} · f {fmt2(r.f)}
          </span>
          {r.warnCount > 0 && flags(r)}
        </div>
      ),
    },
    { key: 'uc', header: 'UC', numeric: true, format: v => <strong>{fmt1(v as number)}</strong> },
    ...(!confirmed ? [editCol(true)] : []),
  ]
  const columns = mobile ? narrowColumns : wideColumns

  // 경보·주의 요약: 공통 AlertList(경보 = 강한 근연, 주의 = 근연 주의·개화기·편중). 근연 항목 아이콘은 KinBadge 체계
  const alertItems: AlertListItem[] = warnings.map(w => ({
    id: w.id,
    severity: w.severity === 'warn' ? 'critical' : 'warning',
    title: w.title,
    description: <span className="tabular-nums">{w.detail}</span>,
    icon: w.kind === 'kinWarn' ? AlertTriangle : w.kind === 'kinCaution' ? CircleAlert : undefined,
  }))
  const nCritical = warnings.filter(w => w.severity === 'warn').length

  return (
    <div className="flex flex-col gap-4" data-confirm-step="" data-kin-warn={hasKinWarn ? 'true' : 'false'}>
      {/* I. 요약 */}
      <Card padding="lg">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-text">{PLAN.name}</h2>
          {confirmed ? (
            <Badge tone="positive">
              <BadgeCheck size={12} aria-hidden="true" />
              확정됨
            </Badge>
          ) : (
            <Badge tone="neutral">작성 중</Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
          <Stat size="lg" value={summary.crosses} unit="건" label="교배 조합 수" caption="이번 회차 상한 30건" />
          <Stat size="md" value={summary.parents} unit="계통" label="사용 부모 수" caption="고유 계통" />
          <Stat size="md" value={fmt1(summary.meanUc)} unit="kg/10a" label="평균 유용성(UC)" caption="선발 후 기대 평균 GEBV" />
          <Stat size="md" value={fmt2(summary.meanF)} label="평균 공조계수(f)" caption="낮을수록 먼 조합 · 음수 = 기준 집단 평균보다 먼 조합" />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* J. 경보·주의 요약 */}
        <Card title="경보·주의 요약" subtitle="심각도순 · 경보 → 주의" className="lg:self-start">
          <div data-warning-summary="" data-critical-count={nCritical} data-caution-count={warnings.length - nCritical}>
            <AlertList items={alertItems} ariaLabel={`경보·주의 ${warnings.length}건`} emptyText="경보·주의 없음" chevron={false} />
          </div>
        </Card>

        {/* K. 조합 목록 */}
        <Card title="교배 조합 목록" subtitle="UC 내림차순 · 초기 모본은 행렬의 행 부모" className="lg:col-span-2">
          <DataTable columns={columns} rows={rows} rowKey="key" dense caption="확정할 교배 조합 목록" />
        </Card>
      </div>
    </div>
  )
}
