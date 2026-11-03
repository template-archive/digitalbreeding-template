import { useId } from 'react'
import { formatSigned } from '@/lib/format'
import { DG_PCT, FACTOR_RATIO, SHARE, WATERFALL, type Factor } from '../data'
import { CONTRIB_FILL, f1, f2 } from './shared'

// 논리 px(SVG 폭 = 캔버스 안 영역 폭이라 글자 크기가 캔버스 기준과 같다)
export const WF_W = 641
export const WF_H = 486 // 디자인 개선 2차: 표제를 왼쪽 열로 옮겨 오른쪽 열이 맨 위까지 올라왔다
const M = { left: 74, right: 8, top: 40, bottom: 54 }
const Y_MAX = 14
const Y_STEP = 2
const PW = WF_W - M.left - M.right
const PH = WF_H - M.top - M.bottom
const BAND = PW / WATERFALL.length
const BAR = 74

const y = (v: number) => M.top + PH * (1 - v / Y_MAX)
const bx = (k: number) => M.left + BAND * k + (BAND - BAR) / 2
const cx = (k: number) => M.left + BAND * k + BAND / 2

const RATIO_LABEL: Record<Factor, string> = {
  i: `×${f2(FACTOR_RATIO.i)}`,
  r: `×${f2(FACTOR_RATIO.r)}`,
  sigmaA: `×${f2(FACTOR_RATIO.sigmaA)}`,
  L: `1/L ×${f2(FACTOR_RATIO.L)}`,
}

const muted = { fill: 'var(--color-text-muted)' }
const text = { fill: 'var(--color-text)' }

export function Waterfall() {
  const id = useId().replace(/:/g, '')
  const convPat = `wf-conv-${id}`
  const negPat = `wf-neg-${id}`
  const lIdx = WATERFALL.findIndex(s => s.key === 'L')
  const lStep = WATERFALL[lIdx]!
  const ticks = Array.from({ length: Y_MAX / Y_STEP + 1 }, (_, i) => i * Y_STEP)

  return (
    <svg viewBox={`0 0 ${WF_W} ${WF_H}`} width="100%" aria-hidden className="block" style={{ overflow: 'visible' }}>
      <defs>
        <pattern id={convPat} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" style={{ fill: 'color-mix(in oklab, var(--color-text-muted) 22%, var(--color-surface))' }} />
          <rect width="3" height="7" style={{ fill: 'color-mix(in oklab, var(--color-text-muted) 62%, var(--color-surface))' }} />
        </pattern>
        <pattern id={negPat} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <rect width="6" height="6" style={{ fill: 'var(--color-surface)' }} />
          <rect width="2.5" height="6" style={{ fill: 'var(--color-warning)' }} />
        </pattern>
      </defs>

      {/* 격자·y축 */}
      {ticks.map(t => (
        <g key={t}>
          <line
            x1={M.left}
            x2={WF_W - M.right}
            y1={y(t)}
            y2={y(t)}
            style={{ stroke: t === 0 ? 'var(--color-text-muted)' : 'var(--color-border)' }}
            strokeWidth={t === 0 ? 1.5 : 1}
            strokeDasharray={t === 0 ? undefined : '3 4'}
          />
          <text x={M.left - 10} y={y(t) + 5.5} textAnchor="end" fontSize={16} className="tabular-nums" style={muted}>
            {t}
          </text>
        </g>
      ))}
      <text transform={`translate(18 ${M.top + PH / 2}) rotate(-90)`} textAnchor="middle" fontSize={16} style={muted}>
        연간 유전적 개량량(kg/10a/년)
      </text>

      {/* 단계 사이 연결선 */}
      {WATERFALL.slice(0, -1).map((s, k) => (
        <line key={`c${k}`} x1={bx(k) + BAR} x2={bx(k + 1)} y1={y(s.to)} y2={y(s.to)} strokeWidth={1.5} strokeDasharray="4 3" style={{ stroke: 'var(--color-text-muted)' }} />
      ))}

      {WATERFALL.map((s, k) => {
        const top = y(Math.max(s.from, s.to))
        const bottom = y(Math.min(s.from, s.to))
        const h = bottom - top
        const isEnd = s.key === 'end'
        const isStart = s.key === 'start'
        const fill = isStart ? `url(#${convPat})` : isEnd ? 'var(--color-accent)' : s.key === 'sigmaA' ? `url(#${negPat})` : CONTRIB_FILL
        const stroke = isStart ? 'var(--color-text-muted)' : s.key === 'sigmaA' ? 'var(--color-warning)' : 'var(--color-accent)'
        return (
          <g key={s.key}>
            <rect x={bx(k)} y={top} width={BAR} height={Math.max(h, 1)} rx={2} style={{ fill, stroke }} strokeWidth={s.key === 'L' ? 2.5 : 1.5} />
            {/* 막대 아래 이름 */}
            {s.name.map((line, j) => (
              <text key={j} x={cx(k)} y={M.top + PH + 22 + j * 20} textAnchor="middle" fontSize={16} fontWeight={j === 0 ? 700 : 500} style={j === 0 ? text : muted}>
                {line}
              </text>
            ))}
            {isStart || isEnd ? (
              <>
                <text x={cx(k)} y={top - 10} textAnchor="middle" fontSize={isEnd ? 28 : 24} fontWeight={800} className="tabular-nums" style={isEnd ? { fill: 'var(--color-accent)' } : text}>
                  {f2(s.to)}
                </text>
                <text
                  x={cx(k)}
                  y={bottom - 12}
                  textAnchor="middle"
                  fontSize={16}
                  fontWeight={700}
                  className="tabular-nums"
                  style={isEnd ? { fill: 'var(--color-accent-contrast)' } : text}
                  paintOrder="stroke"
                  stroke={isStart ? 'var(--color-surface)' : 'none'}
                  strokeWidth={isStart ? 4 : 0}
                >
                  {f2(isEnd ? DG_PCT.digital : DG_PCT.conventional)}%/년
                </text>
              </>
            ) : (
              (() => {
                const f = s.key as Factor
                const v = s.to - s.from
                return (
                  <>
                    <text x={cx(k)} y={top - 30} textAnchor="middle" fontSize={21} fontWeight={800} className="tabular-nums" style={text}>
                      {formatSigned(v, 2)}
                      {v < 0 && (
                        <tspan fontSize={16} fontWeight={700} dx={4} style={{ fill: 'var(--color-warning)' }}>
                          감소
                        </tspan>
                      )}
                    </text>
                    <text x={cx(k)} y={top - 10} textAnchor="middle" fontSize={17} fontWeight={600} className="tabular-nums" style={text}>
                      {f1(SHARE[f]).replace('-', '−')}%
                    </text>
                    <text x={cx(k)} y={bottom + 20} textAnchor="middle" fontSize={16} className="tabular-nums" style={muted}>
                      {RATIO_LABEL[f]}
                    </text>
                  </>
                )
              })()
            )}
          </g>
        )
      })}

      {/* L 콜아웃 */}
      {(() => {
        const bxL = bx(lIdx)
        const ly = y(lStep.to) + 26 // 정리 회차 2: 차트 높이 축소에 맞춰 +30 → +26
        const boxX = bx(0)
        const boxW = bxL - 26 - boxX
        return (
          <g>
            <rect x={boxX} y={ly - 21} width={boxW} height={36} rx={18} style={{ fill: 'var(--color-accent)' }} />
            <text x={boxX + boxW / 2} y={ly + 4} textAnchor="middle" fontSize={18} fontWeight={800} style={{ fill: 'var(--color-accent-contrast)' }}>
              세대 간격 단축 = 증가분의 {f1(SHARE.L)}%
            </text>
            <path d={`M ${boxX + boxW} ${ly - 3} L ${bxL - 4} ${ly - 3}`} strokeWidth={2} style={{ stroke: 'var(--color-accent)' }} />
            <path d={`M ${bxL - 12} ${ly - 9} L ${bxL - 3} ${ly - 3} L ${bxL - 12} ${ly + 3} Z`} style={{ fill: 'var(--color-accent)' }} />
          </g>
        )
      })()}
    </svg>
  )
}
