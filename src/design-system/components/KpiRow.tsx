import { Children, isValidElement, useMemo, type CSSProperties, type ReactNode } from 'react'
import { cn } from './cn'
import { KpiRowContext } from './kpiRowContext'
import { Skeleton } from './layout'

/** KpiTile 요소가 바닥 줄(달성 막대·정상 범위 눈금)을 그리는지 — KpiTile의 막대 조건과 같다 */
function hasFooter(node: ReactNode): boolean {
  if (!isValidElement<Record<string, unknown>>(node)) return false
  const p = node.props
  if (p.range !== undefined) return true
  if (p.achievement !== undefined) return true
  return typeof p.value === 'number' && typeof p.target === 'number' && p.target !== 0
}

export interface KpiRowProps {
  /** KpiTile들(타일에 col-span·너비 클래스를 주지 않는다 — 배치는 KpiRow가 정한다) */
  children?: ReactNode
  /** 첫 자식이 대표 타일(KpiTile size="hero"): 모든 폭에서 2칸 너비 */
  hero?: boolean
  /** 한 줄 칸 수를 직접 지정. 기본: lg = 칸 수(타일 수, 대표가 있으면 +1), md = 4칸 이하면 그대로, 넘으면 3 또는 4(나누어떨어지는 쪽) */
  cols?: { md?: number; lg?: number }
  /** 로딩: children 대신 같은 배치의 스켈레톤(대표 칸 포함)을 그린다 */
  loading?: boolean
  /** 스켈레톤 개수. 기본 children 수(없으면 4) */
  count?: number
  /** 스켈레톤 높이(px). 기본 132 */
  skeletonHeight?: number
  /** 영역 이름. 기본 '핵심 지표' */
  ariaLabel?: string
  className?: string
}

/**
 * KPI 줄(앱 화면 규칙: 고아 칸 없음, 같은 줄 카드는 아래 끝을 맞춤).
 * - 데스크톱(lg 이상) 한 줄: 칸 수 = 타일 수(4개면 4열). 대표 타일은 2칸 너비라 칸 수 +1.
 * - 768px(md): 4칸 이하면 한 줄, 넘으면 3~4칸씩 줄을 나누고 마지막 줄 타일이 늘어나 빈 칸을 남기지 않는다.
 * - 390px(md 미만): 2열. 개수가 홀수면 마지막 타일이 전체 폭(대표 타일은 늘 전체 폭).
 * flex-wrap + 칸 너비(basis) 계산이라 어느 폭에서도 마지막 줄이 꽉 찬다. 줄마다 타일 높이가 같다(stretch).
 * 로딩 스켈레톤도 같은 배치로 그린다. 기준 구현: kpi/program-overview(대표 1 + compact 4). 2026-10-30 신설.
 * 대표 타일 막대 위치(C단계): 형제 가운데 바닥 막대(target·achievement·range)가 절반 이하면 넓은 대표 타일의 달성 막대를 값 오른쪽에 둔다
 * (KpiRowContext → KpiTile). 대표만 막대 높이만큼 길어져 형제 아래 빈 띠가 남던 문제(panel-void).
 */
export function KpiRow({ children, hero, cols, loading, count, skeletonHeight = 132, ariaLabel = '핵심 지표', className }: KpiRowProps) {
  const items = Children.toArray(children)
  const childCount = items.length
  // 대표 타일 막대 위치: 형제 가운데 바닥 막대가 있는 타일이 절반 이하면 값 오른쪽(대표만 길어져 형제 아래 빈 띠가 생기지 않게),
  // 절반을 넘으면 바닥(형제 막대와 높이를 맞춤). 판정은 KpiTile props로 한다(로컬 타일은 바닥 막대 없음으로 본다)
  const siblings = hero ? items.slice(1) : []
  const footers = siblings.filter(hasFooter).length
  const heroSideBar = hero === true && footers * 2 <= siblings.length
  const ctx = useMemo(() => ({ heroSideBar }), [heroSideBar])
  const n = loading ? (count ?? (childCount || 4)) : childCount
  const units = Math.max(1, n + (hero ? 1 : 0))
  const lg = cols?.lg ?? units
  const md = cols?.md ?? (units <= 4 ? units : units % 3 === 0 ? 3 : units % 4 === 0 ? 4 : 3)
  // 칸 너비 = (100% − (칸 수 − 1) × 간격) / 칸 수 − 0.1px(소수점 반올림으로 줄이 넘어가지 않게, 남는 폭은 grow가 채운다)
  const style = {
    '--kpi-md': md,
    '--kpi-lg': lg,
    '--kpi-basis': 'calc((100% - (var(--kpi-per) - 1) * var(--kpi-gap)) / var(--kpi-per) - 0.1px)',
    '--kpi-hero-basis': 'calc(2 * (100% - (var(--kpi-per) - 1) * var(--kpi-gap)) / var(--kpi-per) + var(--kpi-gap) - 0.1px)',
  } as CSSProperties
  return (
    <section
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      data-kpi-row=""
      style={style}
      className={cn(
        'flex flex-wrap gap-[var(--kpi-gap)] [--kpi-gap:12px] [--kpi-per:2] md:[--kpi-gap:16px] md:[--kpi-per:var(--kpi-md)] lg:[--kpi-per:var(--kpi-lg)]',
        '[&>*]:min-w-0 [&>*]:grow [&>*]:basis-[var(--kpi-basis)]',
        hero && '[&>*:first-child]:basis-[var(--kpi-hero-basis)]',
        className,
      )}
    >
      {loading ? Array.from({ length: n }, (_, i) => <Skeleton key={i} height={skeletonHeight} />) : <KpiRowContext.Provider value={ctx}>{children}</KpiRowContext.Provider>}
    </section>
  )
}
