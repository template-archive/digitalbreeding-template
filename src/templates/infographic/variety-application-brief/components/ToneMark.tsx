import { Check, X } from 'lucide-react'
import { u } from '@/design-system'

export type Tone = 'positive' | 'negative' | 'info' | 'muted'

/**
 * 판정 표식(색만으로 판정을 알리지 않는다). 좋은 방향·충족 = 체크 아이콘, 나쁜 방향·미충족 = X 아이콘,
 * 중립 형질(정보) = •, 비슷 = '='. ✓·✕ 글리프 대신 lucide 아이콘을 써서 글꼴과 무관하게 같은 모양으로 그린다(2026-10-30).
 * 크기는 감싼 글자의 em을 따른다.
 */
export function ToneMark({ tone, size = 1 }: { tone: Tone; size?: number }) {
  const style = { width: `${size}em`, height: `${size}em`, verticalAlign: '-0.12em', marginRight: u(3) }
  if (tone === 'positive') return <Check aria-hidden className="inline-block shrink-0" style={style} strokeWidth={3.25} />
  if (tone === 'negative') return <X aria-hidden className="inline-block shrink-0" style={style} strokeWidth={3.25} />
  return (
    <span aria-hidden style={{ marginRight: u(3) }}>
      {tone === 'info' ? '•' : '='}
    </span>
  )
}
