import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useScrollOverflow } from '../hooks/useScrollOverflow'
import { cn } from './cn'
import { ScrollFade, ScrollHint } from './scrollCue'

/**
 * 캔버스 논리 픽셀 → CSS 길이. ScaledCanvas 안에서만 의미가 있다.
 * 예: style={{ fontSize: u(18), padding: u(24) }}
 */
export const u = (n: number) => `calc(var(--u) * ${n})`

export type CanvasPrint = 'a4-landscape' | 'a4-portrait'

export interface ScaledCanvasProps {
  /** 기준 논리 너비(px). 기본 1920 */
  width?: number
  /** 기준 논리 높이(px). 기본 1080(16:9) */
  height?: number
  /**
   * 최소 배율. 컨테이너 폭이 width × minScale보다 좁으면 더 줄이지 않고 그 폭으로 고정한 뒤
   * 가로 스크롤 컨테이너 안에 보여 준다(390px 화면에서 본문이 3px로 줄어드는 문제 방지).
   * 기본 0.6(1920 기준 1152px, 본문 16~18 논리 px → 약 10~11px). 0이면 끝까지 비례 축소.
   */
  minScale?: number
  /**
   * 인쇄 계약. 지정하면 인쇄 시 갤러리 내비·헤더([data-print-hide])를 숨기고
   * 이 캔버스만 해당 용지 한 쪽에 맞춘다(여백 10mm). 템플릿 안의 다른 요소도 숨기려면 data-print-hide를 붙인다.
   */
  print?: CanvasPrint
  /** 캔버스 전체가 말하는 결론(role=figure의 접근성 이름) */
  ariaLabel: string
  /** 스크롤 영역(role=region)의 접근성 이름. 기본 '인포그래픽 캔버스(좁은 화면에서는 가로 스크롤)' */
  regionLabel?: string
  /** 캔버스(배경·글자색 등)에 붙일 클래스 */
  className?: string
  /**
   * 캔버스가 최소 배율에 걸려 잘릴 때(화면보다 넓어 가로 스크롤할 때)만 캔버스 위에 보일 요약. 보통 `<MobileSummary …/>`.
   * 390px뿐 아니라 768px(16:9 캔버스 1152px, A4 세로 744px)에서도 잘리면 보인다. 인쇄에서는 숨는다. 2026-10-30
   */
  summary?: ReactNode
  /** 잘림 상태가 바뀔 때(요약을 직접 배치하는 템플릿용). 첫 측정은 페인트 전에 온다 */
  onClampedChange?: (clamped: boolean) => void
  /** 오른쪽 잘림 페이드 색(캔버스 바탕). 기본 var(--color-bg) — 템플릿 캔버스가 bg-bg가 아니면 그 색을 준다 */
  fadeColor?: string
  children: ReactNode
}

const PAGE_CSS: Record<CanvasPrint, string> = {
  'a4-landscape': '@media print { @page { size: A4 landscape; margin: 10mm; } }',
  'a4-portrait': '@media print { @page { size: A4 portrait; margin: 10mm; } }',
}

// 동시에 여러 캔버스가 인쇄 모드를 요청해도 마지막 하나가 사라질 때 해제한다
let printUsers = 0

/**
 * 고정 비율 인포그래픽 캔버스.
 * 크기 래퍼를 inline-size 컨테이너로 두고 `--u = 100cqw / width`를 1 논리 픽셀로 쓴다.
 * 자식은 u(n)으로 크기를 정하면 부모 폭에 맞춰 줄바꿈 변화 없이 전체가 비례 축소·확대된다.
 * transform·ResizeObserver를 쓰지 않아 인쇄 레이아웃에서도 그대로 맞는다.
 *
 * DOM: div[data-print-flat] > ([data-canvas-summary] · 안내 p, 잘릴 때만) + div.relative > div.overflow-x-auto[data-print-canvas] > div[data-canvas-frame](container) > div[role=figure]
 *      (div.relative 안 오른쪽 페이드 span[data-scroll-fade]는 잘린 채 끝까지 밀지 않았을 때만 보인다)
 * 주의: 캔버스 안에 다른 container-type 요소를 두면 cqw 기준이 바뀐다.
 */
export function ScaledCanvas({
  width = 1920,
  height = 1080,
  minScale = 0.6,
  print,
  ariaLabel,
  regionLabel = '인포그래픽 캔버스(좁은 화면에서는 가로 스크롤)',
  className,
  summary,
  onClampedChange,
  fadeColor = 'var(--color-bg)',
  children,
}: ScaledCanvasProps) {
  useEffect(() => {
    if (!print) return
    const root = document.documentElement
    printUsers += 1
    root.setAttribute('data-print-mode', 'canvas')
    return () => {
      printUsers -= 1
      if (printUsers <= 0) {
        printUsers = 0
        root.removeAttribute('data-print-mode')
      }
    }
  }, [print])

  const minWidth = minScale > 0 ? Math.round(width * minScale) : 0
  // 최소 배율에 걸려 가로 스크롤 중인지(요약·안내 문구 표시용). 캔버스 크기 계산에는 쓰지 않는다. 첫 페인트 전에 판정한다(요약 카드가 뒤늦게 튀어나오지 않게)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [clamped, setClamped] = useState(false)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || !minWidth) return
    const check = () => setClamped(el.clientWidth + 1 < minWidth)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [minWidth])
  const clampRef = useRef(onClampedChange)
  clampRef.current = onClampedChange
  useLayoutEffect(() => {
    clampRef.current?.(clamped)
  }, [clamped])
  const { atEnd } = useScrollOverflow(scrollRef, minWidth > 0)

  const frame: CSSProperties = {
    containerType: 'inline-size',
    width: '100%',
    minWidth: minWidth || undefined,
  }
  const canvas: CSSProperties = {
    ['--u' as string]: `calc(100cqw / ${width})`,
    width: '100%',
    aspectRatio: `${width} / ${height}`,
    position: 'relative',
    overflow: 'hidden',
  }
  return (
    <div data-print-flat="">
      {/* 잘릴 때만: 요약(캔버스 위) → 안내 문구 → 캔버스. 둘 다 인쇄에서 숨는다 */}
      {clamped && summary != null && (
        <div data-print-hide="" data-canvas-summary="" className="mb-3">
          {summary}
        </div>
      )}
      {clamped && (
        <div data-print-hide="">
          <ScrollHint className="mb-1.5">{`옆으로 밀어 전체 보기 → · 글자를 읽을 수 있게 원본의 ${Math.round(minScale * 100)}%까지만 줄였습니다`}</ScrollHint>
        </div>
      )}
      <div className="relative">
        {/* 최소 배율 아래에서만 실제로 스크롤된다. 그때만 키보드로 스크롤할 수 있게 tabIndex·region을 단다. */}
        <div
          ref={scrollRef}
          className="overflow-x-auto"
          data-print-canvas={print ?? undefined}
          tabIndex={clamped ? 0 : undefined}
          role={clamped ? 'region' : undefined}
          aria-label={clamped ? regionLabel : undefined}
        >
          {print && <style>{PAGE_CSS[print]}</style>}
          <div data-canvas-frame="" style={frame}>
            <div role="figure" aria-label={ariaLabel} style={canvas} className={cn(className)}>
              {children}
            </div>
          </div>
        </div>
        {minWidth > 0 && <ScrollFade show={clamped && !atEnd} color={fadeColor} />}
      </div>
    </div>
  )
}
