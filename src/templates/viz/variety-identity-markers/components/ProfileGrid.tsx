/**
 * C. KASP 16마커 프로필 격자(HTML 표, 첫 열 sticky).
 * 셀 = "AA"/"BB" 문자 + 모양(기능 BB = 강조색 채움, ID BB = 잉크 외곽선 + 옅은 중립, AA = 중립 면. 기능·ID는 색상이 아니라 채움·외곽선으로 가른다). 선택한 쌍의 두 행은 중립 표시(행 머리 select-ring +
 * 잉크 A/B 표지 + 옅은 회색 바탕 — 강조색은 기능 BB 데이터 색 하나로만 남긴다), 두 행에서 유전형이 다른 열에는 테두리와 "≠" 기호를 둔다(색만 쓰지 않는다).
 * 가로로 넘치면(768·390) 공통 ScrollRegion 안내·페이드를 보이고, 선택 쌍이 갈리는 열이 화면 밖이면 그 열이 보이게 처음 위치를 옮긴다.
 */
import { useEffect, useRef } from 'react'
import { Badge, ScrollRegion, cn } from '@/design-system'
import {
  KASP_KIND,
  MARKERS,
  MARKER_INFO,
  N_FUNC,
  N_ID,
  PROFILES,
  ROLE_LABEL,
  diffIdx,
  isIdMarker,
  label,
  type Profile,
  type Role,
} from '../data'

export const ROLE_TONE: Record<Role, 'info' | 'warning' | 'positive' | 'neutral'> = { cand: 'info', filed: 'warning', reg: 'positive', check: 'neutral' }

interface Props {
  a: number
  b: number
  idOnly: boolean
  narrow: boolean
  onRowHeader: (idx: number) => void
}

/** 역할 그룹의 첫 행(구분선) */
const groupStart = (p: Profile) => p.idx > 0 && PROFILES[p.idx - 1]!.role !== p.role

/**
 * 선택 쌍이 갈리는 열(≠)이 고정 첫 열 오른쪽 보이는 범위 밖이면 그 열들이 보이게 가로 위치를 옮긴다.
 * 다른 열이 한 화면에 다 들어가지 않으면 가장 오른쪽 열(보통 ID 마커)을 보인다.
 */
function revealDiffColumns(el: HTMLDivElement | null) {
  if (!el || el.scrollWidth <= el.clientWidth + 1) return
  const ths = [...el.querySelectorAll<HTMLElement>('thead th[data-diff="true"]')]
  if (ths.length === 0) return
  const base = el.getBoundingClientRect().left - el.scrollLeft
  const stickyW = el.querySelector<HTMLElement>('thead th')?.getBoundingClientRect().width ?? 0
  const first = ths[0]!.getBoundingClientRect().left - base
  const lastR = ths[ths.length - 1]!.getBoundingClientRect().right - base
  const visL = el.scrollLeft + stickyW
  const visR = el.scrollLeft + el.clientWidth
  if (first >= visL && lastR <= visR) return
  const pad = 8
  const fits = lastR - first <= el.clientWidth - stickyW - pad * 2
  const target = fits && first < visL ? first - stickyW - pad : lastR - el.clientWidth + pad
  el.scrollTo({ left: Math.max(0, Math.min(el.scrollWidth - el.clientWidth, target)) })
}

export function ProfileGrid({ a, b, idOnly, narrow, onRowHeader }: Props) {
  const diff = new Set(diffIdx(PROFILES[a]!.geno, PROFILES[b]!.geno))
  const selected = (idx: number) => idx === a || idx === b
  const scrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    revealDiffColumns(scrollRef.current)
  }, [a, b, narrow])

  return (
    <ScrollRegion label="KASP 마커 프로필 격자(가로 스크롤)" hint="옆으로 밀어 다른 마커 보기 →" scrollRef={scrollRef}>
     <div className="w-max min-w-full rounded-md border border-border">
      <table className="w-full border-separate border-spacing-0 text-[12px] tabular-nums">
        <caption className="sr-only">
          10품종·계통 × KASP 16마커 유전형. 선택 쌍 {label(PROFILES[a]!)} ↔ {label(PROFILES[b]!)}, 다른 마커 {diff.size}개(
          {[...diff].map(i => MARKERS[i]).join('·') || '없음'}).
        </caption>
        <thead>
          <tr>
            <th scope="col" rowSpan={2} className="sticky left-0 z-20 min-w-[120px] border-b border-r border-border bg-surface px-2 py-1.5 text-left align-bottom text-xs font-semibold text-muted sm:min-w-[208px]">
              품종·계통
            </th>
            <th scope="colgroup" colSpan={N_FUNC} className={cn('border-b border-border bg-surface-2 px-2 py-1 text-center text-xs font-semibold text-text', idOnly && 'text-muted')}>
              기능 마커 {N_FUNC}
            </th>
            <th scope="colgroup" colSpan={N_ID} className="border-b border-l-2 border-border border-l-text/40 bg-surface-2 px-2 py-1 text-center text-xs font-semibold text-text">
              ID 마커 {N_ID}
            </th>
          </tr>
          <tr>
            {MARKERS.map((m, k) => {
              const info = MARKER_INFO[k]!
              const dim = info.mono || (idOnly && !isIdMarker(m))
              const isDiff = diff.has(k)
              return (
                <th
                  key={m}
                  scope="col"
                  data-marker={m}
                  data-diff={isDiff ? 'true' : undefined}
                  className={cn(
                    'min-w-[44px] border-b border-border px-0.5 py-1 text-center align-bottom font-semibold',
                    k === N_FUNC && 'border-l-2 border-l-text/40',
                    dim ? 'text-muted' : 'text-text',
                    // 다른 마커 열은 주의가 아니라 표시이므로 중립 회색 + ≠ 기호
                    isDiff && 'bg-active',
                  )}
                >
                  <span className="block whitespace-nowrap text-[12px]">{m}</span>
                  <span className="block whitespace-nowrap text-[11px] font-normal text-muted">
                    {info.mono ? '단형' : KASP_KIND[m].replace('(중립)', '')}
                  </span>
                  {isDiff && (
                    <span className="block text-[11px] font-bold text-text" aria-label="선택 쌍에서 다름">
                      ≠
                    </span>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {PROFILES.map(p => {
            const sel = selected(p.idx)
            const top = groupStart(p) ? 'border-t-2 border-t-text/30' : ''
            return (
              <tr key={p.id} data-profile={p.id} aria-selected={sel || undefined}>
                <th
                  scope="row"
                  className={cn(
                    'sticky left-0 z-10 border-b border-r border-border px-0 py-0 text-left font-normal [--badge-base:var(--color-surface)]',
                    sel ? 'select-ring bg-[color-mix(in_oklab,var(--color-text)_6%,var(--color-surface))]' : 'bg-surface',
                    top,
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onRowHeader(p.idx)}
                    className="flex w-full flex-col items-start gap-0.5 px-2 py-1.5 text-left hover:bg-surface-2/60"
                    title={`${p.name} · ${p.id} · ${p.status} · ${p.source} — 누르면 이 품종을 A로, 최근접 품종을 B로 선택`}
                  >
                    <span className="flex flex-wrap items-center gap-1">
                      {sel && (
                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm bg-text px-0.5 text-[11px] font-bold leading-none text-surface" aria-hidden="true">
                          {p.idx === a ? 'A' : 'B'}
                        </span>
                      )}
                      <span className="text-[13px] font-semibold text-text">{narrow ? label(p) : p.name}</span>
                      <Badge tone={ROLE_TONE[p.role]}>{ROLE_LABEL[p.role]}</Badge>
                    </span>
                    {!narrow && (
                      <>
                        <span className="text-[11px] text-muted">
                          {p.id} · {p.status}
                        </span>
                        <span className="text-[11px] leading-tight text-muted">{p.source}</span>
                      </>
                    )}
                  </button>
                </th>
                {p.geno.map((v, k) => {
                  const m = MARKERS[k]!
                  const id = isIdMarker(m)
                  const isDiff = sel && diff.has(k)
                  const dim = idOnly && !id
                  return (
                    <td
                      key={m}
                      className={cn('border-b border-border p-0.5 text-center', k === N_FUNC && 'border-l-2 border-l-text/40', sel && 'bg-[color-mix(in_oklab,var(--color-text)_4%,var(--color-surface))]', top)}
                      title={`${p.name} · ${m}(${KASP_KIND[m]}) · ${v === 2 ? 'BB' : 'AA'} — ${v === 2 ? (id ? '대체 대립유전자' : '효과 대립유전자') : id ? '기준 대립유전자(IRGSP-1.0)' : '비효과 대립유전자'}`}
                    >
                      <span
                        className={cn(
                          'relative flex h-7 items-center justify-center rounded-sm text-[11px] font-semibold',
                          v === 2 && !id && 'bg-accent text-accent-contrast',
                          v === 2 && id && 'border border-text/55 bg-[color-mix(in_oklab,var(--color-text)_7%,var(--color-surface))] text-text',
                          v === 0 && 'bg-surface-2 text-muted',
                          dim && 'opacity-35',
                          isDiff && 'outline outline-2 outline-offset-1 outline-text',
                        )}
                      >
                        {v === 2 ? 'BB' : 'AA'}
                        {isDiff && (
                          <span className="absolute -right-0.5 -top-1.5 rounded-full bg-surface px-0.5 text-[11px] font-bold leading-none text-text" aria-label="다름">
                            ≠
                          </span>
                        )}
                      </span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="sticky left-0 z-10 border-r border-border bg-surface-2 px-2 py-1.5 text-left text-xs font-semibold text-text">
              마커 정보량
              <span className="block text-[11px] font-normal text-muted">구별 쌍 수(nBB × nAA)</span>
            </th>
            {MARKER_INFO.map((info, k) => (
              <td key={info.marker} className={cn('bg-surface-2 px-0.5 py-1.5 text-center text-[12px]', k === N_FUNC && 'border-l-2 border-l-text/40', info.mono ? 'text-muted' : 'font-semibold text-text')}>
                {info.mono ? (
                  <>
                    0<span className="block text-[11px] font-normal">단형</span>
                  </>
                ) : (
                  info.pairs
                )}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
     </div>
    </ScrollRegion>
  )
}
