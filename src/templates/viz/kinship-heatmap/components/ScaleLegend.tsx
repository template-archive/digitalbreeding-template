import { useChartTheme } from '@/charts'
import { SequentialScaleLegend, type ScaleMark, type ScaleTick } from '@/design-system'
import { GROUPS, GROUP_LABEL, GROUP_SIZE, SCALE_MAX } from '../data'

const TICKS: ScaleTick[] = [
  { value: 0, label: '≤ 0' },
  { value: 0.25, label: '0.25' },
  { value: 0.5, label: '0.50' },
  { value: 0.75, label: '0.75' },
  { value: 1.0, label: '1.00' },
  { value: 1.3, label: '1.3' },
]
const MARKS: ScaleMark[] = [
  { value: 0.5, label: '근연 주의(f 0.25)', labelSide: 'left' },
  { value: 0.75, label: '강한 근연(f 0.375)' },
]

/** 순차 색 척도 범례(관계 계수 G, 2f 척도) + 대각·선택·그룹 띠 표기 */
export function ScaleLegend({ showDiag }: { showDiag: boolean }) {
  const t = useChartTheme()
  return (
    <div className="flex flex-col gap-3 text-xs text-muted">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <SequentialScaleLegend
          title="관계 계수 G(2f 척도)"
          ariaLabel="색 범례: 관계 계수 G(2f 척도), 0 이하(음수 포함)에서 1.3. 0.50 근연 주의(f 0.25), 0.75 강한 근연(f 0.375)"
          colors={t.sequential}
          domain={[0, SCALE_MAX]}
          ticks={TICKS}
          marks={MARKS}
        />
        {/* 좁은 화면은 가로로 흘려 줄 수를 줄인다(히트맵이 첫 화면에 가깝게) */}
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 sm:flex-col" aria-label="히트맵 표기">
          <li className="flex items-center gap-2">
            {showDiag ? (
              <span className="inline-block size-3.5 shrink-0 border border-text bg-muted" aria-hidden="true" />
            ) : (
              <svg width="14" height="14" aria-hidden="true" className="shrink-0">
                <rect width="14" height="14" className="fill-surface-2" />
                <line x1="0" y1="14" x2="14" y2="0" className="stroke-muted" strokeWidth="1" />
              </svg>
            )}
            대각(1 + F) {showDiag ? '강조 표시' : '마스킹'} · 색 척도 제외
          </li>
          <li className="flex items-center gap-2">
            <span className="select-ring inline-block size-3.5 shrink-0 rounded-[2px]" aria-hidden="true" />
            선택 셀(대칭 위치 함께 표시)
          </li>
        </ul>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 sm:flex-col" aria-label="그룹 색 띠">
          {GROUPS.map((g, i) => (
            <li key={g} className="flex items-center gap-2">
              <span className="inline-block h-3.5 w-2 shrink-0 rounded-[2px]" style={{ background: t.categorical[i] }} aria-hidden="true" />
              <span>
                <b className="text-text">{g}</b> {GROUP_LABEL[g].slice(2)} {GROUP_SIZE[g]}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
