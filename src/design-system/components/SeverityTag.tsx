import { Info } from 'lucide-react'
import { cn } from './cn'
import { SEV_BORDER, SEV_ICON, SEV_ICON_COLOR, SEV_LABEL, type KpiSeverity } from './severity'

export interface SeverityTagProps {
  /** ok = 달성(CheckCircle2·positive), warning = 주의(AlertTriangle·warning), critical = 경보(AlertOctagon·negative), info = 정보(Info·info) */
  severity: KpiSeverity | 'info'
  /** 문자 태그를 바꿀 때(예: ok에 '정상', '충족'). 기본 달성/주의/경보/정보 */
  label?: string
  className?: string
}

/**
 * 심각도 문자 태그(아이콘 + 문자, 테두리만 의미색). KpiTile 심각도 태그와 같은 규격이고, 템플릿이 표·불릿·카드에
 * 심각도를 그릴 때 이것을 쓴다(아이콘 한 벌·용어 '경보'/'주의' 통일, visual-language 「기호와 심각도」).
 * 작은 글자의 의미색 대비가 부족할 수 있어 글자는 text 색, 의미색은 아이콘·테두리로만 보인다. 2026-10-30 공개.
 */
export function SeverityTag({ severity, label, className }: SeverityTagProps) {
  const info = severity === 'info'
  const Icon = info ? Info : SEV_ICON[severity]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold leading-none text-text',
        info ? 'border-info/60' : SEV_BORDER[severity],
        className,
      )}
    >
      <Icon size={11} aria-hidden="true" className={info ? 'text-info' : SEV_ICON_COLOR[severity]} />
      {label ?? (info ? '정보' : SEV_LABEL[severity])}
    </span>
  )
}
