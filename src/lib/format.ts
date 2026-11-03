/** 숫자·날짜 표기. 모든 템플릿이 같은 자릿수·단위 규칙을 쓰도록 여기로 모은다. */

const nfCache = new Map<string, Intl.NumberFormat>()
function nf(key: string, make: () => Intl.NumberFormat) {
  let f = nfCache.get(key)
  if (!f) {
    f = make()
    nfCache.set(key, f)
  }
  return f
}

/** 12480 → "12,480", compact: 12480 → "1.2만" */
export function formatNumber(v: number, opts: { digits?: number; compact?: boolean } = {}): string {
  if (!Number.isFinite(v)) return '–'
  const { compact = false } = opts
  if (compact) {
    const digits = opts.digits ?? 1
    return nf(`c${digits}`, () => new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: digits })).format(v)
  }
  const digits = opts.digits ?? (Number.isInteger(v) ? 0 : 1)
  return nf(`n${digits}`, () =>
    new Intl.NumberFormat('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits }),
  ).format(v)
}

/** 비율 → 백분율. 0.987 → "98.7%" */
export function formatPercent(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return '–'
  return `${(v * 100).toFixed(digits)}%`
}

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }

/** p값. 0.001 이상은 소수 3자리, 그보다 작으면 3.2×10⁻⁹ */
export function formatPValue(p: number): string {
  if (!Number.isFinite(p)) return '–'
  if (p <= 0) return '< 1×10⁻³⁰⁰'
  if (p >= 0.001) return p.toFixed(3)
  const exp = Math.floor(Math.log10(p))
  let mant = p / Math.pow(10, exp)
  let e = exp
  if (Number(mant.toFixed(1)) >= 10) {
    mant /= 10
    e += 1
  }
  const sup = String(e)
    .split('')
    .map(c => SUP[c] ?? c)
    .join('')
  return `${mant.toFixed(1)}×10${sup}`
}

/**
 * 변화량 표기. 기본 단위는 '%'(값 1.2 → "▲ 1.2%"). 단위 없이 쓰려면 unit: ''.
 * 0은 "– 0". 정수부 1,000 이상은 천 단위 쉼표를 넣는다(9644 → "▲ 9,644 ha"). 1,000 미만은 toFixed 결과 그대로다.
 */
export function formatDelta(v: number, opts: { digits?: number; unit?: string } = {}): string {
  if (!Number.isFinite(v)) return '–'
  const { digits = 1, unit = '%' } = opts
  const fixed = Math.abs(v).toFixed(digits)
  if (Number(fixed) === 0) return `– ${fixed}${unit}`
  const [int, frac] = fixed.split('.')
  const abs = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (frac !== undefined ? `.${frac}` : '')
  return `${v > 0 ? '▲' : '▼'} ${abs}${unit}`
}

/** short: "2026-10-23", long: "2026년 10월 23일" */
export function formatDate(d: string | Date, style: 'short' | 'long' = 'short'): string {
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return typeof d === 'string' ? d : '–'
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const day = date.getDate()
  if (style === 'long') return `${y}년 ${m}월 ${day}일`
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const MINUS_SIGN = '−'

/**
 * 부호 표기(진짜 마이너스 U+2212). formatSigned(45) → "+45", formatSigned(-4) → "−4", formatSigned(1.06, 1) → "+1.1".
 * 표시 자릿수로 반올림해 0이면 부호 없이 "0", "0.0". 천 단위 쉼표는 formatNumber와 같다.
 */
export function formatSigned(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return '–'
  const abs = Math.abs(v)
  const s = formatNumber(abs, { digits })
  if (Number(abs.toFixed(digits)) === 0) return s
  return `${v > 0 ? '+' : MINUS_SIGN}${s}`
}

/**
 * 고정 소수 표기(부호는 음수일 때만, 진짜 마이너스 U+2212). formatFixed(0.524, 2) → "0.52", formatFixed(-0.05, 2) → "−0.05".
 * 표시 자릿수로 반올림(Math.round, 0.5는 +∞ 쪽)해 0이면 부호 없이 "0.00"(−0 방지). 천 단위 쉼표는 formatNumber와 같다. 비유한 값은 "–".
 * 양수에 "+"를 붙이는 변화량 표기는 formatSigned를 쓴다.
 */
export function formatFixed(v: number, digits: number): string {
  if (!Number.isFinite(v)) return '–'
  const k = 10 ** digits
  return formatNumber(Math.round(v * k) / k || 0, { digits }).replace('-', MINUS_SIGN)
}

/**
 * 마지막 글자에 받침이 있는지(조사 선택용). 한글 음절은 종성 유무, 숫자는 읽는 소리 기준
 * (0 영·1 일·3 삼·6 육·7 칠·8 팔 = 받침, 2·4·5·9 = 없음). 그 밖의 글자(라틴 문자·기호·빈 문자열)는 받침 없음으로 본다.
 */
export function hasBatchim(word: string): boolean {
  const last = word[word.length - 1] ?? ''
  if (/[0-9]/.test(last)) return '013678'.includes(last)
  const code = last.charCodeAt(0) - 0xac00
  return code >= 0 && code <= 11171 ? code % 28 !== 0 : false
}

/** 받침 유무로 조사를 골라 붙인다. pair = [받침 없음, 받침 있음]. josa('간장', '를을') → "간장을", josa('지수', '는은') → "지수는" */
export function josa(word: string, pair: '와과' | '를을' | '는은' | '가이'): string {
  return word + (hasBatchim(word) ? pair[1] : pair[0])
}
