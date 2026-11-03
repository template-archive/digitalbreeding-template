import { DataTable, DivergingBar, SeverityTag, type DataTableColumn } from '@/design-system'
import { CUR, PLAN_YEAR, SUPPLY_2027, SUPPLY_CRITICAL, SUPPLY_RATE, supplyStatus, SUPPLY_TOTAL, type SupplyRow } from '../data'
import { ha, n, pc, sg } from './fmt'

const ROWS: SupplyRow[] = [...SUPPLY_2027, SUPPLY_TOTAL]
/**
 * 과부족 막대 축: 행 gap의 최솟값·최댓값에서 계산한다.
 * inline 값 글자가 막대 끝에 붙으므로 한쪽이 너무 좁으면 글자가 셀을 넘는다 → 각 쪽은 최소 (큰 쪽 절댓값 × 0.5)를 보장하고,
 * 값 글자 자리로 × 1.6 여유를 둔 뒤 짝수로 올린다.
 */
const GAP_MIN = Math.min(0, ...ROWS.map(r => r.gap))
const GAP_MAX = Math.max(0, ...ROWS.map(r => r.gap))
const GAP_EXTENT = Math.max(-GAP_MIN, GAP_MAX, 1)
const GAP_ROOM = 1.6
const gapSide = (v: number) => Math.ceil((Math.max(v, GAP_EXTENT * 0.5) * GAP_ROOM) / 2) * 2
const GAP_DOMAIN = [gapSide(-GAP_MIN), gapSide(GAP_MAX)] as const

const name = (r: SupplyRow) => <span className={r.total ? 'font-bold text-text' : 'font-semibold text-text'}>{r.name}</span>
/** 수급률 칸: 부족 태그에 심각도 낱말을 붙인다(경보 < 90%와 주의 90~100%가 같은 '부족'으로 보이지 않게) */
const rateCell = (r: SupplyRow) => {
  const st = supplyStatus(r.rate)
  return (
    <span className={`flex items-center justify-end gap-1.5 whitespace-nowrap tabular-nums ${r.total ? 'font-bold' : ''}`}>
      <span className="text-text">{pc(r.rate, 1)}</span>
      {st !== 'ok' && <SeverityTag severity={st} label={`${st === 'critical' ? '경보' : '주의'} · 부족`} />}
    </span>
  )
}
const t1 = (v: number, r: SupplyRow) => <span className={r.total ? 'font-bold text-text' : undefined}>{n(v, 1)}</span>

const FULL: DataTableColumn<SupplyRow>[] = [
  { key: 'name', header: '품종', sortable: false, format: (_v, r) => name(r) },
  { key: 'prod2026', header: `${CUR} 보급종 생산(t)`, numeric: true, sortable: false, format: (_v, r) => t1(r.prod2026, r) },
  { key: 'supply', header: `${PLAN_YEAR} 공급(t)`, numeric: true, sortable: false, format: (_v, r) => t1(r.supply, r) },
  { key: 'supplyHa', header: '공급 면적(ha)', numeric: true, sortable: false, format: (_v, r) => <span className={r.total ? 'font-bold text-text' : undefined}>{ha(r.supplyHa)}</span> },
  { key: 'demand', header: '수요 예측(t)', numeric: true, sortable: false, format: (_v, r) => t1(r.demand, r) },
  { key: 'rate', header: '수급률', numeric: true, sortable: false, format: (_v, r) => rateCell(r) },
  {
    key: 'gap',
    header: '과부족(t)',
    sortable: false,
    width: '200px',
    format: (_v, r) => (
      <span className="block text-xs">
        <DivergingBar value={r.gap} domain={GAP_DOMAIN} layout="inline" valueText={sg(r.gap, 1)} />
      </span>
    ),
  },
]

const NARROW: DataTableColumn<SupplyRow>[] = [FULL[0]!, FULL[2]!, FULL[5]!]

/** I. 2027 보급종 공급 계획 */
export function SupplyTable({ narrow }: { narrow: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <DataTable
        dense
        rows={ROWS}
        rowKey="id"
        highlight={r => !!r.total}
        caption={`${PLAN_YEAR} 품종별 보급종 공급 계획(${CUR}년산 생산 × ${SUPPLY_RATE}), 공급 면적, 수요 예측, 수급률, 과부족`}
        columns={narrow ? NARROW : FULL}
      />
      <p className="text-xs text-muted">
        공급 = {CUR}년산 생산 × {SUPPLY_RATE}(정선·검사 후 이월·폐기 5%). 공급 면적 = 공급 ÷ 파종량 4 kg/10a. 수요 예측 = {CUR} 신청 실적 + 지역 협의(추정), 정식 신청 접수 11~12월. 수급률 &lt; {SUPPLY_CRITICAL}% 경보, {SUPPLY_CRITICAL}~100% 주의.
      </p>
    </div>
  )
}
