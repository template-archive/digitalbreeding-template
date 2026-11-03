import { Fragment } from 'react'
import { u } from '@/design-system'
import { ACH, MET_IDX, PASS, PIPELINE, PIPELINE_TARGET, STAGES, f1, fmt } from '../data'

/**
 * 2026 파이프라인: 숫자 블록을 화살표로 잇는다. 2,000 대 3처럼 범위가 커서 막대 길이로 크기를 표현하지 않는다.
 * 화살표 위 = 같은 해 단계 수 비(이전 단계 대비, 코호트 진급률 아님). MET 블록에 목표 미달을 문자로 표시(경고 아이콘은 「남은 과제」에만).
 * 이름 칸을 2줄 높이로 고정해 숫자 기준선을 맞춘다.
 */
export function Pipeline() {
  return (
    <div className="grid items-stretch" style={{ gridTemplateColumns: STAGES.map(() => '1fr').join(` ${u(52)} `) }}>
      {STAGES.map((s, i) => {
        const short = i === MET_IDX
        const last = i === STAGES.length - 1
        return (
          <Fragment key={s.abbr}>
            {i > 0 && (
              <div className="flex flex-col items-center justify-center">
                <span aria-hidden className="font-bold text-text tabular-nums" style={{ fontSize: u(16) }}>
                  {f1(PASS[i]!)}%
                </span>
                <svg viewBox="0 0 50 16" style={{ width: u(50), height: u(16) }} aria-hidden>
                  <line x1={2} x2={40} y1={8} y2={8} stroke="var(--color-text-muted)" strokeWidth={2.5} />
                  <path d="M38,2 L48,8 L38,14 Z" fill="var(--color-text-muted)" />
                </svg>
                <span className="sr-only">같은 해 단계 수 비 {f1(PASS[i]!)}%</span>
              </div>
            )}
            <div
              className={`flex min-w-0 flex-col border ${last ? 'border-accent/60 bg-accent/5' : 'border-border bg-surface'}`}
              style={{ padding: `${u(8)} ${u(10)}`, borderRadius: u(10), borderWidth: u(last ? 2 : 1.5), gap: u(3) }}
            >
              <div className="font-semibold text-muted" style={{ fontSize: u(15), lineHeight: 1.2, height: u(36) }}>
                {s.name}
              </div>
              <div className="flex items-baseline tabular-nums" style={{ gap: u(4) }}>
                <span className="font-extrabold text-text" style={{ fontSize: u(28), lineHeight: 1.05, letterSpacing: '-0.02em' }}>
                  {fmt(PIPELINE[i])}
                </span>
                <span className="font-semibold text-muted" style={{ fontSize: u(15) }}>
                  계통
                </span>
              </div>
              {/* 빈 줄도 높이를 잡아 카드 높이를 맞춘다 */}
              <div className="font-bold text-warning" style={{ fontSize: u(15), lineHeight: 1.2, height: u(18) }}>
                {short ? `목표 ${PIPELINE_TARGET[i]} · ${f1(ACH.met)}%` : null}
              </div>
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}
