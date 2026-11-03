import type { ReactNode } from 'react'
import { Card, KinBadge } from '@/design-system'
import {
  GROUP_LABEL,
  H_E,
  LINES,
  PAIR_BY_KEY,
  fmt2,
  fmt3,
  fmt4,
  fmtDelta,
  fmtGebv,
  fmtHet,
  pairKey,
  relDescription,
  type Line,
} from '../data'
import type { Cell } from './KinshipHeatmap'

function LineBlock({ c, role }: { c: Line; role: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-surface-2 px-3 py-2">
      <p className="text-[11px] text-muted">{role}</p>
      <p className="truncate text-[15px] font-semibold text-text">{c.name}</p>
      <p className="text-xs text-muted">
        {GROUP_LABEL[c.group]} · 가계 {c.family}
      </p>
      <p className="mt-1 text-xs tabular-nums text-text">
        GEBV <b>{fmtGebv(c.gebv)}</b> <span className="text-muted">kg/10a · r² {fmt2(c.rel)}</span>
      </p>
    </div>
  )
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-border py-1.5 text-[13px]">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right tabular-nums text-text">{children}</dd>
    </div>
  )
}

/** 선택 셀 상세: 두 계통, G·f·근연 등급, 계보 기대값과 차이. 대각이면 1 + F */
export function PairDetail({ cell, className }: { cell: Cell; className?: string }) {
  const P = LINES[cell.row]!
  const Q = LINES[cell.col]!

  if (P.idx === Q.idx) {
    return (
      <Card className={className} title="셀 상세 · 대각(자기 관계)" subtitle="대각 원소는 1 + F라 색 척도에서 뺀다">
        <LineBlock c={P} role="계통" />
        <div className="mt-4 flex items-end gap-2">
          <span className="text-[40px] font-bold leading-none tabular-nums text-text">{fmt2(1 + P.F)}</span>
          <span className="pb-1 text-sm text-muted">G = 1 + F</span>
        </div>
        <dl className="mt-3">
          <Row k="G = 1 + F(소수 3자리)">{fmt3(1 + P.F)}</Row>
          <Row k="근교계수(F)">{fmt3(P.F)}</Row>
          <Row k="잔여 이형접합도 H_o">{fmtHet(P.het)}</Row>
          <Row k="기준 이형접합도 H_e(추정)">{fmt2(H_E)}</Row>
        </dl>
        <p className="mt-3 text-xs text-muted">F = 1 − H_o / H_e. F₆ 이상 고정 근교계라 F ≈ 1, 대각 ≈ 2다.</p>
      </Card>
    )
  }

  const pair = PAIR_BY_KEY.get(pairKey(P.idx, Q.idx))!
  const both01 = P.family === 'F01' && Q.family === 'F01'
  return (
    <Card className={className} title="셀 상세" subtitle="히트맵 셀이나 표 행을 고르면 바뀐다. (P, Q)와 (Q, P)는 같은 쌍">
      <div className="grid grid-cols-2 gap-2">
        <LineBlock c={P} role="행 계통 P" />
        <LineBlock c={Q} role="열 계통 Q" />
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-2">
        <div>
          <p className="text-xs text-muted">관계 계수 G(2f 척도)</p>
          <p className="text-[40px] font-bold leading-none tabular-nums text-text">{fmt2(pair.G)}</p>
        </div>
        <div className="pb-0.5">
          <p className="text-xs text-muted">공조계수 f = G/2</p>
          <p className="text-2xl font-semibold leading-tight tabular-nums text-text">{fmt2(pair.f)}</p>
        </div>
        <KinBadge level={pair.level} className="mb-1" />
      </div>
      <dl className="mt-3">
        <Row k="관계 유형">{relDescription(P, Q)}</Row>
        <Row k="계보 기대 f_ped">{pair.fPed === null ? <span aria-label="계보상 공통 조상 미기록">—</span> : fmt4(pair.fPed)}</Row>
        <Row k="유전체 − 계보 Δ">{pair.delta === null ? <span aria-label="계보 비교 불가">—</span> : fmtDelta(pair.delta)}</Row>
        <Row k="교배 시 F1 근교계수">{fmt2(pair.f)}</Row>
        <Row k="자손 유전 분산 비율 1 − f">
          {fmt2(1 - pair.f)} <span className="text-muted">(무한소 모형)</span>
        </Row>
      </dl>
      <p className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">
        교배 조합 설계 화면의 공조계수 <b className="text-text">{fmt2(pair.f)}</b>
        {both01 && pair.fPed !== null ? (
          <>
            , 계통도 탐색기의 계보 공조계수 <b className="text-text">{fmt4(pair.fPed)}</b>
          </>
        ) : null}
        와 같은 쌍입니다.
        {pair.delta !== null && Math.abs(pair.delta) >= 0.005
          ? ' Δ는 멘델 표본 추출(실현 관계가 기대값 주변에 흩어짐)과 GRM 기준 집단·계보 기초 세대 차이에서 생긴다.'
          : ''}
      </p>
    </Card>
  )
}
