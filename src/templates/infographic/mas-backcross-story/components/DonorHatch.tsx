import { DONOR_COLOR } from './style'

/** 공여친 이형 빗금(SVG 패턴). 각 SVG 안에 하나씩 정의하고 useId로 만든 id를 쓴다. */
export function DonorHatchDef({ id, size = 4 }: { id: string; size?: number }) {
  return (
    <defs>
      <pattern id={id} patternUnits="userSpaceOnUse" width={size} height={size} patternTransform="rotate(45)">
        <rect width={size} height={size} style={{ fill: 'var(--color-surface)' }} />
        <rect width={size * 0.55} height={size} style={{ fill: DONOR_COLOR }} />
      </pattern>
    </defs>
  )
}
