import { useChartTheme } from '@/charts'
import { SequentialScaleLegend } from '@/design-system'

/** 히트맵 범례: r² 연속 순차 척도 + 단형 빗금 + 블록·리드 표기 */
export function R2Legend() {
  const t = useChartTheme()
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
      <SequentialScaleLegend
        layout="inline"
        title="r²"
        ariaLabel="색 범례: r² 0(옅음)에서 1(진함)까지 연속 순차 척도"
        ticks={[
          { value: 0, label: '0' },
          { value: 1, label: '1' },
        ]}
        missing={<>집단 내 MAF &lt; 0.05(계산 안 함)</>}
      />
      <span className="inline-flex items-center gap-1.5">
        <svg width="16" height="10" aria-hidden="true">
          <polygon points="1,1 15,1 8,9" fill="none" stroke={t.text} strokeWidth="1.5" />
        </svg>
        LD 블록
      </span>
      <span className="inline-flex items-center gap-1.5">
        <svg width="16" height="10" aria-hidden="true">
          <polygon points="1,1 15,1 8,9" fill="none" stroke={t.accent} strokeWidth="2" />
        </svg>
        리드 블록
      </span>
      <span className="inline-flex items-center gap-1.5">
        <svg width="12" height="10" aria-hidden="true">
          <polygon points="0,0 12,0 6,10" fill={t.accent} />
        </svg>
        리드 SNP
      </span>
      <span className="inline-flex items-center gap-1.5">
        <svg width="10" height="9" aria-hidden="true">
          <polygon points="1,1 9,1 5,8" fill={t.surface} stroke={t.text} strokeWidth="1.3" />
        </svg>
        같은 창의 다른 리드
      </span>
    </div>
  )
}
