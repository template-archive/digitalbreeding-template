import { useId } from 'react'
import {
  CHR_LEN_MB,
  CHR_MAX_MB,
  DRAG_EXPECTED,
  FINAL_SEGMENTS,
  FLANK,
  TARGET,
  TARGET_SEG,
  TARGET_SEG_MB,
  fmtMb,
} from '../data'
import { DonorHatchDef } from './DonorHatch'
import { DONOR_COLOR, HERO_COLOR, RECUR_COLOR } from './style'

/**
 * 최종 계통 그래픽 유전형(6K 칩 판독).
 * 왼쪽: 12개 염색체 세로 막대(공통 Mb 축). 오른쪽 위: Chr06 확대(측면 마커·Pi9·단편). 오른쪽 아래: 연관 끌림 비교 막대(0부터).
 * viewBox 단위 = 캔버스 논리 px.
 */
export const CHR_W = 664
export const CHR_H = 244

const MUTED = { fill: 'var(--color-text-muted)', fontSize: 16 }
const TXT = { fill: 'var(--color-text)', fontSize: 16 }

/* 왼쪽 염색체 */
const L = { x0: 44, x1: 300, top: 30, bottom: CHR_H - 26 }
const pxMb = (L.bottom - L.top) / CHR_MAX_MB
const colW = (L.x1 - L.x0) / CHR_LEN_MB.length
const barW = 12
const bx = (c: number) => L.x0 + colW * (c - 0.5) - barW / 2
const by = (mb: number) => L.top + mb * pxMb

/* 오른쪽 확대 */
const Z = { x0: 372, x1: 636, lo: 8, hi: 13, y: 48, h: 16 }
const zx = (mb: number) => Z.x0 + ((mb - Z.lo) / (Z.hi - Z.lo)) * (Z.x1 - Z.x0)

/* 오른쪽 아래 막대: 라벨(왼쪽 한 줄) · 막대 · 값 */
const B = { lx: 340, x0: 540, x1: 622, max: 15, top: 124, row: 27 }
const bxv = (mb: number) => B.x0 + (mb / B.max) * (B.x1 - B.x0)

export function FinalChromosomes() {
  const hatch = `fh${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const tc = TARGET.chr
  const dragRows = [
    { label: '기존 여교배 BC6 기대', v: DRAG_EXPECTED.bc6, hero: false },
    { label: '재조합 선발 없는 BC3 기대', v: DRAG_EXPECTED.bc3, hero: false },
    { label: '이 사례(재조합 선발)', v: TARGET_SEG_MB, hero: true },
  ]
  return (
    <svg viewBox={`0 0 ${CHR_W} ${CHR_H}`} width="100%" height="100%" aria-hidden style={{ display: 'block' }}>
      <DonorHatchDef id={hatch} size={4} />
      {/* ── 왼쪽: 12 염색체 ── */}
      {[0, 10, 20, 30, 40].map(t => (
        <g key={t}>
          <line x1={L.x0 - 4} x2={L.x1} y1={by(t)} y2={by(t)} style={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
          <text x={L.x0 - 8} y={by(t)} dy="0.35em" textAnchor="end" style={MUTED}>
            {t}
          </text>
        </g>
      ))}
      <text x={L.x0 - 8} y={L.top - 14} textAnchor="end" style={MUTED}>
        Mb
      </text>
      {CHR_LEN_MB.map((len, i) => {
        const c = i + 1
        return (
          <g key={c}>
            <rect x={bx(c)} y={by(0)} width={barW} height={len * pxMb} rx={barW / 2} style={{ fill: RECUR_COLOR }} />
            <text x={bx(c) + barW / 2} y={L.bottom + 18} textAnchor="middle" style={{ ...(c === tc || FINAL_SEGMENTS.some(s => s.chr === c) ? TXT : MUTED), fontWeight: c === tc ? 800 : 400 }}>
              {c}
            </text>
          </g>
        )
      })}
      {FINAL_SEGMENTS.map((s, k) =>
        s.dose === 2 ? (
          <rect key={k} x={bx(s.chr) - 2} y={by(s.start)} width={barW + 4} height={Math.max(2, (s.end - s.start) * pxMb)} style={{ fill: DONOR_COLOR }} />
        ) : (
          <rect
            key={k}
            x={bx(s.chr) + barW / 2}
            y={by(s.start)}
            width={barW / 2 + 2}
            height={Math.max(2, (s.end - s.start) * pxMb)}
            style={{ fill: `url(#${hatch})`, stroke: DONOR_COLOR, strokeWidth: 1 }}
          />
        ),
      )}
      {/* Pi9 표식 */}
      <path d={`M ${bx(tc) - 9} ${by(TARGET.mb) - 5} L ${bx(tc) - 2} ${by(TARGET.mb)} L ${bx(tc) - 9} ${by(TARGET.mb) + 5} Z`} style={{ fill: 'var(--color-text)' }} />
      <text x={bx(tc) + barW / 2} y={L.top - 14} textAnchor="middle" style={{ ...TXT, fontWeight: 800, fontStyle: 'italic' }}>
        {TARGET.gene}
      </text>
      <line x1={bx(tc) + barW / 2} x2={bx(tc) + barW / 2} y1={L.top - 9} y2={by(Z.lo) - 3} style={{ stroke: 'var(--color-text)', strokeWidth: 1 }} />
      {/* 확대 연결선 */}
      <rect x={bx(tc) - 4} y={by(Z.lo)} width={barW + 8} height={(Z.hi - Z.lo) * pxMb} style={{ fill: 'none', stroke: 'var(--color-text-muted)', strokeWidth: 1, strokeDasharray: '3 2' }} />
      <path
        d={`M ${bx(tc) + barW + 4} ${by(Z.lo)} L ${Z.x0 - 30} ${Z.y - 6} M ${bx(tc) + barW + 4} ${by(Z.hi)} L ${Z.x0 - 30} ${Z.y + Z.h + 6}`}
        style={{ stroke: 'var(--color-text-muted)', strokeWidth: 1, strokeDasharray: '3 2', fill: 'none' }}
      />

      {/* ── 오른쪽 위: Chr06 확대 ── */}
      <text x={Z.x0 - 26} y={14} style={{ ...TXT, fontWeight: 700 }}>
        Chr06 확대({Z.lo}~{Z.hi} Mb)
      </text>
      <text x={(zx(TARGET_SEG.start) + zx(TARGET_SEG.end)) / 2} y={33} textAnchor="middle" style={{ ...TXT, fontWeight: 800 }}>
        공여친 단편 {fmtMb(TARGET_SEG_MB)} Mb
      </text>
      <path
        d={`M ${zx(TARGET_SEG.start)} ${Z.y - 4} V ${Z.y - 9} H ${zx(TARGET_SEG.end)} V ${Z.y - 4}`}
        style={{ fill: 'none', stroke: DONOR_COLOR, strokeWidth: 1.5 }}
      />
      <text x={Z.x0 - 26} y={Z.y + Z.h / 2} dy="0.35em" style={MUTED}>
        {Z.lo}
      </text>
      <text x={Z.x1 + 6} y={Z.y + Z.h / 2} dy="0.35em" style={MUTED}>
        {Z.hi}
      </text>
      <rect x={Z.x0} y={Z.y} width={Z.x1 - Z.x0} height={Z.h} rx={3} style={{ fill: RECUR_COLOR }} />
      <rect x={zx(TARGET_SEG.start)} y={Z.y} width={zx(TARGET_SEG.end) - zx(TARGET_SEG.start)} height={Z.h} style={{ fill: DONOR_COLOR }} />
      {[FLANK.left, FLANK.right].map(m => (
        <line key={m} x1={zx(m)} x2={zx(m)} y1={Z.y - 3} y2={Z.y + Z.h + 8} style={{ stroke: 'var(--color-text)', strokeWidth: 2 }} />
      ))}
      <path d={`M ${zx(TARGET.mb) - 6} ${Z.y + Z.h + 10} L ${zx(TARGET.mb) + 6} ${Z.y + Z.h + 10} L ${zx(TARGET.mb)} ${Z.y + Z.h + 2} Z`} style={{ fill: 'var(--color-text)' }} />
      <text x={zx(FLANK.left) - 3} y={Z.y + Z.h + 22} textAnchor="end" style={TXT}>
        {FLANK.leftName} {FLANK.left.toFixed(2)}
      </text>
      <text x={zx(TARGET.mb)} y={Z.y + Z.h + 22} textAnchor="middle" style={{ ...TXT, fontWeight: 800 }}>
        <tspan style={{ fontStyle: 'italic' }}>{TARGET.gene}</tspan> {TARGET.mb}
      </text>
      <text x={zx(FLANK.right) + 3} y={Z.y + Z.h + 22} style={TXT}>
        {FLANK.rightName} {FLANK.right.toFixed(2)}
      </text>

      {/* ── 오른쪽 아래: 연관 끌림 비교 ── */}
      <text x={B.lx} y={B.top - 10} style={{ ...TXT, fontWeight: 700 }}>
        <tspan style={{ fontStyle: 'italic' }}>{TARGET.gene}</tspan> 주변 공여친 단편(Mb, 낮을수록 좋음)
      </text>
      {dragRows.map((r, k) => {
        const yy = B.top + k * B.row
        const cy = yy + B.row / 2
        return (
          <g key={r.label}>
            <text x={B.lx} y={cy} dy="0.35em" style={r.hero ? { ...TXT, fontWeight: 700 } : MUTED}>
              {r.label}
            </text>
            <rect x={B.x0} y={cy - 7} width={bxv(r.v) - B.x0} height={14} rx={2} style={{ fill: r.hero ? HERO_COLOR : 'var(--color-text-muted)', fillOpacity: r.hero ? 1 : 0.55 }} />
            <text x={bxv(r.v) + 5} y={cy} dy="0.35em" style={{ ...TXT, fontWeight: 800, fill: r.hero ? HERO_COLOR : 'var(--color-text)' }}>
              {fmtMb(r.v)}
            </text>
          </g>
        )
      })}
      <line x1={B.x0} x2={B.x0} y1={B.top - 2} y2={B.top + B.row * 3 + 2} style={{ stroke: 'var(--color-text)', strokeWidth: 1.2 }} />
      {[0, 5, 10, 15].map(t => (
        <text key={t} x={bxv(t)} y={B.top + B.row * 3 + 16} textAnchor="middle" style={MUTED}>
          {t}
        </text>
      ))}
    </svg>
  )
}
