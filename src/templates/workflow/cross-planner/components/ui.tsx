import type { ReactNode } from 'react'
import { CircleAlert, Star, X } from 'lucide-react'
import { Badge } from '@/design-system'

export function RecommendBadge() {
  return (
    <Badge tone="info">
      <Star size={12} aria-hidden="true" />
      추천
    </Badge>
  )
}

/** 인라인 안내 문구(색 + 아이콘 + 문자) */
export function Notice({ tone = 'info', children, onClose }: { tone?: 'info' | 'warning'; children: ReactNode; onClose?: () => void }) {
  const cls = tone === 'warning' ? 'border-warning/40 bg-warning/10' : 'border-info/30 bg-info/10'
  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-[13px] text-text ${cls}`}>
      <CircleAlert size={16} aria-hidden="true" className={`mt-0.5 shrink-0 ${tone === 'warning' ? 'text-warning' : 'text-info'}`} />
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="안내 닫기" className="shrink-0 text-muted hover:text-text">
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
