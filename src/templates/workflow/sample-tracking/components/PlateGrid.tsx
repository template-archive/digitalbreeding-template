import { useRef, useState, type KeyboardEvent, type MouseEvent, type MutableRefObject } from 'react'
import { Check } from 'lucide-react'
import { ScrollRegion, cn } from '@/design-system'
import { CONTROL_WELLS, ROWS, wellTooltip, type PlateInfo, type Sample } from '../data'
import { CALL_BINS, KASP_CALL_NOTE, LEGEND_ORDER, WELL_STYLE, callBin, wellKind } from './wellStyle'

export type GridView = 'status' | 'call'

interface Props {
  info: PlateInfo
  /** 시료 94웰(A01~H10 순) */
  samples: Sample[]
  view: GridView
  /** 상세 패널에 열린 웰 바코드 */
  detail: string | null
  /** 다중 선택 웰 바코드 */
  selected: Set<string>
  /** 검색·재분석 카드에서 강조한 웰 */
  highlight: Set<string>
  /** 「여러 웰 선택」 모드(탭 = 선택 토글). 접근성 안내 문구만 바뀐다(토글 처리는 onWellClick 쪽) */
  multiMode?: boolean
  /** 좁은 화면·터치: 웰을 44px로(플레이트는 ScrollRegion 안에서 가로 스크롤, 행 머리는 고정) */
  touchWells?: boolean
  onWellClick: (s: Sample, multi: boolean) => void
  /** 행·열 머리: 해당 웰들을 다중 선택(모두 선택돼 있으면 해제) */
  onToggleWells: (barcodes: string[]) => void
}

const COLS = Array.from({ length: 12 }, (_, i) => i + 1)

/** 96웰 플레이트 격자(8행 A~H × 12열, 실물 플레이트와 같은 방향) */
export function PlateGrid({ info, samples, view, detail, selected, highlight, multiMode, touchWells, onWellClick, onToggleWells }: Props) {
  const byWell = new Map(samples.map(s => [s.well, s]))
  const [focus, setFocus] = useState(0)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const plateId = info.def.id

  const move = (e: KeyboardEvent, i: number) => {
    let n = i
    if (e.key === 'ArrowRight') n = Math.min(95, i + 1)
    else if (e.key === 'ArrowLeft') n = Math.max(0, i - 1)
    else if (e.key === 'ArrowDown') n = Math.min(95, i + 12)
    else if (e.key === 'ArrowUp') n = Math.max(0, i - 12)
    else if (e.key === 'Home') n = i - (i % 12)
    else if (e.key === 'End') n = i - (i % 12) + 11
    else return
    e.preventDefault()
    setFocus(n)
    refs.current[n]?.focus()
  }

  const rowBarcodes = (r: string) => samples.filter(s => s.well.startsWith(r)).map(s => s.barcode)
  const colBarcodes = (c: number) => samples.filter(s => Number(s.well.slice(1)) === c).map(s => s.barcode)
  const fewCalls = samples.every(s => s.call == null)

  return (
    <div className="flex flex-col gap-3">
      <ScrollRegion label={`${plateId} 96웰 격자(가로 스크롤)`} hint="옆으로 밀어 나머지 열 보기 →" className="-mx-1.5 px-1.5 pb-1.5 pt-1">
        <div
          role="group"
          aria-label={
            multiMode
              ? `${plateId} 96웰 플레이트. 여러 웰 선택 모드 — 화살표 키로 웰 이동, Enter로 선택·해제`
              : `${plateId} 96웰 플레이트. 화살표 키로 웰 이동, Enter로 상세, Shift+Enter로 다중 선택`
          }
          className={cn('grid items-center gap-[3px] sm:gap-1', touchWells ? 'min-w-[600px] max-w-[760px]' : 'min-w-[360px] max-w-[640px]')}
          style={{ gridTemplateColumns: `1.5rem repeat(12, minmax(${touchWells ? 44 : 24}px, 1fr))` }}
        >
          <span aria-hidden="true" />
          {COLS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => onToggleWells(colBarcodes(c))}
              title={`${c}열 시료 웰 모두 선택`}
              className="touch-hit-y relative rounded-sm py-0.5 text-center text-[11px] font-semibold tabular-nums text-muted hover:bg-surface-2 hover:text-text"
            >
              {c}
              <span className="sr-only">열 시료 웰 모두 선택</span>
            </button>
          ))}
          {ROWS.map(r => (
            <RowCells
              key={r}
              r={r}
              byWell={byWell}
              info={info}
              view={view}
              detail={detail}
              selected={selected}
              highlight={highlight}
              focus={focus}
              setFocus={setFocus}
              refs={refs}
              move={move}
              onWellClick={onWellClick}
              onRowHeader={() => onToggleWells(rowBarcodes(r))}
            />
          ))}
        </div>
      </ScrollRegion>
      {/* 범례 */}
      {view === 'status' ? (
        <ul aria-label="웰 상태 범례" className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[11px] text-muted">
          {LEGEND_ORDER.map(k => {
            const st = WELL_STYLE[k]
            const present = k === 'pos' || k === 'ntc' || samples.some(s => wellKind(s) === k)
            return (
              <li key={k} className={`inline-flex items-center gap-1.5 ${present ? 'text-text' : 'text-muted'}`}>
                <span aria-hidden="true" className={`inline-flex h-5 w-5 items-center justify-center rounded-full border-2 text-[11px] font-bold leading-none tracking-tighter ${st.cls}`}>
                  {st.symbol}
                </span>
                {info.def.platform === 'GBS' && st.gbsLabel ? st.gbsLabel : st.label}
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted">
          <span className="font-medium text-text">콜레이트(call rate)</span>
          {CALL_BINS.map(b => (
            <span key={b.label} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-4 w-4 rounded-full border border-border" style={{ background: b.bg }} />
              {b.label}
            </span>
          ))}
          <span>× = QC 실패(폐기·대체 포함) · 재분석 요청 웰은 × 없음 · 회색 = 판독 전</span>
          {info.def.platform === 'KASP' && <span className="basis-full">{KASP_CALL_NOTE}</span>}
          {fewCalls && <span className="font-medium text-warning">이 플레이트는 아직 판독값이 없습니다(결과·QC 단계 플레이트만 표시)</span>}
        </div>
      )}
    </div>
  )


}

function RowCells({
  r,
  byWell,
  info,
  view,
  detail,
  selected,
  highlight,
  focus,
  setFocus,
  refs,
  move,
  onWellClick,
  onRowHeader,
}: {
  r: string
  byWell: Map<string, Sample>
  info: PlateInfo
  view: GridView
  detail: string | null
  selected: Set<string>
  highlight: Set<string>
  focus: number
  setFocus: (n: number) => void
  refs: MutableRefObject<(HTMLButtonElement | null)[]>
  move: (e: KeyboardEvent, i: number) => void
  onWellClick: (s: Sample, multi: boolean) => void
  onRowHeader: () => void
}) {
  const ri = ROWS.indexOf(r as (typeof ROWS)[number])
  return (
    <>
      <button
        type="button"
        onClick={onRowHeader}
        title={`${r}행 시료 웰 모두 선택`}
        className="sticky left-0 z-[1] h-full rounded-sm bg-surface text-center text-[11px] font-semibold text-muted hover:bg-surface-2 hover:text-text"
      >
        {r}
        <span className="sr-only">행 시료 웰 모두 선택</span>
      </button>
      {COLS.map(c => {
        const well = `${r}${String(c).padStart(2, '0')}`
        const i = ri * 12 + c - 1
        const s = byWell.get(well)
        const control = CONTROL_WELLS[well]
        const tab = focus === i ? 0 : -1
        const common = {
          ref: (el: HTMLButtonElement | null) => {
            refs.current[i] = el
          },
          tabIndex: tab,
          onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => move(e, i),
          onFocus: () => setFocus(i),
        }
        if (!s) {
          const st = WELL_STYLE[well === 'H11' ? 'pos' : 'ntc']
          return (
            <button
              key={well}
              type="button"
              {...common}
              aria-disabled="true"
              title={`${well} · ${control} — 대조 웰은 선택할 수 없습니다`}
              className={`flex aspect-square w-full cursor-not-allowed items-center justify-center rounded-full border-2 text-[11px] font-bold leading-none ${st.cls}`}
            >
              <span aria-hidden="true">{st.symbol}</span>
              <span className="sr-only">{`${well} ${control ?? ''} — 대조 웰은 선택할 수 없습니다`}</span>
            </button>
          )
        }
        const kind = wellKind(s)
        const st = WELL_STYLE[kind]
        const tip = wellTooltip(s, info)
        const isDetail = detail === s.barcode
        const isSel = selected.has(s.barcode)
        const isHi = highlight.has(s.barcode)
        const fail = kind === 'failRun' || kind === 'failWait' || kind === 'reseq' || kind === 'substitute' || kind === 'expFail'
        const callStyle = view === 'call' && s.call != null ? callBin(s.call) : null
        const onClick = (e: MouseEvent) => onWellClick(s, e.shiftKey || e.ctrlKey || e.metaKey)
        return (
          <button
            key={well}
            type="button"
            {...common}
            onClick={onClick}
            onKeyDown={e => {
              if ((e.key === 'Enter' || e.key === ' ') && e.shiftKey) {
                e.preventDefault()
                onWellClick(s, true)
                return
              }
              move(e, i)
            }}
            aria-pressed={isSel}
            aria-current={isDetail ? 'true' : undefined}
            title={tip}
            className={cn(
              'relative flex aspect-square w-full items-center justify-center rounded-full border-2 text-[11px] font-bold leading-none tracking-tighter',
              callStyle ? 'border-border' : st.cls,
              view === 'call' && s.call == null && 'bg-surface-2 border-border',
              // 데이터 위 선택 표시(강조색 아님): 상세에 연 웰 = 글자색 바깥 윤곽 + 표면색 틈(후광), 다중 선택 = select-ring(안쪽 글자색 테두리) + 체크 배지,
              // 검색·재분석 묶음 강조 = 점선 윤곽. outline은 box-shadow(select-ring)와 겹쳐도 지워지지 않는다
              isSel && 'select-ring',
              isDetail ? 'outline outline-[3px] outline-offset-2 outline-text' : isHi && 'outline-2 outline-offset-1 outline-dashed outline-text',
            )}
            style={callStyle ? { background: callStyle.bg, color: callStyle.fg } : undefined}
          >
            <span aria-hidden="true" className={st.symbol === '×' || (view === 'call' && fail) ? 'text-sm font-black sm:text-base' : ''}>
              {view === 'call' ? (fail ? '×' : '') : st.symbol}
            </span>
            <span className="sr-only">{tip}</span>
            {isSel && (
              <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-text text-surface ring-2 ring-surface">
                <Check size={10} strokeWidth={3.5} />
              </span>
            )}
          </button>
        )
      })}
    </>
  )
}
