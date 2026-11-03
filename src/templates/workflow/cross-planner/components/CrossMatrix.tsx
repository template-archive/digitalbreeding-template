import { useRef, type KeyboardEvent } from 'react'
import { AlertTriangle, Check, CircleAlert, Star } from 'lucide-react'
import { ScrollRegion } from '@/design-system'
import { KIN_LEVEL_LABEL } from '@/lib/genomics'
import { fmt1, fmt2, fmtSigned1, type Candidate, type CrossPred } from '../data'

export type Metric = 'uc' | 'mu' | 'sigma' | 'f'
export const METRIC_LABEL: Record<Metric, { short: string; long: string; unit: string }> = {
  uc: { short: '유용성(UC)', long: '유용성 기준 UC', unit: 'kg/10a' },
  mu: { short: '자손 평균(μ)', long: '예측 자손 평균 μ', unit: 'kg/10a' },
  sigma: { short: '자손 SD(σ)', long: '예측 자손 유전 표준편차 σ', unit: 'kg/10a' },
  f: { short: '공조계수(f)', long: '공조계수(f)', unit: '' },
}

export const metricValue = (x: CrossPred, m: Metric) => (m === 'uc' ? x.uc : m === 'mu' ? x.mu : m === 'sigma' ? x.sigma : x.f)
export const metricText = (v: number, m: Metric) => (m === 'f' ? fmt2(v) : fmt1(v))

/** 7단계 순차 척도에서 단계(1~7) */
export function seqStep(v: number, min: number, max: number) {
  if (!(max > min)) return 4
  return Math.min(7, Math.max(1, 1 + Math.floor(((v - min) / (max - min)) * 7 - 1e-9)))
}

export const cellAria = (x: CrossPred) =>
  `${x.a.name} × ${x.b.name}, UC ${fmt1(x.uc)}, μ ${fmt1(x.mu)}, σ ${fmt1(x.sigma)}, f ${fmt2(x.f)}, ${x.level === 'ok' ? '정상' : KIN_LEVEL_LABEL[x.level]}`

interface Props {
  parents: Candidate[]
  pairs: Map<string, CrossPred>
  metric: Metric
  range: [number, number]
  recommended: Set<string>
  planned: Set<string>
  focusKey: string | null
  onFocus: (key: string) => void
}

/** 부모×부모 HTML 격자. 상삼각만 값, 화살표 키로 셀 이동 */
export function CrossMatrix({ parents, pairs, metric, range, recommended, planned, focusKey, onFocus }: Props) {
  const n = parents.length
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const keyAt = (r: number, c: number) => `${parents[r]!.name}|${parents[c]!.name}`

  const move = (e: KeyboardEvent, r: number, c: number) => {
    let nr = r
    let nc = c
    if (e.key === 'ArrowRight') nc = c + 1
    else if (e.key === 'ArrowLeft') nc = c - 1
    else if (e.key === 'ArrowDown') nr = r + 1
    else if (e.key === 'ArrowUp') nr = r - 1
    else if (e.key === 'Home') nc = r + 1
    else if (e.key === 'End') nc = n - 1
    else return
    e.preventDefault()
    if (nr < 0 || nc >= n || nc <= nr) return
    const k = keyAt(nr, nc)
    onFocus(k)
    refs.current.get(k)?.focus()
  }

  // 로빙 tabindex: 포커스 셀(없으면 첫 셀)만 탭 순서에 들어간다
  const tabKey = focusKey && pairs.has(focusKey) ? focusKey : n > 1 ? keyAt(0, 1) : null
  // 현재 셀의 행·열 머리를 회색 면으로 함께 표시해 담은 셀(체크 배지)과 첫눈에 구분한다(검토 C4)
  const [focusRow, focusCol] = focusKey ? (focusKey.split('|') as [string, string]) : [null, null]

  return (
    <ScrollRegion label="부모 조합 행렬(가로 스크롤)" hint="옆으로 밀어 나머지 부모 보기 →" className="pb-1">
      <table className="w-full border-separate border-spacing-1 tabular-nums" aria-label="부모 조합 행렬(상삼각)">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-[2] bg-surface">
              <span className="sr-only">행 부모 / 열 부모</span>
            </th>
            {parents.map(p => (
              <th key={p.name} scope="col" className={`min-w-[64px] rounded-sm px-0.5 pb-1 align-bottom text-[11px] font-semibold leading-tight text-muted ${p.name === focusCol ? 'bg-active' : ''}`}>
                <span className="block whitespace-nowrap text-text">{p.name}</span>
                <span className="block font-normal">{fmtSigned1(p.gebv)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parents.map((rp, r) => (
            <tr key={rp.name}>
              <th scope="row" className={`sticky left-0 z-[1] rounded-sm pr-2 text-left text-[11px] font-semibold leading-tight ${rp.name === focusRow ? 'bg-active' : 'bg-surface'}`}>
                <span className="block whitespace-nowrap text-text">{rp.name}</span>
                <span className="block font-normal text-muted">{fmtSigned1(rp.gebv)}</span>
              </th>
              {parents.map((cp, c) => {
                if (c === r)
                  return (
                    <td key={cp.name} className="h-14 rounded-md bg-surface-2 text-center text-sm text-muted" aria-label="자가 조합 없음">
                      —
                    </td>
                  )
                if (c < r) return <td key={cp.name} aria-hidden="true" />
                const k = keyAt(r, c)
                const x = pairs.get(k)!
                const v = metricValue(x, metric)
                const step = seqStep(v, range[0], range[1])
                const rec = recommended.has(k)
                const sel = planned.has(k)
                const foc = focusKey === k
                const border =
                  x.level === 'warn' ? 'border-[3px] border-solid border-negative' : x.level === 'caution' ? 'border-2 border-dashed border-warning' : 'border border-transparent'
                const textColor = step >= 5 ? 'var(--color-surface)' : 'var(--color-text)'
                // 현재 셀(상세 표시) = 데이터 위 선택 표시(글자색 테두리 + 표면색 후광, select-ring). 담은 조합은 모서리 체크 배지 하나
                return (
                  <td key={cp.name} className="p-0">
                    <button
                      ref={el => {
                        if (el) refs.current.set(k, el)
                        else refs.current.delete(k)
                      }}
                      type="button"
                      tabIndex={tabKey === k ? 0 : -1}
                      onClick={() => onFocus(k)}
                      onKeyDown={e => move(e, r, c)}
                      aria-pressed={foc}
                      title={cellAria(x)}
                      className={`relative flex h-14 w-full min-w-[64px] flex-col items-center justify-center rounded-md px-1 leading-none transition-shadow ${border} ${foc ? 'select-ring' : ''}`}
                      style={{ background: `var(--viz-seq-${step})`, color: textColor }}
                    >
                      {sel && (
                        <span className="absolute right-0.5 top-0.5 flex size-3.5 items-center justify-center rounded-full bg-text text-surface">
                          <Check size={10} strokeWidth={3} aria-hidden="true" />
                        </span>
                      )}
                      <span className="text-[19px] font-bold tracking-tight">{metricText(v, metric)}</span>
                      <span className="sr-only">
                        {`, ${cellAria(x)}${rec ? ", 추천" : ""}${sel ? ", 담음" : ""}`}
                      </span>
                      {x.level === 'warn' ? (
                        <span className="mt-1 inline-flex items-center gap-0.5 rounded-sm bg-surface px-1 py-px text-[11px] font-bold text-negative">
                          <AlertTriangle size={10} aria-hidden="true" />
                          근연
                        </span>
                      ) : x.level === 'caution' ? (
                        <span className="mt-1 inline-flex items-center gap-0.5 rounded-sm bg-surface px-1 py-px text-[11px] font-bold text-warning">
                          <CircleAlert size={10} aria-hidden="true" />
                          주의
                        </span>
                      ) : rec ? (
                        <span className="mt-1 inline-flex items-center gap-0.5 rounded-sm bg-surface px-1 py-px text-[11px] font-bold text-info">
                          <Star size={10} aria-hidden="true" />
                          추천
                        </span>
                      ) : null}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  )
}

/** 척도·기호 범례 */
export function MatrixLegend({ metric, range }: { metric: Metric; range: [number, number] }) {
  const m = METRIC_LABEL[metric]
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
      <div className="flex items-center gap-2">
        <span className="font-medium text-text">{m.long}</span>
        <span className="tabular-nums">{metricText(range[0], metric)}</span>
        <span className="flex h-3 w-28 overflow-hidden rounded-sm" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6, 7].map(s => (
            <span key={s} className="flex-1" style={{ background: `var(--viz-seq-${s})` }} />
          ))}
        </span>
        <span className="tabular-nums">{metricText(range[1], metric)}</span>
        <span>{m.unit}</span>
      </div>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block size-3.5 rounded-sm border-[3px] border-negative" aria-hidden="true" />
        <AlertTriangle size={12} aria-hidden="true" className="text-negative" />
        강한 근연 f ≥ 0.375(자손 분산이 작음)
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block size-3.5 rounded-sm border-2 border-dashed border-warning" aria-hidden="true" />
        근연 주의 0.25 ≤ f &lt; 0.375
      </span>
      <span className="inline-flex items-center gap-1">
        <Star size={12} aria-hidden="true" className="text-info" />
        추천(f &lt; 0.25 중 UC 상위 5)
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="flex size-3.5 items-center justify-center rounded-full bg-text text-surface" aria-hidden="true">
          <Check size={10} strokeWidth={3} />
        </span>
        담은 조합
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="select-ring inline-block size-4 rounded-sm bg-surface-2" aria-hidden="true" />
        상세에 표시 중인 셀(행·열 머리 회색)
      </span>
    </div>
  )
}
