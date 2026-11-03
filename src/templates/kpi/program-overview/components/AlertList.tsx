import { AlertList as CommonAlertList, Card } from '@/design-system'
import { formatNumber } from '@/lib/format'
import type { AlertItem, KpiKey } from '../data'

/** 목표 미달 경보 카드. 목록 자체는 공통 AlertList */
export function AlertList({ year, items, onSelect }: { year: number; items: AlertItem[]; onSelect: (key: KpiKey) => void }) {
  const critical = items.filter(i => i.severity === 'critical').length
  const warning = items.length - critical
  return (
    <Card
      className="h-full"
      title={`경보·주의 ${items.length}건`}
      subtitle={`${year}년 달성률 100% 미만 지표 · 달성률 낮은 순`}
      actions={
        items.length > 0 && (
          <span className="text-xs text-muted tabular-nums">
            경보 {critical} · 주의 {warning}
          </span>
        )
      }
    >
      <CommonAlertList
        ariaLabel={`${year}년 목표 미달 지표 ${items.length}건`}
        emptyText="모든 지표가 목표를 달성했습니다"
        actionLabel="— 관련 차트로 이동"
        items={items.map(it => ({
          id: it.key,
          severity: it.severity,
          title: it.label,
          value: `${formatNumber(it.achievement, { digits: 1 })}%`,
          description: it.cause,
          onClick: () => onSelect(it.key),
        }))}
      />
      <p className="mt-3 text-xs text-muted">경보: 달성률 90% 미만 · 주의: 90% 이상 100% 미만.{items.some(it => it.gradeBasis !== undefined && it.gradeBasis !== it.achievement) && ' 연중 출원은 연말 전망(실적 + 확정 예정)으로 등급을 정합니다.'} 항목을 누르면 관련 차트로 이동합니다.</p>
    </Card>
  )
}
