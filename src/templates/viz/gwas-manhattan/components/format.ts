import { formatNumber, formatPValue, formatSigned } from '@/lib/format'
import type { Lead, Snp } from '../data'

/** Chr06:9,310,452 */
export const locus = (s: { chr: string; bp: number }) => `${s.chr}:${formatNumber(s.bp)}`

/** 부호를 붙인 효과 크기. +6.3 일 */
export function formatBeta(beta: number, unit: string): string {
  return `${formatSigned(beta, 1)} ${unit}`
}

/** 차트 툴팁 HTML */
export function snpTooltip(snp: Snp, logP: number, lead?: Lead): string {
  const rows: [string, string][] = [
    ['위치', locus(snp)],
    ['p값', formatPValue(10 ** -logP)],
    ['−log10(p)', logP.toFixed(2)],
    ['MAF', snp.maf.toFixed(2)],
  ]
  if (lead) rows.push(['후보 유전자', lead.gene ? `${lead.gene} (${lead.geneDistKb} kb)` : '—'])
  const body = rows
    .map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:16px"><span style="opacity:.7">${k}</span><span style="font-variant-numeric:tabular-nums">${v}</span></div>`)
    .join('')
  return `<div style="font-weight:600;margin-bottom:4px">${snp.id}${lead ? ' · 리드 SNP' : ''}</div>${body}`
}

/** 리드 SNP 라벨: 후보 유전자 기호, 없으면 SNP ID */
export const leadLabel = (l: Lead) => l.gene ?? l.id
