import { useEffect, useState, type KeyboardEvent, type MutableRefObject, type ReactNode } from 'react'
import { AlertOctagon, MapPin, StickyNote } from 'lucide-react'
import { formatNumber, formatSigned } from '@/lib/format'
import {
  CHECK_LABEL,
  COLS,
  ENTRY_BY_NO,
  PLOT_AT,
  PLOT_BY_NO,
  REP_LABEL,
  REPS,
  ROWS,
  TRAIT_EXTENT,
  TRAIT_KEYS,
  TRAITS,
  TREND_EXTENT,
  TRENDS,
  type Plot,
  type TraitKey,
} from '../data'
import { HATCH_MISSING, ScrollRegion } from '@/design-system'
import { HATCH_CHECK, divColor, divTextClass, seqColor, seqTextClass } from './scale'

export type ViewMode = 'layout' | 'heatmap' | 'missing'
export type ValueMode = 'raw' | 'trend'

export interface FieldGridProps {
  mode: ViewMode
  trait: TraitKey
  valueMode: ValueMode
  showBlocks: boolean
  /** 검색 일치 구. null이면 검색 없음(또는 0건: 흐리게 하지 않음) */
  matches: Set<number> | null
  selected: number | null
  onSelect: (plotNo: number) => void
  memoPlots: Set<number>
  cellRefs: MutableRefObject<Map<number, HTMLButtonElement>>
}

const fmtVal = (t: TraitKey, v: number, digits = TRAITS[t].digits) => formatNumber(v, { digits })
const fmtTrend = (t: TraitKey, v: number) => {
  const digits = t === 'yield' ? 0 : 1
  // 0은 자릿수와 무관하게 '0'
  return Number(Math.abs(v).toFixed(digits)) === 0 ? '0' : formatSigned(v, digits)
}

/** 현재 모드의 값 문구(툴팁·aria-label) */
export function describeValue(p: Plot, mode: ViewMode, trait: TraitKey, valueMode: ValueMode): string {
  const tr = TRAITS[trait]
  if (mode === 'missing') {
    const miss = TRAIT_KEYS.filter(t => p.status[t] === 'missing').map(t => TRAITS[t].short)
    const out = TRAIT_KEYS.filter(t => p.status[t] === 'outlier').map(t => `${TRAITS[t].short} ${fmtVal(t, p.values[t]!)} ${TRAITS[t].unit}`)
    const parts = [miss.length ? `결측: ${miss.join('·')}` : '', out.length ? `이상치: ${out.join('·')}` : ''].filter(Boolean)
    return parts.length ? parts.join(', ') : '결측·이상치 없음'
  }
  const t: TraitKey = mode === 'layout' ? 'yield' : trait
  if (mode === 'heatmap' && valueMode === 'trend') {
    const v = TRENDS[t].get(p.no)
    return v == null ? `${tr.short} 공간 경향 계산 불가(유효 이웃 3개 미만)` : `${tr.short} 공간 경향 ${fmtTrend(t, v)} ${tr.unit}`
  }
  const v = p.values[t]
  const T = TRAITS[t]
  if (v === null) return `${T.short} 결측`
  return `${T.short} ${fmtVal(t, v)} ${T.unit}${p.status[t] === 'outlier' ? '(이상치)' : ''}`
}

function statusFlags(p: Plot, memo: boolean): string[] {
  const e = ENTRY_BY_NO.get(p.entry)!
  const flags: string[] = []
  if (e.check) flags.push(`대비 품종(${CHECK_LABEL[e.check]})`)
  const miss = TRAIT_KEYS.filter(t => p.status[t] === 'missing').map(t => TRAITS[t].short)
  if (miss.length) flags.push(`결측 ${miss.join('·')}`)
  const out = TRAIT_KEYS.filter(t => p.status[t] === 'outlier').map(t => TRAITS[t].short)
  if (out.length) flags.push(`이상치 ${out.join('·')}`)
  if (memo) flags.push('메모 있음')
  return flags
}

export function FieldGrid({ mode, trait, valueMode, showBlocks, matches, selected, onSelect, memoPlots, cellRefs }: FieldGridProps) {
  const [active, setActive] = useState<number>(selected ?? 101)
  useEffect(() => {
    if (selected != null) setActive(selected)
  }, [selected])

  const focusAt = (row: number, col: number) => {
    const p = PLOT_AT[row - 1]?.[col - 1]
    if (!p) return
    setActive(p.no)
    cellRefs.current.get(p.no)?.focus()
  }

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, p: Plot) => {
    let r = p.row
    let c = p.col
    switch (e.key) {
      case 'ArrowUp': r = Math.max(1, r - 1); break
      case 'ArrowDown': r = Math.min(ROWS, r + 1); break
      case 'ArrowLeft': c = Math.max(1, c - 1); break
      case 'ArrowRight': c = Math.min(COLS, c + 1); break
      case 'Home': c = 1; break
      case 'End': c = COLS; break
      case 'Enter':
      case ' ':
        e.preventDefault()
        onSelect(p.no)
        return
      default:
        return
    }
    e.preventDefault()
    focusAt(r, c)
  }

  const dimSearch = matches !== null && matches.size > 0
  const ext = TRAIT_EXTENT[trait]
  const tExt = TREND_EXTENT[trait] || 1

  // 열 경계: 불완전 블록 경계(2열마다)는 2px, 그 외 1px
  const colBorder = (col: number) =>
    col === 1 ? '' : (col - 1) % 2 === 0 && showBlocks ? 'border-l-2 border-l-text/45' : 'border-l border-l-border'

  const renderCell = (p: Plot) => {
    const e = ENTRY_BY_NO.get(p.entry)!
    const memo = memoPlots.has(p.no)
    const isMatch = matches?.has(p.no) ?? false
    const isSel = selected === p.no
    let bg: string | undefined
    let textCls = 'text-text'
    let body: ReactNode
    let faded = false
    let outlierFrame = false

    if (mode === 'layout') {
      if (e.check) bg = HATCH_CHECK
      body = e.check ? (
        <>
          <span className="text-[12px] font-bold leading-none tabular-nums">{e.no}</span>
          <span className="mt-0.5 text-[11px] font-semibold leading-none tracking-tight">{e.name}</span>
          <span className="mt-0.5 rounded-sm border border-text/40 bg-surface px-0.5 text-[11px] font-bold leading-tight text-text">대비</span>
        </>
      ) : (
        <>
          <span className="text-[13px] font-bold leading-none tabular-nums">{e.no}</span>
          <span className="mt-1 text-[11px] leading-none text-muted tabular-nums">{e.name.slice(-4)}</span>
        </>
      )
    } else if (mode === 'heatmap') {
      const st = p.status[trait]
      const v = p.values[trait]
      if (valueMode === 'trend') {
        const tv = TRENDS[trait].get(p.no)
        if (tv == null) {
          bg = HATCH_MISSING
          body = <span className="text-[12px] text-muted">—</span>
        } else {
          const n = tv / tExt
          bg = divColor(n)
          textCls = divTextClass(n)
          body = <span className="text-[12px] font-semibold tabular-nums">{fmtTrend(trait, tv)}</span>
        }
      } else if (st === 'missing' || v === null) {
        bg = HATCH_MISSING
        body = <span className="text-[13px] font-semibold text-muted">—</span>
      } else if (st === 'outlier') {
        bg = 'var(--color-surface)'
        outlierFrame = true
        body = (
          <>
            <AlertOctagon size={12} aria-hidden="true" className="text-negative" />
            <span className="mt-0.5 text-[12px] font-bold tabular-nums">{fmtVal(trait, v, 0)}</span>
          </>
        )
      } else {
        const t = (v - ext[0]) / (ext[1] - ext[0] || 1)
        bg = seqColor(t)
        textCls = seqTextClass(t)
        body = <span className="text-[13px] font-semibold tabular-nums">{fmtVal(trait, v, 0)}</span>
      }
    } else {
      const miss = TRAIT_KEYS.filter(t => p.status[t] === 'missing')
      const out = TRAIT_KEYS.filter(t => p.status[t] === 'outlier')
      if (miss.length) {
        bg = HATCH_MISSING
        body = (
          <>
            <span className="text-[11px] font-bold leading-none">결측</span>
            <span className="mt-0.5 text-[11px] font-semibold leading-none">{miss.map(t => TRAITS[t].abbr).join('·')}</span>
          </>
        )
      } else if (out.length) {
        outlierFrame = true
        body = (
          <>
            <span className="flex items-center gap-0.5 text-[11px] font-bold leading-none">
              <AlertOctagon size={11} aria-hidden="true" className="text-negative" />
              이상
            </span>
            <span className="mt-0.5 text-[11px] font-semibold leading-none">{out.map(t => TRAITS[t].abbr).join('·')}</span>
          </>
        )
      } else {
        faded = true
        body = <span className="text-[11px] text-muted tabular-nums">{p.no}</span>
      }
    }

    const label = [
      `구 ${p.no}, 반복 ${REP_LABEL[p.rep - 1]} 블록 B${p.block}, ${p.row}행 ${p.col}열, 처리 ${e.no} ${e.name}`,
      describeValue(p, mode, trait, valueMode),
      ...statusFlags(p, memo),
      isMatch ? '검색 일치' : '',
    ]
      .filter(Boolean)
      .join(', ')

    const tipPos = p.row <= 2 ? 'top-full mt-1' : 'bottom-full mb-1'
    const tipAlign = p.col <= 3 ? 'left-0' : p.col >= COLS - 2 ? 'right-0' : 'left-1/2 -translate-x-1/2'
    const lowered = (dimSearch && !isMatch) || (faded && !isMatch)

    return (
      <div role="gridcell" aria-selected={isSel} key={p.no} className={`relative min-w-[44px] flex-1 ${colBorder(p.col)}`}>
        <button
          type="button"
          ref={el => {
            if (el) cellRefs.current.set(p.no, el)
            else cellRefs.current.delete(p.no)
          }}
          tabIndex={active === p.no ? 0 : -1}
          onClick={() => {
            setActive(p.no)
            onSelect(p.no)
          }}
          onFocus={() => setActive(p.no)}
          onKeyDown={ev => onKey(ev, p)}
          className={`group relative flex h-[60px] w-full flex-col items-center justify-center outline-none focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${textCls}`}
          style={{ background: bg }}
        >
          <span className="sr-only">{label}</span>
          {/* 왼쪽 위 구 번호(11px)와 겹치지 않게 본문을 조금 내린다(구 번호를 그리지 않는 결측 모드 제외) */}
          <span aria-hidden="true" className={`flex flex-col items-center transition-opacity ${mode !== 'missing' ? 'pt-2' : ''} ${lowered ? 'opacity-35' : ''}`}>{body}</span>
          {mode !== 'missing' && (
            <span
              className={
                isSel
                  ? 'absolute left-[3px] top-[3px] z-10 rounded-sm bg-text px-1 py-px text-[11px] font-semibold leading-none tracking-tight text-surface tabular-nums'
                  : `absolute left-0.5 top-0.5 text-[11px] leading-none tracking-tight tabular-nums ${lowered ? 'opacity-25' : 'opacity-80'}`
              }
              aria-hidden="true"
            >
              {p.no}
            </span>
          )}
          {memo && <StickyNote size={10} aria-hidden="true" className="absolute right-0.5 top-0.5 text-muted" />}
          {outlierFrame && <span aria-hidden="true" className="pointer-events-none absolute inset-[3px] rounded-sm border-2 border-dashed border-negative" />}
          {isMatch && (
            <>
              {/* 검색 일치 = 글자색 안쪽 테두리 + 표면색 후광(select-ring, 강조색 아님) + 위치 핀. 선택 구는 이중선 테두리 */}
              <span aria-hidden="true" className="select-ring pointer-events-none absolute inset-0" />
              <MapPin size={12} aria-hidden="true" className="absolute bottom-0.5 right-0.5 fill-surface text-text" />
            </>
          )}
          {isSel && <span aria-hidden="true" className="pointer-events-none absolute inset-[1px] border-[5px] border-double border-text" />}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute z-30 hidden w-max max-w-[220px] rounded-md border border-border bg-surface px-2 py-1.5 text-left text-[11px] leading-snug text-text shadow-2 group-hover:block group-focus-visible:block ${tipPos} ${tipAlign}`}
          >
            <b className="font-semibold">
              구 {p.no} · {e.name}
            </b>
            <br />
            {describeValue(p, mode, trait, valueMode)}
            <br />
            <span className="text-muted">{statusFlags(p, memo).join(' · ') || '정상'}</span>
          </span>
        </button>
      </div>
    )
  }

  return (
    <ScrollRegion label="시험포장 A-3 격자(가로 스크롤, 방향키로 구 이동)" hint="옆으로 밀어 나머지 열 보기 →" className="rounded-md border-[3px] border-text/70">
      <div role="grid" aria-label="시험포장 A-3 배치 격자, 9행 14열 126구" aria-rowcount={ROWS + 1} aria-colcount={COLS + 1} className="min-w-[680px] bg-surface">
        {/* 열 번호 */}
        <div role="row" className="flex border-b border-border bg-surface-2">
          <div role="columnheader" className="sticky left-0 z-10 flex w-12 shrink-0 items-center justify-center bg-surface-2 text-[11px] text-muted">
            행＼열
          </div>
          {Array.from({ length: COLS }, (_, i) => (
            <div role="columnheader" key={i} className={`min-w-[44px] flex-1 py-1 text-center text-[11px] font-semibold text-muted tabular-nums ${colBorder(i + 1).replace(/border-l-text\/45/, 'border-l-transparent').replace(/border-l-border/, 'border-l-transparent')}`}>
              {i + 1}
            </div>
          ))}
        </div>
        {Array.from({ length: REPS }, (_, r) => (
          <div key={r} className={r > 0 ? 'border-t-[3px] border-text/70' : ''}>
            {/* 반복 라벨 + 블록 소라벨 */}
            <div className="flex bg-surface-2/60" aria-hidden="true">
              <div className="sticky left-0 z-10 flex w-12 shrink-0 items-center justify-center bg-surface-2 text-[11px] font-bold text-text">반복 {REP_LABEL[r]}</div>
              {Array.from({ length: COLS }, (_, i) => (
                <div key={i} className={`relative min-w-[44px] flex-1 py-0.5 text-[11px] font-semibold text-muted ${colBorder(i + 1)}`}>
                  {showBlocks && i % 2 === 0 ? <span className="absolute inset-y-0 left-0 flex w-[200%] items-center justify-center">B{i / 2 + 1}</span> : ' '}
                </div>
              ))}
            </div>
            {[1, 2, 3].map(ro => {
              const row = r * 3 + ro
              return (
                <div role="row" key={row} className="flex border-t border-border">
                  <div role="rowheader" className="sticky left-0 z-10 flex w-12 shrink-0 flex-col items-center justify-center border-r border-border bg-surface text-[12px] font-semibold text-muted tabular-nums">
                    {row}
                    <span className="sr-only">행, 반복 {REP_LABEL[r]}</span>
                  </div>
                  {PLOT_AT[row - 1]!.map(p => renderCell(PLOT_BY_NO.get(p.no)!))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </ScrollRegion>
  )
}
