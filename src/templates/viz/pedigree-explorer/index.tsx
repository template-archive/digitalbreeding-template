import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { TemplateMeta } from "@/gallery/types";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  KinBadge,
  KpiRow,
  KpiTile,
  PageGrid,
  PageHeader,
  ScrollRegion,
  Segmented,
  Skeleton,
  SummaryCallout,
  Switch,
  useMediaQuery,
} from "@/design-system";
import { kinLevel } from "@/lib/genomics";
import {
  BASE_DATE,
  DEFAULT_DEPTH,
  DEFAULT_ROOT,
  KIND_LABEL,
  NODES,
  NO_GENO_REASON,
  contributions,
  fFixed,
  fParents,
  instances,
  isLoopVisible,
  label,
  loops as computeLoops,
  maxDepth,
  type Depth,
} from "./data";
import { LineCombobox } from "./components/LineCombobox";
import { PedigreeTree } from "./components/PedigreeTree";
import { PedigreeList } from "./components/PedigreeList";
import { MetricStrip } from "./components/MetricStrip";
import { LoopTable } from "./components/LoopTable";
import { ContributionBars } from "./components/ContributionBars";
import { DetailPanel } from "./components/DetailPanel";
import { LoopBadge, fmtF, fmtGebv } from "./components/style";

export const meta: TemplateMeta = {
  slug: "pedigree-explorer",
  category: "viz",
  title: "계통도 탐색기",
  description:
    "기준 계통의 3~5세대 조상을 펼쳐 보고, 부모 양쪽에 함께 들어간 공통 조상(근연 루프)과 부모 간 공조계수 f가 어느 조상에서 왔는지 확인하는 계보 화면.",
  tags: ["계통도", "계보", "공조계수", "근연", "조상 기여율", "벼"],
  organism: "벼",
  status: "review",
  updatedAt: "2026-11-02",
};

type DevState = "ready" | "loading" | "empty" | "error";
function readDevState(): DevState {
  if (typeof window === "undefined") return "ready";
  const s = new URLSearchParams(window.location.search).get("state");
  return s === "loading" || s === "empty" || s === "error" ? s : "ready";
}

const DEPTH_OPTIONS: { value: `${Depth}`; label: string }[] = [
  { value: "3", label: "3세대" },
  { value: "4", label: "4세대" },
  { value: "5", label: "5세대" },
];

/** 390px 기본 표시 세대: 3세대(4열)면 한 화면에 들어온다. 4·5세대는 세로 목록으로 읽는다 */
const NARROW_QUERY = "(max-width: 639px)";
const NARROW_DEPTH: Depth = 3;
type NarrowView = "tree" | "list";
const VIEW_OPTIONS: { value: NarrowView; label: string }[] = [
  { value: "tree", label: "계통도" },
  { value: "list", label: "목록" },
];

const F_INFO =
  "두 부모에서 무작위로 고른 대립유전자가 같은 조상 유래(IBD)일 확률. 계보 기대값(근교계·기초 개체끼리 무관 가정). 0.25 이상 근연 주의, 0.375 이상 강한 근연.";

export default function Template() {
  const narrow = useMediaQuery(NARROW_QUERY);
  const [devState, setDevState] = useState<DevState>(readDevState);
  const [history, setHistory] = useState<string[]>([DEFAULT_ROOT]);
  const [depth, setDepth] = useState<Depth>(() =>
    typeof window !== "undefined" && window.matchMedia(NARROW_QUERY).matches
      ? NARROW_DEPTH
      : DEFAULT_DEPTH,
  );
  const [view, setView] = useState<NarrowView>("tree");
  const [highlight, setHighlight] = useState(true);
  const [hoverLoop, setHoverLoop] = useState<number | null>(null);
  const [pinLoop, setPinLoop] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const returnFocus = useRef<Element | null>(null);

  const root = history[history.length - 1]!;
  const rootNode = NODES[root]!;
  const hasParents = !!rootNode.dam;

  useEffect(() => {
    setHoverLoop(null);
    setPinLoop(null);
  }, [root]);

  const loops = useMemo(() => computeLoops(root), [root]);
  const contrib = useMemo(() => contributions(root), [root]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of instances(root, depth).out)
      m.set(i.id, (m.get(i.id) ?? 0) + 1);
    return m;
  }, [root, depth]);
  const f = fParents(root);
  const F = fFixed(root);
  const visibleLoops = loops.filter((l) => isLoopVisible(l, depth)).length;
  const deepest = maxDepth(root);
  const activeLoop = highlight ? (hoverLoop ?? pinLoop) : null;
  // 390px은 표와 계통도가 한 화면에 없으므로 번호를 누르면 그 공통 조상으로 이동한다
  const scrollLoop = narrow && highlight ? pinLoop : null;

  const setRoot = useCallback((id: string) => {
    setHistory((h) => (h[h.length - 1] === id ? h : [...h, id]));
    setSelected(null);
  }, []);
  const onSelect = useCallback((id: string, el: Element) => {
    returnFocus.current = el;
    setSelected(id);
  }, []);
  const changeDepth = useCallback(
    (d: Depth) => {
      setDepth(d);
      // 4·5세대는 390px 가로 폭에 들어가지 않으므로 세로 목록으로 바꾼다(되돌릴 수 있다)
      if (narrow && d > NARROW_DEPTH) setView("list");
    },
    [narrow],
  );
  const closePanel = useCallback(() => {
    setSelected(null);
    const el = returnFocus.current as HTMLElement | SVGElement | null;
    if (el && "focus" in el && el.isConnected) el.focus();
  }, []);

  // 머리(공통 PageHeader: 범위 회색 한 줄 → 제목 + 기준일 스탬프 → 데이터 한 문장)
  const header = (
    <PageHeader
      context={["벼", "계보 기준"]}
      title={meta.title}
      scope="계보 기대 공조계수(자식성 근교계 가정) · 경로 펼침 계통도 · 쌀 수량 GEBV는 2026-10 GBLUP 재추정"
      asOf={BASE_DATE}
      details={narrow ? F_INFO : undefined}
      detailsLabel="공조계수 f 뜻"
    />
  );

  if (devState === "error") {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState
          title="계보 데이터를 불러오지 못했습니다"
          description="계보 DB(교배 기록·유전자원 도입 기록) 응답이 없습니다. 잠시 뒤 다시 시도하세요."
          action={
            <Button onClick={() => setDevState("ready")}>다시 시도</Button>
          }
        />
      </div>
    );
  }
  if (devState === "loading") {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {header}
        <KpiRow loading hero count={4} skeletonHeight={128} />
        <Card title="계통도" subtitle="계보를 불러오는 중…">
          <div className="grid grid-cols-4 gap-6">
            {[0, 1, 2, 3].map((c) => (
              <div
                key={c}
                className="flex flex-col justify-around gap-3"
                style={{ minHeight: 320 }}
              >
                {Array.from({ length: 2 ** Math.min(c + 1, 3) }, (_, k) => (
                  <Skeleton key={k} height={36} />
                ))}
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }
  if (devState === "empty") {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState
          title="계보 기록이 없습니다"
          description="등록된 교배 기록이 없어 계통도를 그릴 수 없습니다. 교배 기록을 등록하면 이곳에 계보가 표시됩니다."
        />
      </div>
    );
  }

  const NA = "해당 없음";
  const parentsText = hasParents
    ? `♀ ${label(rootNode.dam!)} × ♂ ${label(rootNode.sire!)}`
    : "부모 기록 없음";

  const topLoop = loops[0];
  const outOfDepth = loops.length - visibleLoops;

  // 조작: 넓은 화면은 계통도 아래, 390px은 계통도 바로 위
  const controls = (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
      <LineCombobox value={root} onChange={setRoot} />
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">표시 세대</span>
        <Segmented
          ariaLabel="표시 세대"
          options={DEPTH_OPTIONS}
          value={`${depth}` as `${Depth}`}
          onChange={(v) => changeDepth(Number(v) as Depth)}
        />
      </div>
      {narrow && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">보기</span>
          <Segmented
            ariaLabel="계통도 보기 방식"
            options={VIEW_OPTIONS}
            value={view}
            onChange={setView}
          />
        </div>
      )}
      <Switch
        className="h-9"
        checked={highlight}
        onChange={setHighlight}
        label="근연 루프 강조"
      />
    </div>
  );

  const trail = (
    <nav
      aria-label="다시 그리기 이력"
      className="flex flex-wrap items-center gap-2 text-[13px]"
    >
      <Button
        size="sm"
        variant="ghost"
        disabled={history.length < 2}
        onClick={() => setHistory((h) => h.slice(0, -1))}
        icon={<ArrowLeft size={14} aria-hidden="true" />}
      >
        뒤로
      </Button>
      <ol className="flex flex-wrap items-center gap-1">
        {history.map((id, i) => {
          const last = i === history.length - 1;
          return (
            <li key={`${id}-${i}`} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight
                  size={14}
                  aria-hidden="true"
                  className="text-muted"
                />
              )}
              {last ? (
                <span aria-current="page" className="font-semibold text-text">
                  {label(id)}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setHistory((h) => h.slice(0, i + 1))}
                  className="touch-hit rounded-sm text-text underline decoration-border underline-offset-2 hover:decoration-text"
                >
                  {label(id)}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <span className="ml-auto text-xs text-muted">
        {KIND_LABEL[rootNode.kind]} · {rootNode.id} ·{" "}
        {rootNode.kind === "G"
          ? "도입"
          : rootNode.kind === "B"
            ? "육성"
            : "교배"}{" "}
        {rootNode.year}
      </span>
    </nav>
  );

  // 선택 지표: 넓은 화면 KpiRow(대표 + 3), 390px 가로 띠. 띠 안에서는 위로 열리는 ⓘ가 잘리므로 뜻은 머리 「자세히」로
  const tiles = [
    <KpiTile
      key="f"
      size="hero"
      label="부모 간 공조계수 f"
      value={f === null ? NA : fmtF(f)}
      badge={f !== null ? <KinBadge level={kinLevel(f)} /> : undefined}
      info={narrow ? undefined : F_INFO}
      sub={
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold text-text">{parentsText}</span>
          {f !== null && (
            <span>
              정밀값 {fmtF(f, 4)} · 기록된 전체 계보 기준(최대 {deepest}
              세대) · 표시 세대와 무관
            </span>
          )}
        </span>
      }
    />,
    <KpiTile
      key="inbreeding"
      label="근교계수 F"
      value={F === null ? NA : F.toFixed(3)}
      sub={
        F === null ? (
          "부모 기록 없음"
        ) : (
          <span className="flex flex-col gap-0.5">
            <span>F7 고정 계통 가정 · 자식으로 거의 동형접합</span>
            <span className="text-text">
              F는 자식으로 1에 가까워지므로 근연 정도는 부모 간 f로 판단
            </span>
          </span>
        )
      }
    />,
    <KpiTile
      key="loops"
      label="근연 루프(공통 조상)"
      value={f === null ? NA : loops.length}
      unit={f === null ? undefined : "개"}
      sub={
        f === null
          ? "부모 기록 없음"
          : `표시 세대 안 ${visibleLoops}/${loops.length}`
      }
    />,
    <KpiTile
      key="gebv"
      label="기준 계통 GEBV(쌀 수량)"
      value={rootNode.gebv === null ? "없음" : fmtGebv(rootNode.gebv)}
      unit={rootNode.gebv === null ? undefined : "kg/10a"}
      sub={
        rootNode.gebv === null
          ? NO_GENO_REASON
          : `r² ${rootNode.r2!.toFixed(2)} · 2026-10 GBLUP`
      }
    />,
  ];

  const showList = narrow && view === "list";

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* 결론 띠: 머리 바로 아래 한 곳. 기준 계통·표시 세대에 따라 바뀐다 */}
      <SummaryCallout live>
        <b>{label(root)}</b>
        {f === null ? (
          <> — 부모 기록이 없어 공조계수를 계산할 수 없습니다.</>
        ) : loops.length === 0 ? (
          <>
            {" "}
            — {parentsText}. 부모 사이 공통 조상이 없어 부모 간 f는{" "}
            <b>{fmtF(f)}</b>입니다.
          </>
        ) : (
          <>
            {" "}
            — {parentsText}, 부모 간 f <b>{fmtF(f)}</b>. 기여가 가장 큰 공통
            조상은 <b>{label(topLoop!.ancestor)}</b>(기여{" "}
            {topLoop!.contrib.toFixed(4)})이고, 공통 조상은 모두 {loops.length}
            개입니다.
            {outOfDepth > 0 && (
              <>
                {" "}
                그중 {outOfDepth}개는 표시 세대 밖에 있습니다.
              </>
            )}
          </>
        )}
      </SummaryCallout>

      {/* 주 그림: 계통도는 넓은 그림이라 전체 폭. 조작·범례는 그림 아래(390px은 조작만 그림 바로 위) */}
      <Card
        title={`${label(root)} 계통도`}
        subtitle={
          hasParents
            ? showList
              ? `기준 계통 아래로 ${depth}세대까지. 모본 쪽을 먼저, 들여쓰기가 세대다. 행을 누르면 상세가 열린다.`
              : `왼쪽 = 기준 계통, 오른쪽으로 ${depth}세대까지. 조상은 경로마다 한 번씩 놓고 모본을 위, 부본을 아래에 둔다. 노드를 누르면 상세가 열린다.`
            : undefined
        }
      >
        {narrow && <div className="mb-3">{controls}</div>}
        {hasParents ? (
          showList ? (
            <PedigreeList
              root={root}
              depth={depth}
              loops={loops}
              highlight={highlight}
              activeLoop={activeLoop}
              scrollLoop={scrollLoop}
              selectedId={selected}
              onSelect={onSelect}
            />
          ) : (
            /* 가로 스크롤 안내·페이드는 실제로 넘칠 때만(768px 포함, 공통 ScrollRegion) */
            <ScrollRegion
              label="계통도(가로 스크롤)"
              hint="옆으로 밀어 상위 세대 보기 →"
              className="pb-2"
            >
              <PedigreeTree
                root={root}
                depth={depth}
                loops={loops}
                highlight={highlight}
                activeLoop={activeLoop}
                scrollLoop={scrollLoop}
                selectedId={selected}
                onSelect={onSelect}
              />
            </ScrollRegion>
          )
        ) : (
          <EmptyState
            title="부모 기록이 없는 기초 계통(또는 도입 유전자원)입니다. 계보를 그릴 수 없습니다."
            description={`${label(root)}은(는) ${KIND_LABEL[rootNode.kind]}입니다. 이 개체를 부모로 쓴 계통을 기준으로 고르면 계보 안의 위치를 볼 수 있습니다.`}
            action={
              <Button size="sm" onClick={() => setSelected(root)}>
                이 개체 상세 보기
              </Button>
            }
          />
        )}
        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          {!narrow && controls}
          {hasParents && <TreeLegend loops={loops} highlight={highlight} />}
          {trail}
        </div>
      </Card>

      {/* 선택 지표 */}
      {narrow ? (
        <MetricStrip label="선택 지표(가로 스크롤)">{tiles}</MetricStrip>
      ) : (
        <KpiRow hero ariaLabel="선택 지표">
          {tiles}
        </KpiRow>
      )}

      {/* D·E */}
      <PageGrid>
        <Card
          className="col-span-12 xl:col-span-7"
          title="근연 루프 — 부모 양쪽의 공통 조상"
          subtitle={
            f === null
              ? undefined
              : `기여 내림차순 · 합계 = 부모 간 f ${fmtF(f, 4)} · 번호를 누르면 계통도에서 그 경로쌍만 강조`
          }
        >
          {f === null ? (
            <p className="text-[13px] text-muted">
              {NA} — 부모 기록이 없습니다.
            </p>
          ) : (
            <LoopTable
              loops={loops}
              f={f}
              depth={depth}
              highlight={highlight}
              activeLoop={activeLoop}
              pinned={pinLoop}
              onHover={setHoverLoop}
              onPin={setPinLoop}
            />
          )}
        </Card>
        <Card
          className="col-span-12 self-start xl:col-span-5"
          title="조상 기여율 — 기초 조상"
          subtitle="기준 계통 게놈 중 각 조상 유래 기대 비율 g = Σ(½)^세대수"
        >
          {hasParents ? (
            <ContributionBars key={root} items={contrib} />
          ) : (
            <p className="text-[13px] text-muted">
              {NA} — 부모 기록이 없습니다.
            </p>
          )}
        </Card>
      </PageGrid>

      {/* G. 각주 */}
      <footer className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted">
        <p>
          공조계수는 계보 기대값(근교계 가정, 기초 개체끼리 무관 가정). 유전체
          실현값(GRM)과 다를 수 있음.
        </p>
        <p>
          수량은 쌀 수량(백미 기준). GEBV는 2026-10 GBLUP 재추정값(훈련 집단
          평균 0 기준 편차).
        </p>
        <p>계통·품종명은 가상, 유전자 이름은 실제이나 보유 여부는 가상.</p>
      </footer>

      {selected && (
        <DetailPanel
          id={selected}
          isRoot={selected === root}
          count={counts.get(selected) ?? 0}
          onClose={closePanel}
          onRedraw={setRoot}
        />
      )}
    </div>
  );
}

function TreeLegend({
  loops,
  highlight,
}: {
  loops: ReturnType<typeof computeLoops>;
  highlight: boolean;
}) {
  const sw = "inline-block h-3.5 w-6 shrink-0";
  return (
    <ul
      className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted"
      aria-label="범례"
    >
      <li className="flex items-center gap-1.5">
        <span
          className={`${sw} rounded-[4px] border border-accent/60 bg-accent/10`}
        />
        품종
      </li>
      <li className="flex items-center gap-1.5">
        <span className={`${sw} border border-muted bg-surface`} />
        계통
      </li>
      <li className="flex items-center gap-1.5">
        <span
          className={`${sw} rounded-[3px] border border-dashed border-muted bg-surface`}
        />
        도입 유전자원
      </li>
      <li className="flex items-center gap-1.5">
        <span
          className={`${sw} rounded-[3px] border border-border bg-surface-2`}
        />
        기초 계통(기록 없음)
      </li>
      <li className="flex items-center gap-1.5">
        <svg width="26" height="8" aria-hidden="true">
          <line
            x1="0"
            x2="26"
            y1="4"
            y2="4"
            className="stroke-muted"
            strokeWidth="1.5"
          />
        </svg>
        ♀ 모본
      </li>
      <li className="flex items-center gap-1.5">
        <svg width="26" height="8" aria-hidden="true">
          <line
            x1="0"
            x2="26"
            y1="4"
            y2="4"
            className="stroke-muted"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        </svg>
        ♂ 부본
      </li>
      <li className="flex items-center gap-1.5">
        <span className="font-bold text-accent">＋상위</span> 상위 계보 더 있음
      </li>
      {highlight &&
        loops.map((l, i) => (
          <li
            key={l.ancestor}
            className="flex items-center gap-1.5 font-medium text-text"
          >
            <LoopBadge i={i} />
            {label(l.ancestor)}
          </li>
        ))}
    </ul>
  );
}
