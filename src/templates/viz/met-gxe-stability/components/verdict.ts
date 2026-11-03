import { formatFixed, formatSigned } from '@/lib/format'
import { CHECK, INDEX_RULE, LSD, SITES, W_RULE, type Genotype } from '../data'

const f1 = (v: number) => formatFixed(v, 1)

export const RULE_TEXT = `지수 ≥ ${f1(INDEX_RULE)}% 그리고 (W ≤ ${f1(W_RULE)}% 또는 메가 환경 승자)`

/** "지수 기준만 충족(W 11.7%, 메가 환경 승자 아님)" */
export function indexOnlyText(g: Genotype): string {
  return `지수 기준만 충족(W ${f1(g.wPct)}%, 메가 환경 승자 아님)`
}

export function lsdText(g: Genotype): string {
  return `가람솔 대비 ${formatSigned(g.diffVsCheck, 1)} kg/10a ${g.overLsd ? '>' : '≤'} LSD(5%) ${f1(LSD)}`
}

/** 순위가 가장 낮은 지역 */
function worstSite(g: Genotype) {
  let j = 0
  g.siteRanks.forEach((r, k) => {
    if (r > g.siteRanks[j]!) j = k
  })
  return { site: SITES[j]!, rank: g.siteRanks[j]!, value: g.site2[j]!, index: (100 * g.site2[j]!) / CHECK.site2[j]! }
}

/** 상세 패널의 판정 문장(규칙에서 생성) */
export function verdictSentence(g: Genotype): string {
  if (g.role === 'check') return `대비 품종(${g.checkKind})이라 출원 후보 판정 대상이 아닙니다. 지수 ${f1(g.index)}%.`
  if (g.verdict === 'pass') {
    const why: string[] = []
    if (g.mega) why.push(`${g.mega.label} 메가 환경 승자`)
    if (g.wPct <= W_RULE) why.push(`W ${f1(g.wPct)}% ≤ ${f1(W_RULE)}%`)
    return `지수 ${f1(g.index)}% ≥ ${f1(INDEX_RULE)}%, ${why.join(' · ')} → 출원 후보 규칙 통과. ${lsdText(g)}.`
  }
  if (g.verdict === 'indexOnly') {
    const w = worstSite(g)
    return `${indexOnlyText(g)} → 비선발. 평균 ${g.rank}위지만 반응 기울기 b ${formatFixed(g.b, 2)}로 환경에 민감하고 ${w.site.short}에서 ${w.rank}위(${f1(w.value)}, 가람솔 대비 ${f1(w.index)}%)입니다.`
  }
  return `지수 ${f1(g.index)}% < ${f1(INDEX_RULE)}%로 출원 후보 규칙의 지수 기준에 못 미칩니다.`
}
