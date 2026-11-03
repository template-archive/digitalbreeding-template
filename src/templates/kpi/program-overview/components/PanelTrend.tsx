import { SeverityTag, useElementWidth, type SeverityTagProps } from '@/design-system'

export interface PanelTrendPoint {
  label: string
  value: number
  /** 기준 구간 밖(예: GS 도입 전)이라 더 흐리게 */
  dim?: boolean
}

export interface PanelTrendRef {
  value: number
  label: string
}

export interface PanelTrendProps {
  /** 도식 제목 한 줄(12px). 선 모양의 뜻도 여기에 적는다 */
  title: string
  points: PanelTrendPoint[]
  kind?: 'bar' | 'line'
  /** 수평 기준선 */
  refs?: PanelTrendRef[]
  /** 점별 목표(계단 점선). points와 같은 길이 */
  stepTarget?: number[]
  format: (v: number) => string
  /** 결론형 설명 */
  ariaLabel: string
  min?: number
  max?: number
  height?: number
}

const INK = 'var(--color-panel-ink)'
const MUTED = 'var(--color-panel-muted)'
const FACE = 'var(--color-panel)'
const TOP = 18
const BOTTOM = 18

/** 어두운 결론 패널 위 작은 추세 도식. 면 색 토큰(--color-panel-*)만 쓰고 강조색은 쓰지 않는다. 축 눈금 없이 양끝 값·기준선만 적는다 */
export function PanelTrend({ title, points, kind = 'bar', refs = [], stepTarget, format, ariaLabel, min, max, height = 112 }: PanelTrendProps) {
  const { ref, width } = useElementWidth()
  const values = points.map(p => p.value)
  const all = [...values, ...refs.map(r => r.value), ...(stepTarget ?? [])]
  const dataLo = Math.min(...all)
  const dataHi = Math.max(...all)
  const span = dataHi - dataLo || Math.abs(dataHi) || 1
  const lo = min ?? (kind === 'bar' ? 0 : dataLo - span * 0.12)
  const hi = max ?? dataHi + span * 0.08
  const plotH = height - TOP - BOTTOM
  const y = (v: number) => TOP + (1 - (v - lo) / (hi - lo || 1)) * plotH
  const n = points.length
  const last = points[n - 1]
  const band = width / Math.max(1, n)
  const cx = (i: number) => (kind === 'bar' ? band * (i + 0.5) : n <= 1 ? width / 2 : 4 + ((width - 8) * i) / (n - 1))
  const barW = Math.min(band * 0.62, 26)
  const steps = stepTarget ? stepTarget.map((v, i) => `${i === 0 ? 'M' : 'H'}${i === 0 ? cx(0) - band / 2 : cx(i) - band / 2} ${i === 0 ? '' : `V${y(v)} `}${i === 0 ? y(v) : ''}H${cx(i) + band / 2}`).join(' ') : null
  const halo = { paintOrder: 'stroke' as const, stroke: FACE, strokeWidth: 3, strokeLinejoin: 'round' as const }

  return (
    <figure className="m-0 min-w-0">
      <figcaption className="mb-1 break-keep text-xs text-panel-muted">{title}</figcaption>
      <div ref={ref} style={{ height }}>
        {width > 0 && n > 0 && (
          <svg role="img" aria-label={ariaLabel} width={width} height={height} className="block tabular-nums">
            {kind === 'bar'
              ? points.map((p, i) => (
                  <rect
                    key={p.label}
                    x={cx(i) - barW / 2}
                    y={y(p.value)}
                    width={barW}
                    height={Math.max(1, y(lo) - y(p.value))}
                    rx={2}
                    fill={INK}
                    opacity={i === n - 1 ? 1 : p.dim ? 0.28 : 0.55}
                  />
                ))
              : (
                <>
                  <polyline points={points.map((p, i) => `${cx(i)},${y(p.value)}`).join(' ')} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  <circle cx={cx(n - 1)} cy={y(last.value)} r={3.5} fill={INK} stroke={FACE} strokeWidth={1.5} />
                </>
              )}
            {steps && <path d={steps} fill="none" stroke={MUTED} strokeWidth={1.25} strokeDasharray="4 3" />}
            {refs.map(r => (
              <g key={r.label}>
                <line x1={0} x2={width} y1={y(r.value)} y2={y(r.value)} stroke={MUTED} strokeWidth={1.25} strokeDasharray="4 3" />
                <text x={0} y={y(r.value) - 4} fontSize={11} fill={MUTED} style={halo}>
                  {r.label}
                </text>
              </g>
            ))}
            {refs.length === 0 && !steps && kind === 'line' && (
              <text x={0} y={Math.max(11, y(points[0].value) - 7)} fontSize={11} fill={MUTED} style={halo}>
                {format(points[0].value)}
              </text>
            )}
            <text x={width} y={Math.max(11, y(last.value) - (kind === 'line' ? 8 : 5))} textAnchor="end" fontSize={11} fontWeight={700} fill={INK} style={halo}>
              {format(last.value)}
            </text>
            <text x={0} y={height - 3} fontSize={11} fill={MUTED}>
              {points[0].label}
            </text>
            {n > 1 && (
              <text x={width} y={height - 3} textAnchor="end" fontSize={11} fill={MUTED}>
                {last.label}
              </text>
            )}
          </svg>
        )}
      </div>
    </figure>
  )
}

/** 어두운 패널 위 심각도 태그: 의미색은 면 대비가 모자라 아이콘·글자를 패널 잉크로 바꾼다. 심각도는 아이콘 모양 + 문자가 말한다 */
export function PanelSeverity({ severity, label }: Pick<SeverityTagProps, 'severity' | 'label'>) {
  return <SeverityTag severity={severity} label={label} className="!border-panel-muted/60 !text-panel-ink align-[1px] [&_svg]:!text-panel-ink" />
}
