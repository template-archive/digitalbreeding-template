import { u } from '@/design-system'
import { formatFixed, formatSigned } from '@/lib/format'
import {
  DISTINCT_ROWS,
  DUS,
  DUS_REF,
  LINE,
  UNIFORMITY,
  allowedOffTypes,
  dusDiffs,
  dusDirection,
  isDistinct,
  isStable,
  uniformByYear,
  type DusRow,
} from '../data'
import { V_COLOR } from './style'
import { ToneMark } from './ToneMark'

const pair = (r: DusRow, k: 'y' | 'c') => {
  const v = r[k]
  if (r.kind === 'measured') return `${formatFixed(v[0] as number, r.digits!)} / ${formatFixed(v[1] as number, r.digits!)}`
  return v[0] === v[1] ? String(v[0]) : `${v[0]} / ${v[1]}`
}
const diffText = (r: DusRow) => {
  const d = dusDiffs(r)
  if (!d) return r.y[0] === r.c[0] && r.y[1] === r.c[1] ? '같음' : '다름'
  return `${formatSigned(d[0], r.digits!)} / ${formatSigned(d[1], r.digits!)}`
}
/** 안정성 문장의 "출수 −7 / −7일" 같은 구별 형질 요약 */
export const distinctSummary = DISTINCT_ROWS.map(r => `${r.label.replace(/\(.*\)/, '')} ${diffText(r)}${r.unit === '일' ? '일' : ` ${r.unit}`}`).join(', ')

export function DusPanel() {
  const cols = `minmax(0, 1fr) ${u(38)} ${u(90)} ${u(90)} ${u(78)} ${u(42)} ${u(160)}`
  const ucols = `${u(64)} ${u(130)} 1fr ${u(150)} ${u(70)}`
  return (
    <div className="flex h-full flex-col" style={{ gap: u(8) }}>
      <div role="table" aria-label={`구별성 예비 조사: 대조 품종 ${DUS_REF.name}와 명확한 차이 ${DISTINCT_ROWS.length}형질(${DISTINCT_ROWS.map(r => r.label).join('·')})`}>
        <div role="row" className="grid items-end border-b border-text/60 font-bold text-muted" style={{ gridTemplateColumns: cols, gap: u(6), fontSize: u(15), paddingBottom: u(4), borderBottomWidth: u(1.5), lineHeight: 1.2 }}>
          <span role="columnheader">형질(단위)</span>
          <span role="columnheader" className="text-right">
            UPOV
          </span>
          <span role="columnheader" className="text-right" style={{ color: V_COLOR }}>
            {LINE.id}
            <br />
            <span className="font-medium text-muted">2025 / 2026</span>
          </span>
          <span role="columnheader" className="text-right">
            {DUS_REF.name}
            <br />
            <span className="font-medium">2025 / 2026</span>
          </span>
          <span role="columnheader" className="text-right">
            차
          </span>
          <span role="columnheader" className="text-right">
            LSD
            <br />
            (1%)
          </span>
          <span role="columnheader">판정</span>
        </div>
        {DUS.map(r => {
          const dist = isDistinct(r)
          const dir = dusDirection(r)
          return (
            <div
              role="row"
              key={r.label}
              className={`grid items-center border-b border-border tabular-nums ${dist ? 'bg-accent/5 font-bold' : ''}`}
              style={{ gridTemplateColumns: cols, gap: u(6), minHeight: u(25), fontSize: u(15), lineHeight: 1.2 }}
            >
              <span role="cell" className="text-text">
                {r.label}
                {r.unit && <span className="font-medium text-muted">{r.label.endsWith(')') ? ` ${r.unit}` : `(${r.unit})`}</span>}
              </span>
              <span role="cell" className="text-right text-muted">
                {r.upov ?? '—'}
              </span>
              <span role="cell" className="text-right whitespace-nowrap" style={{ color: dist ? V_COLOR : undefined }}>
                {pair(r, 'y')}
              </span>
              <span role="cell" className="text-right whitespace-nowrap text-text">
                {pair(r, 'c')}
              </span>
              <span role="cell" className="text-right whitespace-nowrap text-text">
                {diffText(r)}
              </span>
              <span role="cell" className="text-right text-muted">
                {r.lsd1 != null ? formatFixed(r.lsd1, 1) : '—'}
              </span>
              <span role="cell" className={`whitespace-nowrap ${dist ? 'text-text' : 'text-muted'}`}>
                {dist ? (
                  <>
                    <span aria-hidden style={{ color: V_COLOR }}>
                      ●{' '}
                    </span>
                    명확한 차이{dir ? `(${dir})` : ''}
                  </>
                ) : (
                  '차이 없음'
                )}
              </span>
            </div>
          )
        })}
        <p className="text-muted" style={{ fontSize: u(15), marginTop: u(5), lineHeight: 1.3 }}>
          ● 명확한 차이 = 2년 모두 |차| &gt; LSD(1%), 같은 방향(UPOV 2×1% 기준) · 천립중은 정조 기준
        </p>
      </div>

      <div>
        <h3 className="font-extrabold text-text" style={{ fontSize: u(16), marginBottom: u(2) }}>
          균일성 · 안정성{' '}
          <span className="font-medium text-muted" style={{ fontSize: u(15) }}>
            · UPOV TG/16/9, 계통 품종(모집단 기준 {formatFixed(UNIFORMITY.popStd * 100, 1)}%, 수용 확률 ≥ {Math.round(UNIFORMITY.acceptProb * 100)}%)
          </span>
        </h3>
        <div role="table" aria-label={`균일성: ${uniformByYear.map(r => `${r.year}년 이형주 ${r.off}주`).join(', ')}, 허용 ${allowedOffTypes}주`}>
          <div role="row" className="grid border-b border-text/60 font-bold text-muted" style={{ gridTemplateColumns: ucols, gap: u(8), fontSize: u(15), paddingBottom: u(3), borderBottomWidth: u(1.5) }}>
            <span role="columnheader">연도</span>
            <span role="columnheader" className="text-right">
              조사 주 수
            </span>
            <span role="columnheader" className="text-right">
              이형주
            </span>
            <span role="columnheader" className="text-right">
              허용({formatFixed(UNIFORMITY.popStd * 100, 1)}%, ≥ {Math.round(UNIFORMITY.acceptProb * 100)}%)
            </span>
            <span role="columnheader">판정</span>
          </div>
          {uniformByYear.map(r => (
            <div role="row" key={r.year} className="grid items-center border-b border-border tabular-nums" style={{ gridTemplateColumns: ucols, gap: u(8), height: u(24), fontSize: u(15) }}>
              <span role="cell" className="font-bold text-text">
                {r.year}
              </span>
              <span role="cell" className="text-right text-text">
                {UNIFORMITY.plantsPerYear}주
              </span>
              <span role="cell" className="text-right text-text">
                <b style={{ color: V_COLOR }}>{r.off}주</b>
                {r.note && <span className="text-muted">({r.note})</span>}
              </span>
              <span role="cell" className="text-right text-text">
                {allowedOffTypes}주 이하
              </span>
              <span role="cell" className={`font-bold ${r.ok ? 'text-positive' : 'text-negative'}`}>
                <ToneMark tone={r.ok ? 'positive' : 'negative'} />
                {r.ok ? '균일' : '불균일'}
              </span>
            </div>
          ))}
        </div>
        <p className="text-text" style={{ fontSize: u(15), marginTop: u(4), lineHeight: 1.3 }}>
          <b className={isStable ? 'text-positive' : 'text-negative'}>
            <ToneMark tone={isStable ? 'positive' : 'negative'} />
            {isStable ? '안정(2년 재현)' : '재현 안 됨'}
          </b> — 구별 형질 {DISTINCT_ROWS.length}개가 2년 모두 같은 방향·크기({distinctSummary}) · 2년 모두 균일
        </p>
      </div>
    </div>
  )
}
