import { formatNumber } from '@/lib/format'
import {
  CHECK_LABEL,
  ENTRY_BY_NO,
  REP_LABEL,
  TRAITS,
  blockLabel,
  type CellCheck,
  type CellValue,
  type Plot,
  type RemoteChange,
  type TraitKey,
} from '../data'

/** 화면에 그리는 칸 상태(우선순위: 충돌 > 오류 > 범위 밖 > 반복 편차 > 정상, 결측·미입력 별도) */
export type DisplayStatus = CellCheck['status'] | 'conflict'

export const STATUS_TEXT: Record<DisplayStatus, string> = {
  ok: '정상',
  range: '주의: 범위 밖',
  dev: '주의: 반복 편차',
  error: '오류',
  missing: '결측(NA)',
  empty: '미입력',
  conflict: '충돌',
}

/** 상태 아이콘 문자(색 외 구분 수단). ▲▼는 증감 전용이라 범위 밖은 '!'(visual-language 「기호와 심각도」) */
export const STATUS_GLYPH: Partial<Record<DisplayStatus, string>> = {
  error: '⊘',
  range: '!',
  dev: '≠',
  conflict: '⇄',
}

/** 미저장 진척 막대 빗금 */
export const HATCH_UNSAVED =
  'repeating-linear-gradient(135deg, var(--color-accent) 0 2px, color-mix(in oklab, var(--color-accent) 35%, var(--color-surface)) 2px 5px)'

export function formatCell(v: CellValue | undefined, trait: TraitKey, withComma = true): string {
  if (v === undefined) return ''
  if (v === 'NA') return 'NA'
  if (typeof v === 'object') return v.raw
  const d = TRAITS[trait].digits
  // 정수 형질의 소수 입력, 불가능 값은 입력한 그대로 보인다(예: 소수점 누락 197)
  if ((d === 0 && !Number.isInteger(v)) || v < TRAITS[trait].hard[0] || v > TRAITS[trait].hard[1]) return String(v)
  return withComma ? formatNumber(v, { digits: d }) : v.toFixed(d)
}

export function plotLabel(p: Plot): string {
  const e = ENTRY_BY_NO.get(p.entry)!
  return `처리 ${p.entry} ${e.name}${e.check ? `(${CHECK_LABEL[e.check]})` : ''}`
}

/** 셀 aria-label: "구 225, 반복 Ⅱ 블록 B5, 처리 12 YR22-0331, 수장 197 cm, 오류: 불가능 값, 미저장" */
export function cellAria(p: Plot, trait: TraitKey, v: CellValue | undefined, status: DisplayStatus, check: CellCheck, dirty: boolean): string {
  const T = TRAITS[trait]
  const head = `구 ${p.no}, 반복 ${REP_LABEL[p.rep - 1]} 블록 ${blockLabel(p)}, ${plotLabel(p)}`
  let body: string
  if (status === 'empty') body = `${T.label} 미입력`
  else if (status === 'missing') body = `${T.label} NA, 결측`
  else body = `${T.label} ${formatCell(v, trait)} ${T.unit}`
  const st =
    status === 'conflict'
      ? '충돌: 다른 사용자가 먼저 저장'
      : status === 'error' || status === 'range' || status === 'dev'
        ? `${status === 'error' ? '오류' : '주의'}: ${check.tag}`
        : null
  return [head, body, st, dirty ? '미저장' : null].filter(Boolean).join(', ')
}

export function cellTitle(trait: TraitKey, v: CellValue | undefined, status: DisplayStatus, check: CellCheck, others: string, conflict?: RemoteChange): string {
  const T = TRAITS[trait]
  const lines = [`${T.label}: ${v === undefined ? '미입력' : `${formatCell(v, trait)}${v === 'NA' ? '' : ` ${T.unit}`}`}`, `상태: ${STATUS_TEXT[status]}`]
  if (conflict) lines.push(`서버 값 ${formatCell(conflict.value, trait)}(${conflict.by}, ${conflict.at})`)
  if (check.reason) lines.push(check.reason)
  if (others) lines.push(`같은 처리 다른 반복: ${others}`)
  return lines.join('\n')
}
