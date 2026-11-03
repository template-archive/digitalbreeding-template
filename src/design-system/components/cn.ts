/** 클래스 이름 결합: 거짓 값(false·null·undefined·빈 문자열)을 빼고 공백으로 잇는다. 2026-10-30 공개 */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}
