import { formatNumber } from '@/lib/format'
import { AS_OF, AS_OF_T, GS2023, LINE, TIMELINE, devYears, f1, gsRank, gsRankPct } from '../data'
import { HALO, V_COLOR } from './style'

/**
 * 육성 경위 가로 타임라인(2019~2029, 1년 눈금). 단계 구간 막대 + 이정표 + 단계 아래 계통 수.
 * 2023 GS 1차 강조, 기준일 세로 점선, 2026-12 출원 예정은 빈 표식, 재배심사·등록은 점선(예정), 교배~출원 "7년" 괄호.
 * 정적 SVG — 좌표는 viewBox 논리 픽셀(캔버스 1 논리 px와 같은 비율로 그린다).
 */
export const TL_W = 790
export const TL_H = 182
const X0 = 14
const X1 = TL_W - 14
const Y_FROM = 2019
const Y_TO = 2030
const x = (t: number) => X0 + ((t - Y_FROM) / (Y_TO - Y_FROM)) * (X1 - X0)

const LANE_Y = 80
const BAR_H = 20
const LABEL_Y = LANE_Y + BAR_H / 2 + 17
const COUNT_Y = LABEL_Y + 17
const AXIS_Y = COUNT_Y + 10
const BOX_X = 4
const by = (n: number) => TIMELINE.find(m => m.n === n)!

function Diamond({ t, r = 8, fill = V_COLOR, hollow = false }: { t: number; r?: number; fill?: string; hollow?: boolean }) {
  const cx = x(t)
  return (
    <path
      d={`M${cx} ${LANE_Y - r} L${cx + r} ${LANE_Y} L${cx} ${LANE_Y + r} L${cx - r} ${LANE_Y} z`}
      style={hollow ? { fill: 'var(--color-bg)', stroke: 'var(--color-text)', strokeWidth: 2.25 } : { fill, stroke: 'var(--color-surface)', strokeWidth: 2 }}
    />
  )
}

export function LineageTimeline() {
  const cross = by(1)
  const ssd = by(2)
  const gs = by(3)
  const pyt = by(4)
  const ayt = by(5)
  const met = by(6)
  const pick = by(7)
  const filing = by(8)
  const exam = by(9)
  const reg = by(10)
  const label = `육성 경위: ${TIMELINE.map(m => `${m.period} ${m.stage}${m.count ? `(${m.count}계통)` : ''}`).join(', ')}. 교배부터 출원 예정까지 ${devYears}년.`
  const gsX = x(gs.start)
  const done = [ssd, pyt, ayt, met]
  const asX = x(AS_OF_T)
  // 출원 표식(2026-12 중순)과 재배심사 시작(2027)이 붙어 있어 막대를 표식 오른쪽에서 시작한다
  const examX0 = Math.max(x(exam.start), x(filing.start) + 13)
  return (
    <svg viewBox={`0 0 ${TL_W} ${TL_H}`} width="100%" height="100%" role="img" aria-label={label}>
      {/* 연 눈금 */}
      {Array.from({ length: Y_TO - Y_FROM + 1 }, (_, i) => Y_FROM + i).map(yr => (
        <g key={yr}>
          <line x1={x(yr)} x2={x(yr)} y1={LANE_Y - 16} y2={AXIS_Y} style={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
          {yr < Y_TO && (
            <text x={x(yr + 0.5)} y={AXIS_Y + 16} textAnchor="middle" style={{ fill: 'var(--color-text-muted)', fontSize: 15.5, fontWeight: 600 }}>
              {yr}
            </text>
          )}
        </g>
      ))}
      <line x1={X0} x2={X1} y1={AXIS_Y} y2={AXIS_Y} style={{ stroke: 'var(--color-text-muted)', strokeWidth: 1.25 }} />

      {/* 완료 단계 막대 */}
      {done.map(m => (
        <rect key={m.n} x={x(m.start)} y={LANE_Y - BAR_H / 2} width={x(m.end!) - x(m.start)} height={BAR_H} rx={4} style={{ fill: V_COLOR, fillOpacity: m.n === 2 ? 0.16 : 0.32, stroke: V_COLOR, strokeWidth: 1.25 }} />
      ))}
      {/* 예정 구간(점선) */}
      <rect x={examX0} y={LANE_Y - BAR_H / 2} width={x(exam.end!) - examX0} height={BAR_H} rx={4} style={{ fill: 'none', stroke: 'var(--color-text-muted)', strokeWidth: 1.75, strokeDasharray: '6 4' }} />
      <text x={(examX0 + x(exam.end!)) / 2} y={LANE_Y} dy="0.35em" textAnchor="middle" style={{ fill: 'var(--color-text-muted)', fontSize: 15.5, fontWeight: 700 }}>
        재배심사(예정)
      </text>

      {/* 단계 이름(막대 아래) */}
      <text x={(x(ssd.start) + x(ssd.end!)) / 2} y={LABEL_Y} textAnchor="middle" style={{ fill: 'var(--color-text)', fontSize: 15.5, fontWeight: 600 }}>
        세대 진전 {ssd.gen} · SSD 작기 7회
      </text>
      <text x={(x(pyt.start) + x(pyt.end!)) / 2} y={LABEL_Y} textAnchor="middle" style={{ fill: 'var(--color-text)', fontSize: 15.5, fontWeight: 700 }}>
        PYT
      </text>
      <text x={(x(ayt.start) + x(ayt.end!)) / 2} y={LABEL_Y} textAnchor="middle" style={{ fill: 'var(--color-text)', fontSize: 15.5, fontWeight: 700 }}>
        AYT
      </text>
      <text x={(x(met.start) + x(met.end!)) / 2} y={LABEL_Y} textAnchor="middle" style={{ fill: 'var(--color-text)', fontSize: 15.5, fontWeight: 700 }}>
        MET 2년
      </text>
      <text x={x(reg.start)} y={LABEL_Y} textAnchor="middle" style={{ fill: 'var(--color-text-muted)', fontSize: 15.5, fontWeight: 600 }}>
        등록(예정)
      </text>

      {/* 계통 수(단계 아래 작은 글씨) */}
      <text x={gsX + 8} y={COUNT_Y} textAnchor="end" style={{ fill: 'var(--color-text-muted)', fontSize: 15.5, fontWeight: 600 }}>
        {gs.count!.split(' → ').map(n => formatNumber(Number(n))).join(' → ')}
      </text>
      {[pyt, ayt, met].map(m => (
        <text key={m.n} x={(x(m.start) + x(m.end!)) / 2} y={COUNT_Y} textAnchor="middle" style={{ fill: 'var(--color-text-muted)', fontSize: 15.5, fontWeight: 600 }}>
          → {m.count}
        </text>
      ))}
      <text x={x(pick.start) + 2} y={COUNT_Y} textAnchor="start" style={{ fill: 'var(--color-text-muted)', fontSize: 15.5, fontWeight: 600 }}>
        → 후보 {pick.count!.split(' → ')[0]} → 출원 {pick.count!.split(' → ')[1]}
      </text>

      {/* 기준일 세로 점선 */}
      <line x1={asX} x2={asX} y1={8} y2={AXIS_Y} style={{ stroke: 'var(--color-text-muted)', strokeWidth: 1.5, strokeDasharray: '4 3' }} />
      <text x={asX + 5} y={18} textAnchor="start" style={{ fill: 'var(--color-text-muted)', fontSize: 15.5, fontWeight: 700, ...HALO }}>
        기준일 {AS_OF.slice(5)}
      </text>

      {/* 교배 */}
      <Diamond t={cross.start} />
      <text x={x(cross.start) - 8} y={LANE_Y - 18} style={{ fill: 'var(--color-text)', fontSize: 15.5, fontWeight: 700, ...HALO }}>
        교배 {cross.period}
      </text>

      {/* GS 1차(강조) — 설명 상자는 왼쪽(세대 진전 구간 위)에 둔다 */}
      <line x1={gsX} x2={gsX} y1={LANE_Y - 12} y2={46} style={{ stroke: V_COLOR, strokeWidth: 2 }} />
      <circle cx={gsX} cy={LANE_Y} r={13} style={{ fill: V_COLOR, stroke: 'var(--color-surface)', strokeWidth: 2.5 }} />
      <text x={gsX} y={LANE_Y} dy="0.36em" textAnchor="middle" style={{ fill: 'var(--color-accent-contrast)', fontSize: 15.5, fontWeight: 800 }}>
        GS
      </text>
      <rect x={BOX_X} y={2} width={400} height={44} rx={8} style={{ fill: 'var(--color-surface)', stroke: V_COLOR, strokeWidth: 2 }} />
      <text x={BOX_X + 12} y={20} style={{ fill: V_COLOR, fontSize: 15.5, fontWeight: 800 }}>
        {GS2023.year} GS 1차 · 수량 GEBV +{f1(GS2023.gebv)} kg/10a
      </text>
      <text x={BOX_X + 12} y={38} style={{ fill: 'var(--color-text)', fontSize: 15.5 }}>
        {formatNumber(GS2023.candidates)}계통 중 {gsRank}위(상위 {f1(gsRankPct)}%) · 예측 정확도 {GS2023.r.toFixed(2)}
      </text>

      {/* 출원 예정(빈 표식) */}
      <Diamond t={filing.start} r={10} hollow />
      <text x={x(filing.start) + 14} y={LANE_Y - 22} textAnchor="middle" style={{ fill: 'var(--color-text)', fontSize: 15.5, fontWeight: 800, ...HALO }}>
        출원 {LINE.filingMonth}(예정)
      </text>
      {/* 등록 예정 */}
      <Diamond t={reg.start} r={7} hollow />

      {/* 교배~출원 괄호 */}
      <path d={`M${x(cross.start)} ${AXIS_Y + 22} v7 H${x(filing.start)} v-7`} style={{ fill: 'none', stroke: V_COLOR, strokeWidth: 2 }} />
      <rect x={(x(cross.start) + x(filing.start)) / 2 - 120} y={AXIS_Y + 22} width={240} height={18} style={{ fill: 'var(--color-bg)' }} />
      <text x={(x(cross.start) + x(filing.start)) / 2} y={AXIS_Y + 35} textAnchor="middle" style={{ fill: V_COLOR, fontSize: 15.5, fontWeight: 800 }}>
        {devYears}년({LINE.crossYear} → {LINE.filingMonth.slice(0, 4)})
      </text>
    </svg>
  )
}
