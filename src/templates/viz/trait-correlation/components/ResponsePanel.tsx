import { Badge, Card, Legend, Segmented, Select, type LegendItem } from '@/design-system'
import { useChartTheme } from '@/charts'
import { formatFixed, formatSigned } from '@/lib/format'
import {
  BASE_CRITERION,
  DG_PCT_MAX,
  HEADING_ALERT_DAYS,
  VERDICT_EPS,
  P_OPTIONS,
  PRESET_KEYS,
  PRESETS,
  TRAITS,
  annualYield,
  criterionLabel,
  explainResponse,
  fmtPct,
  fmtResp,
  intensity,
  unitSuffix,
  verdictOf,
  verdictTone,
  type Criterion,
  type Response,
} from '../data'

interface Props {
  order: number[]
  criterion: Criterion
  onCriterion: (c: Criterion) => void
  p: number
  onP: (p: number) => void
  cur: Response
  base: Response
  /** 단일 형질 선택지에 보이는 형질 */
  visible: number[]
}

const BAR_CLS = { positive: 'bg-positive', warning: 'bg-warning', neutral: 'bg-muted/55' } as const

/** F 상관 반응 막대(σA 단위) + G 해설 문장 */
export function ResponsePanel({ order, criterion, onCriterion, p, onP, cur, base, visible }: Props) {
  const isBase = criterion === BASE_CRITERION
  const i = intensity(p)
  const options = [
    ...PRESET_KEYS.map(k => ({ value: `idx:${k}` as Criterion, label: `지수 · ${PRESETS[k].label}` })),
    ...visible.map(t => ({ value: `single:${TRAITS[t]!.key}` as Criterion, label: criterionLabel(`single:${TRAITS[t]!.key}` as Criterion) })),
  ]
  const zs = order.flatMap(y => [cur.resp[y]! / TRAITS[y]!.sigmaA, isBase ? 0 : base.resp[y]! / TRAITS[y]!.sigmaA])
  const D = Math.max(1.25, Math.ceil(Math.max(...zs.map(Math.abs)) / 0.25) * 0.25)
  const ticks: number[] = []
  for (let t = -Math.floor(D / 0.5) * 0.5; t <= D + 1e-9; t += 0.5) ticks.push(Math.round(t * 100) / 100)
  const pos = (z: number) => 50 + (Math.max(-D, Math.min(D, z)) / D) * 50
  const yieldIdx = TRAITS.findIndex(t => t.key === 'yield')
  const annual = annualYield(cur.resp[yieldIdx]!)
  const sentence = explainResponse(criterion, cur.resp, base.resp)
  const theme = useChartTheme()
  // 막대 색 = 판정. 현재·기준은 채움·외곽선 모양으로 구분한다(견본 = 막대)
  const verdictLegend: LegendItem[] = [
    { label: '개선', color: 'var(--color-positive)' },
    { label: '손해·출수 주의', color: 'var(--color-warning)' },
    { label: '변화 미미·방향 없음', color: `color-mix(in srgb, ${theme.textMuted} 55%, transparent)` },
  ]

  return (
    <Card
      title="지수 가중치의 부수 효과 — 형질별 상관 반응"
      subtitle={`선택한 기준으로 상위 ${fmtPct(p)}를 선발할 때 한 세대 뒤 각 형질의 기대 변화(σA 단위 막대, 끝 글자는 원 단위). 행 순서 = 현재 행렬 순서`}
    >
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Select label="선발 기준" options={options} value={criterion} onChange={onCriterion} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted">선발 비율</span>
            <Segmented
              ariaLabel="선발 비율"
              size="sm"
              options={P_OPTIONS.map(v => ({ value: String(v), label: fmtPct(v) }))}
              value={String(p)}
              onChange={v => onP(Number(v))}
            />
            <span className="text-xs tabular-nums text-muted">i = {formatFixed(i, 3)}</span>
          </div>
        </div>
      
      {/* G 해설: 페이지 결론 띠는 머리 아래 한 곳이므로 여기는 일반 문단 */}
      <p className="mb-4 break-keep text-[14px] leading-relaxed text-text" aria-live="polite">
        {sentence}
      </p>

      {cur.weights && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted">지수 가중치</span>
          {cur.weights.map(w => (
            <span key={w.key} className="rounded-full border border-border bg-surface-2 px-2 py-0.5 tabular-nums text-text">
              {TRAITS.find(t => t.key === w.key)!.short} {fmtPct(w.w)}
            </span>
          ))}
          {cur.sdI !== null && <span className="tabular-nums text-muted">· σ_I {formatFixed(cur.sdI, 3)}</span>}
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="break-keep">막대 색(현재 {criterionLabel(criterion)})</span>
        <Legend items={verdictLegend} />
        {!isBase && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-5 rounded-[2px] border-[1.5px] border-muted" aria-hidden="true" />
            기준: 쌀 수량 증가(단일)
          </span>
        )}
        {annual.over && <Badge tone="warning">범위 초과(이론값) · 연 {formatFixed(annual.pct, 2)}% &gt; {formatFixed(DG_PCT_MAX, 1)}%</Badge>}
      </div>

      <ul className="flex flex-col" aria-label="형질별 기대 반응">
        {order.map(y => {
          const t = TRAITS[y]!
          const R = cur.resp[y]!
          const B = base.resp[y]!
          const v = verdictOf(y, R)
          const vb = verdictOf(y, B)
          const tone = verdictTone(v)
          const z = R / t.sigmaA
          const zb = B / t.sigmaA
          return (
            <li
              key={t.key}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-border py-2 md:grid-cols-[7.5rem_minmax(0,1fr)_15rem]"
            >
              <div className="text-[13px] font-medium text-text">
                {t.short}
                {t.key === 'blast' && <span className="block text-[11px] font-normal text-muted">발병 지수(낮을수록 저항)</span>}
              </div>
              <div className="col-span-2 row-start-2 md:col-span-1 md:row-start-auto" aria-hidden="true">
                <div className="relative h-7">
                  {ticks.map(tk => (
                    <div key={tk} className={`absolute inset-y-0 w-px ${tk === 0 ? 'bg-text' : 'bg-border'}`} style={{ left: `${pos(tk)}%` }} />
                  ))}
                  {!isBase && (
                    <div
                      className="absolute top-0.5 h-2.5 rounded-[2px] border-[1.5px] border-muted"
                      style={{ left: `${Math.min(pos(0), pos(zb))}%`, width: `${Math.abs(pos(zb) - pos(0))}%` }}
                    />
                  )}
                  <div
                    className={`absolute rounded-[2px] ${BAR_CLS[tone]} ${isBase ? 'top-1.5 h-4' : 'top-[14px] h-3.5'}`}
                    style={{ left: `${Math.min(pos(0), pos(z))}%`, width: `${Math.max(0.4, Math.abs(pos(z) - pos(0)))}%` }}
                  />
                </div>
              </div>
              <div className="text-right text-[13px] tabular-nums md:text-left">
                <div className="flex flex-wrap items-center justify-end gap-1.5 md:justify-start">
                  <b className="text-text">{fmtResp(y, R)}</b>
                  <span className="text-[11px] text-muted">({formatSigned(z, 2)} σA)</span>
                  <Badge tone={tone}>{v}</Badge>
                </div>
                {!isBase && (
                  <p className="text-[11px] text-muted">
                    기준 {formatSigned(B, t.dr)}
                    {unitSuffix(t.unit)} · {vb}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <div className="relative ml-0 mt-1 h-4 text-[11px] tabular-nums text-muted md:ml-[8.25rem] md:mr-[15.75rem]" aria-hidden="true">
        {ticks.map(tk => (
          <span key={tk} className="absolute -translate-x-1/2" style={{ left: `${pos(tk)}%` }}>
            {formatSigned(tk, 1)}
          </span>
        ))}
      </div>
      <p className="mt-1 text-center text-xs text-muted md:ml-[8.25rem] md:mr-[15.75rem]">기대 반응 (σA 단위, 세대당)</p>
      <p className="mt-3 text-xs text-muted">
        이론 기대값(무한 집단·정규 가정·1회 선발). R = i · r · rG · σA(단일), 지수는 표준화 GEBV 가중합의 상관 반응. 판정: 방향 있는 형질은 ±{formatFixed(VERDICT_EPS, 2)} σA 밖이면 개선·손해, 출수기는 ±
        {formatFixed(HEADING_ALERT_DAYS, 1)}일 이상이면 출수 주의. 후보 600계통의 실제 선발 결과(절단 분포·앵커 포함)는 GEBV 기반 선발 화면을 참고하세요 — 기준이 달라 숫자가 조금 다릅니다.
      </p>
    </Card>
  )
}
