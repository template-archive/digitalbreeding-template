import type { Sample } from '../data'

export type WellKind =
  | 'pass16'
  | 'pass15'
  | 'failRun'
  | 'failWait'
  | 'reseq'
  | 'request'
  | 'substitute'
  | 'expFail'
  | 'readDone'
  | 'pending'
  | 'pos'
  | 'ntc'

export const WELL_STYLE: Record<WellKind, { cls: string; symbol: string; label: string; gbsLabel?: string }> = {
  pass16: { cls: 'bg-positive/25 border-positive/60', symbol: '', label: '통과 16/16', gbsLabel: '통과(리드 ≥ 1M · 결측 ≤ 20%)' },
  pass15: { cls: 'bg-positive/10 border-positive/60 text-positive', symbol: '15', label: '통과 15/16(보조 마커 1개 미호출)' },
  failRun: { cls: 'bg-negative/20 border-negative text-negative', symbol: '×', label: '실패 · 재분석 진행 중' },
  failWait: { cls: 'bg-warning/20 border-warning text-warning', symbol: '×', label: '실패 · 재분석 대기' },
  reseq: { cls: 'bg-info/20 border-info text-info', symbol: '×', label: '실패 · 재시퀀싱 대기' },
  request: { cls: 'bg-accent/10 border-accent text-accent', symbol: '↻', label: '재분석 요청(QC 통과 · 재확인, 실패 아님)' },
  substitute: { cls: 'bg-surface-2 border-muted text-muted', symbol: '⇄', label: '폐기·대체 개체 사용' },
  expFail: { cls: 'bg-warning/10 border-warning border-dashed text-warning', symbol: '!', label: 'QC 실패 예상(판정 전)' },
  readDone: { cls: 'bg-positive/5 border-positive/50 border-dashed text-positive', symbol: '', label: '판독 완료 · QC 판정 대기' },
  pending: { cls: 'bg-surface-2 border-border', symbol: '', label: '판독 전(진행 중 단계)' },
  pos: { cls: 'bg-surface border-text text-text', symbol: '+', label: '양성 대조(H11)' },
  ntc: { cls: 'bg-surface border-text text-text', symbol: 'N', label: '음성 대조(NTC) H12' },
}

export const LEGEND_ORDER: WellKind[] = ['pass16', 'pass15', 'failRun', 'failWait', 'reseq', 'request', 'substitute', 'expFail', 'readDone', 'pending', 'pos', 'ntc']

export function wellKind(s: Sample): WellKind {
  // 재분석 요청(REQUEST) 웰은 QC 실패가 아니다(data.ts의 1차 QC·실패율 계산과 같은 규칙). ×를 쓰지 않는다
  if (s.fail === 'REQUEST' && (s.status === '대기' || s.status === '진행 중')) return 'request'
  switch (s.status) {
    case '통과':
      return s.platform === 'KASP' && s.called === 15 ? 'pass15' : 'pass16'
    case '진행 중':
      return 'failRun'
    case '대기':
    case '재채취 요청':
      return 'failWait'
    case '재시퀀싱 대기':
      return 'reseq'
    case '폐기·대체 개체 사용':
      return 'substitute'
    case 'QC 실패 예상':
      return 'expFail'
    case 'QC 판정 대기':
      return 'readDone'
    default:
      return 'pending'
  }
}

/** 콜레이트 보기 보조 설명: KASP는 콜레이트 구간만으로 통과·실패를 가르지 않는다 */
export const KASP_CALL_NOTE = 'KASP는 콜레이트만으로 판정하지 않음(대상 마커 호출 여부 우선 — 같은 15/16이라도 Pi9 미호출이면 실패)'

/** 콜레이트 보기 구간(순차 팔레트 토큰). 높은 구간은 글자를 surface 색으로 바꿔 대비를 지킨다 */
export const CALL_BINS: { lo: number; label: string; bg: string; fg: string }[] = [
  { lo: 0, label: '< 80%', bg: 'var(--viz-seq-1)', fg: 'var(--color-text)' },
  { lo: 80, label: '80–90%', bg: 'var(--viz-seq-2)', fg: 'var(--color-text)' },
  { lo: 90, label: '90–95%', bg: 'var(--viz-seq-3)', fg: 'var(--color-text)' },
  { lo: 95, label: '95–99.9%', bg: 'var(--viz-seq-5)', fg: 'var(--color-surface)' },
  { lo: 99.95, label: '100%', bg: 'var(--viz-seq-7)', fg: 'var(--color-surface)' },
]
export function callBin(call: number) {
  let b = CALL_BINS[0]!
  for (const x of CALL_BINS) if (call >= x.lo) b = x
  return b
}
