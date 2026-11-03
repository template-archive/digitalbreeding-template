import { useId } from 'react'
import { CHR_LEN_MB, GENOME_MB, TARGET, type Segment } from '../data'
import { DONOR_COLOR, RECUR_COLOR } from './style'
import { DonorHatchDef } from './DonorHatch'

/**
 * 미니 게놈 띠: 12개 염색체를 길이 비례로 한 줄로 이은 가로 띠(6K 칩 판독).
 * 동형 = 공여친색 전체 높이, 이형 = 아래 반 높이 빗금, 가람솔형 = 회청 바탕.
 * viewBox 단위 = 캔버스 논리 px(부모가 u(width) 폭을 준다).
 */
export function GenomeStrip({ segments, width, height = 18 }: { segments: Segment[]; width: number; height?: number }) {
  const hatch = `h${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const gap = 1.5
  const usable = width - gap * (CHR_LEN_MB.length - 1)
  const offsets: number[] = []
  let acc = 0
  CHR_LEN_MB.forEach(l => {
    offsets.push(acc)
    acc += (l / GENOME_MB) * usable + gap
  })
  const sx = (chr: number, mb: number) => offsets[chr - 1] + (mb / GENOME_MB) * usable
  const markH = 5
  const barTop = markH
  const barH = height - markH
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" aria-hidden style={{ display: 'block', overflow: 'visible' }}>
      <DonorHatchDef id={hatch} size={3.5} />
      {CHR_LEN_MB.map((l, i) => (
        <rect key={i} x={offsets[i]} y={barTop} width={(l / GENOME_MB) * usable} height={barH} rx={1.5} style={{ fill: RECUR_COLOR }} />
      ))}
      {segments.map((s, k) => {
        const x = sx(s.chr, s.start)
        const w = Math.max(1.5, sx(s.chr, s.end) - x)
        return s.dose === 2 ? (
          <rect key={k} x={x} y={barTop} width={w} height={barH} style={{ fill: DONOR_COLOR }} />
        ) : (
          <rect key={k} x={x} y={barTop + barH / 2} width={w} height={barH / 2} style={{ fill: `url(#${hatch})`, stroke: DONOR_COLOR, strokeWidth: 0.6 }} />
        )
      })}
      {/* Pi9 위치 표식(아래로 향한 삼각형) */}
      <path
        d={`M ${sx(TARGET.chr, TARGET.mb) - 3.5} 0 L ${sx(TARGET.chr, TARGET.mb) + 3.5} 0 L ${sx(TARGET.chr, TARGET.mb)} ${markH - 0.5} Z`}
        style={{ fill: 'var(--color-text)' }}
      />
    </svg>
  )
}
