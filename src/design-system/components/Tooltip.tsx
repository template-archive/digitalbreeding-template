import { useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { cn } from './cn'

/**
 * 정보 툴팁. 마우스는 호버, 키보드는 포커스, 터치·펜은 탭으로 연다(다시 탭하거나 바깥을 탭하면 닫힘). Esc로 닫힌다.
 * children은 포커스 가능한 요소가 좋다(비활성 사유 툴팁이면 disabled 대신 aria-disabled 버튼 — 탭 이벤트가 전달되도록).
 * 열린 말풍선이 화면 가장자리를 넘으면 안쪽으로 밀어 넣는다(좁은 화면 탭).
 */
export function Tooltip({ content, children, className }: { content: ReactNode; children: ReactNode; className?: string }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  // 탭 직전 열림 상태. 탭 중에 포커스·호환 마우스 이벤트가 먼저 열어도 탭 한 번 = 토글이 되게 한다
  const wasOpen = useRef(false)
  const [shift, setShift] = useState(0)

  // 터치로 연 뒤 바깥을 탭하면 닫는다(iOS는 버튼에 포커스를 주지 않아 blur가 오지 않는다)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // 화면 밖으로 나간 만큼 가로로 밀기(여백 8px)
  useLayoutEffect(() => {
    if (!open) {
      setShift(0)
      return
    }
    const tip = tipRef.current
    if (!tip) return
    const r = tip.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    const base = r.left - shift
    const right = base + r.width
    const next = base < 8 ? 8 - base : right > vw - 8 ? vw - 8 - right : 0
    if (Math.abs(next - shift) > 0.5) setShift(next)
    // shift는 이 effect가 정하는 값이라 의존성에 넣지 않는다(넣으면 같은 계산을 한 번 더 돈다)
  }, [open, content])

  const isMouse = (e: ReactPointerEvent) => e.pointerType === 'mouse'
  return (
    <span
      ref={rootRef}
      className={cn('relative inline-flex', className)}
      onPointerEnter={e => {
        if (isMouse(e)) setOpen(true)
      }}
      onPointerLeave={e => {
        if (isMouse(e)) setOpen(false)
      }}
      onPointerDown={e => {
        if (!isMouse(e)) wasOpen.current = open
      }}
      onPointerUp={e => {
        if (!isMouse(e)) setOpen(!wasOpen.current)
      }}
      onFocus={() => setOpen(true)}
      onBlur={e => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
      onKeyDown={e => {
        if (e.key === 'Escape') setOpen(false)
      }}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      {open && (
        <span
          ref={tipRef}
          role="tooltip"
          id={id}
          style={shift ? { translate: `calc(-50% + ${shift}px) 0` } : undefined}
          className="absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-64 -translate-x-1/2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-normal leading-relaxed text-text shadow-2"
        >
          {content}
        </span>
      )}
    </span>
  )
}
