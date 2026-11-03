import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Badge, Card } from '@/design-system'
import { formatFixed, formatSigned } from '@/lib/format'
import {
  N,
  TRAITS,
  fmtInt,
  computeResponse,
  f2,
  f3,
  fmtP,
  fmtPct,
  fmtResp,
  interpretPair,
  intensity,
  pairOf,
  stars,
  type Criterion,
} from '../data'

function Row({ k, children, hint }: { k: ReactNode; children: ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-border py-1.5 text-[13px]">
      <dt className="text-muted" title={hint}>
        {k}
      </dt>
      <dd className="text-right tabular-nums text-text">{children}</dd>
    </div>
  )
}

/** rP 분해 막대: 유전 기여 + 환경 기여 = rP (0 기준 양방향) */
function DecompBar({ gen, env, rp }: { gen: number; env: number; rp: number }) {
  const D = 0.5 // ±0.5 축
  const pct = (v: number) => (Math.max(-D, Math.min(D, v)) / D) * 50
  // 같은 부호면 이어 붙이고, 다른 부호면 각자 0에서 시작
  const segs: { v: number; start: number; cls: string; label: string }[] = []
  const gStart = 0
  const eStart = Math.sign(gen) === Math.sign(env) ? gen : 0
  segs.push({ v: gen, start: gStart, cls: 'bg-accent', label: '유전' })
  segs.push({ v: env, start: eStart, cls: 'bg-muted/60', label: '환경' })
  return (
    <div>
      <div className="relative h-5 rounded-sm bg-surface-2" aria-hidden="true">
        {segs.map(s => {
          const a = pct(s.start)
          const b = pct(s.start + s.v)
          const left = 50 + Math.min(a, b)
          const width = Math.abs(b - a)
          return <div key={s.label} className={`absolute top-1 h-3 rounded-[2px] ${s.cls}`} style={{ left: `${left}%`, width: `${width}%` }} />
        })}
        <div className="absolute inset-y-0 left-1/2 w-px bg-text" />
        <div className="absolute -bottom-0.5 h-1.5 w-0.5 bg-text" style={{ left: `${50 + pct(rp)}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted" aria-hidden="true">
        <span>{f2(-D)}</span>
        <span>0</span>
        <span>{f2(D)}</span>
      </div>
      <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-text tabular-nums">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-[2px] bg-accent" aria-hidden="true" />
          유전 기여 {f3(gen)}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-[2px] bg-muted/60" aria-hidden="true" />
          환경 기여 {f3(env)}
        </span>
        <span>= rP {f3(rp)}</span>
      </p>
    </div>
  )
}

interface Props {
  pair: [number, number]
  p: number
  className?: string
}

/** 선택 쌍 상세: rG·rP·rE, 분해, GEBV 간 상관, 해석 문장, 양방향 상관 반응 */
export function PairDetail({ pair, p, className }: Props) {
  const q = pairOf(pair[0], pair[1])
  const x = TRAITS[q.a]!
  const y = TRAITS[q.b]!
  const sentences = interpretPair(q)
  const i = intensity(p)
  const both: [number, number][] = [
    [q.a, q.b],
    [q.b, q.a],
  ]
  const signDiff = Math.sign(q.rg) !== Math.sign(q.rp) && Math.abs(q.rg) >= 0.05 && Math.abs(q.rp) >= 0.05

  return (
    <Card
      className={className}
      title={`쌍 상세 · ${x.short}–${y.short}`}
      subtitle="행렬 셀(상·하삼각 어느 쪽이든)을 누르면 바뀝니다"
      actions={signDiff ? <Badge tone="warning">rG·rP 부호 다름</Badge> : q.pg < 0.05 ? <Badge tone="info">rG 유의</Badge> : <Badge tone="neutral">rG 비유의</Badge>}
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-border bg-surface-2 px-3 py-2">
          <p className="text-[11px] text-muted">유전 상관 rG</p>
          <p className="text-[28px] font-bold leading-tight tabular-nums text-text">
            {f2(q.rg)}
            <span className="text-base">{stars(q.pg)}</span>
          </p>
          <p className="text-xs tabular-nums text-muted">± {f2(q.se)} · {fmtP(q.pg)}</p>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <p className="text-[11px] text-muted">표현형 상관 rP</p>
          <p className="text-[28px] font-bold leading-tight tabular-nums text-text">
            {f2(q.rp)}
            <span className="text-base">{stars(q.pp)}</span>
          </p>
          <p className="text-xs tabular-nums text-muted">{fmtP(q.pp)} · n = {fmtInt(N)}</p>
        </div>
      </div>

      <dl className="mt-3">
        <Row k="rG 95% 신뢰구간" hint="rG ± 1.96·SE, SE는 Robertson(1959) 근사">
          {f2(q.rgLo)}~{f2(q.rgHi)}
        </Row>
        <Row k="rP 95% 신뢰구간" hint="Fisher z 변환">
          {f2(q.rpLo)}~{f2(q.rpHi)}
        </Row>
        <Row k="환경(잔차) 상관 rE" hint="rE = (rP − hx·hy·rG) / (ex·ey)">
          {f2(q.re)}
        </Row>
        <Row k="GEBV 간 상관" hint={`${fmtInt(N)}계통 교차 검증 GEBV의 Pearson 상관 — rG와 다른 양`}>
          {f2(q.rgebv)}
        </Row>
      </dl>

      <div className="mt-3">
        <p className="mb-1 text-xs font-medium text-text">rP 분해 (유전 기여 hx·hy·rG + 환경 기여 ex·ey·rE)</p>
        <DecompBar gen={q.gen} env={q.env} rp={q.rp} />
      </div>

      <div className="mt-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-text" aria-live="polite">
        {sentences.map((s, k) => (
          <p key={k} className={s.startsWith('유전 상관과 표현형 상관의 부호') ? 'mt-1 font-medium text-warning' : undefined}>
            {s}
          </p>
        ))}
      </div>

      <div className="mt-3">
        <p className="mb-1 text-xs font-medium text-text">
          양방향 상관 반응 (선발 비율 {fmtPct(p)}, i {formatFixed(i, 3)}, 세대당 기대값)
        </p>
        <ul className="flex flex-col gap-1">
          {both.map(([s, t]) => {
            const R = computeResponse(`single:${TRAITS[s]!.key}` as Criterion, p).resp[t]!
            return (
              <li key={`${s}-${t}`} className="flex flex-wrap items-center gap-x-1.5 text-[13px] tabular-nums text-text">
                <span className="text-muted">{TRAITS[s]!.singleLabel} 선발</span>
                <ArrowRight size={13} className="text-muted" aria-hidden="true" />
                <span>
                  {TRAITS[t]!.short} <b>{fmtResp(t, R)}</b>
                </span>
                <span className="text-muted">({formatSigned(R / TRAITS[t]!.sigmaA, 2)} σA)</span>
              </li>
            )
          })}
        </ul>
      </div>
    </Card>
  )
}
