import { Fragment, type ReactNode } from 'react'
import { Badge, DivergingBar } from '@/design-system'
import { formatFixed, formatSigned } from '@/lib/format'
import { CHECK_ID, GENOTYPES, MEGA_BY_WINNER, N_E, N_G, PLANNED_APPLICATION, SITES, YEARS, ZONES, type Genotype } from '../data'
import { RoleBadge, sectorLabel } from './RankTable'
import { verdictSentence } from './verdict'

const f1 = (v: number) => formatFixed(v, 1)
const f2 = (v: number) => formatFixed(v, 2)

/** 지역별 가람솔 대비 차의 막대 축(모든 계통 공통, 5 단위 올림) */
const DIFF_DOMAIN = Math.ceil(Math.max(...GENOTYPES.flatMap(g => g.siteDiff.map(Math.abs))) / 5) * 5

function Item({ label, children, sub }: { label: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-[14px] font-semibold tabular-nums text-text">
        {children}
        {sub && <span className="ml-1 text-xs font-normal text-muted">{sub}</span>}
      </dd>
    </div>
  )
}

/** "연도 값"·"권역 값" 쌍이 낱말 중간에서 갈리지 않게 쌍마다 nowrap, ' · ' 뒤에서만 줄바꿈 */
function Pairs({ items }: { items: string[] }) {
  return (
    <>
      {items.map((s, i) => (
        <Fragment key={s}>
          {i > 0 && ' · '}
          <span className="whitespace-nowrap">{s}</span>
        </Fragment>
      ))}
    </>
  )
}

export function DetailPanel({ g }: { g: Genotype }) {
  const sector = MEGA_BY_WINNER[g.sectorId]
  const planned = g.id === PLANNED_APPLICATION.line
  const tone = g.verdict === 'pass' ? 'border-positive' : g.verdict === 'indexOnly' ? 'border-warning' : 'border-border'
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-bold tracking-tight text-text">{g.id}</h3>
        {g.name && <span className="text-[15px] text-muted">{g.name}</span>}
        <RoleBadge g={g} />
        {planned && (
          <Badge tone="info">
            {PLANNED_APPLICATION.year}년 {PLANNED_APPLICATION.month}월 출원 예정
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
        <p className="text-[32px] font-bold leading-none tabular-nums text-text">
          {f1(g.mean)}
          <span className="ml-1 text-sm font-medium text-muted">kg/10a</span>
        </p>
        <p className="pb-0.5 text-sm tabular-nums text-text">
          지수 <b>{f1(g.index)}%</b> · 평균 순위 <b>{g.rank}</b>/{N_G}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
        <Item label="연도 평균">
          <Pairs items={YEARS.map((y, t) => `${y} ${f1(g.yearMeans[t]!)}`)} />
        </Item>
        <Item label="권역 지수(가람솔 = 100)">
          <Pairs items={ZONES.map(z => `${z.short} ${f1(g.zoneIndex[z.key])}`)} />
        </Item>
        <Item label="반응 기울기 b ± SE" sub={`R² ${f2(g.r2)}`}>
          {f2(g.b)} ± {f2(g.seB)}
        </Item>
        <Item label="Wricke 생태가 W" sub={`${g.wRank}위`}>
          {f1(g.wPct)}%
        </Item>
        <Item label="AMMI ASV" sub={`${g.asvRank}위`}>
          {f2(g.asv)}
        </Item>
        <Item label="GGE 구역" sub={g.mega ? '승자' : undefined}>
          {sector ? sectorLabel(g) : `지역 없음(${g.sectorId})`}
        </Item>
        <Item label="실측 1위" sub={`/ ${N_E}개 환경`}>
          {g.topCount}회
        </Item>
      </dl>

      <p className={`rounded-md border-l-4 bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-text ${tone}`}>{verdictSentence(g)}</p>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">지역별 가람솔 대비 차(kg/10a, 2025~2026 평균)</p>
        {g.id === CHECK_ID ? (
          <p className="text-xs text-muted">가람솔은 비교 기준 자신입니다. 다른 계통을 고르면 지역별 차가 나옵니다.</p>
        ) : (
          <ul className="flex flex-col">
            {SITES.map((s, j) => {
              const d = g.siteDiff[j]!
              const neg = Math.round(d * 10) < 0
              return (
                <li key={s.name} className="grid grid-cols-[2.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 text-xs">
                  <span className="text-muted">{s.short}</span>
                  <DivergingBar layout="inline" value={d} domain={DIFF_DOMAIN * 1.7} valueText={formatSigned(d, 1)} />
                  <span className="text-right tabular-nums text-muted">
                    {neg && <span className="mr-1 font-semibold text-warning">낮음</span>}
                    {g.siteRanks[j]}위
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
