import { AlertOctagon, AlertTriangle, CheckCircle2 } from 'lucide-react'

/** 목표 대비 심각도. ok = 달성, warning = 주의, critical = 경보. KpiTile·AlertList 공용 규칙 */
export type KpiSeverity = 'ok' | 'warning' | 'critical'

// Tailwind가 정적으로 찾을 수 있도록 클래스 문자열을 그대로 둔다(내부용)
export const SEV_BAR: Record<KpiSeverity, string> = { ok: 'bg-positive', warning: 'bg-warning', critical: 'bg-negative' }
export const SEV_ICON_COLOR: Record<KpiSeverity, string> = { ok: 'text-positive', warning: 'text-warning', critical: 'text-negative' }
/** 문자 태그 테두리(태그 글자는 text 색: 작은 글자 대비 확보) */
export const SEV_BORDER: Record<KpiSeverity, string> = { ok: 'border-positive/50', warning: 'border-warning/60', critical: 'border-negative/60' }
/** 목록 항목 왼쪽 2px 띠 색(전체 테두리는 border 토큰 — 심각도색 테두리는 heavy-borders, 2026-10-30) */
export const SEV_ITEM_BORDER: Record<KpiSeverity, string> = {
  ok: 'border-l-positive',
  warning: 'border-l-warning',
  critical: 'border-l-negative',
}
export const SEV_LABEL: Record<KpiSeverity, string> = { ok: '달성', warning: '주의', critical: '경보' }
export const SEV_ICON = { ok: CheckCircle2, warning: AlertTriangle, critical: AlertOctagon } as const
