import { Badge, DataTable, type DataTableColumn } from '@/design-system'
import { useChartTheme } from '@/charts'
import { alertsOfEnv, COLD_T, HEAT_STERILE_T, HEAT_T, mmdd, WIN_HALF, ZONE_BY_KEY, type Env } from '../data'
import { f1, n0, pct0, s0, s1, zoneColor } from './fmt'

const Pair = ({ main, sub }: { main: string; sub: string }) => (
  <span className="whitespace-nowrap">
    {main} <span className="text-muted">({sub})</span>
  </span>
)

interface Props {
  rows: Env[]
  showYear: boolean
  selected: (e: Env) => boolean
  onSelect: (e: Env) => void
}

/** H 환경 요약 표 */
export function EnvTable({ rows, showYear, selected, onSelect }: Props) {
  const theme = useChartTheme()
  // 390px: 결론 열(환경 지수·경보)이 스크롤 끝에 숨지 않게 지역 · 환경 지수 · 경보만 남긴다(기상 값은 위 지역 카드에 있음)
  const columns: DataTableColumn<Env>[] = [
    {
      key: 'site',
      header: '지역',
      sortValue: e => e.e,
      format: (_v, e) => (
        <span className="flex items-center gap-1.5 whitespace-nowrap font-semibold text-text">
          <span aria-hidden="true" className="inline-block h-3.5 w-1 rounded-full" style={{ background: zoneColor(theme, e.site.zone) }} />
          {e.site.name}
          {showYear && <span className="font-normal text-muted">{e.year}</span>}
        </span>
      ),
    },
    { key: 'zone', hideBelow: 'sm', header: '권역', sortValue: e => e.site.zone, format: (_v, e) => <span className="whitespace-nowrap">{ZONE_BY_KEY[e.site.zone].label}</span> },
    { key: 'tp', hideBelow: 'sm', header: '이앙', align: 'right', format: (_v, e) => mmdd(e.tp) },
    { key: 'hd', hideBelow: 'sm', header: '출수', align: 'right', format: (_v, e) => mmdd(e.hd) },
    { key: 'hv', hideBelow: 'sm', header: '수확', align: 'right', format: (_v, e) => mmdd(e.hv) },
    { key: 'seasonDays', hideBelow: 'sm', header: '재배 일수', align: 'right', sortDescFirst: true, format: (_v, e) => `${e.seasonDays}일` },
    {
      key: 'gdd',
      hideBelow: 'sm',
      header: 'GDD (편차)',
      headerTitle: '유효적산온도 °C·일(기준 10 °C, 이앙~수확), 괄호 = 같은 재배기 날짜 평년 대비 편차(원값 기준)',
      align: 'right',
      sortDescFirst: true,
      format: (_v, e) => <Pair main={n0(e.gdd)} sub={s0(e.gdd - e.gddN)} />,
    },
    { key: 'pr', hideBelow: 'sm', header: '강수 mm (%)', align: 'right', sortDescFirst: true, format: (_v, e) => <Pair main={n0(e.pr)} sub={pct0((100 * e.pr) / e.prN)} /> },
    { key: 'sun', hideBelow: 'sm', header: '일조 h (%)', align: 'right', sortDescFirst: true, format: (_v, e) => <Pair main={n0(e.sun)} sub={pct0((100 * e.sun) / e.sunN)} /> },
    {
      key: 's40',
      hideBelow: 'sm',
      header: '등숙기 일조 h (%)',
      headerTitle: '출수 후 1~40일 일조 합, 괄호 = 평년비',
      align: 'right',
      sortDescFirst: true,
      format: (_v, e) => <Pair main={n0(e.s40)} sub={pct0((100 * e.s40) / e.s40N)} />,
    },
    { key: 't40', hideBelow: 'sm', header: '등숙기 평균기온', headerTitle: '출수 후 1~40일 일평균기온 평균(°C), 적온 21~23 °C', align: 'right', sortDescFirst: true, format: (_v, e) => `${f1(e.t40)} °C` },
    {
      key: 'heat',
      hideBelow: 'sm',
      header: `고온 ≥ ${HEAT_T} (≥ ${HEAT_STERILE_T})`,
      headerTitle: `출수 ±${WIN_HALF}일 최고 ≥ ${HEAT_T} °C 일수, 괄호 = 그중 ≥ ${HEAT_STERILE_T} °C 일수(0일이면 생략)`,
      align: 'right',
      sortDescFirst: true,
      format: (_v, e) => (e.heat35 > 0 ? <Pair main={`${e.heat}일`} sub={`${e.heat35}`} /> : `${e.heat}일`),
    },
    { key: 'cold', hideBelow: 'sm', header: `저온 ≤ ${COLD_T}`, headerTitle: `출수 ±${WIN_HALF}일 최저 ≤ ${COLD_T} °C 일수`, align: 'right', sortDescFirst: true, format: (_v, e) => `${e.cold}일` },
    {
      key: 'index',
      header: '환경 지수',
      headerTitle: '환경 평균 − 전체 평균(kg/10a, 쌀 수량), 다환경 시험 GxE·안정성 화면과 같은 정의',
      align: 'right',
      sortDescFirst: true,
      format: (_v, e) => <b className="text-text">{s1(e.index)}</b>,
    },
    {
      key: 'alerts',
      header: '경보',
      sortValue: e => alertsOfEnv(e).length,
      sortDescFirst: true,
      format: (_v, e) => {
        const al = alertsOfEnv(e)
        const crit = al.filter(a => a.severity === 'critical').length
        if (!al.length) return <span className="text-muted">—</span>
        return (
          <span className="flex gap-1 whitespace-nowrap">
            {crit > 0 && <Badge tone="negative">경보 {crit}</Badge>}
            {al.length > crit && <Badge tone="warning">주의 {al.length - crit}</Badge>}
          </span>
        )
      },
    },
  ]
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey="e"
      dense
      stickyColumn="site"
      defaultSort={{ key: 'index', dir: 'desc' }}
      onRowClick={onSelect}
      activeRow={selected}
      caption="시험지별 재배기 기상 요약"
    />
  )
}
