import { CHR_LEN_MB, GENES, VARIETY, type Gene } from '../data'
import { V_COLOR } from './style'

/**
 * 벼 염색체 12개 가로 트랙(길이 비례, 공통 Mb 축) + 유전자 위치 표식.
 * 채운 원 = 별하랑 보유, 빈 원 = 미보유, 회색 사각 = 대립유전자형만 표시(Wx).
 */
const W = 452
const LABEL_W = 50
const X0 = 54
const MB_MAX = 45
const TRACK_W = 262
const mx = (mb: number) => X0 + (mb / MB_MAX) * TRACK_W
const ROW = 17
const TOP = 6
const NOTE_X = X0 + TRACK_W + 10
export const CHR_TRACKS_H = TOP + ROW * 12 + 30

function Mark({ g, cy }: { g: Gene; cy: number }) {
  const cx = mx(g.mb)
  if (!g.counted) {
    return <rect x={cx - 5} y={cy - 5} width={10} height={10} style={{ fill: 'var(--color-text-muted)', stroke: 'var(--color-surface)', strokeWidth: 1.25 }} />
  }
  return g.v ? (
    <circle cx={cx} cy={cy} r={6} style={{ fill: V_COLOR, stroke: 'var(--color-surface)', strokeWidth: 1.5 }} />
  ) : (
    <circle cx={cx} cy={cy} r={5.5} style={{ fill: 'var(--color-surface)', stroke: 'var(--color-text)', strokeWidth: 1.75 }} />
  )
}

export function ChromosomeTracks() {
  const axisY = TOP + ROW * 12 + 4
  const desc = GENES.map(g => `${g.gene} Chr${String(g.chr).padStart(2, '0')} ${g.mb} Mb(${g.counted ? (g.v ? '보유' : '미보유') : g.allele})`).join(', ')
  return (
    <svg viewBox={`0 0 ${W} ${CHR_TRACKS_H}`} width="100%" height="100%" role="img" aria-label={`${VARIETY.name} 유전자 위치(IRGSP-1.0 근사): ${desc}`}>
      {CHR_LEN_MB.map((len, i) => {
        const chr = i + 1
        const cy = TOP + i * ROW + ROW / 2
        const genes = GENES.filter(g => g.chr === chr).sort((a, b) => a.mb - b.mb)
        return (
          <g key={chr}>
            <text x={LABEL_W - 4} y={cy} dy="0.35em" textAnchor="end" style={{ fill: genes.length ? 'var(--color-text)' : 'var(--color-text-muted)', fontSize: 15, fontWeight: genes.length ? 700 : 400 }}>
              Chr{String(chr).padStart(2, '0')}
            </text>
            <rect x={X0} y={cy - 3.5} width={(len / MB_MAX) * TRACK_W} height={7} rx={3.5} style={{ fill: 'var(--viz-chr-b)' }} />
            {genes.map(g => (
              <Mark key={g.gene} g={g} cy={cy} />
            ))}
            {genes.length > 0 && (
              <text x={NOTE_X} y={cy} dy="0.35em" style={{ fill: 'var(--color-text)', fontSize: 15 }}>
                {genes.map((g, k) => (
                  <tspan key={g.gene} style={{ fontWeight: g.counted && g.v ? 700 : 400, fill: g.counted && g.v ? V_COLOR : 'var(--color-text)' }}>
                    {k > 0 ? ' · ' : ''}
                    {g.gene} {g.mb.toFixed(1)}
                  </tspan>
                ))}
              </text>
            )}
          </g>
        )
      })}
      <line x1={X0} x2={X0 + TRACK_W} y1={axisY} y2={axisY} style={{ stroke: 'var(--color-text-muted)', strokeWidth: 1 }} />
      {[0, 10, 20, 30, 40].map(t => (
        <g key={t}>
          <line x1={mx(t)} x2={mx(t)} y1={axisY} y2={axisY + 4} style={{ stroke: 'var(--color-text-muted)', strokeWidth: 1 }} />
          <text x={mx(t)} y={axisY + 17} textAnchor="middle" style={{ fill: 'var(--color-text-muted)', fontSize: 15 }}>
            {t}
          </text>
        </g>
      ))}
      <text x={NOTE_X} y={axisY + 17} style={{ fill: 'var(--color-text-muted)', fontSize: 15 }}>
        Mb (IRGSP-1.0)
      </text>
    </svg>
  )
}
