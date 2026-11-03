import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from './cn'

export interface PageHeaderProps {
  /** 페이지 제목(h1 하나, 24/700) */
  title: ReactNode
  /**
   * 제목 위 범위·소속 한 줄(빵부스러기형 회색 일반 텍스트 12px, pill 아님). 예: '벼 · 쌀 수량(kg/10a) · 중부 평야지 벼 육종 프로그램'.
   * 문자열 배열이면 ' · '로 잇는다
   */
  context?: ReactNode | string[]
  /**
   * 제목 아래 둘째 줄: 데이터에 관한 한 문장(결론·기간·범위, 13px muted). '목업'·'가상' 같은 상태 표시도 여기 텍스트로 쓴다.
   * '항목을 누르면 …로 이동' 같은 인터페이스 안내는 쓰지 않는다
   */
  scope?: ReactNode
  /** 기준일(제목 줄 오른쪽 회색 스탬프). '기준일 ' 뒤에 붙는다. 예: '2026-10-23 · 2026년은 잠정' */
  asOf?: ReactNode
  /** asOf 앞 이름. 기본 '기준일' */
  asOfLabel?: string
  /** 실제 필터·동작이 있을 때만: 제목 줄 오른쪽(기준일 뒤). 한 줄 컨트롤 높이는 32~36px로 맞춘다(Select 32px 등) */
  actions?: ReactNode
  /** 긴 정의·규칙·방법 문단. 「자세히」를 눌러야 펼쳐진다(기본 접힘) */
  details?: ReactNode
  /** details 펼침 버튼 문구. 기본 '자세히' */
  detailsLabel?: string
  /** details를 처음부터 펼쳐 둘지. 기본 false */
  detailsOpen?: boolean
  className?: string
}

/**
 * 템플릿 페이지 머리(앱 화면 규칙: pill은 행 안이나 값 옆에만, 제목 위에는 두지 않는다).
 * 배치: 범위·소속 회색 한 줄 → 제목(h1) + 오른쪽 기준일 스탬프·필터 → 데이터 한 문장 → 접힌 「자세히」.
 * 좁은 화면에서는 오른쪽 묶음이 제목 아래로 내려와 왼쪽 정렬된다. 인포그래픽 캔버스 안에서는 쓰지 않는다.
 * 기준 구현: kpi/program-overview(2026-10-30). 페이지 머리 마크업(SectionHeader level 1 + 배지 줄 직접 배치)은 이것으로 옮긴다.
 */
export function PageHeader({ title, context, scope, asOf, asOfLabel = '기준일', actions, details, detailsLabel = '자세히', detailsOpen, className }: PageHeaderProps) {
  const ctx = Array.isArray(context) && context.every(c => typeof c === 'string') ? context.join(' · ') : (context as ReactNode)
  const hasRight = asOf != null || actions != null
  return (
    // header 요소는 쓰지 않는다(main 밖 임베드에서 banner 랜드마크가 되어 갤러리 머리와 겹친다)
    <div className={cn('flex flex-col gap-2', className)} data-page-header="">
      {ctx != null && ctx !== '' && <p className="break-keep wrap-break-word text-xs font-medium text-muted">{ctx}</p>}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h1 className="min-w-0 break-keep wrap-break-word text-2xl font-bold tracking-tight text-text">{title}</h1>
        {hasRight && (
          <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 sm:w-auto">
            {asOf != null && (
              <p className="text-xs text-muted tabular-nums">
                {asOfLabel} {asOf}
              </p>
            )}
            {actions != null && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
        )}
      </div>
      {scope != null && <p className="max-w-[110ch] break-keep wrap-break-word text-[13px] leading-relaxed text-muted">{scope}</p>}
      {details != null && (
        <details className="group mt-0.5" open={detailsOpen}>
          <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 rounded-sm text-[13px] font-medium text-muted hover:text-text touch:min-h-11 [&::-webkit-details-marker]:hidden">
            {detailsLabel}
            <ChevronDown size={14} aria-hidden="true" className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 max-w-[72ch] break-keep text-[13px] leading-relaxed text-muted">{details}</div>
        </details>
      )}
    </div>
  )
}
