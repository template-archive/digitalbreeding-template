import { Badge, DataTable, type DataTableColumn } from '@/design-system'
import { RPC_MIN_N, SURVEY, ci95, ci95p, type SurveyRow } from '../data'
import { n } from './fmt'

const LO = 1
const HI = 5
const pos = (v: number) => `${((Math.min(HI, Math.max(LO, v)) - LO) / (HI - LO)) * 100}%`

/** 5점 척도 위 평균 점 + 95% 신뢰구간 막대 */
function DotCI({ mean, ci, color }: { mean: number; ci: number; color: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="relative block h-3 w-14 shrink-0 sm:w-24" aria-hidden="true">
        <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
        {[1, 2, 3, 4, 5].map(t => (
          <span key={t} className="absolute top-1/2 h-1.5 w-px -translate-y-1/2 bg-border" style={{ left: pos(t) }} />
        ))}
        <span className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full" style={{ left: pos(mean - ci), right: `calc(100% - ${pos(mean + ci)})`, background: color }} />
        <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface" style={{ left: pos(mean), background: color }} />
      </span>
      <span className="whitespace-nowrap tabular-nums">
        <b className="text-text">{n(mean, 1)}</b> <span className="text-muted">± {n(ci, 2)}</span>
      </span>
    </span>
  )
}

const COLUMNS: DataTableColumn<SurveyRow>[] = [
  { key: 'name', header: '품종', format: (_v, r) => <span className="font-semibold text-text">{r.name}</span> },
  { key: 'n', header: '응답 농가 n', numeric: true, hideBelow: 'sm', sortDescFirst: true },
  {
    key: 'yieldSat',
    header: '수량 만족도',
    sortValue: r => r.yieldSat[0],
    sortDescFirst: true,
    headerTitle: '5점 척도 평균 ± 95% 신뢰구간(1.96·SD/√n)',
    format: (_v, r) => <DotCI mean={r.yieldSat[0]} ci={ci95(r.yieldSat[1], r.n)} color="var(--viz-cat-1)" />,
  },
  {
    key: 'qualitySat',
    header: '품질 만족도',
    hideBelow: 'sm',
    sortValue: r => r.qualitySat[0],
    sortDescFirst: true,
    headerTitle: '5점 척도 평균 ± 95% 신뢰구간(1.96·SD/√n)',
    format: (_v, r) => <DotCI mean={r.qualitySat[0]} ci={ci95(r.qualitySat[1], r.n)} color="var(--viz-cat-2)" />,
  },
  {
    key: 'rpc',
    header: 'RPC 평가',
    hideBelow: 'sm',
    sortValue: r => r.rpc.mean,
    sortDescFirst: true,
    headerTitle: `미곡종합처리장(RPC) 수매 담당 5점 척도 평균. RPC ${RPC_MIN_N}곳 미만은 참고`,
    format: (_v, r) => (
      <span className="flex items-center gap-1.5 whitespace-nowrap tabular-nums">
        <b className="text-text">{n(r.rpc.mean, 1)}</b>
        <span className="text-muted">RPC {r.rpc.n}곳</span>
        {r.rpc.n < RPC_MIN_N && <Badge tone="neutral">참고</Badge>}
      </span>
    ),
  },
  {
    key: 'replant',
    header: '재재배 의향',
    numeric: true,
    sortDescFirst: true,
    headerTitle: '"내년에도 이 품종을 심겠다" 응답 비율 ± 95% 구간(정규 근사)',
    format: (_v, r) => (
      <span className="whitespace-nowrap tabular-nums">
        <b className="text-text">{r.replant}%</b> <span className="text-muted">± {n(ci95p(r.replant, r.n), 1)}</span>
      </span>
    ),
  },
]

/** H. 농가·RPC 평가 */
export function SurveyTable() {
  return (
    <DataTable
      dense
      rows={SURVEY.rows}
      rowKey="name"
      stickyColumn={{ key: 'name', below: 'lg' }}
      caption={`${SURVEY.meta.crop}년산 품종별 농가 수량·품질 만족도(평균 ± 95% 신뢰구간), RPC 평가, 재재배 의향`}
      columns={COLUMNS}
    />
  )
}
