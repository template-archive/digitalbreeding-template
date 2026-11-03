/** 리드 SNP 효과(GWAS 연결) 카드 — GWAS 결과 뷰어 피크 표 값 + 이 화면의 판정과 육종 계통 검산 */
import type { ReactNode } from 'react'
import { Card } from '@/design-system'
import { formatNumber, formatSigned } from '@/lib/format'
import {
  SUBPOP_LABEL,
  TRAIT_FULL,
  TRAIT_SHORT,
  catCounts,
  kb1,
  parentRecordAgreement,
  parentTraitDiff,
  type HapData,
  type LocusResult,
  type TraitKey,
} from '../data'
import { pct1 } from './FreqBars'

/** 표적 하플로타입의 하위 집단 내 빈도(%) — GS3 각주용 */
function targetPct(L: LocusResult, data: HapData, g: 'TEJ' | 'IND'): string {
  const tn = new Set(L.named.filter(h => h.target).map(h => h.name))
  const { counts, n } = catCounts(L, data, g)
  return pct1(L.cats.reduce((acc, c, i) => acc + (tn.has(c) ? counts[i]! : 0), 0), n)
}

/** 단위 붙이기: 한글 단위(일·점)는 붙여 쓰고, cm·g는 띄운다 */
export const withUnit = (v: string, trait: TraitKey) => {
  const u = { dth: '일', cl: 'cm', tgw: 'g', blast: '점' }[trait]
  return /^[a-z]/.test(u) ? `${v} ${u}` : `${v}${u}`
}

export function effectPhrase(L: LocusResult): string {
  const p = L.planted
  return withUnit(formatSigned(p.beta, 1), p.trait)
}

export function checkLine(L: LocusResult, data: HapData): string {
  switch (L.def.key) {
    case 'sd1': {
      const d = parentTraitDiff(L, data, 'culm')
      return `부모 후보 보유 ${d.nYes} 평균 간장 ${d.mYes.toFixed(1)} cm vs 비보유 ${d.nNo} ${d.mNo.toFixed(1)} cm(${formatSigned(d.diff, 1)} cm)`
    }
    case 'Hd1': {
      const d = parentTraitDiff(L, data, 'heading')
      return `지연형 보유 ${d.nYes} 평균 출수 ${d.mYes.toFixed(1)}일 vs ${d.mNo.toFixed(1)}일(${formatSigned(d.diff, 1)}일)`
    }
    case 'GS3':
      return '천립중 기록 없음(교배 조합 설계 후보 기록에 천립중이 없다)'
    case 'Pi-ta': {
      const a = parentRecordAgreement(L, data)
      return `교배 조합 설계 기록 Pi-ta ${a.recorded}계통과 판정 ${a.agree}/${a.total} 일치`
    }
    case 'Pi9': {
      const a = parentRecordAgreement(L, data)
      return `기록 Pi9 ${a.recorded}계통과 ${a.agree}/${a.total} 일치 · Pigm ${a.pigm}계통은 이 SNP로 구별 안 됨`
    }
  }
}

export function EffectCard({ L, data }: { L: LocusResult; data: HapData }) {
  const p = L.planted
  const lead = L.snps[L.leadIdx]!
  const fav = L.def.kind === 'fav'
  const gene = L.geneIn ? `${p.gene} · 리드 블록 안` : L.geneOutKb != null ? `${p.gene} · 리드 블록 밖 ${kb1(L.geneOutKb)} kb` : '—'
  const rows: [string, ReactNode][] = [
    ['형질', TRAIT_FULL[p.trait]],
    ['리드 SNP', <span key="l" className="tabular-nums">{`${lead.id} (${p.chr}:${formatNumber(p.bp)})`}</span>],
    [
      'β',
      <span key="b">
        <span className="font-semibold tabular-nums">{effectPhrase(L)}</span> <span className="text-muted">(소수 동형 − 주 동형)</span>
      </span>,
    ],
    ['PVE', <span key="p" className="tabular-nums">{(p.pve * 100).toFixed(1)}%</span>],
    ['−log10 p', <span key="g" className="tabular-nums">{p.logP.toFixed(1)}</span>],
    ['표적 대립유전자', fav ? `소수 대립유전자 = 유리(${L.def.goal})` : `소수 대립유전자 = ${L.def.effectName} · 유리 판정 안 함`],
    ['후보 유전자', gene],
    ['육종 계통 검산', checkLine(L, data)],
  ]
  L.others.forEach((o, k) => {
    const r2 = L.otherR2[k]
    const oi = L.otherIdx[k]!
    const same = oi >= L.leadBlock.from && oi <= L.leadBlock.to
    rows.push([
      `${o.id} 리드`,
      `${same ? '같은 블록' : '다른 블록'} ${TRAIT_SHORT[o.trait]} 리드 ${L.snps[oi]!.id} · β ${withUnit(formatSigned(o.beta, 1), o.trait)} · r² ${r2 == null ? '—' : r2.toFixed(2)}(LD 구조)`,
    ])
  })
  return (
    <Card title="리드 SNP 효과(GWAS 연결)" subtitle={`GWAS 결과 뷰어 피크 표 · ${L.def.key}`}>
      <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="min-w-0 break-keep text-text">{v}</dd>
          </div>
        ))}
      </dl>
      {L.def.key === 'GS3' && (
        <p className="mt-3 text-xs text-muted">
          천립중 증가형(표적 하플로타입 {L.named.filter(h => h.target).map(h => h.name).join('·')})은 {SUBPOP_LABEL.IND} {targetPct(L, data, 'IND')}% · {SUBPOP_LABEL.TEJ} {targetPct(L, data, 'TEJ')}%로 {Number(targetPct(L, data, 'IND')) >= Number(targetPct(L, data, 'TEJ')) ? `${SUBPOP_LABEL.IND}에 많다` : `${SUBPOP_LABEL.TEJ}에 많다(실제 분포와 반대)`}. 실제 GS3 장립·대립형(C165A, GS3A)도 인디카에 많고 온대 자포니카는 주로 GS3C(단원립)를 갖는다. 천립중 증가형은 장립화와 연관될 수 있어 자포니카 단원립 품질 기준과 함께 판단한다.
        </p>
      )}
      {L.def.key === 'Pi9' && (
        <p className="mt-3 text-xs text-muted">Pigm은 Pi2/Pi9와 같은 Chr06 좌위의 다른 대립유전자군이다(미확인 일반 지식). 기능 마커(KASP)로 구별한다.</p>
      )}
    </Card>
  )
}
