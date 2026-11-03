import { Card } from '@/design-system'
import { formatNumber } from '@/lib/format'
import { CATS, CAT_LABEL, MIN_HOLD, STD_OUT, toGrains, type Use } from '../data'
import { UseBadge } from './ui'

/** 용도별 표준 출고량·최소 보유량(내부 기준, 추정) — 요청량을 판단할 때 옆에 두는 참고표 */
export function StandardsCard() {
  const crossGrains = Math.round(toGrains(STD_OUT.cross, STD_OUT.refTgw) / 10) * 10
  const rows: { use: Use; qty: string; note: string }[] = [
    {
      use: '교배',
      qty: `${STD_OUT.cross} g/계통`,
      note: `약 ${formatNumber(crossGrains)}립 — 교배포·온실 3회 분할 파종분`,
    },
    {
      use: 'MET 파종',
      qty: `${formatNumber(STD_OUT.met.total)} g/계통`,
      note: `${STD_OUT.met.sites}개 지역 × ${STD_OUT.met.reps}반복 × ${STD_OUT.met.perPlot} g + 육묘 여유`,
    },
    {
      use: 'AYT 파종',
      qty: `${STD_OUT.ayt.total} g/계통`,
      note: `${STD_OUT.ayt.reps}반복 × ${STD_OUT.ayt.perPlot} g`,
    },
    {
      use: '외부 분양',
      qty: `${STD_OUT.external.min}~${STD_OUT.external.max} g`,
      note: '요청량, MTA 체결 필요 · 출원 전 계통 불가',
    },
    {
      use: '유전체 분석 시료',
      qty: `${STD_OUT.dnaGrains}립`,
      note: '발아 불합격 로트도 허용(주의)',
    },
  ]
  return (
    <Card title="용도별 표준 출고량 · 최소 보유량" subtitle="이 프로그램의 내부 기준(추정)" padding="md">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ul className="flex flex-col gap-1.5 text-xs">
          {rows.map(r => (
            <li key={r.use} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <UseBadge use={r.use} />
              <b className="tabular-nums text-text">{r.qty}</b>
              <span className="text-muted">{r.note}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-1 self-start">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {CATS.map(c => (
              <div key={c} className="flex justify-between gap-2 border-b border-border py-1">
                <dt className="text-muted">{CAT_LABEL[c]}</dt>
                <dd className="font-semibold tabular-nums text-text">{c === 'f1' ? `${MIN_HOLD[c]}립` : `${formatNumber(MIN_HOLD[c])} g`}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[11px] leading-snug text-muted">최소 보유량은 계통별 가용 재고 기준. 두 구분에 속한 계통(부모 후보 + AYT)은 큰 값을 쓴다.</p>
        </div>
      </div>
    </Card>
  )
}
