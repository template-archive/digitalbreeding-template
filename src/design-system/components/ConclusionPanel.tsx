import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from './cn'
import { useMediaQuery } from '../hooks/useMediaQuery'

export interface ConclusionPanelProps {
  /** 왼쪽 위 범위 줄(예: '2026년 잠정 · 기준 품종 대비') */
  label: ReactNode
  /** 대표 값. 데이터 상수에서 만든 문자열을 넘긴다 */
  value: ReactNode
  /** 단위(값보다 작게) */
  unit?: ReactNode
  /** 판단 한 문장 */
  statement: ReactNode
  /** 값의 이름(예: '연간 유전적 개량량 ΔG') */
  valueLabel?: ReactNode
  /** 패널 안 작은 추세 도식(실제 데이터 차트). 없으면 글만 채운다 */
  aside?: ReactNode
  className?: string
}

/**
 * 결론 패널: 화면의 판단 하나를 어두운 면에 세운다. 화면당 최대 1개, 판단이 없는 화면에서는 쓰지 않고 SummaryCallout을 쓴다.
 * 면 색은 --color-panel(라이트 잉크, 다크 표면 2)이고 강조색으로 채우지 않는다. 대표 값은 40/700.
 */
export function ConclusionPanel({ label, value, unit, statement, valueLabel, aside, className }: ConclusionPanelProps) {
  const narrow = useMediaQuery('(max-width: 639px)')
  return (
    <section data-conclusion-panel="" className={cn('@container flex h-full min-w-0 rounded-lg bg-panel p-5 text-panel-ink sm:p-6', className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-3 @lg:flex-row @lg:items-stretch">
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 sm:gap-5">
          <p className="break-keep text-xs font-medium text-panel-muted">{label}</p>
          <div>
            {valueLabel != null && <p className="mb-1 break-keep text-[13px] text-panel-muted">{valueLabel}</p>}
            <p className="text-[40px] font-bold leading-none tracking-tight tabular-nums">
              {value}
              {unit != null && <span className="ml-1 text-[22px] font-semibold">{unit}</span>}
            </p>
          </div>
          <p className="max-w-[46ch] break-keep text-sm leading-relaxed tabular-nums">{statement}</p>
        </div>
        {aside != null && (narrow ? (
          <details className="group/conclusion min-w-0 border-t border-panel-muted/30 pt-2">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-medium text-panel-muted [&::-webkit-details-marker]:hidden">추이·보조 자료 보기<ChevronDown size={16} aria-hidden="true" className="group-open/conclusion:rotate-180" /></summary>
            <div className="pt-2">{aside}</div>
          </details>
        ) : <div className="min-w-0 @lg:w-[45%] @lg:self-center">{aside}</div>)}
      </div>
    </section>
  )
}

export interface ConclusionBundleProps {
  /** 대표 면(보통 ConclusionPanel) */
  panel: ReactNode
  /** 받치는 타일들(2~4개 권장). 핵심 값 하나만 진하게 칠한다 */
  children: ReactNode
  className?: string
}

/** 결론 묶음: 넓은 화면에서 대표 면 47%와 연한 타일 영역 53%. 좁아지면 대표 면이 전체 폭으로 올라간다 */
export function ConclusionBundle({ panel, children, className }: ConclusionBundleProps) {
  return (
    <div className={cn('@container', className)}>
      <div className="grid grid-cols-1 gap-3 @5xl:grid-cols-[47fr_53fr]">
        <div className="min-w-0">{panel}</div>
        <div className="grid min-w-0 grid-cols-1 gap-3 @xl:grid-cols-2">{children}</div>
      </div>
    </div>
  )
}
