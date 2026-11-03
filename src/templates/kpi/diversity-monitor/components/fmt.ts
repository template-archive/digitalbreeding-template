import { formatNumber, formatSigned } from '@/lib/format'
import type { ChartTheme } from '@/charts'
import { GS_START, YEARS, type Status, type Year } from '../data'

/** 고정 자릿수 숫자(천 단위 쉼표) */
export const n = (v: number, d = 0) => formatNumber(v, { digits: d })
/** 비율(0~1) → '0.96%'(소수 d자리, % 기호 포함) */
export const pct = (v: number, d = 2) => `${n(v * 100, d)}%`
/** 부호 표기(U+2212) */
export const sg = formatSigned

export const STATUS_LABEL: Record<Status, string> = { ok: '정상', warning: '주의', critical: '경보' }

export const statusColor = (theme: ChartTheme, s: Status) => (s === 'critical' ? theme.negative : s === 'warning' ? theme.warning : theme.text)

export const yearAxis = YEARS.map(String)
export const GS_INDEX = YEARS.indexOf(GS_START as Year)
