import { useChartTheme } from '@/charts'
import { GROUPS, GROUP_DIAG_MEAN, GROUP_LABEL, GROUP_SIZE, SCALE_MAX, fmt2, fmt3, fmtInt, groupMean } from '../data'

/** 그룹 안·그룹 사이 평균 관계(상삼각 3 × 3) */
export function GroupMeanTable() {
  const t = useChartTheme()
  const seq = t.sequential
  // 셀 배경: 히트맵과 같은 순차 척도의 옅은 단계(≤ 0~SCALE_MAX → 1~3단계, 음수는 최저 단계)로 비교만 돕는다
  const tint = (G: number) => seq[Math.max(0, Math.min(2, Math.floor((G / SCALE_MAX) * 7)))] ?? seq[0]
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-[13px] tabular-nums">
          <caption className="sr-only">그룹별 평균 관계 계수 G(괄호 f = G/2)와 쌍 수. 같은 그룹은 대각 제외</caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">행 그룹 / 열 그룹</span>
              </th>
              {GROUPS.map((g, i) => (
                <th key={g} scope="col" className="px-1 pb-1 text-left text-xs font-semibold text-muted">
                  <span className="mr-1 inline-block h-2.5 w-1.5 rounded-[2px] align-middle" style={{ background: t.categorical[i] }} aria-hidden="true" />
                  {g}
                  <span className="font-normal"> ({GROUP_SIZE[g]})</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((x, r) => (
              <tr key={x}>
                <th scope="row" className="pr-1 text-left text-xs font-semibold text-muted" title={GROUP_LABEL[x]}>
                  {x}
                </th>
                {GROUPS.map((y, c) => {
                  if (c < r) return <td key={y} aria-hidden="true" />
                  const m = groupMean(x, y)
                  const same = x === y
                  return (
                    <td key={y} className={`rounded-md border px-2 py-1.5 align-top ${same ? 'border-text/40' : 'border-border'}`} style={{ background: tint(m.G) }}>
                      <span className={`block text-text ${same ? 'text-[15px] font-bold' : 'font-semibold'}`}>
                        {fmt2(m.G)}
                        <span className="ml-0.5 text-xs font-normal">({fmt2(m.f)})</span>
                      </span>
                      <span className="block text-[11px] text-text">{fmtInt(m.n)}쌍</span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-1 text-xs text-muted">
        {GROUPS.map(g => (
          <li key={g}>
            <b className="text-text">{g}</b> {GROUP_LABEL[g].slice(2)}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        같은 그룹 칸은 대각 제외(자기 관계 1 + F를 빼고 평균). 그룹 평균 대각 1 + F: A {fmt3(GROUP_DIAG_MEAN.A)} · B {fmt3(GROUP_DIAG_MEAN.B)} · C{' '}
        {fmt3(GROUP_DIAG_MEAN.C)}.
      </p>
      <p className="text-xs text-muted">C 저항성 공여 그룹은 A·B와 가장 멀다(평균 f A–C {fmt2(groupMean('A', 'C').f)}, B–C {fmt2(groupMean('B', 'C').f)}). A·B × C 조합은 모두 근연 등급 정상이다.</p>
      <p className="text-xs text-muted">음수 = 기준 집단 평균보다 덜 가까움</p>
    </div>
  )
}
