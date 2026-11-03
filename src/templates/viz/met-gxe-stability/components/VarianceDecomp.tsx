import { ChevronDown } from 'lucide-react'
import { ScrollRegion } from '@/design-system'
import { formatFixed, formatNumber } from '@/lib/format'
import { ANOVA, CV, GE_OVER_G, RANDOM_ENV_TESTS, VAR_PCT, VAR_SUB_PCT, type AnovaRow } from '../data'

const f1 = (v: number) => formatFixed(v, 1)

/** p 표기: < 0.001, 0.01 미만은 3자리, 그 외 2자리 */
export function formatP(p: number): string {
  if (p < 0.001) return '< 0.001'
  return formatFixed(p, p < 0.01 ? 3 : 2)
}

/** 각주용 p 문구: "p < 0.001" / "p = 0.42" */
const pText = (p: number) => (p < 0.001 ? 'p < 0.001' : `p = ${formatP(p)}`)

const SEGMENTS = [
  { key: 'G', label: '유전자형(G)', value: VAR_PCT.G, bg: 'var(--color-accent)', fg: 'var(--color-accent-contrast)' },
  { key: 'E', label: '환경(E)', value: VAR_PCT.E, bg: 'color-mix(in oklab, var(--color-text-muted) 28%, var(--color-surface))', fg: 'var(--color-text)' },
  { key: 'GE', label: 'GxE', value: VAR_PCT.GE, bg: 'var(--color-warning)', fg: 'var(--color-surface)' },
] as const

/** 반올림 표시값의 합(한 번만 반올림) */
const ROUNDED_SUM = SEGMENTS.reduce((s, x) => s + Math.round(x.value * 10), 0) / 10

export function VarianceDecomp() {
  return (
    <div className="flex flex-col gap-3">
      <div
        role="img"
        aria-label={`수량 변동(SS_G + SS_E + SS_GE)의 ${f1(VAR_PCT.E)}%가 환경, ${f1(VAR_PCT.GE)}%가 유전자형×환경 상호작용, ${f1(VAR_PCT.G)}%가 유전자형. GxE가 G의 ${f1(GE_OVER_G)}배`}
        className="flex h-11 w-full overflow-hidden rounded-md border border-border"
      >
        {SEGMENTS.map(s => (
          <div
            key={s.key}
            className="flex items-center justify-center overflow-hidden whitespace-nowrap px-1 text-[13px] font-semibold tabular-nums"
            style={{ width: `${s.value}%`, background: s.bg, color: s.fg }}
          >
            {s.value >= 15 ? `${s.label} ${f1(s.value)}%` : f1(s.value)}
          </div>
        ))}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-xs">
        {SEGMENTS.map(s => (
          <div key={s.key} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-muted">
              <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: s.bg, boxShadow: 'inset 0 0 0 1px var(--color-border)' }} />
              {s.label}
            </dt>
            <dd className="pl-4 text-[15px] font-semibold tabular-nums text-text">{f1(s.value)}%</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs leading-relaxed text-muted">
        환경 = 지역 {f1(VAR_SUB_PCT.L)} + 연도 {f1(VAR_SUB_PCT.Y)} + L×Y {f1(VAR_SUB_PCT.LY)} · GxE = G×L <b className="text-text">{f1(VAR_SUB_PCT.GL)}</b> + G×Y{' '}
        {f1(VAR_SUB_PCT.GY)} + G×L×Y {f1(VAR_SUB_PCT.GLY)}. 해마다 반복되는 지역 상호작용(G×L)이 GxE의 대부분이라 메가 환경별 추천이 의미 있습니다.
      </p>
      <p className="text-xs text-muted">
        결합 분산분석(시험구 기준) SS 비율 · 반올림으로 합 {f1(ROUNDED_SUM)} · CV {f1(CV)}%
      </p>
      <details className="group rounded-md border border-border">
        <summary className="touch-hit-y flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[13px] font-medium text-text hover:bg-surface-2">
          분산분석 표 보기
          <ChevronDown size={14} aria-hidden className="text-muted transition-transform group-open:rotate-180" />
        </summary>
        <ScrollRegion label="분산분석 표(가로 스크롤)" hint="옆으로 밀어 나머지 열 보기 →" wrapperClassName="border-t border-border">
          <AnovaTable />
        </ScrollRegion>
        <p className="border-t border-border px-3 py-2 text-xs leading-relaxed text-muted">
          환경을 임의 효과로 보면 {RANDOM_ENV_TESTS.map(t => `${t.key}는 ${t.denomLabel} 대비 F ${f1(t.F)}(${pText(t.p)})`).join(', ')} — 결론 같음
        </p>
      </details>
    </div>
  )
}

function AnovaTable() {
  const cell = 'px-2.5 py-1.5 text-right tabular-nums'
  return (
    <table className="w-full min-w-[460px] text-xs">
      <caption className="sr-only">결합 분산분석 표(시험구 기준, F는 오차 평균제곱 대비)</caption>
      {/* 표 머리: 채운 띠 없음, 12px 회색, 머리 아래 선이 표 안에서 가장 진함(DataTable과 같은 모양) */}
      <thead className="text-muted">
        <tr className="border-b border-text/25">
          <th scope="col" className="px-2.5 py-1.5 text-left font-medium">요인</th>
          <th scope="col" className={`${cell} font-medium`}>자유도</th>
          <th scope="col" className={`${cell} font-medium`}>SS</th>
          <th scope="col" className={`${cell} font-medium`}>MS</th>
          <th scope="col" className={`${cell} font-medium`}>F(오차 대비)</th>
          <th scope="col" className={`${cell} font-medium`}>p</th>
        </tr>
      </thead>
      <tbody>
        {ANOVA.map((r: AnovaRow) => (
          <tr key={r.key} className="border-b border-border/70 last:border-b-0">
            <th scope="row" className={`px-2.5 py-1.5 text-left font-normal ${r.sub ? 'pl-6 text-muted' : 'font-medium text-text'}`}>
              {r.sub ? '┗ ' : ''}
              {r.label}
            </th>
            <td className={cell}>{r.df}</td>
            <td className={cell}>{formatNumber(r.ss, { digits: 1 })}</td>
            <td className={cell}>{formatNumber(r.ms, { digits: 2 })}</td>
            <td className={cell}>{r.F === null ? '' : formatFixed(r.F, 1)}</td>
            <td className={cell}>{r.p === null ? '' : formatP(r.p)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
