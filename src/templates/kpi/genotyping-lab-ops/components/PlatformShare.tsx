import { Fragment } from 'react'
import { Card } from '@/design-system'
import { PLATE_COUNT, PLATFORMS, PLATFORM_KEYS, SAMPLES, TOTAL_SAMPLES, sharePct } from '../data'
import { int, pct1, platformVar } from './shared'

const ORDER = [...PLATFORM_KEYS].sort((a, b) => SAMPLES[b] - SAMPLES[a])

/** F. 플랫폼별 비중 — 샘플 수 가로 막대 + 마커·플레이트 보조 열 */
export function PlatformShare({ className }: { className?: string }) {
  const max = SAMPLES[ORDER[0]]
  return (
    <Card className={className} title="플랫폼별 비중" subtitle={`누계 샘플 수 기준 · 합계 ${int(TOTAL_SAMPLES)}샘플`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[288px] border-collapse text-sm">
          <caption className="sr-only">플랫폼별 누계 샘플 수와 비중, 마커 수, 플레이트 수</caption>
          <thead>
            <tr className="border-b border-text/25 text-left text-xs text-muted">
              <th scope="col" className="py-1.5 pr-2 font-medium">플랫폼 · 용도</th>
              <th scope="col" className="py-1.5 pr-2 font-medium">샘플 수(비중)</th>
              <th scope="col" className="py-1.5 pr-2 text-right font-medium">마커</th>
              <th scope="col" className="whitespace-nowrap py-1.5 text-right font-medium">플레이트</th>
            </tr>
          </thead>
          <tbody>
            {ORDER.map((k, i) => {
              const p = PLATFORMS[k]
              const last = i === ORDER.length - 1
              return (
                <Fragment key={k}>
                  <tr className={`align-top sm:border-b sm:border-border/70 ${last ? 'sm:border-b-0' : ''}`}>
                    <th scope="row" className="py-2.5 pr-2 text-left font-normal">
                      <span className="flex items-center gap-1.5 whitespace-nowrap font-semibold text-text">
                        <span aria-hidden="true" className="inline-block size-2.5 shrink-0 rounded-[2px]" style={{ background: platformVar(k) }} />
                        {p.name}
                      </span>
                      {/* 좁은 화면에서는 시각적으로 아래 전체 폭 행에 보이고, 스크린리더에는 여기서 읽힌다 */}
                      <span className="sr-only text-xs text-muted sm:not-sr-only sm:mt-0.5 sm:block">{p.purpose}</span>
                    </th>
                    <td className="py-2.5 pr-2 sm:w-[44%]">
                      <span className="block whitespace-nowrap text-[13px] tabular-nums text-text">
                        <b>{int(SAMPLES[k])}</b>
                        <span className="text-muted">
                          <span className="hidden sm:inline"> · </span>
                          <span className="block sm:inline">{pct1(sharePct(k))}</span>
                        </span>
                      </span>
                      <span className="mt-1 block h-2 w-full min-w-12 rounded-sm bg-surface-2" aria-hidden="true">
                        <span className="block h-2 rounded-sm" style={{ width: `${Math.max(1.5, (SAMPLES[k] / max) * 100)}%`, background: platformVar(k) }} />
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-2 text-right text-[13px] tabular-nums text-text">
                      {p.markersUsed !== undefined ? (
                        <>
                          {int(p.markers)}
                          <span className="block text-xs text-muted">사용 {int(p.markersUsed)}</span>
                        </>
                      ) : (
                        p.markersLabel
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2.5 text-right text-[13px] tabular-nums text-text">{PLATE_COUNT[k]}장</td>
                  </tr>
                  {/* 390px 등 좁은 화면: 용도를 행 전체 폭으로 내려 이름 열이 여러 줄로 꺾이지 않게 한다 */}
                  <tr aria-hidden="true" className={`sm:hidden ${last ? '' : 'border-b border-border/70'}`}>
                    <td colSpan={4} className="pb-2.5 pl-4 text-xs text-muted">
                      {p.purpose}
                    </td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        비중 합계 {pct1(PLATFORM_KEYS.reduce((a, k) => a + Number(sharePct(k).toFixed(1)), 0))} · GBS 마커 수는 필터 후 추정치 · 플레이트 = 96웰(시료 94 + 대조 2)
      </p>
    </Card>
  )
}
