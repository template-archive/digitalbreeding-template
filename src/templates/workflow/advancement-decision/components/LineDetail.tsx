import { useEffect, useId, useRef, type ReactNode } from 'react'
import { AlertTriangle, Layers, NotebookPen, RotateCcw, Sprout } from 'lucide-react'
import { Button, DivergingBar } from '@/design-system'
import { formatNumber } from '@/lib/format'
import {
  CONTRIB_DOMAIN,
  GEBV_MODEL,
  GEBV_RESCUE,
  GERM_RESULT,
  HIGH,
  INDEX_KEYS,
  INDEX_LABEL,
  LIMITS,
  PLOT_MEMOS,
  PLOT_TRAIT_LABEL,
  QUICK_PHRASES,
  REASON_MAX,
  REASON_MIN,
  REC_LABEL,
  SEED_MET_G,
  SEED_MET_MIN_HOLD,
  STD,
  TRAIT_LABEL,
  WEIGHTS,
  Y_HOLD,
  Y_PROMOTE,
  dayToDate,
  differs,
  repShort,
  type Decision,
  type DecisionState,
  type Line,
  type Trait,
} from '../data'
import { DecisionSegmented, RecBadge, basisSentence, f1, f2, fGebv, limitText, recParen, recShort, traitText } from './ui'

export interface DetailHandlers {
  onDecision: (d: Decision) => void
  onRevertToRec: () => void
  onReason: (text: string) => void
}

type Verdict = 'pass' | 'border' | 'fail' | 'info'
const VERDICT: Record<Verdict, { text: string; cls: string }> = {
  pass: { text: '통과', cls: 'text-positive' },
  border: { text: '경계(통과)', cls: 'text-warning' },
  fail: { text: '위반', cls: 'text-negative font-bold' },
  info: { text: '—', cls: 'text-muted' },
}

/** G. 계통 상세·결정 입력 */
export function LineDetail({ l, st, dirty, error, h, titleId }: { l: Line; st: DecisionState | null; dirty: boolean; error: boolean; h: DetailHandlers; titleId?: string }) {
  const uid = useId()
  const reasonId = `${uid}-reason`
  const errId = `${uid}-err`
  const countId = `${uid}-count`
  const plotsText = l.plots.map(String).join(' · ')
  const diff = st ? differs(l, st) : false
  const errRef = useRef<HTMLParagraphElement>(null)
  // 저장에서 걸리면 오류 문구가 보이도록(390px 시트 안 포함)
  useEffect(() => {
    if (error) errRef.current?.scrollIntoView({ block: 'nearest' })
  }, [error])

  const traitVerdict = (t: Trait): Verdict => (l.viol.includes(t) ? 'fail' : l.border.includes(t) ? 'border' : 'pass')
  const idxVerdict: { text: string; cls: string } =
    l.d.idx >= Y_PROMOTE ? { text: '진급 기준', cls: 'text-positive' } : l.d.idx >= Y_HOLD ? { text: '보류 구간', cls: 'text-warning' } : { text: '미달', cls: 'text-negative font-bold' }

  const yieldReps = l.yieldPlots.map(p => {
    if (p.status === 'ok') return { key: p.no, text: f1(p.value!), excluded: false }
    if (p.status === 'outlier') return { key: p.no, text: `구 ${p.no} ${f1(p.value!)} 제외(범위 이상치)`, excluded: true }
    return { key: p.no, text: `구 ${p.no} 결측(${PLOT_MEMOS[p.no]?.includes('분실') ? '시료 분실' : '수확 불가'})`, excluded: true }
  })

  const rows: { label: string; value: ReactNode; limit: string; std: string; high: string; verdict: { text: string; cls: string } }[] = [
    {
      label: '쌀 수량(kg/10a)',
      value: (
        <span className="flex flex-col">
          <b>{f1(l.d.yield)}</b>
          <span className="whitespace-normal text-[11px] text-muted">
            {yieldReps.map((y, i) => (
              <span key={y.key} className={y.excluded ? 'text-warning' : undefined}>
                {i ? ' · ' : ''}
                {y.text}
              </span>
            ))}
          </span>
        </span>
      ),
      limit: '—',
      std: f1(STD.d.yield),
      high: f1(HIGH.d.yield),
      verdict: VERDICT.info,
    },
    { label: '대비 지수', value: <b>{f1(l.d.idx)}</b>, limit: `≥ ${f1(Y_PROMOTE)} 진급`, std: f1(STD.d.idx), high: f1(HIGH.d.idx), verdict: l.check ? VERDICT.info : idxVerdict },
    {
      label: '출수기(일)',
      value: (
        <span>
          <b>{l.d.heading}</b> <span className="text-[11px] text-muted">({dayToDate(l.d.heading)})</span>
        </span>
      ),
      limit: `≤ ${limitText('heading')}`,
      std: String(STD.d.heading),
      high: String(HIGH.d.heading),
      verdict: l.check ? VERDICT.info : VERDICT[traitVerdict('heading')],
    },
    { label: '간장(cm)', value: <b>{traitText(l, 'culm')}</b>, limit: `≤ ${limitText('culm')}`, std: String(STD.d.culm), high: String(HIGH.d.culm), verdict: l.check ? VERDICT.info : VERDICT[traitVerdict('culm')] },
    {
      label: '잎도열병',
      value: (
        <span>
          <b>{traitText(l, 'blast')}</b> <span className="text-[11px] text-muted">({l.blastScores.join('·')})</span>
        </span>
      ),
      limit: `≤ ${limitText('blast')}`,
      std: f1(STD.d.blast),
      high: f1(HIGH.d.blast),
      verdict: l.check ? VERDICT.info : VERDICT[traitVerdict('blast')],
    },
    { label: '밥맛(식미치)', value: <b>{traitText(l, 'taste')}</b>, limit: `≥ ${limitText('taste')}`, std: f1(STD.d.taste), high: f1(HIGH.d.taste), verdict: l.check ? VERDICT.info : VERDICT[traitVerdict('taste')] },
  ]

  const rs = repShort(l)
  const domain = CONTRIB_DOMAIN

  return (
    <div className="flex flex-col gap-4">
      {/* ① 머리 */}
      <header className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={titleId} className="text-lg font-bold text-text">
            {l.name}
          </h3>
          <RecBadge rec={l.rec} suffix={l.rec ? ' 권고' : ''} />
          {!l.check && <span className="text-xs tabular-nums text-muted">진급 지수 {l.rank}위</span>}
        </div>
        <p className="text-xs tabular-nums text-muted">
          처리 {l.no} · 구 {plotsText}
        </p>
        <p className={`text-[13px] font-medium ${l.rec === 'drop' ? 'text-negative' : 'text-text'}`}>{basisSentence(l)}</p>
      </header>

      {/* ② 형질 표 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px] tabular-nums">
          <caption className="sr-only">{l.name} 형질별 값과 한계·대비 품종 비교</caption>
          <thead>
            <tr className="border-b border-text/25 text-left text-xs text-muted">
              <th scope="col" className="py-1 pr-2 font-medium">형질</th>
              <th scope="col" className="py-1 pr-2 text-right font-medium">값</th>
              <th scope="col" className="py-1 pr-2 text-right font-medium">한계</th>
              <th scope="col" className="py-1 pr-2 text-right font-medium">가람솔</th>
              <th scope="col" className="py-1 pr-2 text-right font-medium">온새미로</th>
              <th scope="col" className="py-1 text-right font-medium">판정</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label} className="border-b border-border/70 align-top last:border-b-0">
                <th scope="row" className="whitespace-nowrap py-1.5 pr-2 text-left font-normal text-muted">
                  {r.label}
                </th>
                <td className="py-1.5 pr-2 text-right text-text">{r.value}</td>
                <td className="whitespace-nowrap py-1.5 pr-2 text-right text-muted">{r.limit}</td>
                <td className="py-1.5 pr-2 text-right text-muted">{r.std}</td>
                <td className="py-1.5 pr-2 text-right text-muted">{r.high}</td>
                <td className={`whitespace-nowrap py-1.5 text-right text-xs ${r.verdict.cls}`}>{r.verdict.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ③ 다형질 프로필 */}
      {!l.check && (
        <section aria-labelledby={`${uid}-prof`}>
          <h4 id={`${uid}-prof`} className="mb-1.5 flex items-baseline justify-between text-xs font-semibold text-text">
            진급 지수 기여(w · z, 바람직한 방향 +)
            <span className="tabular-nums">합계 {f2(l.index)}</span>
          </h4>
          <div className="flex flex-col gap-1.5">
            {INDEX_KEYS.map(k => (
              <DivergingBar
                key={k}
                value={l.contrib[k]}
                domain={domain}
                label={<span className="text-xs">{INDEX_LABEL[k]}</span>}
                valueText={`${f2(l.contrib[k])} (z ${f2(l.z[k])} × ${f2(WEIGHTS[k])})`}
                negativeTag={<span className="text-[11px] text-muted">불리</span>}
              />
            ))}
          </div>
        </section>
      )}

      {/* ④ GEBV */}
      <section aria-labelledby={`${uid}-gebv`} className="rounded-md border border-border bg-surface-2 p-3 text-[13px]">
        <h4 id={`${uid}-gebv`} className="mb-1 text-xs font-semibold text-muted">
          수량 GEBV(유전체 추정 육종가)
        </h4>
        <p className="tabular-nums text-text">
          <b className="text-base">{fGebv(l.gebv)}</b> kg/10a · r² {f2(l.rel)}
          {!l.check && (
            <>
              {' '}
              · 부모 선발 컷오프 {fGebv(GEBV_RESCUE)} 대비 <b>{fGebv(l.gebv - GEBV_RESCUE)}</b>
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-muted">
          {l.check
            ? `${GEBV_MODEL.when} 재추정 · 표현형 포함`
            : `${GEBV_MODEL.when} ${GEBV_MODEL.method} · 2026 AYT 표현형 미포함(${GEBV_MODEL.retrain} 재학습 반영)${l.shared ? ' · GEBV 기반 선발 화면과 같은 값' : ''}`}
        </p>
      </section>

      {/* ⑤ 플래그·메모 */}
      {!l.check && (
        <section aria-labelledby={`${uid}-flag`} className="flex flex-col gap-1.5 text-[13px]">
          <h4 id={`${uid}-flag`} className="text-xs font-semibold text-text">
            플래그·메모
          </h4>
          {rs.length > 0 && (
            <p className="flex items-start gap-1.5 text-text">
              <Layers size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
              반복 부족: {rs.map(t => `${PLOT_TRAIT_LABEL[t]} ${l.n[t]}반복`).join(', ')}(정상 관측 구만 평균)
            </p>
          )}
          <p className="flex items-start gap-1.5 text-text">
            <Sprout size={14} aria-hidden="true" className={`mt-0.5 shrink-0 ${l.seedWarn ? 'text-warning' : 'text-muted'}`} />
            <span className="tabular-nums">
              {l.seedWarn && <b className="mr-1">종자 주의</b>}
              AYT 로트 재고 {formatNumber(Math.round(l.stock))} g · MET 출고 {formatNumber(SEED_MET_G)} g 후 {formatNumber(Math.round(l.stockAfter))} g
              {l.seedWarn ? `(최소 보유량 ${formatNumber(SEED_MET_MIN_HOLD)} g 미달)` : ''} · 발아 판정 {GERM_RESULT.slice(5)} 예정
            </span>
          </p>
          {l.memos.map(m => (
            <p key={m.plot} className="flex items-start gap-1.5 text-text">
              <NotebookPen size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
              구 {m.plot}: {m.text}
            </p>
          ))}
          {l.border.length > 0 && (
            <p className="text-xs text-muted">
              한계 경계: {l.border.map(t => `${TRAIT_LABEL[t]} ${traitText(l, t, true)} = 한계`).join(' · ')}(통과)
            </p>
          )}
        </section>
      )}

      {/* ⑥ 결정 입력 */}
      {!l.check && st && (
        <section aria-labelledby={`${uid}-dec`} className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 id={`${uid}-dec`} className="text-sm font-semibold text-text">
              결정{dirty && <span className="ml-1.5 text-xs font-semibold text-text">· 미저장</span>}
            </h4>
            <Button size="sm" variant="ghost" icon={<RotateCcw size={13} aria-hidden="true" />} onClick={h.onRevertToRec} disabled={st.decision === l.rec}>
              자동 판정으로 되돌리기
            </Button>
          </div>
          <DecisionSegmented value={st.decision} onChange={h.onDecision} ariaLabel={`${l.name} 결정`} rec={l.rec} />
          <label htmlFor={reasonId} className="mt-1 text-xs font-medium text-text">
            {diff ? (
              <>
                사유(필수 · 자동 판정과 다름)
                <span className="ml-1 font-normal text-muted">
                  — {recParen(l)} → {REC_LABEL[st.decision!]}
                </span>
              </>
            ) : (
              '메모(선택)'
            )}
          </label>
          <textarea
            id={reasonId}
            data-field="reason"
            value={st.reason}
            maxLength={REASON_MAX}
            rows={3}
            onChange={e => h.onReason(e.target.value)}
            aria-invalid={error || undefined}
            aria-describedby={`${countId}${error ? ` ${errId}` : ''}`}
            placeholder={diff ? `기준과 다르게 정한 근거를 ${REASON_MIN}자 이상 입력하세요` : '심사회의에 남길 메모'}
            className={`w-full resize-y rounded-md border bg-surface px-2.5 py-2 text-[13px] leading-relaxed text-text placeholder:text-muted ${error ? 'border-negative ring-1 ring-negative' : 'border-border'}`}
          />
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap gap-1.5 touch:gap-2" role="group" aria-label="빠른 문구">
              {QUICK_PHRASES.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => h.onReason(appendPhrase(st.reason, p))}
                  className="touch-hit inline-flex h-7 items-center rounded-full border border-border bg-surface px-2.5 text-xs text-text hover:bg-surface-2"
                >
                  + {p}
                </button>
              ))}
            </div>
            <span id={countId} className="shrink-0 text-[11px] tabular-nums text-muted">
              {st.reason.length} / {REASON_MAX}자
            </span>
          </div>
          {error && (
            <p ref={errRef} id={errId} className="flex items-start gap-1.5 text-[13px] font-medium text-negative">
              <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
              자동 판정({recShort(l)})과 다른 결정({REC_LABEL[st.decision!]})입니다. 사유를 {REASON_MIN}자 이상 입력하세요.
            </p>
          )}
        </section>
      )}
      {l.check && (
        <p className="text-xs text-muted">
          대비 품종은 진급 결정 대상이 아닙니다. 지수 기준(가람솔 = 100)과 다수성 비교(온새미로 {f1(HIGH.d.idx)})에 씁니다. 한계 기준 출수기 {LIMITS.heading}일은 가람솔 {STD.d.heading}일 기준입니다.
        </p>
      )}
    </div>
  )
}

function appendPhrase(text: string, p: string): string {
  const t = text.trimEnd()
  const out = t ? `${t}${/[.。·,]$/.test(t) ? ' ' : '. '}${p}` : p
  return out.slice(0, REASON_MAX)
}
