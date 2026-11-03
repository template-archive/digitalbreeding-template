import { Fragment } from "react";
import { Badge, ScrollRegion } from "@/design-system";
import { label, type Depth, type Loop } from "../data";
import { LoopBadge, loopColor } from "./style";

interface Props {
  loops: Loop[];
  f: number;
  depth: Depth;
  highlight: boolean;
  activeLoop: number | null;
  pinned: number | null;
  onHover: (i: number | null) => void;
  onPin: (i: number | null) => void;
}

/** 경로 문구: 계통 ID가 중간("YR93- / 0208")에서 끊기지 않게 ID마다 nowrap, '→' 뒤에서만 줄바꿈 */
const PathText = ({ ids }: { ids: string[] }) => (
  <>
    {ids.map((id, i) => (
      <Fragment key={`${id}-${i}`}>
        {i > 0 && " → "}
        <span className="whitespace-nowrap">{label(id)}</span>
      </Fragment>
    ))}
  </>
);

/** 근연 루프(공통 조상) 표. 행 호버·선택으로 계통도의 경로쌍을 강조한다 */
export function LoopTable({
  loops,
  f,
  depth,
  highlight,
  activeLoop,
  pinned,
  onHover,
  onPin,
}: Props) {
  if (loops.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted">
        부모 간 공통 조상이 없습니다(f = 0.00)
      </p>
    );
  }
  // 좁은 화면에서 가로 스크롤해도 번호·공통 조상 열은 고정(배경을 칠해 아래 열이 비치지 않게)
  const stick1 = "sticky left-0 z-[1] w-10 min-w-10";
  const stick2 = "sticky left-10 z-[1]";
  return (
    <div>
      <ScrollRegion
        label="근연 루프 표(가로 스크롤)"
        hint="옆으로 밀어 경로 보기 →"
      >
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <caption className="sr-only">
            근연 루프 목록. 공통 조상별 기여의 합이 부모 간 공조계수 f다
          </caption>
          <thead>
            <tr className="border-b border-text/25 text-left text-xs text-muted">
              <th
                scope="col"
                className={`${stick1} bg-surface py-2 pr-2 font-medium`}
              >
                루프
              </th>
              <th
                scope="col"
                className={`${stick2} bg-surface py-2 pr-3 font-medium`}
              >
                공통 조상
              </th>
              <th
                scope="col"
                className="py-2 pr-3 text-right font-medium"
                title="Σ(½)^(n₁+n₂)"
              >
                기여
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                ♀ 모본 쪽 경로
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                ♂ 부본 쪽 경로
              </th>
              <th scope="col" className="py-2 font-medium">
                세대
              </th>
            </tr>
          </thead>
          <tbody>
            {loops.map((l, i) => {
              const visible = l.pairs.some((p) => p.gen <= depth);
              const on = activeLoop === i;
              const cellBg = on
                ? "bg-surface-2"
                : "bg-surface group-hover:bg-surface-2";
              const color = highlight ? loopColor(i) : "var(--color-muted)";
              return (
                <tr
                  key={l.ancestor}
                  onMouseEnter={() => onHover(i)}
                  onMouseLeave={() => onHover(null)}
                  className={`group border-b border-border/70 align-top transition-colors ${on ? "bg-surface-2" : "hover:bg-surface-2"}`}
                >
                  <td
                    className={`${stick1} ${cellBg} py-2 pr-2 transition-colors`}
                  >
                    <button
                      type="button"
                      aria-pressed={pinned === i}
                      aria-label={`루프 ${i + 1} 경로 강조`}
                      onClick={() => onPin(pinned === i ? null : i)}
                      onFocus={() => onHover(i)}
                      onBlur={() => onHover(null)}
                      className={`touch-hit inline-flex items-center justify-center rounded-full ${pinned === i ? "outline-2 outline-offset-2 outline-text" : ""}`}
                    >
                      <LoopBadge i={i} color={color} />
                    </button>
                  </td>
                  <td
                    className={`${stick2} ${cellBg} py-2 pr-3 transition-colors`}
                  >
                    <div className="whitespace-nowrap font-semibold text-text">
                      {label(l.ancestor)}
                    </div>
                    {!visible && (
                      <Badge tone="neutral" className="mt-1">
                        표시 세대 밖({l.minGen}세대)
                      </Badge>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right font-semibold tabular-nums text-text">
                    {l.contrib.toFixed(4)}
                  </td>
                  <td className="py-2 pr-3 text-muted">
                    {l.pairs.map((p, k) => (
                      <div key={k} className="leading-6">
                        <PathText ids={p.a} />
                      </div>
                    ))}
                  </td>
                  <td className="py-2 pr-3 text-muted">
                    {l.pairs.map((p, k) => (
                      <div key={k} className="leading-6">
                        <PathText ids={p.b} />
                      </div>
                    ))}
                  </td>
                  <td className="py-2 tabular-nums text-muted">
                    {l.pairs.map((p, k) => (
                      <div key={k} className="whitespace-nowrap leading-6">
                        {p.gen}세대 · n {p.n}
                      </div>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="text-[13px]">
              <th
                scope="row"
                colSpan={2}
                className="sticky left-0 z-[1] whitespace-nowrap bg-surface py-2 pr-3 text-left font-semibold text-text"
              >
                합계 = 부모 간 f
              </th>
              <td className="py-2 pr-3 text-right font-bold tabular-nums text-text">
                {f.toFixed(4)}
              </td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </ScrollRegion>
      <div className="mt-2 flex flex-col gap-0.5 text-xs text-muted">
        <p>
          경로쌍마다 (½)^(n₁+n₂), n = 모본·부본에서 공통 조상까지 세대 수의 합.
        </p>
        <p>
          각 값은 소수 4자리 반올림이라 행 합과 합계의 마지막 자리가 다를 수
          있음(합계는 정확한 f를 반올림).
        </p>
      </div>
    </div>
  );
}
