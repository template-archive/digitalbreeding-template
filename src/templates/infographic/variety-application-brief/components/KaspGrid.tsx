import { Fragment, type CSSProperties } from 'react'
import { u } from '@/design-system'
import { KASP, KASP_COLUMNS, KASP_DISTINCT_MIN, KASP_KIND, KASP_MARKERS, LINE, gt, isIdMarker, markerDiff, parentage } from '../data'
import { DIFF_CELL_BG, V_COLOR } from './style'

const FUNC = KASP_MARKERS.filter(m => !isIdMarker(m))
const IDS = KASP_MARKERS.filter(isIdMarker)
const others = KASP_COLUMNS.slice(1)
const ROW = 18.5
const OWN_SIDE: CSSProperties = { borderLeft: `${u(2)} solid ${V_COLOR}`, borderRight: `${u(2)} solid ${V_COLOR}` }

/**
 * KASP 16마커 × 4열 유전형 격자. 셀 = "AA"/"BB" 문자, YR19-0118 열은 강조 테두리,
 * YR19-0118과 다른 셀은 사선 + "≠" 표식(색 외 표식). 기능/ID 마커는 왼쪽 세로 머리글로 묶는다.
 */
export function KaspGrid() {
  const diffs = others.map(c => ({ ...c, n: markerDiff(c.id).length }))
  return (
    <div className="flex h-full flex-col" style={{ gap: u(6) }}>
      <table className="w-full border-collapse" style={{ tableLayout: 'fixed', fontSize: u(15) }}>
        <caption className="sr-only">
          KASP 16마커 유전형. {LINE.id}과 다른 마커 수 {diffs.map(d => `${d.name} ${d.n}개`).join(', ')}
        </caption>
        <colgroup>
          <col style={{ width: u(22) }} />
          <col style={{ width: u(54) }} />
          <col />
          {/* 출원 계통 열 106 · 비교 열 68 · 「종류」 열은 나머지(2026-11-03 조정, 이전 90 · 72).
              90일 때 "YR19-0118"(15 굵게, 가운데 정렬)의 여유가 0px이라 리눅스(CI)에서 약 8px 넓게 그려져 강조 테두리 양옆으로 4px씩 넘쳤다.
              출원 계통 열만 넓히면 「종류」 칸의 "천립중 증가형"이 잘리므로 비교 열에서 4씩 가져왔다.
              최소 배율(390·768) 기준 여유: YR19-0118 양옆 5.9px · 온새미로 5.7px · 「종류」 칸 5px. */}
          {KASP_COLUMNS.map((c, ci) => (
            <col key={c.id} style={{ width: u(ci === 0 ? 106 : 68) }} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-text/60" style={{ borderBottomWidth: u(1.5) }}>
            <th scope="col">
              <span className="sr-only">묶음</span>
            </th>
            <th scope="col" className="text-left align-bottom font-bold text-muted" style={{ paddingBottom: u(3), fontSize: u(15) }}>
              마커
            </th>
            <th scope="col" className="text-left align-bottom font-bold text-muted" style={{ paddingBottom: u(3), fontSize: u(15) }}>
              종류
            </th>
            {KASP_COLUMNS.map((c, ci) => (
              <th
                scope="col"
                key={c.id}
                className="text-center align-bottom"
                style={{
                  paddingBottom: u(3),
                  lineHeight: 1.15,
                  ...(ci === 0 ? { ...OWN_SIDE, borderTop: `${u(2)} solid ${V_COLOR}`, paddingTop: u(2) } : {}),
                }}
              >
                <span className="block font-extrabold whitespace-nowrap" style={{ color: ci === 0 ? V_COLOR : 'var(--color-text)', fontSize: u(15) }}>
                  {c.name}
                </span>
                <span className="block font-medium text-muted" style={{ fontSize: u(15) }}>
                  {c.role}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[FUNC, IDS].map((group, gi) =>
            group.map((m, k) => {
              const i = KASP_MARKERS.indexOf(m)
              const own = KASP[LINE.id]![i]!
              const sep = k === 0 && gi > 0
              return (
                <tr key={m} className={sep ? 'border-t border-text/50' : 'border-t border-border/60'} style={{ height: u(ROW), lineHeight: 1 }}>
                  {k === 0 && (
                    <th
                      scope="rowgroup"
                      rowSpan={group.length}
                      className="font-bold text-muted"
                      style={{ writingMode: 'vertical-rl', textOrientation: 'upright', fontSize: u(15), letterSpacing: '0.04em', textAlign: 'center' }}
                    >
                      {gi === 0 ? '기능 마커 ' : 'ID '}
                      {/* 두 자리 수는 세로줄에서 한 칸에 가로로 묶는다 */}
                      <span style={{ textCombineUpright: 'all' }}>{group.length}</span>
                    </th>
                  )}
                  <th scope="row" className={`text-left font-bold text-text ${isIdMarker(m) ? '' : 'italic'}`} style={{ padding: 0 }}>
                    {m}
                  </th>
                  <td className="truncate text-muted" style={{ fontSize: u(15), padding: 0 }}>
                    {KASP_KIND[m]}
                  </td>
                  {KASP_COLUMNS.map((c, ci) => {
                    const v = KASP[c.id]![i]!
                    const diff = ci > 0 && v !== own
                    return (
                      <td
                        key={c.id}
                        className={`text-center tabular-nums ${v === 2 ? 'font-extrabold text-text' : 'text-muted'}`}
                        style={{
                          padding: 0,
                          background: diff ? DIFF_CELL_BG : undefined,
                          ...(ci === 0
                            ? { ...OWN_SIDE, color: v === 2 ? V_COLOR : undefined, background: 'color-mix(in oklab, var(--color-accent) 7%, transparent)', ...(gi === 1 && k === group.length - 1 ? { borderBottom: `${u(2)} solid ${V_COLOR}` } : {}) }
                            : {}),
                        }}
                      >
                        {gt(v)}
                        {diff && (
                          <>
                            <span aria-hidden className="font-bold text-warning" style={{ fontSize: u(15), marginLeft: u(2) }}>
                              ≠
                            </span>
                            <span className="sr-only">({LINE.id}와 다름)</span>
                          </>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            }),
          )}
        </tbody>
      </table>
      <div className="text-text" style={{ fontSize: u(15), lineHeight: 1.3 }}>
        <p>
          <b>차이 마커</b>:{' '}
          {diffs.map((d, i) => (
            <Fragment key={d.id}>
              {i > 0 && ' · '}
              {d.name} <b style={{ color: V_COLOR }}>{d.n}</b>
            </Fragment>
          ))}{' '}
          ({KASP_DISTINCT_MIN}개 이상 = 마커로 식별 · 식별 참고, 구별성 판정은 형질)
        </p>
        <p>
          <b>친자 일치</b> {parentage.match}/{parentage.total}(모본형 {parentage.fromFemale.length} · 부본형 {parentage.fromMale.length})
          <span className="text-muted"> · 사선 + ≠ = {LINE.id}와 다른 셀</span>
        </p>
      </div>
    </div>
  )
}
