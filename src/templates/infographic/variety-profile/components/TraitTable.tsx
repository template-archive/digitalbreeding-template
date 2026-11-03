import { DivergingBar, u } from '@/design-system'
import { formatNumber, formatSigned } from '@/lib/format'
import { BLAST_BANDS, CHECK, TRAITS, VARIETY, blastClass, changePct, diff, verdict, verdictTone, type Trait } from '../data'
import { V_COLOR } from './style'

/** 열 너비(논리 px). 합계 810 = 표 영역 폭(콘텐츠 1144 − 수량 도식 310 − 간격 24) */
const COLS = [204, 100, 100, 84, 226, 96] as const
const GRID = COLS.map(w => u(w)).join(' ')

const UNIT_SHORT: Record<Trait['key'], string> = { yield: '', heading: '일', culm: ' cm', tgw: ' g', blast: '점', taste: '점' }

/* ───────── 증감(%) 발산 막대: 0 = 대비 품종 ─────────
 * 셀 안쪽 폭 222 논리 px 기준으로 0을 왼쪽 76 지점에 두고 1% = 6 px. 막대 끝 값 글자 15 px. */
const DV_W = 222
const DV_ZERO = 76
const DV_PX = 6 // px per %
const DV_DOMAIN = [DV_ZERO / DV_PX, (DV_W - DV_ZERO) / DV_PX] as const

function DivergingCell({ pct }: { pct: number }) {
  return (
    <div className="flex h-full items-center" style={{ fontSize: u(15) }}>
      <DivergingBar layout="inline" tone="accent" value={pct} domain={DV_DOMAIN} valueText={`${formatSigned(pct, 1)}%`} className="w-full" />
    </div>
  )
}

/** 잎도열병 0~9 눈금 띠 + 두 품종 표식 */
const BX0 = 10
const BX1 = DV_W - 10
const bx = (s: number) => BX0 + (s / 9) * (BX1 - BX0)
const BAND_COLOR = ['var(--color-positive)', 'var(--color-warning)', 'var(--color-negative)']

/** 두 표식 라벨(15.5 논리 px)이 겹치지 않도록 중심 간격을 최소 LABEL_GAP으로 벌린다 */
const LABEL_GAP = 64

function BlastCell({ v, c }: { v: number; c: number }) {
  const d = Math.abs(bx(c) - bx(v))
  const push = d < LABEL_GAP ? (LABEL_GAP - d) / 2 : 0
  const dir = bx(v) <= bx(c) ? -1 : 1
  const vx = bx(v) + dir * push
  const cx = bx(c) - dir * push
  return (
    <svg viewBox={`0 0 ${DV_W} 50`} width="100%" height="100%" aria-hidden>
      {BAND_COLOR.map((col, i) => {
        const b = BLAST_BANDS[i]
        const x0 = i === 0 ? bx(0) : (bx(b.from - 1) + bx(b.from)) / 2
        const x1 = i === 2 ? bx(9) : (bx(b.to) + bx(b.to + 1)) / 2
        return (
          <g key={b.label}>
            <rect x={x0} y={18} width={x1 - x0} height={9} style={{ fill: col, fillOpacity: 0.32 }} />
            <text x={(x0 + x1) / 2} y={44} textAnchor="middle" style={{ fill: 'var(--color-text-muted)', fontSize: 15.5 }}>
              {b.label}
            </text>
          </g>
        )
      })}
      {[0, 3, 6, 9].map(s => (
        <line key={s} x1={bx(s)} x2={bx(s)} y1={18} y2={27} style={{ stroke: 'var(--color-surface)', strokeWidth: 1 }} />
      ))}
      {/* 대비 품종: 빈 역삼각 */}
      <path d={`M${bx(c) - 6} 15 h12 l-6 9 z`} style={{ fill: 'var(--color-surface)', stroke: 'var(--color-text)', strokeWidth: 1.5 }} />
      <text x={cx} y={12} textAnchor="middle" style={{ fill: 'var(--color-text-muted)', fontSize: 15.5 }}>
        {CHECK.name} {c}
      </text>
      {/* 신품종: 채운 역삼각 */}
      <path d={`M${bx(v) - 7} 14 h14 l-7 11 z`} style={{ fill: V_COLOR, stroke: 'var(--color-surface)', strokeWidth: 1 }} />
      <text x={vx} y={12} textAnchor="middle" style={{ fill: V_COLOR, fontSize: 15.5, fontWeight: 700 }}>
        {VARIETY.name} {v}
      </text>
    </svg>
  )
}

const TONE: Record<ReturnType<typeof verdictTone>, { cls: string; label: string }> = {
  good: { cls: 'text-positive bg-positive/10 border-positive/40', label: '유리' },
  bad: { cls: 'text-negative bg-negative/10 border-negative/40', label: '불리' },
  info: { cls: 'text-info bg-info/10 border-info/40', label: '정보' },
  same: { cls: 'text-muted bg-surface-2 border-border', label: '차이 없음' },
}

function VerdictPill({ t }: { t: Trait }) {
  const word = verdict(t)
  const tone = verdictTone(t)
  const icon = word === '비슷' ? '=' : t.v > t.c ? '▲' : '▼'
  return (
    <span
      className={`inline-flex items-center justify-center border font-bold whitespace-nowrap ${TONE[tone].cls}`}
      style={{ fontSize: u(16), gap: u(4), padding: `${u(3)} ${u(8)}`, borderRadius: u(999), borderWidth: u(1.5) }}
      title={TONE[tone].label}
    >
      <span aria-hidden style={{ fontSize: u(15) }}>
        {icon}
      </span>
      {word}
    </span>
  )
}

function ValueCell({ t, which }: { t: Trait; which: 'v' | 'c' }) {
  const strong = which === 'v'
  const style = { fontSize: u(strong ? 20 : 18), color: strong ? V_COLOR : undefined }
  if (t.date) {
    return (
      <div className="leading-tight tabular-nums">
        <div className={strong ? 'font-extrabold' : 'font-semibold text-text'} style={style}>
          {t.date[which]}
        </div>
        <div className="text-muted" style={{ fontSize: u(15) }}>
          ({t[which]}일)
        </div>
      </div>
    )
  }
  return (
    <div className="leading-tight tabular-nums">
      <div className={strong ? 'font-extrabold' : 'font-semibold text-text'} style={style}>
        {formatNumber(t[which], { digits: t.digits })}
      </div>
      {t.key === 'blast' && (
        <div className="text-muted" style={{ fontSize: u(15) }}>
          {blastClass(t[which])}
        </div>
      )}
    </div>
  )
}

function VisualCell({ t }: { t: Trait }) {
  const pct = changePct(t)
  if (pct != null) return <DivergingCell pct={pct} />
  if (t.key === 'blast') return <BlastCell v={t.v} c={t.c} />
  // 날짜·임의 원점 점수: % 지수를 만들지 않고 원 단위 차와 LSD만 적는다
  const unit = t.key === 'heading' ? '일' : '점'
  const lsd = formatNumber(t.lsd, { digits: Number.isInteger(t.lsd) ? 0 : 1 })
  return (
    <p className="text-muted leading-snug" style={{ fontSize: u(15) }}>
      원 단위 차만 표시
      <br />
      <span className="text-text font-semibold">
        {formatSigned(diff(t), t.digits)}
        {unit}
      </span>{' '}
      {verdict(t) === '비슷' ? '≤' : '>'} LSD {lsd}
      {unit}
    </p>
  )
}

export function TraitTable() {
  const head = ['형질(단위)', VARIETY.name, `대비 ${CHECK.name}`, '차', '대비 품종 대비 증감(%)', '판정']
  return (
    <div role="table" aria-label={`형질 성적 비교: ${VARIETY.name}와 대비 품종 ${CHECK.name}`} className="flex flex-col">
      <div
        role="row"
        className="grid items-end border-b border-text/60 font-bold text-muted"
        style={{ gridTemplateColumns: GRID, fontSize: u(15), paddingBottom: u(6), borderBottomWidth: u(1.5) }}
      >
        {head.map((h, i) => (
          <span key={h} role="columnheader" className={i === 1 ? 'text-accent' : undefined} style={{ paddingLeft: i === 0 ? 0 : u(6) }}>
            {h}
          </span>
        ))}
      </div>
      {TRAITS.map(t => (
        <div
          role="row"
          key={t.key}
          className="grid items-center border-b border-border"
          style={{ gridTemplateColumns: GRID, height: u(57) }}
        >
          <div role="cell" className="leading-tight">
            <div className="font-bold text-text" style={{ fontSize: u(17) }}>
              {t.label}
              <span className="font-normal text-muted" style={{ fontSize: u(15) }}>
                {' '}
                ({t.key === 'heading' ? '월·일' : t.unit})
              </span>
            </div>
            <div className="text-muted" style={{ fontSize: u(15), marginTop: u(2) }}>
              {t.hint}
            </div>
          </div>
          <div role="cell" style={{ paddingLeft: u(6) }}>
            <ValueCell t={t} which="v" />
          </div>
          <div role="cell" style={{ paddingLeft: u(6) }}>
            <ValueCell t={t} which="c" />
          </div>
          <div role="cell" className="font-bold text-text tabular-nums whitespace-nowrap" style={{ fontSize: u(17), paddingLeft: u(6) }}>
            {formatSigned(diff(t), t.digits)}
            <span className="font-normal text-muted" style={{ fontSize: u(15) }}>
              {UNIT_SHORT[t.key]}
            </span>
          </div>
          <div role="cell" style={{ height: u(t.key === 'blast' ? 50 : 30), paddingLeft: u(4) }}>
            <VisualCell t={t} />
          </div>
          <div role="cell" style={{ paddingLeft: u(6) }}>
            <VerdictPill t={t} />
          </div>
        </div>
      ))}
    </div>
  )
}

