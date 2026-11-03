# 공개 API 계약

템플릿 빌더는 아래에 있는 것만 import한다. 새 공개 API는 `design-system-architect`가 승격 절차로만 추가하고, 추가하면 이 문서에 적는다.

## 목차

필요한 절만 찾아 읽는다(제목으로 grep). 새 절을 추가하면 이 목록에도 넣는다.

- **갤러리**: @/gallery/types · 갤러리 로딩·DOM 계약 · 갤러리 셸·상세 화면(경로, 가져오기 모달·다운로드, 연결형 템플릿, 피드백, 빌드)
- **스타일**: Tailwind 토큰 클래스 · 공통 CSS 클래스·변형(`touch-hit`, `select-ring` 등)
- **@/design-system**: export 목록(컴포넌트·훅) · 컴포넌트 상세
  - 페이지 구조: PageHeader · KpiRow · KpiTile 옵션 · SummaryCallout · ScrollRegion
  - 표·목록: DataTable 옵션 · AlertList · SaveBar · Toast
  - 입력·선택: Segmented · FilterChip · Slider 옵션 · BottomSheet
  - 차트 보조·범례: SequentialScaleLegend · DivergingBar
  - 인포그래픽: ScaledCanvas · CanvasBigNumber · CanvasSectionTitle · MobileSummary
- **@/charts**: EChart 래퍼, 테마, 팔레트, 선택 표시, markLine 프리셋, 시리즈 도우미
- **@/lib**: rng · format · genomics(목업 생성기, KASP 상수) · stats(상관·회귀·t·이항)

## @/gallery/types

```ts
export type TemplateCategory = 'kpi' | 'viz' | 'infographic' | 'workflow'
export interface TemplateMeta {
  slug: string              // 폴더 이름과 같아야 함
  category: TemplateCategory // 상위 폴더 이름과 같아야 함
  title: string             // 한국어 제목
  description: string       // 한 문장
  tags: string[]            // 예: ['GWAS', '벼', '맨해튼']
  organism?: string         // 예: '벼'
  status: 'draft' | 'review' | 'stable'
  updatedAt?: string        // YYYY-MM-DD
}
```

템플릿 `index.tsx`는 `export const meta: TemplateMeta`와 `export default function` 컴포넌트를 둘 다 export한다.

## 갤러리 로딩·DOM 계약(`src/gallery/registry.ts`, `TemplateView.tsx`)

템플릿은 import하지 않는다(`@/gallery/registry`는 갤러리 내부용). 빌더·QA가 알아야 할 동작만 적는다.

- 템플릿 모듈은 **지연 로드**한다(`import.meta.glob('../templates/*/*/index.tsx')`, eager 아님). 빌드에서 템플릿마다 별도 청크가 된다.
  템플릿 하나의 import 오류(없는 export 등)나 모듈 평가 오류는 그 템플릿 화면과 목록의 해당 항목에만 나타나고, 다른 템플릿 화면·목록은 영향을 받지 않는다.
  그래서 템플릿 모듈 최상위의 부수 효과(DEV 검산 `console.assert` 포함)는 그 템플릿을 열 때(목록·사이드바에서는 목록을 모을 때)만 실행된다.
- slug 존재 여부는 glob 키(파일 경로)로 동기 판단한다. 폴더가 없을 때만 `data-template-missing`을 렌더한다.
- 템플릿 상세(`/#/t/{category}/{slug}`, `?embed=1` 포함) 상태별 DOM:

| 상태 | DOM |
| --- | --- |
| 모듈 로딩 중 | `[data-template-loading="{category}/{slug}"]`(role=status). 루트·오류·missing 없음 |
| 성공 | `[data-template-root="{slug}"][data-print-flat]` 안에 ErrorBoundary + 템플릿 |
| 모듈 로드 실패 | `[data-template-root="{slug}"]` 안 `[data-template-error="{slug}"]` — 제목 '템플릿 모듈을 불러오지 못했습니다.', 메시지 `src/templates/{category}/{slug}/index.tsx 모듈을 불러오지 못했습니다: {원래 오류}` |
| 렌더 오류 | `[data-template-root="{slug}"]` 안 `[data-template-error="{slug}"]` — 제목 '템플릿 렌더 중 오류가 발생했습니다.', 메시지 `error.message` |
| 폴더 없음 | `[data-template-missing="{category}/{slug}"]` |

  `verify-templates.mjs`는 `[data-template-root="{slug}"], [data-template-error], [data-template-missing]`을 최대 15초 기다리므로 로딩 상태를 따로 기다리지 않는다.
- 목록(`#/library?category=&q=`, 홈은 `#/`): 갤러리 모드에서 App이 모든 템플릿 모듈을 개별로 로드해 한 번 모으고(`useTemplateList`) 홈·사이드바·목록에 함께 넘긴다. 임베드 모드는 목록을 로드하지 않는다. 모으는 동안 목록 머리에 `role=status` 「템플릿 불러오는 중…」과 폴더 수 기준 자리 표시를 보인다.
  로드에 실패한 템플릿은 `[data-template-load-failed]`(role=alert) 상자에 파일 경로(상세 화면 링크)와 오류 메시지로 보이고, 나머지는 카드로 정상 표시한다. 실패 항목은 사이드바에서 빠진다.
  `_` 접두 slug는 숨긴다. meta·폴더 불일치(`meta.slug`·`meta.category`)와 default/meta export 누락은 `console.warn('[gallery] …')`으로 알린다.
- **QA·빌더가 의존하는 훅**: `data-template-root|loading|missing|error`, `data-template-load-failed`, `data-print-hide|flat`, `data-chart-ready`(차트 래퍼), URL `#/t/{category}/{slug}`·`?embed=1`·`?theme=`. 이 목록을 바꾸면 template-qa 스크립트(verify·gen-thumbs·check-ssr)를 함께 고친다. 2026-11-03 기준 `data-gallery-loading`·`data-template-load-failed-item`은 코드에 없다(쓰는 스크립트도 없다).

### 갤러리 셸·상세 화면(2026-11-03 기준)

갤러리 셸·상세 화면·피드백·다운로드는 하네스 밖 작업(GitHub PR #1~#4)에서도 바뀐다. 세부 동작은 코드(`src/App.tsx`, `src/gallery/*`, `src/features/*`)와 저장소 문서 `docs/template-preview-layout.md`·`docs/template-feedback.md`를 기준으로 한다. 이 절에는 빌더·QA·설계자가 알아야 할 것만 적는다. 갤러리를 바꾸는 설계자는 먼저 위 두 문서와 해당 코드를 읽는다.

- **경로**(`src/gallery/router.ts`의 `templateHref`·`libraryHref`): `#/` 홈(`Home.tsx`, 카테고리별 개수) · `#/library?category=&q=` 목록(`Gallery.tsx`·`ListSections.tsx`·`TemplateCard.tsx`) · `#/t/{category}/{slug}` 상세(`TemplatePage.tsx`) · 그 밖은 찾을 수 없음.
- **정렬**: 사이드바·목록 구획·이전/다음이 모두 카테고리(`CATEGORIES` 순서, 그 밖의 폴더는 뒤에 이름순) → 묶음 안 `meta.title`(ko) 순(`src/gallery/order.ts`). 묶음은 폴더 카테고리(`path.category`) 기준이다.
- **썸네일**: `src/gallery/thumbs/{category}-{slug}-{light|dark}.webp`(template-qa `gen-thumbs.mjs`, 720×450). `src/gallery/thumbs.ts`가 **있는 파일만** 지도로 만든다(없으면 카테고리 라벨만, 404 요청 없음).
- **상세 화면**: 상단(목록으로 · 메타 · 설명 · 「프로젝트에 가져오기」) → 미리보기 프레임 `section[data-template-preview-frame][data-print-flat]`(프레임 바: 미리보기 모드·폭·테마·임베드 열기, 안쪽 `[data-template-preview-content]`에 템플릿 또는 사용자 데이터 결과) → `nav[data-template-navigation][data-print-hide]`(이전·다음·전체 목록).
  폭 768·390은 `iframe[data-template-preview]`(`?embed=1&theme={현재}#/t/…`) 안에서 렌더한다. iframe은 화면 높이를 넘지 않는 sticky 창이라 템플릿의 fixed 요소(BottomSheet·Toast·좁은 화면 SaveBar)와 vh가 실제 기기처럼 창 기준으로 그려진다. QA는 늘 `?embed=1`로 직접 열므로 프레임의 영향을 받지 않는다.
- **가져오기 모달**(`TemplateResources.tsx`, native `<dialog>`): `public/downloads/{category}/{slug}/`의 `starter.zip`·`sample-data.json`·`schema.json`·`guide.md`(연결형은 `sample-data.csv`까지)를 내려받게 한다. 이 파일은 `scripts/prepare-downloads.mjs`가 `predev`·`prebuild`에서 만든다(git 제외). 스크립트는 템플릿마다 `index.tsx`·`data.ts`를 Vite SSR로 불러오고, `README.md`를 guide 원문으로, `data.ts`의 직렬화 가능한 내보내기를 `sample-data.json`으로 쓴다. 템플릿 하나라도 실패하면 `npm run dev`·`build`가 멈춘다 → template-authoring 「다운로드 스타터」 규칙, 검사는 template-qa `check-ssr.mjs`.
- **연결형 템플릿**: `kpi/program-overview`만 `data?: ProgramDataset`(`@/features/template-data/contract`) prop을 받아 사용자 데이터(JSON·CSV, `DataImport`)로 렌더한다. 다운로드 스크립트가 이 템플릿 `data.ts`의 `MU`·`YEARS`·`I`·`R`·`SIGMA_A`·`L`·`dGTargetPct`로 샘플·스키마·CSV를 만들므로 이 내보내기 이름을 바꾸거나 지우지 않는다(`check-ssr.mjs`가 확인).
- **피드백**(`src/features/feedback`, 서버 `server/feedback-*.ts`·`api/feedback.ts`·`db/feedback-schema.sql`): `TemplateView`가 템플릿을 `FeedbackOverlay`(`.fb-wrapper > .fb-surface`)로 감싼다. 즉 `data-template-root` 안이고 임베드 화면도 포함한다. 도구(`.fb-dock-stack`·`.fb-panel`·`[data-feedback-pin]`·`.fb-target-highlight`)는 화면 고정·포털로 그려진다. 공유 저장은 Neon Postgres(`DATABASE_URL`)이고 로컬 dev 서버는 Vite 미들웨어 `/api/feedback`가 처리한다. API는 `server/feedback-templates.ts` 목록에 있는 템플릿만 받는다. 이 목록은 생성 파일이다(`npm run sync:feedback-templates`, 폴더와 다르면 `tests/feedback-templates.test.mjs`가 실패한다). QA(verify·gen-thumbs)는 이 도구들을 숨기고 템플릿만 검사·촬영한다(`DATABASE_URL` 없이도 verify 문제 0건, 2026-11-03 program-overview 확인). 템플릿은 `.fb-*` 클래스와 `data-feedback-*` 속성을 쓰지 않는다.
- **빌드**: `npm run build` = `prebuild`(다운로드 준비) → `test:feedback`(node --test 4개) → typecheck → vite build. 공통 모듈을 바꾼 뒤의 완료 조건 「build 성공」은 이 전체가 통과한다는 뜻이다.
- 페이지가 바뀌면(해시 변경) 맨 위로 스크롤한다. 갤러리·임베드 모두 템플릿 위에 고정 바가 없으므로 템플릿의 `lg:sticky lg:top-4`가 가리지 않고, `SaveBar` `placement="responsive"`는 `md:top-4`를 쓴다.

## Tailwind 토큰 클래스

`index.css`의 `@theme`에서 토큰을 다음 이름으로 연결한다. 빌더는 이 클래스명을 쓴다.

| 토큰 | 클래스 예 |
| --- | --- |
| `--color-bg`, `--color-surface`, `--color-surface-2` | `bg-bg`, `bg-surface`, `bg-surface-2` |
| `--color-border` | `border-border` |
| `--color-text`, `--color-text-muted` | `text-text`, `text-muted` |
| `--color-accent`, `--color-accent-contrast` | `bg-accent`, `text-accent`, `text-accent-contrast` — **데이터와 선택 표시(포커스 링 포함)에만** |
| `--color-primary`, `--color-primary-contrast` | `bg-primary`, `text-primary-contrast` — 주 버튼(라이트 #1d1f20 + 흰 글자, 다크 흰 채움 + #0e1116 글자)·Stepper 현재 단계 |
| `--color-panel`, `--color-panel-ink`, `--color-panel-muted` | `bg-panel`, `text-panel-ink`, `text-panel-muted` — 결론 패널. 라이트는 주 버튼과 같은 잉크, 다크는 표면 2·글자·보조 글자와 같은 값으로 새 색이 아니다 |
| `--color-active` | `bg-active` — UI 크롬 활성 회색 채움(FilterChip 켜짐, Stepper 현재 번호). 라이트 #e2e5ea, 다크 #2f3540 |
| `--color-positive/negative/warning/info` | `text-positive`, `bg-warning/10` 등 |
| `--radius-sm/md/lg` | `rounded-sm/md/lg` |

2026-10-30(디자인 개선 1차, 앱 화면 규칙): 강조색은 UI 크롬(주 버튼, Segmented·Tabs·FilterChip·Switch 활성, 대표 KPI 테두리)에 쓰지 않는다. 주 버튼은 `--color-primary`, 크롬 활성은 회색 채움(`--color-active`)이나 잉크 글자 + 2px 잉크 밑줄, 스위치 켜짐은 잉크 채움이다.

### 공통 CSS 클래스·변형(`src/index.css`)

| 이름 | 동작 |
| --- | --- |
| `touch:` 변형 | `@media (pointer: coarse), (max-width: 639px)`에서만 적용. 예: `touch:h-11`, `touch:gap-4` |
| `touch-hit` | 좁은 화면·터치에서 `::after` 투명 영역으로 누르는 영역을 가로·세로 최소 44px(요소 가운데 기준). 보이는 크기·데스크톱 화면은 같다. 따로 떨어진 작은 버튼·아이콘 버튼·칩. 요소에 `position: relative; isolation: isolate`, `::after`는 `z-index: −1`(요소 자신의 내용 아래 — 라벨 안 버튼·체크박스를 덮지 않아 자동화 클릭이 가로채이지 않는다). `::after`를 따로 쓰는 요소에는 붙이지 않는다 |
| `touch-hit-y` | 같은 방식으로 세로만 44px, 가로는 요소 폭(붙어 있는 선택지 묶음처럼 옆과 겹치면 안 될 때) |
| `label > input[type=checkbox\|radio]` | 라벨로 감싼 체크박스·라디오는 라벨에 자동으로 세로 44px 영역(전역 규칙). 맨 체크박스는 `<label className="touch-hit …">`로 감싼다 |
| `.overflow-x-auto`(터치) | 좁은 화면·터치에서 `overflow-y: hidden`(넓힌 영역이 가로 스크롤 줄 안에서 세로 스크롤 막대를 만들지 않게). 세로 스크롤이 필요하면 `overflow-y-auto`를 함께 준다 |
| `select-ring` | 데이터 위 선택 표시(HTML 칸·카드): 글자색 2.5px 안쪽 테두리 + 표면색 1.5px 안쪽 후광. box-shadow라 `shadow-*`와 같이 쓰지 않는다. SVG·ECharts는 `selectionStroke`(@/charts) |

인쇄: tokens.css 다크 블록은 `screen` 전용이다. 인쇄는 화면 테마와 관계없이 라이트 토큰이고, 인쇄 캔버스(`ScaledCanvas print`)의 figure 배경은 흰색(`#ffffff`)이다. 인쇄 캔버스 화면에서는 beforeprint 때 `<html data-printing>`이 켜져 JS가 읽는 토큰(`useChartTheme`)도 라이트로 다시 읽힌다(`themeMode.ts`).

## @/design-system

| export | 용도 | 주요 props |
| --- | --- | --- |
| `Card` | 기본 표면 | `title?`, `subtitle?`, `actions?`, `padding?: 'sm'\|'md'\|'lg'`, `children`. `actions`는 제목 줄에 안 맞으면 아래 줄로 내려가고, 그 줄보다 넓으면 안쪽에서 줄을 바꾼다(`min-w-0 max-w-full flex-wrap`, 2026-10-30 — `shrink-0`이라 390에서 넓은 범례·토글 묶음이 카드 밖으로 넘쳤다). 묶음을 한 요소로 감쌀 때 그 요소도 `flex flex-wrap`이어야 안에서 줄이 바뀐다 |
| `KpiTile` | 지표 카드 | `label: ReactNode`, `plainLabel?`, `value: number\|string`, `unit?`, `sub?`, `delta?: number\|null`, `deltaUnit?`(기본 '%'), `deltaDigits?`(기본 1), `deltaLabel?`, `better?: 'up'\|'down'`, `target?: number`, `targetLabel?`, `achievement?`, `achievementDigits?`, `achievementLabel?`(기본 '달성률'), `severity?: KpiSeverity`, `badge?: ReactNode`, `range?: KpiRange`, `spark?`(**@deprecated, 그리지 않음** 2026-10-30), `period?`, `info?`, `digits?`, `size?: 'default'\|'compact'\|'hero'` — 아래 상세. 배치는 `KpiRow` |
| `KpiRow` | KPI 줄 배치 | `children`(KpiTile들, col-span 클래스 없이), `hero?`(첫 타일 2칸), `cols?: {md?, lg?}`, `loading?`, `count?`, `skeletonHeight?`(기본 132), `ariaLabel?`(기본 '핵심 지표'), `className?` — 아래 상세. 2026-10-30 신설 |
| `PageHeader` | 페이지 머리 | `title`, `context?: ReactNode \| string[]`(제목 위 범위·소속 회색 한 줄), `scope?`(제목 아래 데이터 한 문장), `asOf?`, `asOfLabel?`(기본 '기준일'), `actions?`, `details?`, `detailsLabel?`(기본 '자세히'), `detailsOpen?`, `className?` — 아래 상세. 2026-10-30 신설 |
| `SummaryCallout` | 결론 한 문장 띠 | `children`(인라인 문장), `tone?: 'neutral'\|'info'\|'warning'\|'negative'`(기본 neutral), `icon?`, `dismissible?`, `onDismiss?`, `dismissLabel?`(기본 '안내 닫기'), `mobileLines?`(기본 3, 0 = 제한 없음), `live?`, `className?` — 아래 상세. 2026-10-30 신설 |
| `ScrollRegion` | 표가 아닌 가로 스크롤 영역 | `children`, `label`(넘칠 때 region 이름), `hint?`(기본 '옆으로 밀어 전체 보기 →', false = 숨김), `fade?`(기본 true), `fadeColor?`(기본 surface), `className?`(스크롤 컨테이너), `wrapperClassName?`, `innerClassName?`(2026-10-30 C단계), `onOverflowChange?`, `scrollRef?` — 아래 상세. 2026-10-30 신설 |
| `SeverityTag` | 심각도 문자 태그 | `severity: 'ok'\|'warning'\|'critical'\|'info'`, `label?`(기본 달성/주의/경보/정보), `className?`. KpiTile 태그와 같은 규격(아이콘 + 문자, 테두리만 의미색, 글자는 text 색). 표·불릿·카드에 심각도를 그릴 때 쓴다. 2026-10-30 공개 |
| `ChartCard` | 차트 + 제목·범례·출처 | `title`, `subtitle?`, `source?`, `actions?`, `height: number`, `children`. `actions` 줄바꿈은 `Card`와 같다(2026-10-30) |
| `Badge` | 상태 표시 | `tone: 'neutral'\|'positive'\|'negative'\|'warning'\|'info'`, `children`. 색 톤 배경은 의미색 10%를 CSS 변수 `--badge-base`(기본 transparent → 반투명 10%)에 섞는다. 색이 깔린 컨테이너 안에서는 그 컨테이너에 `[--badge-base:var(--color-surface)]`를 주면 배지가 불투명해져 12px 글자 대비가 AA(라이트 ≥5.1, 다크 ≥5.9)로 유지된다. DataTable `highlight` 행은 이미 지정돼 있다 |
| `DataTable<T>` | 정렬 가능한 표 | `columns: {key, header, align?, numeric?, format?, width?, sortable?, sortValue?, sortDescFirst?, headerTitle?, hideBelow?}[]`, `rows: T[]`, `rowKey`, `dense?`, `maxHeight?`, `onRowClick?`, `highlight?: (row)=>boolean`, `activeRow?: (row)=>boolean`, `caption?`, `emptyText?`, `stickyColumn?: string \| {key, below?: 'md'\|'lg'}`, `defaultSort?: DataTableSort`, `sort?`/`onSortChange?`(제어형), `allowUnsorted?`, `pageSize?`, `page?`/`onPageChange?`, `pageLabel?`, `rowProps?`, `rowTone?`, `scrollHint?` — 아래 상세 |
| `Tabs` | 탭 | `items: {id, label}[]`, `value`, `onChange`. `label`은 문자열이 보통이고 ReactNode도 받는다(갤러리 「전체 <회색>33</회색>」, 2026-11-02 하위 호환 확장) |
| `Segmented` | 소수 옵션 토글 | `options: SegmentedOption[]`(`{value, label: ReactNode, disabled?, data?, describedBy?, title?}`), `value: V \| null`(null = 미선택), `onChange`, `size?`, `ariaLabel?`/`ariaLabelledBy?`, `optionClassName?` — 아래 상세 |
| `Select` | 드롭다운 | `options`, `value`, `onChange`, `label` |
| `Slider` | 수치 입력 | `min`, `max`, `step`, `value`, `onChange`, `label`, `format?`, `ticks?: (number \| SliderTick)[]`, `pageStep?`, `valueText?: string \| (v)=>string`, `prominent?` — 아래 상세 |
| `Stat` | 큰 숫자(요약 카드) | `value`, `unit?`, `label`, `caption?`, `size?: 'md'\|'lg'\|'xl'`(30/40/44px — 2026-10-30 36/48/72에서 낮춤, 앱 화면 숫자는 48px 미만), `color?` |
| `SectionHeader` | 섹션 제목 | `title`, `description?`, `actions?`, `level?`. 페이지 머리(level 1)는 `PageHeader`로 옮긴다 |
| `EmptyState` / `ErrorState` / `Skeleton` | 상태 화면 | `title`, `description?`, `action?` / `height?` |
| `Legend` | HTML 범례 | `items: {label, color, shape?: LegendShape}[]`. `shape`: `'square'`(기본, `color`에 CSS 배경 값도 받음) · `'line'` · `'dashed'` · `'circle'`(채운 원) · `'ring'`(빈 원: `color` 1.5px 테두리 + 표면색 속) · `'diamond'`(산점 다이아몬드, 예: 리드 SNP) · `'diamond-open'`(빈 다이아몬드, 예: 목표 표식) · `'plus'`(더하기 표식) · `'triangle'`(예: 한계 위반 점) · `'hatch'`(`color` 바탕 + 표면색 사선 = `stripeBg`·`stripeDecal`과 같은 모양: 계획·예정·같은 계열의 두 번째 구성) · `'missing'`(결측·대기 회색 빗금 `HATCH_MISSING_DENSE` + 1px 테두리, `color` 무시). 견본은 차트 마크와 같은 모양을 고른다(산점도의 채운 원·빈 원을 글자로 적거나 사각 견본으로 대신하지 않는다). 빗금을 `color`에 `HATCH_MISSING`·`stripeBg(…)` 문자열로 넘기는 우회는 기존 호환으로 동작하지만 새 코드는 `shape`를 쓴다. 타입 `LegendShape`. 2026-10-30 C단계 |
| `Tooltip` | 정보 툴팁 | `content`, `children`, `className?`. 마우스 호버·키보드 포커스·**터치 탭**으로 열린다(다시 탭하거나 바깥을 탭하면 닫힘, Esc). 열린 말풍선이 화면 밖으로 나가면 안쪽으로 민다(2026-10-30). 비활성 사유 툴팁은 `disabled` 대신 `aria-disabled` 버튼에 단다 |
| `PageGrid` | 반응형 12열 격자 | `children`; 자식은 `col-span-*` 클래스로 배치 |
| `Button` | 업무 화면 버튼 | `variant?: 'primary'\|'secondary'\|'ghost'\|'danger'`(기본 secondary, primary = `--color-primary` 거의 검정 채움 2026-10-30), `size?: 'sm'\|'md'`(28/36px, 좁은 화면·터치는 누르는 영역 44px `touch-hit`), `icon?: ReactNode`(글자 앞), 그 밖의 `<button>` 속성(`disabled`, `aria-*`, `onClick` 등). `type` 기본 'button', ref 전달 |
| `Toast` / `useToast` | 저장·확정 피드백 | `Toast`: `message: ReactNode\|null`, `onClose`, `tone?: ToastTone`(기본 positive), `duration?`(ms, 기본 4000, 0=자동 닫힘 없음), `className?`(위치), `closeLabel?`. `useToast(defaults?)` → `{ show(message, {tone?, duration?}), dismiss, toastProps }` — 아래 상세 |
| `ConclusionPanel` | 화면의 판단 하나를 세우는 어두운 면(2026-11-02) | `label`(범위 줄), `value`, `unit?`, `valueLabel?`, `statement`(판단 한 문장), `aside?`(작은 실제 추세 차트), `className?`. 화면당 1개, 판단이 없으면 쓰지 않고 `SummaryCallout`을 쓴다. 면 색 `--color-panel`(라이트 잉크, 다크 표면 2), 강조색 채움 금지 |
| `ConclusionBundle` | 대표 면 47% + 연한 타일 53% 묶음(2026-11-02) | `panel`, `children`(타일 2~4개), `className?`. 컨테이너 1024px 미만은 대표 면이 전체 폭으로 올라간다 |
| `SectionMark` | 구획 시작 표식(2026-11-02) | `children`, `className?`. 8px 잉크 사각형 + 12px 라벨. 구획의 시작에만 쓰고 장식으로 반복하지 않는다 |
| `Stepper` | 다단계 단계 표시 | `items: {id, label, description?, enabled?, done?}[]`, `current`, `onChange(id)`, `ariaLabel`, `compactBelow?: 'md'\|'lg'`, `className?`. 현재 단계 `aria-current="step"`. `compactBelow`(기본: 4단계 이하 md, **5단계 이상 lg**) 미만은 'n/총 + 단계 이름 + 번호 버튼' 축약. 문자열 `description`은 ' · ' 구절마다 nowrap(날짜 '05-20'이 하이픈에서 끊기지 않게, ReactNode면 템플릿이 단위마다 nowrap span). 번호 버튼은 28px, 좁은 화면·터치에서 누르는 영역 44px·간격 16px(모자라면 아래 줄 오른쪽). 현재 단계 = 잉크(`--color-primary`) 번호 + 잉크 밑줄, 완료 = 회색 원 테두리 + 잉크 체크(의미색 녹색 원 아님), 강조색·의미색 없음(2026-10-30, 앱 화면 규칙 T7) |
| `ScaledCanvas` / `u` | 고정 비율 인포그래픽 캔버스 | `width?`(기본 1920), `height?`(기본 1080), `minScale?`(기본 0.6), `print?: 'a4-landscape'\|'a4-portrait'`, `ariaLabel`, `regionLabel?`, `className?`, `summary?: ReactNode`(잘릴 때만 위에 보일 요약, 보통 MobileSummary), `onClampedChange?`, `fadeColor?`(기본 var(--color-bg)), `children`. 자식 크기는 `u(n)` — 아래 상세 |
| `CanvasSectionTitle` | `ScaledCanvas` 안의 인포그래픽 영역 제목 | `title`, `sub?`, `right?`, `no?`(주면 번호 배지, 없으면 세로 막대), `size?`(기본 21), `gapBelow?`(기본 8). 모든 크기가 `u(n)` — 아래 상세 |
| `CanvasBigNumber` | `ScaledCanvas` 안의 인포그래픽 큰 숫자 카드 | `value`, `unit`, `label`, `sub`, `primary?`, `labelPosition?: 'above'\|'below'`(기본 below), `note?`, `keepSegments?`, `size?: 'default'\|'compact'` — 아래 상세. 2026-10-30 승격 |
| `MobileSummary` | 인포그래픽 요약 카드(캔버스가 잘릴 때 캔버스 위, 인쇄 제외) — `<ScaledCanvas summary={<MobileSummary …/>}>`로 넘긴다 | `title: ReactNode`(h2), `items: MobileSummaryItem[]`(`{key, label, value, detail?, primary?}`), `footer?: ReactNode`(아래 한 줄 결론), `ariaLabel?`(기본 '핵심 요약') — 아래 상세. 2026-10-27 승격 |
| `AlertList` | 경보·주의·정보 목록 | `items: AlertListItem[]`(`{id, severity: 'warning'\|'critical'\|'info', title, description?, value?, icon?, onClick?, actionLabel?}`), `ariaLabel?`, `emptyText?`, `density?: 'default'\|'compact'`, `chevron?`(기본 true), `actionLabel?`(기본 '— 자세히 보기'), `className?` — 아래 상세 |
| `DivergingBar` | 0 기준 양방향 가로 막대 한 줄 | `value`, `domain: number | [neg, pos]`, `label?`, `valueText?`, `negativeTag?`, `layout?: 'stacked'|'inline'`(기본 stacked), `tone?: 'sign'|'accent'`(기본 sign), `className?` — 아래 상세 |
| `KinBadge` | 근연 등급 배지(공조계수 f) | `level: KinLevel`(`'warn'\|'caution'\|'ok'`), `className?`. 색 + 아이콘 + 문자: ok = positive·Check·'정상', caution = warning·CircleAlert·'근연 주의', warn = negative·AlertTriangle·'강한 근연'. 근연 아이콘은 KpiTile·AlertList 심각도 아이콘과 별개 체계다: 행렬 셀·범례·경고 목록에 근연 표시를 그릴 때도 이 세 아이콘을 쓴다. f에서 구할 때 `<KinBadge level={kinLevel(f)} />`(@/lib/genomics). 사용 예: `workflow/cross-planner`, `viz/pedigree-explorer` |
| `Switch` | 켜고 끄는 보기 옵션 토글 | `checked: boolean`, `onChange(next: boolean)`, `label: ReactNode`, `description?: ReactNode`(라벨 아래 보조 설명, aria-describedby), `disabled?`, `className?`(바깥 label, 높이 조정 예 `'h-8'`). `role="switch"` + `aria-checked` 네이티브 button(Space·Enter), 라벨 전체 클릭 가능(좁은 화면·터치는 세로 44px), 접근 이름 = label(aria-labelledby), 포커스 링은 전역 `:focus-visible`, 켜짐 = 잉크(`--color-text`) 채움(2026-10-30 accent에서 변경)·꺼짐 = surface-2 토큰. 둘 이상 중 하나를 고르는 것은 `Segmented`. 사용 예: `viz/pedigree-explorer`(근연 루프 강조), `viz/kinship-heatmap`(대각 강조) |
| `HATCH_MISSING` / `HATCH_MISSING_DENSE` | 결측(NA·미측정) 빗금 CSS 배경 문자열 | `style={{ background: HATCH_MISSING }}`. 135° `--color-text-muted` 사선 + `--color-surface-2` 바탕(토큰만 사용, 다크 자동). 기본: 선 농도 28%·주기 7px(시험포 셀·범례 견본), DENSE: 30%·6px(높이 28px 안팎 편집 그리드 셀). 빗금만으로 결측을 알리지 말고 'NA'·'—' 문자나 aria 문구를 함께 둔다. 사용 예: `workflow/field-trial-layout`(기본), `workflow/phenotype-entry`(DENSE) |
| `useMediaQuery` | 미디어 쿼리 구독 훅 | `(query: string) => boolean`. 첫 렌더부터 현재 값. 레이아웃만 다르면 Tailwind 반응형 클래스를 먼저 쓴다 |
| `useElementWidth` | 요소 내용 폭 구독 훅 | `<T extends HTMLElement = HTMLDivElement>() => { ref: (el: T | null) => void; width: number }`. 콜백 ref라 대상 요소가 바뀌어도(로딩 화면 → 본 화면) 새 요소를 관찰한다. ResizeObserver `contentRect.width` 반올림, 첫 측정 전 0(`width > 0 &&`로 차트를 지연). 범주 폭 판정만 필요하면 `useNarrowCategoryAxis`. 사용 예: `viz/kinship-heatmap`, `viz/ld-decay`. 2026-10-26 승격 |
| `SequentialScaleLegend` | 순차 색 척도 HTML 범례 | `title`, `ariaLabel`, `colors?`(기본 `var(--viz-seq-1..7)`), `layout?: 'block'|'inline'`(기본 block), `domain?: [lo, hi]`(기본 [0, 1]), `ticks?: ScaleTick[]`, `marks?: ScaleMark[]`(block 전용), `missing?: ReactNode`, `className?` — 아래 상세. 2026-10-26 승격 |
| `hatchPattern` | `HATCH_MISSING`의 ECharts 캔버스 패턴판 | `(colors: { surface2, textMuted }) => HTMLCanvasElement | null`. `useChartTheme()` 값을 그대로 넘긴다. 6px 타일, surface-2 바탕 + text-muted 45% 135° 사선 1.2px. `const hatch = useMemo(() => hatchPattern(theme), [theme])` → `itemStyle: { color: { image: hatch, repeat: 'repeat' } }`. 사용 예: `viz/ld-decay` LdHeatmap(MAF < 0.05 셀). kinship-heatmap 대각 마스킹은 셀당 사선 1개라 모양이 달라 교체하지 않았다. 2026-10-26 승격 |
| `stripeBg` | 계열 색 위 사선 빗금 CSS 배경(HTML 막대) | `(color: string, surface = 'var(--color-surface)') => string`. ECharts `stripeDecal`(@/charts)과 같은 모양: 바탕 = `color`, `surface` 1.2px 선 135°·주기 4.2px(`repeating-linear-gradient(135deg, color 0 3px, surface 3px 4.2px)`). `style={{ background: stripeBg(c) }}`. 계획·전망·같은 계열의 두 번째 구성 요소를 계열 색을 잃지 않고 구분할 때 쓴다(회색 바탕 결측은 `HATCH_MISSING`). 차트와 HTML 막대를 한 화면에 함께 두면 `surface`에 `useChartTheme().surface`를 넘겨 차트 빗금과 같은 색을 쓴다. 빗금만으로 의미를 전하지 말고 범례·문구를 함께 둔다. 사용 예: `kpi/program-budget` BudgetBullets(B 그룹). 2026-10-30 승격 |
| `cn` | 클래스 이름 결합 | `(...parts: (string \| false \| null \| undefined)[]) => string`. 거짓 값(`false`·`null`·`undefined`·빈 문자열)을 빼고 공백으로 잇는다. Tailwind 충돌 병합(twMerge)은 하지 않는다 — 같은 속성 클래스를 둘 다 넘기면 CSS 순서가 이긴다. 템플릿에 로컬 `cn`을 새로 만들지 않는다. 사용 예: `kpi/program-budget`, `viz/variety-identity-markers`, `workflow/rga-scheduler`. 2026-10-30 공개 |
| `SaveBar` | 업무 화면 저장 바(상태 영역 + 「변경 취소」·「저장」) | `placement: 'bottom'\|'responsive'`, `pinned?`(bottom 전용 sticky), `children`(왼쪽 상태 영역), `dirty: number`, `saving: boolean`, `canSave: boolean`, `onSave`, `onRevert`, `blockReasonId?`(저장 버튼 aria-describedby), `saveSpinner?`(기본 true), `shortcut?: {aria, label}`, `saveButtonProps?: SaveButtonProps`(저장 버튼 추가 속성, 예 `{ 'data-action': 'save' }`), `saveLabel?`(기본 '저장', 되돌리기 어려운 동작은 '확정'), `saveIcon?`, `secondary?`(보조 동작), `showRevert?`(기본 true) — 아래 상세. 2026-10-27 승격, 2026-11-02 확장 |
| `FilterChip` | 표 위 필터 칩(토글 버튼) | `pressed`, `onClick`, `label: ReactNode`, `count?`, `data?: Record<\`data-${string}\`, string>`, `title?`, `className?` — 아래 상세. 2026-10-29 승격, 2026-10-30 켜짐 = 회색 채움·누르는 영역 44px |
| `BottomSheet` | 390px 상세 하단 시트 | `open`, `onClose`, `labelledBy`, `children`, `header?`, `footer?`, `maxHeight?`(기본 '85vh'), `backdropLabel?`(기본 '상세 닫기'), `className?` — 아래 상세. 2026-10-29 승격 |

타입: `LegendShape`(2026-10-30 C단계), `PageHeaderProps`, `KpiRowProps`, `SummaryCalloutProps`, `SummaryCalloutTone`, `ScrollRegionProps`, `SeverityTagProps`(2026-10-30), `ButtonProps`, `ButtonVariant`, `ButtonSize`, `ToastProps`, `ToastTone`(`'positive'|'info'|'warning'|'negative'`), `UseToastResult`, `StepperItem`, `StepperProps`, `ScaledCanvasProps`, `CanvasPrint`, `CanvasSectionTitleProps`, `CanvasBigNumberProps`, `DataTableSort`(`{ key, dir: 'asc'|'desc' }`), `SliderTick`(`{ value, label?, hideBelow?: 'sm'|'md' }`), `AlertListProps`, `AlertListItem`, `AlertSeverity`(`'warning'|'critical'|'info'`), `DivergingBarProps`, `KinBadgeProps`, `SwitchProps`, `SequentialScaleLegendProps`, `ScaleTick`(`{ value, label }`), `ScaleMark`(`{ value, label?, labelSide?: 'left'|'right' }`), `SaveBarProps`, `SaveBarPlacement`(`'bottom'|'responsive'`), `SaveButtonProps`, `MobileSummaryProps`, `MobileSummaryItem`, `SegmentedOption`, `DataTableRowProps`(`{className?, title?, 'data-*'?}`), `DataTableRowTone`(`'negative'|'warning'`), `FilterChipProps`, `BottomSheetProps`도 `@/design-system`에서 export한다.

### SequentialScaleLegend 상세

히트맵 등의 연속 순차 척도 범례. 막대·눈금은 aria-hidden이고 `ariaLabel`(figure)이 범위·임계값을 문장으로 말한다. 범례 컨테이너(`text-xs text-muted`, flex)는 템플릿이 두고, 그 안에 다른 범례 항목과 나란히 넣는다.

| 옵션 | 동작 |
| --- | --- |
| `layout: 'block'` | `figure.w-full.max-w-[340px]`: 제목(mb-1 semibold text) 위, 막대 h-3, 아래 줄에 `ticks`를 값 위치에(양끝은 안쪽 정렬, 가운데는 중앙 정렬), `marks`는 막대를 가로지르는 2px text 색 세로선(18px)과 셋째 줄 라벨(medium text, `labelSide: 'left'`면 선 왼쪽에 오른쪽 정렬). 라벨 있는 mark가 있으면 아래 여백 pb-9, 없으면 pb-5 |
| `layout: 'inline'` | 한 줄 `figure.flex.items-center.gap-2`: 제목 · `ticks[0].label` · 막대(w-28 h-2.5) · 마지막 tick 라벨. marks는 무시 |
| `domain: [lo, hi]` | 막대 양끝 값. 위치 = (v − lo) / (hi − lo) |
| `colors` | 그라데이션 색(낮음 → 높음). 생략하면 `var(--viz-seq-1..7)`(CSS 변수라 테마 전환에 자동). 차트와 같은 배열을 쓰려면 `useChartTheme().sequential` |
| `missing` | figure 뒤 형제 요소로 `HATCH_MISSING` 견본(size-3, rounded 2px, border) + 문구를 둔다(Fragment 반환). 결측·계산 안 함 셀이 있는 히트맵 |

발산 척도(0 = 중간색)도 이 컴포넌트로 그린다: `colors={useChartTheme().diverging}`(또는 `var(--viz-div-neg-3..pos-3)` 7개), `domain={[-m, m]}`. 별도 DivergingScaleLegend는 두지 않는다(예: `kpi/trial-site-environment` 환경 지수 inline 범례). 셀 색을 값에서 구하는 발산 색 함수는 템플릿마다 방식이 달라(RGB 연속 보간, 7색 구간, color-mix oklab) 공통화하지 않았다.

색 척도 밖 표기(대각 마스킹, 선택 셀, 그룹 색 띠, 블록 윤곽 등)는 템플릿이 범례 컨테이너에 따로 둔다. 사용 예: `viz/kinship-heatmap` ScaleLegend(block, domain [0, 1.3], 임계 2개), `viz/ld-decay` R2Legend(inline, missing).

### SaveBar 상세

업무 화면의 저장 작업 바. 바 틀(위치·표면·반응형 배치)과 오른쪽 버튼 두 개만 공통이고, 왼쪽 상태 영역(건수·충돌·저장 막는 이유·임시 저장 안내 등)은 템플릿이 `children`으로 채운다. 저장 상태 모델이 템플릿마다 달라서다. `data-print-hide`가 붙어 인쇄 시 숨는다.

| 옵션 | 동작 |
| --- | --- |
| `placement: 'bottom'` | 본문 흐름 안의 둥근 카드(`rounded-lg border bg-surface px-3 py-2.5 shadow-2`). `pinned`면 `sticky bottom-0 z-20`. sm 미만 세로 쌓임, sm 이상 가로 배치 |
| `placement: 'responsive'` | md 미만 화면 아래 `fixed`(가장자리까지, 위쪽 테두리만), md 이상 `sticky top-4`(2026-11-02 갤러리 상단 바 제거로 옛 헤더 기준 `top-14`에서 변경) 둥근 카드. md 미만 세로 쌓임. md 미만에서 본문 끝이 바에 가리지 않게 템플릿 루트에 아래 여백(예: `pb-40 md:pb-0`)을 둔다 |
| `children` | 왼쪽 영역 `flex flex-wrap gap-x-3 gap-y-1 text-[13px]`. 상태 문구에는 `aria-live="polite"`(필요하면 `role="status"`)를 템플릿이 붙인다 |
| `dirty`, `saving` | 「변경 취소」(ghost, RotateCcw)는 `dirty === 0 || saving`이면 비활성 |
| `canSave` | 「저장」(primary, Save) 활성 여부. 판정(오류 0건 등)은 템플릿이 한다 |
| `blockReasonId` | 저장을 막는 이유 요소의 id. 저장 버튼 `aria-describedby`로 이어진다. 이유 요소(`id` 포함)는 `children` 안에 템플릿이 둔다 |
| `saveSpinner` | 저장 중 저장 버튼 아이콘을 Loader2 스피너로(`motion-reduce`에서 정지). false면 Save 아이콘 유지 |
| `shortcut` | 저장 버튼 `aria-keyshortcuts`와 md 이상에서 보이는 `<kbd>`. 키 처리 자체는 템플릿이 한다 |
| `saveButtonProps` | 저장 버튼에 더 붙일 속성(`data-*`, `title`, `id` 등). `onClick`·`disabled`·`aria-describedby`·`aria-keyshortcuts`·`className`·`type`은 SaveBar가 정하므로 받지 않는다. QA 선택자: `saveButtonProps={{ 'data-action': 'save' }}`(예: `workflow/advancement-decision`). ref·setAttribute로 붙이지 않는다 |

좁은 화면에서는 두 버튼이 44px 높이(`min-h-11`), 1:2 폭으로 나뉜다. 사용 예: `workflow/crossing-record`(bottom, `pinned = dirty > 0 || saving`), `workflow/phenotype-entry`(responsive, `saveSpinner={false}`, Ctrl+S).

### DataTable 옵션 상세

표 모양(2026-10-30, 앱 화면 규칙): 머리에 채운 띠가 없다(세로 스크롤 고정 머리만 표면색으로 가린다). 머리 글자는 12px 회색 문장형(대문자 변환 없음, medium), 머리 아래 선은 표 안에서 가장 진한 1px 선(`text` 25%), 행 구분선은 그보다 옅게(`border` 70%), 지브라 없음. 고정 열 머리·셀 배경은 표면색. 좁은 화면·터치에서 정렬 머리 줄은 44px(`touch:h-11`, 정렬 버튼 `touch-hit`), 페이지 버튼은 Button의 44px 누르는 영역을 쓴다.

| 옵션 | 동작 |
| --- | --- |
| `columns[].numeric` | 숫자 열: 셀·머리글을 오른쪽 정렬(앱 화면 규칙 7.4, 자릿수 맞춤 tabular-nums는 표 전체 기본). `align`을 따로 주면 `align`이 이긴다. 비교하는 ISO 날짜 열도 오른쪽 정렬을 권장한다. 예: `{ key: 'yield', header: '쌀 수량(kg/10a)', numeric: true }`. 정렬 머리 버튼은 오른쪽 정렬 열에서 아이콘을 앞에 두려고 `flex-row-reverse`를 쓰는데, 머리 내용은 `span` 하나로 감싸 넣으므로 `header`에 Fragment(`<>수량 <abbr>GEBV</abbr></>`)를 넘겨도 어순이 뒤집히지 않는다(2026-10-30 C단계) |
| `columns[].hideBelow: 'sm'\|'md'\|'lg'` | 그 폭(640·768·1024px) 미만에서 머리글·셀을 숨긴다. 좁은 화면에서 결론 열(상태·판정·지수)이 스크롤 끝에 숨지 않게 덜 중요한 열(기간·단위·설명)을 뺀다. 고정 열에는 쓰지 않는다. 결론 열을 앞으로 당기려면 좁은 화면용 열 배열을 따로 둔다(예: `viz/gwas-manhattan` PeakTable). 2026-10-30 |
| `stickyColumn: 'name'` | 그 열의 머리글·셀을 `left: 0`에 고정한다(가로 스크롤 시). 셀은 불투명 surface 배경 + 오른쪽 1px 경계선, `highlight` 행은 accent 10%를 섞은 불투명색이라 강조가 유지된다 |
| `stickyColumn: { key, below: 'md' }` | 그 폭 미만에서만 고정(모바일 전용). `below: 'lg'`도 가능 |
| `defaultSort: { key, dir }` | 초기 정렬 상태. 머리글에 `aria-sort`와 화살표가 처음부터 표시된다. 정렬은 안정 정렬(같은 값은 원래 순서 유지, 내림차순 포함). 머리글을 누르면 기존처럼 오름 → 내림 → 해제 순환 |

| `columns[].sortValue: (row) => unknown` | 정렬 값. 없으면 `row[key]`. 중첩 필드·계산 열(`format`으로 그리는 열)을 정렬할 때 |
| `columns[].sortDescFirst` | 그 열을 처음 누르면 내림차순(수치 지표 열) |
| `columns[].headerTitle` | 머리글 정렬 버튼의 `title`(단위·정의) |
| `sort` + `onSortChange(next)` | 제어형 정렬. `sort`를 넘기면(null 포함) 부모 상태를 쓰고, 머리글을 누르면 다음 상태로 `onSortChange`가 불린다. rows 재배열은 DataTable이 한다(안정 정렬) |
| `allowUnsorted: false` | 같은 열을 다시 누르면 해제 없이 방향만 바뀐다(첫 방향 ↔ 반대). 기본 true(첫 방향 → 반대 → 해제) |
| `pageSize` | 표 아래에 페이지 나눔 nav(`aria-label`=`pageLabel`, 기본 '표 페이지'): '1–20 / 600', 이전·다음 버튼, 'n / m쪽'(aria-live). 페이지는 정렬 결과 기준이고 정렬을 바꾸면 0쪽으로 돌아간다. 이때 `className`은 표+nav를 감싼 바깥 요소에 붙는다 |
| `page` + `onPageChange` | 제어형 페이지(0부터). 검색·필터를 바꿀 때 부모가 0으로 돌린다. 없으면 내부 상태(범위를 넘으면 마지막 쪽으로 보정) |
| `activeRow: (row) => boolean` | 상세 패널과 연동된 현재 행: 2px text 윤곽선 + `aria-selected`(onRowClick이 있을 때, highlight보다 우선). `highlight`(배경)와 함께 쓸 수 있다. `stickyColumn`과 함께 써도 윤곽이 이어진다: 윤곽은 tr의 outline이라 불투명 바탕의 고정 셀이 가리므로, 고정 셀 안에 같은 2px 조각(위·아래, 첫 열이면 왼쪽, `span[aria-hidden]` absolute)을 다시 그린다. 고정이 풀리는 폭(`below`)에서는 그 조각을 숨긴다(2026-10-30 C단계 — genetic-gain-tracker·gs-model-performance 390에서 첫 열 윤곽이 가려졌다) |
| `highlight: (row) => boolean` | 강조 행: accent 10% 배경(hover 15%). 행에 `--badge-base: var(--color-surface)`를 지정해 행 안 `Badge`(positive·warning·negative·info)가 불투명 배경을 쓴다. 반투명 배지가 accent 배경과 겹치면 라이트에서 positive 4.42, warning 4.48:1로 AA 미달이었다(8차 배치 수정). 템플릿이 행 안에 직접 만든 `bg-{tone}/10` 배지는 해당되지 않으므로 `Badge`를 쓴다 |

| `rowProps: (row) => DataTableRowProps` | 행(tr)에 붙일 `data-*`·`className`·`title`. 클릭·키보드·aria는 DataTable이 정한다 |
| `rowTone: (row) => 'negative'\|'warning'\|null` | 오류·주의 행 띠: 고정 열(stickyColumn) 셀, 없으면 첫 셀 왼쪽 안쪽 3px 의미색(inset box-shadow, 고정 셀의 오른쪽 경계선과 함께 그린다). 색만으로 알리지 말고 셀 안에 아이콘·문구를 함께 둔다. 예: `workflow/advancement-decision`(사유 누락 행, 계통 열 + AlertTriangle). 기존 phenotype-entry·crossing-record 오류 표시는 셀 단위 표시라 그대로 둔다. 새 업무 화면의 행 단위 오류 표시는 이 옵션을 쓴다 |
| `scrollHint: ReactNode` | 가로 스크롤 단서 문구. **2026-10-30부터 기본으로 켜져 있다**: 생략하면 '옆으로 밀어 나머지 열 보기 →'. 표가 실제로 가로로 넘칠 때만(폭과 관계없이, 768px 포함) 표 위에 `p.mb-1.5.text-xs.text-muted.break-keep[aria-hidden]`로 보이고, 끝까지 밀기 전에는 오른쪽 가장자리에 표면색 페이드(`span[data-scroll-fade]`)가 생긴다. 넘칠 때 스크롤 컨테이너가 `tabIndex=0`(키보드 스크롤). 문구를 바꾸려면 '옆으로 밀어 … 보기 →' 꼴로 넘기고, 끄려면 `false`(페이드도 꺼짐). 템플릿이 표 위에 직접 쓰던 안내 문단은 지우고 이 옵션으로 옮긴다(겹쳐 보인다) |

DOM: (안내 p) + `div.relative.min-w-0 > div.relative.overflow-auto(스크롤 컨테이너, className) + span[data-scroll-fade]`. 스크롤 컨테이너는 `relative`다. 셀 안 `absolute` 요소(`sr-only` 포함)의 containing block이 스크롤 컨테이너 안에 있어, 표 밖 페이지 폭을 늘리지 않는다(15차 배치 advancement-decision 768px 905px 넘침). 셀 format을 relative div로 감싸는 우회는 하지 않는다. 고정 열 셀은 sticky라 그 자체가 containing block이다.

검색 입력·'선발만 보기' 같은 도구 막대는 표 밖(템플릿)에 둔다. 예: `viz/gebv-selection/components/RankTable.tsx`.

고정 열은 `left: 0`에 붙으므로 첫 열이나 좁은 선택 열 바로 다음 열을 고른다(스크롤하면 앞 열을 덮는다). 두 옵션을 주지 않으면 기존 동작과 같다.

### Slider 옵션 상세

| 옵션 | 동작 |
| --- | --- |
| `ticks` | 트랙 아래 눈금 라벨(11px muted, `aria-hidden`). 숫자면 `format(value)`, `{ value, label?, hideBelow: 'sm' }`이면 좁은 화면에서 숨김. 양끝 눈금은 안쪽 정렬 |
| `pageStep` | PageUp/PageDown 한 번의 이동량(min~max로 제한). ←→는 `step` |
| `valueText` | `aria-valuetext`. 기본은 표시값. 값의 결과를 함께 읽어 줄 때(예: '선발 비율 10%, 60계통, 선발 강도 1.755') |
| `prominent` | 화면의 주 파라미터: 표시값 18px 굵게, 라벨과 기준선 정렬 |

### AlertList 상세

- 항목: 옅은 1px 전체 테두리(`border` 토큰) + **왼쪽 2px 심각도 띠** + 아이콘 + 문자 태그('경보'/'주의'/'정보') + 제목(13px semibold, break-keep) + 선택적 오른쪽 값 + 설명(12px muted, break-keep). 심각도는 아이콘과 문자 태그가 말하고 띠는 훑어보기용이다(2026-10-30 C단계: 4px 띠 + 심각도색 30% 전체 테두리 → 2px 띠 + 중립 테두리. 심각도색 테두리는 tasteskill heavy-borders로 집계됐다 — 검사는 반투명 테두리의 알파를 버리고 잰다).
- 제목 줄은 「태그 | 제목 | 값」 3칸 격자다(2026-10-30): 제목이 길면 가운데 칸 안에서 줄이 바뀌고 값은 제목 오른쪽 위에 남는다. **항목(`li.@container`) 폭이 값 길이로 정한 기준보다 좁으면** 값이 제목 아래 왼쪽으로 내려간다. 기준 = 고정 폭(테두리·여백·아이콘·태그·간격 약 95px, 화살표 +24px) + 값 글자 폭 어림(13px bold, 한글 1em·그 밖 0.6em) + 제목 칸 130px을 18·20·22·24·26·28·30rem 단계로 올림. 예: 'Ne 52'·'87%'는 18rem, 'He 0.337~0.340'은 22rem(390 카드 약 300px에서 값이 제목 옆에 남아 제목이 4줄로 감기던 문제, C단계). 값이 문자열이 아닌 노드면 안쪽 글자를 모아 어림하고, 글자가 없으면 64px로 본다. 기준이 항목 폭이라 목록을 `xl:grid-cols-2`처럼 여러 열로 놓아도 항목마다 맞는다. 색·아이콘·태그는 `KpiTile` `severity`와 같은 규칙(같은 내부 모듈 `severity.ts`): critical = negative·AlertOctagon·'경보', warning = warning·AlertTriangle·'주의'. 태그 글자는 text 색.
- 항목 상자가 `relative`다(C단계): 목록을 `max-h-* overflow-y-auto`로 감싸도 버튼 안 `sr-only`(absolute)가 스크롤 영역 밖 문서 높이를 늘리지 않는다(phenotype-entry 1440 문서 높이 2120 → 1793). 감싸는 쪽에 `relative`를 따로 줄 필요가 없다.
- `severity: 'info'`(2026-10-30): info 토큰·Info 아이콘·'정보' 태그. 같은 상자 규격이다. KpiTile `severity`에는 없는 단계라 참고 사항(예: 교배 부모 KASP 결과 대기)에만 쓴다. 경보·주의 목록과 나눠 보일 때는 목록을 둘 두고 정보 목록은 항목이 있을 때만 렌더한다(`infoItems.length > 0 &&` 조건, ariaLabel '정보 n건', compact. 빈 ul이 gap을 만들지 않게). 사용 예: `workflow/rga-scheduler`.
- `onClick`이 있으면 항목 전체가 `<button>`(hover surface-2, `chevron`이면 오른쪽 화살표, 스크린리더 보조 문구 `actionLabel`), 없으면 정적 상자.
- `icon`으로 항목 아이콘만 바꿀 수 있다(예: 지연 = Clock). 색과 문자 태그는 심각도를 따른다.
- `emptyText`가 있고 항목이 0개면 positive 테두리 상자에 체크 아이콘과 문구를 보인다.
- 카드 제목·집계·각주는 템플릿이 `Card`로 감싼다. 정렬(심각도·달성률 순)도 템플릿이 한다.

### Toast 상세

```tsx
const toast = useToast()                       // 템플릿 단위 상태, Provider 불필요
toast.show(`교배 조합 5건을 확정했습니다`)          // 같은 문구를 다시 띄워도 타이머 재시작
toast.show('저장하지 못했습니다', { tone: 'negative', duration: 0 })
<Toast {...toast.toastProps} />                // 템플릿 루트 끝에 한 번
```

- 라이브 영역(`role="status"`, `aria-live="polite"`)은 메시지가 없어도 DOM에 남아 있다. 조건부로 렌더하지 않는다.
- 기본 위치: md 미만 하단 중앙(`bottom-20`, 고정 하단 작업 바 위), md 이상 우하단. 바꾸려면 `className`.
- 아이콘+색으로 tone을 구분하고 문구 자체가 결과를 말하게 쓴다(색만으로 성공·실패를 알리지 않는다).

### DivergingBar 상세

선발 차(SD), 표준화 GEBV(z), 대비 품종 대비 증감(%)처럼 0이 기준인 값을 한 줄 막대로 보인다. 막대·기준선은 aria-hidden이고 값은 `valueText` 글자로 읽힌다.

| 옵션 | 동작 |
| --- | --- |
| `domain: 3` | 축 양끝 ±3, 0이 가운데. 범위를 넘는 값은 끝에서 자른다(글자는 원래 값) |
| `domain: [neg, pos]` | 0을 `neg / (neg + pos)` 지점에 둔다. 한쪽 값이 크거나 막대 끝 글자에 여백이 필요할 때. 예: 셀 폭 186 중 0을 76에, 1% = 6px → `[76/6, 110/6]` |
| `layout: 'stacked'` | UI 화면용. `label`이 있으면 4.5rem 라벨 열 + 16px 트랙, 아래 줄에 12px 값 글자(semibold)와 음수일 때 `negativeTag`. 기준선 1px border 색 |
| `layout: 'inline'` | 표 셀·인포그래픽용. 값 글자가 막대 끝(음수는 왼쪽)에 붙는다. 높이 2em, 막대 14/15em, 기준선 1.5/15em muted, 글자 bold text 색. 모든 크기가 em이라 감싼 요소의 font-size가 값 글자 크기다. `ScaledCanvas` 안에서는 `style={{ fontSize: u(15) }}`로 감싼다. 글자는 트랙 밖으로 나가므로 domain에 여백을 둔다 |
| `tone: 'sign'` | 양수 accent, 음수 warning. 음수를 색만으로 알리지 않도록 `negativeTag`(예: `<Badge tone="warning">손해</Badge>`)를 함께 준다 |
| `tone: 'accent'` | 부호와 관계없이 accent(부호가 좋고 나쁨을 뜻하지 않을 때. 좋고 나쁨은 판정 열이 말한다) |

사용 예: `viz/gebv-selection`(형질별 선발 차 E·계통 상세 I, stacked·sign), `infographic/variety-profile` TraitTable(증감 %, inline·accent).

### ScaledCanvas 상세

- DOM: `div[data-print-flat] > ([data-canvas-summary] 요약 · 안내 p — 잘릴 때만) + div.relative > div.overflow-x-auto[data-print-canvas] > div[data-canvas-frame](container-type: inline-size) > div[role=figure]` (+ `div.relative` 안 `span[data-scroll-fade]`). 2026-10-30에 요약·안내가 캔버스 위로, `div.relative`가 생겼다.
  `--u = 100cqw / width`가 1 논리 픽셀이고 자식은 `style={{ fontSize: u(18), padding: u(24) }}`처럼 모두 `u(n)`으로 크기를 정한다. transform·ResizeObserver 없이 CSS만으로 비례하므로 인쇄에서도 같다. 캔버스 안에 다른 `container-type` 요소를 두지 않는다.
- `minScale`: 컨테이너 폭이 `width × minScale`보다 좁으면 그 폭(1920 × 0.6 = 1152px)에 고정하고 `overflow-x-auto` 컨테이너 안에서 가로 스크롤한다(`verify-templates`는 이 안의 넘침을 문제로 보지 않는다). 이때만 스크롤 영역에 `role="region"`·`tabIndex=0`·`regionLabel`이 붙고, 캔버스 **위에** '옆으로 밀어 전체 보기 → · 글자를 읽을 수 있게 원본의 60%까지만 줄였습니다' 안내(break-keep)와 오른쪽 잘림 페이드(`fadeColor`, 기본 bg)가 나온다. `0`이면 끝까지 비례 축소(이전 동작).
- `summary`: 잘린 상태(최소 배율에 걸려 가로 스크롤)일 때만 캔버스 위(안내 위)에 렌더한다. 16:9(1920)는 768px에서도 1152px로 잘리고, A4 세로(1240)는 744px라 768px 임베드(720px)에서도 잘리므로 **390·768 모두** 요약이 보인다. 잘림 판정은 첫 페인트 전(useLayoutEffect)이다. 인쇄에서는 숨는다. 요약을 직접 배치해야 하면 `onClampedChange(clamped)`로 상태를 받는다(예: 제목 줄에 기준일이 있는 annual-report-onepager 로컬 요약).
  기본 0.6은 본문 16~18 논리 px가 약 10~11px, 가장 작은 각주 15 논리 px가 9px가 되는 값이다. 본문을 더 작게 잡은 캔버스는 minScale을 올린다.
- `print`: 마운트 동안 `<html data-print-mode="canvas">`를 켜고 `@page { size: A4 …; margin: 10mm }`를 넣는다. 인쇄 규칙은 `src/index.css`의 공통 계약이다:
  `[data-print-hide]`는 숨김(갤러리 헤더·사이드바·목록 링크, 캔버스 위 요약·안내 문구·페이드; 템플릿에서 인쇄에 빼고 싶은 요소에도 붙인다), `[data-print-flat]`은 여백·폭 제한·배경 제거(갤러리 레이아웃 래퍼, `data-template-root`), `[data-print-canvas="a4-landscape"]`는 277mm, `"a4-portrait"`는 190mm 폭, 최소 폭 해제, `print-color-adjust: exact`.
  템플릿 안에 `@media print`·`:has()`로 앱 크롬을 숨기는 규칙을 직접 쓰지 않는다.
  인쇄는 늘 라이트 토큰 + 흰 캔버스다(2026-10-30): 다크 모드에서 인쇄해도 흰 A4로 나온다. 캔버스 루트의 `bg-bg`는 인쇄에서 흰색으로 바뀐다.
- 글자 크기 상속: 캔버스 루트(`role=figure`)는 font-size를 정하지 않는다. 캔버스 안 HTML 글자는 자기 또는 조상 요소에 `u(n)` font-size가 있어야 비례한다(조상에 없으면 페이지 기본 14px로 고정). `u(n)`을 가진 요소의 자식은 font-size를 상속만 해도 폭 변경 시 함께 다시 계산된다(7차 배치에서 같은 페이지 390 → 768 → 1440 리사이즈로 확인, 재계산 누락 없음). 390·768에서 글자가 작게 보이는 것은 `minScale` 0.6 고정 때문이다(1240 너비 캔버스 기준 744px).

### CanvasBigNumber 상세

- DOM: `section.flex.min-w-0.flex-col.justify-between.border`(padding `u(8) u(padX) u(10)`, 반경 12, 테두리 대표 2 accent/50 + accent 5% 바탕 / 보통 1.5 border + surface) > [h3 라벨] + `div.flex.items-baseline.tabular-nums.whitespace-nowrap`(gap 8: 숫자 extrabold accent 60/52·lh 1·자간 −0.02em + 단위 bold text + `note`) + [h3 라벨] + `p.text-muted.tabular-nums`(sub). 높이는 감싼 격자가 정한다.
- `size`: default = 라벨 19/1.2, 보조 17/1.25, 단위 26/22, padX 20(mas-backcross-story, 16:9 캔버스). compact = 라벨 17, 보조 15/1.3, 단위 24/21, padX 18(variety-application-brief, A4 세로). 숫자 크기는 둘 다 60/52.
- `labelPosition`: below(기본) = 숫자 → 라벨 → 보조, above = 라벨 → 숫자 → 보조(근거 카드처럼 무엇의 숫자인지 먼저 읽혀야 할 때).
- `note`: 숫자 줄 끝 muted semibold **15**/1.15(캔버스 글자 하한 15 논리 px, 2026-10-30 C단계 14 → 15), 세로 가운데, 줄바꿈 허용(break-keep). 예: "· KASP 마커 3개(식별 참고)".
- `keepSegments`: `sub`가 문자열이면 ' · '로 나눈 구절마다 nowrap(예: "b 0.87"이 갈라지지 않게). ReactNode면 그대로.
- 사용 예: `infographic/mas-backcross-story`(기본값), `infographic/variety-application-brief`(`size="compact" labelPosition="above" keepSegments`). variety-profile·digital-breeding-process·annual-report-onepager의 로컬 BigStat/StatCard는 규격이 달라 옮기지 않았다(promotion-holds).
- `ScaledCanvas` 밖에서는 크기가 0이 된다. 일반 화면의 큰 숫자는 `Stat`·`KpiTile`.

### CanvasSectionTitle 상세

- DOM: `div.flex.items-baseline.justify-between(gap 16, margin-bottom gapBelow) > h3(min-w-0, extrabold, size, line-height 1.2) [마커 + span.whitespace-nowrap(title) + span(sub, muted 15)] + div.shrink-0(right, muted 15, 오른쪽 정렬)`.
- 마커: `no`가 없으면 강조색 세로 막대 5×20(반경 2), 있으면 강조색 26×26 번호 배지(반경 6, 15, `text-accent-contrast`). 둘 다 `aria-hidden`이라 번호는 접근성 이름에 들어가지 않는다.
- 사용처 기본값: annual-report-onepager는 `size` 21·`gapBelow` 8(기본값), variety-profile은 `no="1"…`, `size={22}`, `gapBelow={6}`.
- `ScaledCanvas` 밖에서는 `--u`가 없어 크기가 0이 된다. 일반 화면의 영역 제목은 `SectionHeader`를 쓴다.

### Segmented 상세

| 옵션 | 동작 |
| --- | --- |
| `value: null` | 아무것도 선택하지 않은 상태(미결정 등). 첫 활성 선택지가 탭 정지점이고, 화살표를 누르면 그 방향의 첫 활성 선택지가 선택된다 |
| `options[].disabled` | `aria-disabled` + 취소선(`line-through`, muted, not-allowed). 클릭·화살표 이동에서 빠진다. 이유 문구는 `describedBy`로 잇는다. 예: `viz/haplotype-viewer` OptionToggle(다양성 패널 GEBV 정렬) |
| `options[].data` | 버튼의 `data-*` 속성(QA 선택자). 예: `{ 'data-decision-option': 'promote' }` |
| `options[].label: ReactNode` | 색 점·'(권고)' 같은 보조 표기. 아이콘을 넣으면 `optionClassName="inline-flex min-h-8 items-center gap-1"`로 정렬·높이를 맞춘다(예: `workflow/advancement-decision` DecisionSegmented) |
| `ariaLabelledBy` | 화면에 보이는 라벨이 있으면 `ariaLabel` 대신 그 id |

기본 버튼 클래스(`whitespace-nowrap rounded-[6px] font-medium`, sm `px-2 py-0.5 text-xs`, md `px-3 py-1 text-[13px]`, 선택 `bg-surface text-text shadow-1` — 회색 트랙 위 흰 칸, 강조색 없음)는 바뀌지 않았다. 2026-10-30부터 선택지마다 `touch-hit-y`(좁은 화면·터치에서 누르는 영역 세로 44px, 가로는 버튼 폭)가 붙는다. 가로 스크롤 줄(overflow-x-auto) 안에 두면 누르는 영역이 그 줄 높이로 잘리므로 줄에 `touch:py-2` 같은 여유를 준다.

### FilterChip 상세

- 규격(seed-inventory LotToolbar): `button[aria-pressed].touch-hit.inline-flex.h-7.items-center.gap-1.rounded-full.border.px-2.5.text-xs.font-medium`, 켜짐 `border-text/40 bg-active font-semibold text-text`(2026-10-30 강조색 채움에서 회색 채움으로), 꺼짐 `border-border bg-surface text-text hover:bg-surface-2`. `count`는 라벨 뒤 tabular-nums(꺼짐이면 muted). 좁은 화면·터치에서 누르는 영역 44px — 칩 묶음은 `gap-1.5 touch:gap-2`.
- 선택 방식(단일·복수)은 호출 측이 정한다. 칩 묶음은 `div[role=group][aria-label].flex.flex-wrap.gap-1.5`, 앞에 `span.text-xs.font-medium.text-muted` 라벨을 둘 수 있다.
- 사용 예: `workflow/seed-inventory`(구분, 복수 선택), `workflow/advancement-decision`(자동 판정·결정 상태, 단일 선택). crossing-record의 날짜 칩(h-8·text-[13px]·개수 없음)은 규격이 달라 쓰지 않는다(promotion-holds).

### BottomSheet 상세

- DOM: `div.fixed.inset-0.z-40.flex.flex-col.justify-end > button[aria-label=backdropLabel].absolute.inset-0.bg-text/30 + div[role=dialog][aria-modal][aria-labelledby].relative.rounded-t-xl.border-t.bg-surface.shadow-2`(max-height = `maxHeight`).
- `header` 없음: 대화상자 전체가 `overflow-y-auto p-4`, 맨 위 `div.mb-2.flex.justify-end`에 「닫기」(Button sm ghost, X, autoFocus) 뒤 children(예: `workflow/crossing-record`).
- `header` 있음: `flex flex-col` — 머리 줄(`border-b px-4 py-2`, 왼쪽 `text-xs text-muted` header · 오른쪽 「닫기」), 본문(`min-h-0 flex-1 overflow-y-auto p-4`), `footer`가 있으면 아래 줄(`flex items-center justify-between gap-2 border-t px-4 py-2.5`). 시트 안 저장 버튼처럼 SaveBar가 오버레이에 가릴 때(예: `workflow/advancement-decision`, `maxHeight="88vh"`).
- Esc·배경·「닫기」가 `onClose`를 부른다(Esc 구독은 컴포넌트가 한다). 좁은 화면 조건은 호출 측이 `open={narrow && sheetOpen}`으로 걸고, 넓어지면 `sheetOpen`을 false로 돌리는 effect도 호출 측에 둔다. 제목 요소(`id = labelledBy`)는 children 안에 있다.
- 시트 안에 `data-action="save"` 버튼이 있으면 SaveBar보다 DOM 앞에 둔다(QA `clickSelector`의 첫 일치가 시트 쪽이 되도록).

### MobileSummary 상세

- DOM: `section[data-print-hide][aria-label](rounded-lg border bg-surface p-3) > h2(15px extrabold) + dl.mt-2.grid.grid-cols-2.gap-2 > div(rounded-md border p-2; primary면 border-accent bg-accent/5) > dt(14px semibold leading-tight muted) + dd.mt-1 > span.block(value, 22px extrabold leading-tight tabular-nums; primary면 text-accent) + detail` 뒤에 `footer`가 있으면 `p.mt-2(14px semibold text)`.
- `detail`은 dd 안 값 뒤에 그대로 붙는다. 단위·보조 문구 span을 템플릿이 정한다. 예: 보조 문구만 `<span className="text-[14px] text-muted">…</span>`(mas-backcross-story), 단위 + 보조 `<span className="text-[14px] font-bold text-text">{unit}</span><span className="ml-1 inline-block whitespace-nowrap text-[14px] text-muted">· {sub}</span>`(conventional-vs-digital).
- 표시 조건은 캔버스가 정한다(2026-10-30 계약 변경): `<ScaledCanvas summary={<MobileSummary … />} …>`. 캔버스가 잘릴 때(390·768px)만 보인다. 예전 방식(`useMediaQuery('(max-width: 639px)')` + 캔버스 앞에 직접 렌더)은 768px에서 요약이 빠지므로 옮긴다. 카드 숫자는 캔버스와 같은 상수에서 만든다.
- annual-report-onepager의 요약은 제목 줄에 기준일 배지가 있고 숫자가 24px·leading-none + 단위 span 구조라 이 컴포넌트를 쓰지 않는다(바꾸면 화면이 바뀐다).

### PageHeader 상세(2026-10-30 신설, 앱 화면 규칙)

- 근거: 앱 화면 규칙 「pill은 행 안이나 값 옆에만, 제목 위에는 절대 두지 않음」. 그래서 제목 위 칩 줄을 쓰지 않는다.
- 배치: `context`(범위·소속, 12px medium muted 일반 텍스트 한 줄, pill 아님) → 제목 줄(`h1` 24/700 하나 + 오른쪽 `asOf` 회색 스탬프 '기준일 …' + `actions`) → `scope`(13px muted 데이터 한 문장) → 접힌 「자세히」(`details`).
- `scope`에는 데이터에 관한 한 문장(결론·기간·범위)만 둔다. '항목을 누르면 …로 이동합니다' 같은 인터페이스 안내는 쓰지 않는다. '목업'·'가상' 같은 상태 표시는 제목 옆 pill 대신 이 줄의 텍스트로 쓴다.
- `actions`는 실제 필터·동작이 있을 때만. 한 줄 컨트롤 높이는 32~36px로 맞춘다(Select 32px, Segmented md 약 32px, Button md 36px — 한 줄에 섞지 말고 한 높이로).
- 긴 정의·규칙·방법 문단(2줄 넘는 것)은 `details`로 접는다. 390px에서 첫 KPI가 화면 안에 들어와야 한다.
- 좁은 화면에서는 `asOf`·`actions` 묶음이 제목 아래로 내려와 왼쪽 정렬된다(flex-wrap). DOM: `div[data-page-header]`(header 요소 아님 — 임베드에서 banner 랜드마크가 되지 않게).
- 예(기준 구현 `kpi/program-overview`):

```tsx
<PageHeader
  context={['벼 · 쌀 수량(kg/10a)', '중부 평야지 벼 육종 프로그램']}
  title={meta.title}
  scope={`2019~2021 표현형 선발 → ${GS_START}년 유전체 선발(GS)·속성세대진전 도입 · KPI·경보는 종료 연도, 추세 차트는 선택 기간 기준`}
  asOf={`${AS_OF} · ${PROVISIONAL_YEAR}년은 잠정`}
  actions={<YearRange />}
/>
```

### KpiRow 상세(2026-10-30 신설, 앱 화면 규칙)

- 근거: 앱 화면 규칙 「고아 칸 없음, 같은 줄 카드는 아래 끝을 맞춤」, 시각 언어 「모바일 KPI 2열」.
- 데스크톱(lg 이상) 한 줄: 칸 수 = 타일 수(4개면 4열). `hero`면 첫 타일이 2칸 너비라 칸 수 +1(대표 1 + 4 = 6칸).
- 768px(md): 칸 수 4 이하면 한 줄, 넘으면 3 또는 4칸(나누어떨어지는 쪽)씩 줄을 나누고 마지막 줄 타일이 늘어나 빈 칸이 없다.
- 390px(md 미만): 2열. 개수가 홀수면 마지막 타일이 전체 폭, 대표 타일은 늘 전체 폭.
- `flex flex-wrap` + 칸 너비 `basis` 계산(`--kpi-per`·`--kpi-gap` CSS 변수)이라 어느 폭에서도 마지막 줄이 꽉 차고, 줄마다 타일 높이가 같다(stretch, 타일 안 달성 막대는 `mt-auto`로 아래 끝 정렬).
- **대표 타일 달성 막대 위치(2026-10-30 C단계)**: `hero`이고 형제 타일 가운데 바닥 막대(`target`+숫자 값, `achievement`, `range`)가 있는 것이 **절반 이하**면, 대표 타일이 넓을 때(내용 폭 400px 이상 — 1440·768 2칸) 달성 막대를 값 오른쪽에 둔다(값 줄 아래 끝 정렬, 막대 아래 목표·달성률·태그 그대로). 대표만 막대 높이(약 36px)만큼 길어져 형제 타일 아래에 빈 띠가 남던 문제(advancement-decision·gs-model-performance, tasteskill panel-void)다. 형제 대부분이 바닥 막대를 가지면(program-overview·genotyping-lab-ops) 대표 막대도 바닥에 두어 줄의 막대 높이를 맞춘다. 390(전체 폭 내용 약 318px)에서는 늘 값 아래. 판정은 자식 `KpiTile`의 props로 하므로 로컬 타일은 바닥 막대 없음으로 본다. KpiRow 밖의 대표 타일은 예전처럼 값 아래.
- 타일에 `col-span-*`·너비 클래스를 주지 않는다. 열 수를 바꿔야 하면 `cols={{ md: 3, lg: 6 }}`.
- 로딩: `<KpiRow loading hero count={5} skeletonHeight={176} />` — 본 화면과 같은 배치의 스켈레톤.
- DOM: `section[aria-label][data-kpi-row]`. 간격 12px(md 이상 16px).

### SummaryCallout 상세(2026-10-30 신설, 앱 화면 규칙)

- 화면의 「결론 한 문장」이다. 본문 잉크색 14px(`text-[14px] leading-relaxed text-text`), 바탕은 중립(`bg-surface-2` 한 단계, 색 틴트 없음), `px-4 py-2.5`, `rounded-md`.
- 톤은 왼쪽 4px 표시와 아이콘에만 쓴다: `neutral`(기본, muted 회색) = 결론·요약, `warning`·`negative` = 결론이 주의·경보일 때(예: KPI 심각도와 같게), `info` = 안내·참고 띠(닫기 버튼과 함께). 문장 안 강조는 `<b>`만(색 밑줄·색 글자 없음).
- 위치: KPI 줄 바로 아래 한 곳(KPI·viz). KPI 위·차트 카드 안에 따로 두지 않는다. 업무 화면은 필요할 때만.
- 좁은 화면(< 640px): `mobileLines`(기본 3)줄까지만 보이고 실제로 넘칠 때 「더 보기」/「접기」 버튼(`aria-expanded`). 블록 요소를 넣지 않는다.
- 문장은 `break-keep`(낱말 중간에서 줄이 바뀌지 않음) + `wrap-break-word`(한 낱말이 줄보다 길 때만 끊음). 390에서 '하나입니\n다'처럼 끊기던 문제(2026-10-30 C단계). `PageHeader`의 `context`·제목·`scope`도 같다.
- `dismissible`: 닫기 버튼(X, `touch-hit`)을 누르면 스스로 숨는다. `onDismiss`만 주면 숨김은 부모가 정한다. 선택에 따라 문장이 바뀌면 `live`.
- DOM: `div[data-summary-callout] > (icon) + div > p(tabular-nums) + (더 보기) + (닫기)`.

### ScrollRegion 상세(2026-10-30 신설)

- 표가 아닌 가로 스크롤 영역(계통도 SVG, ADMIXTURE 막대, 격자·행렬)을 감싼다. 표는 DataTable이 같은 규칙을 기본으로 가진다.
- 폭 조건(`md:hidden`, `narrow`)이 아니라 실제 넘침(scrollWidth > clientWidth)일 때만: 위에 안내(12px muted, break-keep, 기본 '옆으로 밀어 전체 보기 →'), 오른쪽 가장자리 페이드(끝까지 밀면 사라짐), 스크롤 컨테이너에 `role="region"` + `tabIndex=0` + `aria-label={label}`.
- `fadeColor`: 페이드가 섞이는 바탕(카드 안 기본 surface, 페이지 바탕 위면 `'var(--color-bg)'`).
- 템플릿이 직접 둔 `overflow-x-auto` + 폭 조건 안내 문구(`md:hidden` 등)는 이것으로 옮긴다. 선택한 노드로 스크롤하려면 `scrollRef`.
- **테두리 있는 스크롤 컨테이너(2026-10-30 C단계)**: `className`에 `border`·`rounded-*`를 주면 넘칠 때 스크롤 컨테이너의 계산된 테두리 두께와 오른쪽 모서리 반경을 재서 페이드를 테두리 안쪽에 그린다(오른쪽 테두리를 덮지 않음, 옵션 없음). 예: `className="rounded-md border border-border"`(variety-adoption StageTimeline).
- **고정 높이 카드 채우기(`innerClassName`, C단계)**: 안내 줄 아래 relative 상자의 클래스. 남은 높이를 채우려면 `wrapperClassName="flex min-h-0 flex-1 flex-col"` + `innerClassName="min-h-0 flex-1"` + `className="h-full"` — 안내 줄 높이를 템플릿이 계산해 더하지 않는다(population-structure 요청).
- DOM: `div[data-scroll-region](wrapperClassName) > (p 안내) + div.relative(innerClassName) > div.relative.overflow-x-auto(className) + span[data-scroll-fade]`.

### KpiTile 옵션 상세

기존 props(`label`·`value`·`unit`·`delta`·`deltaLabel`·`better`·`target`·`spark`·`period`·`info`·`digits`)의 의미와 화면은 그대로다. 나머지는 모두 선택 옵션이다.

| 옵션 | 동작 |
| --- | --- |
| `label: ReactNode` + `plainLabel` | 라벨에 보조 설명 같은 노드를 넣을 수 있다. 노드면 `plainLabel`(설명 버튼·달성 막대의 접근성 이름)을 함께 넘긴다 |
| `sub` | 값 아래 보조 표기(12px muted). 예: `12.8 kg/10a/년` |
| `delta: null` | 비교 기준이 없음 → '—' 표시(`deltaLabel`은 유지) |
| `deltaUnit`, `deltaDigits` | 변화량 단위·자릿수. `%p`·`년`·`건`·`''` 등. 표시 자릿수로 반올림해 0이면 '변화 없음'(muted)으로 본다 |
| `achievement` | 달성률(%)을 직접 지정. 문자열 value이거나 달성률이 value/target이 아닐 때(예: 목표/실적) 쓴다. 없으면 `value/target`(better=down이면 `target/value`) |
| `targetLabel` | 목표 표기 직접 지정. 기본 `목표 {target}{unit}` |
| `achievementDigits` | 지정하면 막대 아래를 `{목표} · 달성률 98.7%`로 표시. 생략하면 기존 `{목표} · 95%`/`달성` |
| `achievementLabel` | 달성 막대 비율의 이름. 기본 `'달성률'`(생략하면 화면·DOM 그대로). 막대 아래 `{목표} · {achievementLabel} 98.7%`(achievementDigits나 severity를 줄 때)와 meter 접근성 이름 `{plainLabel} 목표 대비 {achievementLabel}`에 쓴다. 수급률·충족률처럼 '달성'이 아닌 비율에 쓴다. 예: `<KpiTile label="보급종 수급률" value={92.4} unit="%" achievement={92.4} achievementDigits={1} achievementLabel="수급률" targetLabel="수요 100%" severity="warning" />`. 생략 시 문구(`달성`·정수 %)와 severity 태그 문자(달성/주의/경보)는 바뀌지 않는다. 2026-10-27 추가(variety-adoption 요청) |
| `severity: 'ok'\|'warning'\|'critical'` | 달성 막대가 있으면 막대를 positive/warning/negative 색으로 칠하고 막대 아래 줄에 아이콘+문자 태그(달성/주의/경보, `SeverityTag`)를 붙인다. **달성 막대가 없으면(목표 없는 지표, 2026-10-30)** 머리 줄(기간·배지 뒤)에 같은 태그를 붙이고, warning·critical이면 타일 테두리를 옅은 심각도 색(`border-warning/15`·`border-negative/15`, surface 대비 약 1.3:1)으로 둔다. ok + 막대 없음은 표시하지 않는다. 태그 글자는 text 색(작은 글자 대비 확보). 루트에 `data-severity`(막대 없음 경보·주의). 테두리 클래스는 불투명 혼합 `border-[color-mix(in_oklab,var(--color-warning)_15%,var(--color-surface))]`(negative도 같은 꼴)다 — 반투명 `/15`와 같은 색이지만, 알파를 버리고 재는 검사(tasteskill heavy-borders)가 5.9:1로 잘못 집계했다(C단계). 로컬 요약 타일이 같은 표시를 하면 이 클래스를 쓴다 |
| `badge` | 머리 오른쪽(기간 옆)에 상태 표시. 보통 `<Badge>` |
| `range: { min, max, lo, hi, value?, label? }` | min~max 눈금 위에 정상 구간 lo~hi(positive 30%)와 현재 값 눈금. `value`를 생략하면 숫자 value를 쓴다 |
| `size` | `default` 값 28/30px · `compact` 값 28/30px·단위 16px · `hero` 값 최대 40px, 라벨 14px text 색. **앱 화면 규칙(2026-10-30)**: 어떤 값도 48px 이상이 되지 않는다. 대표 값은 칸 폭에 맞춰 `clamp(형제 값 28/30px, 내용 폭 × 0.22, 40px)`로 줄고(390px 2열 칸 '145/412'가 타일 밖으로 나가지 않게), 넓으면 형제의 1.3배 이상(40 ÷ 30)이다. 대표 타일은 크기로만 구분한다(강조색 테두리·링 없음). 기본 32px → 30px, 대표 48px → 40px로 낮췄다 |
| `spark` | **@deprecated(2026-10-30)**: 받되 그리지 않는다(앱 화면 규칙: KPI 타일에 스파크라인을 두지 않는다). 추세는 템플릿의 자체 차트에 두거나 없앤다. 목표 달성 막대는 그대로다 |
| 좁은 칸 | 내용 폭 240px 미만(1440 lg 6칸, 768 3칸, 390 2열 칸)이면 기간·배지·태그를 라벨 아래 줄로 내리고(라벨이 2줄을 넘지 않게), 막대 아래 태그를 왼쪽 정렬로 둔다. ⓘ는 라벨 글 끝에 붙고, 좁은 화면·터치에서 누르는 영역 44px. 폭은 ResizeObserver로 잰다(컨테이너 쿼리는 쌓임 맥락을 만들어 툴팁이 옆 타일 아래로 깔리므로 쓰지 않는다). 루트에 `data-kpi-tile` |

`KpiSeverity`, `KpiRange` 타입도 `@/design-system`에서 export한다.

## @/charts

```ts
export function EChart(props: {
  option: EChartsOption        // 색은 지정하지 않으면 테마가 적용됨
  height: number | string
  ariaLabel: string            // 필수: 차트가 말하는 결론 한 문장
  fallbackTable?: { columns: string[]; rows: (string | number)[][] } // 스크린리더용 숨김 표
  onEvents?: Record<string, (params: unknown) => void>
  renderer?: 'canvas' | 'svg'  // 기본 canvas
  loading?: boolean
}): JSX.Element
export function useChartTheme(): ChartTheme  // 현재 테마의 색(토큰을 읽어 계산)
export function histogramSeries<B extends { x0: number; x1: number }>(opts: {
  name: string; bins: readonly B[]
  y1: (bin: B) => number; y0?: (bin: B) => number; baseline?: number // 기본 0, 로그 축 1
  color: string | ((bin: B, i: number) => string); opacity?: number
  cursor?: (bin: B, i: number) => 'pointer' | 'default'
  extra?: (bin: B) => (number | string)[]  // 행 끝에 붙는 값
  series?: Record<string, unknown>         // tooltip, z 등
}): SeriesOption  // 사전 계산 구간의 막대(custom 시리즈)
export function hMarkLine(y: number | string, label: string | null, color: string, opts?: RefLineOptions): MarkLineItem  // 수평 기준선
export function vMarkLine(x: number | string, label: string | null, color: string, opts?: RefLineOptions): MarkLineItem  // 수직선
export function gsIntroLine(theme: ChartTheme, x: number | string, opts?: RefLineOptions): MarkLineItem             // 'GS 도입' 선
// RefLineOptions = { line?: 'solid'|'dashed'|'dotted'; width?: number; position?: MarkLineLabelPosition; fontWeight?: number|'normal'|'bold'; labelColor?: string }
export function useNarrowCategoryAxis<T extends HTMLElement = HTMLDivElement>(count: number, minBandPx?: number /* 기본 80 */): { ref: RefObject<T>; narrow: boolean }  // 범주 하나당 폭이 좁은지
export function errorBarSeries(opts: {
  name: string
  data: readonly { index: number; value?: number; lo: number; hi: number; marker?: boolean; extra?: (number | string)[] }[]
  horizontal?: boolean                                        // true면 범주 축이 y
  bar?: { color: string; opacity?: number; radius?: number } | false // false: 오차 막대만(막대는 일반 bar 시리즈)
  group?: { index: number; count: number; width?: number }    // 묶음 막대 위치, width 기본 0.8(범주 폭 대비)
  error: { color: string; lineWidth?: number /* 1.3 */; cap?: number | ((barWidth: number) => number) /* min(5, w×0.35) */ }
  marker?: { text: string; color: string; fontSize?: number }  // datum.marker인 항목에 오차 막대 끝 바깥 글자(예: 권장 ★)
  series?: Record<string, unknown>                            // z, silent, tooltip 등
}): SeriesOption  // 범주 축 막대 + 오차 막대 custom 시리즈. 행 = [index, value, lo, hi, marker(0|1), ...extra]
export type RiceSubpop = 'TEJ' | 'TRJ' | 'IND' | 'AUS' | 'ADM'
export const RICE_SUBPOP_CAT_INDEX: Record<RiceSubpop, number> // { TEJ: 0, IND: 1, TRJ: 2, AUS: 3, ADM: 7 }
export function riceSubpopColor(theme: Pick<ChartTheme, 'categorical'>, g: RiceSubpop): string // 벼 하위 집단 색
export type MetZoneKey = 'central' | 'south' | 'north'
export interface MetZone { key: MetZoneKey; label: string; short: string }
export const MET_ZONES: MetZone[]   // [중부 평야지/중부, 남부 평야지/남부, 중북부지/중북부] — 순서 = 범주형 팔레트 인덱스
export const MET_ZONE_BY_KEY: Record<MetZoneKey, MetZone>
export function metZoneColor(theme: Pick<ChartTheme, 'categorical'>, zone: MetZoneKey): string // MET 권역 색
export function stripeDecal(color: string, gap?: number /* 기본 3 */): StripeDecal // 시리즈 색 위 사선 빗금 itemStyle.decal
export function selectionStroke(theme: Pick<ChartTheme, 'surface' | 'text'>): SelectionStroke // { haloColor: surface, haloWidth: 4, lineColor: text, lineWidth: 2.5 } — 데이터 위 선택 표시(2026-10-30)
export function selectionSymbolSeries(theme: Pick<ChartTheme, 'surface' | 'text'>, opts: {
  value: readonly (number | string)[] | null | undefined  // 선택 점 data 한 행([x, y, …]). null이면 빈 시리즈(시리즈 수 유지)
  symbol?: string        // 기본 'circle'. 점 마크와 같게('diamond' 등)
  symbolSize?: number    // 기본 16
  z?: number             // 기본 5(후광 → 선 순서로 같은 z)
  name?: string          // 후광 시리즈 이름, 기본 '선택 후광'(선 시리즈는 ' 후광'을 뺀 이름)
  haloWidth?: number     // 기본 4. 지도·격자선 위처럼 선이 많은 곳에서 굵게
  xAxisIndex?: number; yAxisIndex?: number
}): [SeriesOption, SeriesOption]  // 산점·기호 위 선택 고리 [후광, 선] — 2026-10-30 C단계 승격
export const palettes: {
  categorical: () => string[]  // --viz-cat-1..8 실제 색값
  sequential: () => string[]
  diverging: () => string[]
  chromosome: () => [string, string]
  threshold: () => string
}
```

- `EChart`는 ResizeObserver로 크기를 맞추고, 테마(라이트·다크)가 바뀌면 다시 그린다.
- **값 축 눈금 정렬(2026-10-30 C단계)**: `type: 'value'`(yAxis는 type 생략 포함) 축에 숫자 `min`·`max`·`interval`을 함께 주고 `min`이 `interval`의 배수가 아니면, 래퍼가 `axisTick.customValues`·`axisLabel.customValues`를 [min, max] 안의 `interval` 배수로 채운다(눈금·격자선·라벨이 같은 값). ECharts는 그런 축의 눈금을 min부터 세어(min 0.5·interval 1 → 0.5, 1.5, …) 막대·정수 위치에 라벨이 없거나, 반올림 formatter가 눈금과 다른 값을 적는다(population-structure 요청). 템플릿이 `customValues`를 직접 주었으면 건드리지 않는다. 가장자리 라벨 숨김(`showMinLabel`·`showMaxLabel: false`)은 그 가장자리에 눈금이 더는 없으면 기본값으로 돌린다. 적용된 곳(2026-10-30): trial-site-environment SiteMap(126.1°E·35.1°N → 127°E·36°N…), kinship-heatmap 덴드로그램 축(0.3 시작 → 0.4·0.6…), met-gxe-stability GGE 바이플롯(실수 범위 → 짝수 눈금), population-structure PCA(0.02 단위 범위 → 0.04 배수, 0 격자선 포함). 의도적으로 min부터 세는 눈금이 필요하면 `customValues`를 직접 준다.
- **대용량 시리즈**: `large: true`이거나 데이터가 2,000점 이상인 시리즈는 `progressive`를 지정하지 않았으면 래퍼가 `progressive: 0`(한 프레임에 모두 그림)을 넣는다. ECharts 기본값은 큰 시리즈를 여러 프레임에 나눠 그려 스크린샷·인쇄에 점이 일부만 나온다. 템플릿이 `progressive`를 직접 주면 그 값을 존중한다.
- **렌더 완료 표시**: 차트 요소(`role="img"`, `_echarts_instance_`가 있는 div)에 `data-chart-ready`를 단다. `setOption` 직전에 `"false"`, ECharts `finished` 이벤트(렌더·애니메이션 완료)에서 `"true"`. `verify-templates.mjs`는 스크린샷 전에 `[data-chart-ready="false"]`가 없어질 때까지(최대 10초) 기다리고, 시간이 넘으면 문제로 보고한다.
- `useNarrowCategoryAxis(count, minBandPx)`: 반환한 `ref`를 차트를 감싸는 요소에 붙이면, 범주 하나당 폭(요소 폭 / count)이 `minBandPx`보다 좁을 때 `narrow`가 true다. 긴 한국어 범주 라벨을 기울이는 데 쓴다: `axisLabel: narrow ? { interval: 0, rotate: 35 } : { interval: 0, width: 64, overflow: 'break' }`.
- `histogramSeries`: 사전 계산한 구간을 `[x0, x1]`에 맞춘 사각형(이웃과 1px 틈)으로 그리는 custom 시리즈를 만든다. 데이터 행은 `[x0, x1, y0, y1, ...extra(bin)]`이고 툴팁·클릭의 `params.value`가 이 배열이다. 누적 막대는 같은 bins로 시리즈를 여러 개 만들고 위 시리즈의 `y0`를 아래 시리즈의 `y1`로 준다. 로그 y축이면 `baseline: 1`. 축·기준선·평균선·주석·KDE는 템플릿이 그린다(기준선 표현이 템플릿마다 달라 공통화하지 않았다). 사용 예: `kpi/genotyping-lab-ops` CallRateHistogram(구간별 색·로그 전환·클릭), `viz/gebv-selection` SelectionHistogram(선발/비선발 누적).
- `hMarkLine` / `vMarkLine` / `gsIntroLine`: `series.markLine.data`에 넣는 항목을 만든다(`markLine`의 `symbol: 'none'`, `silent: true`는 호출부가 둔다). 기본값은 선 `solid` 1.5px, 라벨 11px·굵기 600·선과 같은 색, 라벨 위치는 수평선 `insideEndTop`, 수직선 `end`. `label`이 `null`이면 `label: { show: false }`(선만). `gsIntroLine`은 `vMarkLine(x, 'GS 도입', theme.accent, { line: 'dashed', fontWeight: 700, ...opts })`이다. 범주 축이면 x는 범주 인덱스(`years.indexOf(GS_START)`). 라벨 배경·offset 같은 다른 속성이 필요하면 `{ ...hMarkLine(...), label: {...} }`로 덮어쓰지 말고 객체를 직접 쓴다(프리셋은 같은 모양을 반복할 때만 쓴다). 타입 `MarkLineItem`, `MarkLineLabelPosition`, `MarkLineStroke`, `RefLineOptions`도 export한다. 사용 예: `kpi/diversity-monitor` TrendCharts, `kpi/genetic-gain-tracker` TrendChart·IndexChart, `kpi/program-overview` GainChart.
- `errorBarSeries`: 범주 축의 막대 + 오차 막대(±SD·신뢰구간)를 custom 시리즈 하나로 그린다. 묶음 막대는 모델·환경마다 시리즈를 만들고 `group: { index: j, count: k }`(범주 폭 80%를 k칸, 막대 폭 = 칸 − min(3, 칸 × 0.18), 끝 모서리 반경 2). 오차 막대는 세로선 + 양끝 cap, 표식은 세로면 위 끝 3px 위 가운데, 가로면 오른쪽 끝 4px 오른쪽. 막대 위 값 라벨이 필요하면 `bar: false`로 오차 막대만 만들고 막대는 일반 bar 시리즈(label)로 그린다. lo/hi는 호출부가 축 범위로 자른다. 축·툴팁·선택 범주 배경은 템플릿이 정한다. 사용 예: `kpi/gs-model-performance` AccuracyChart(묶음·세로/가로·★), `kpi/program-overview` TraitAccuracyChart(`bar: false`, cap 6, lineWidth 1.5). 2026-10-26 승격
- `riceSubpopColor`: 벼 하위 집단 색을 범주형 팔레트 인덱스로 고정한다(TEJ 파랑 cat[0], IND 주황 cat[1], TRJ 청록 cat[2], AUS 보라 cat[3], 혼합형 ADM 회청 cat[7]). cat[4]·cat[5]는 도입 계열 조상 성분(population-structure `componentColor`)이 쓴다. '전체 패널' 같은 비집단 계열은 템플릿이 중립색(`theme.text`)을 정한다. 집단 키가 템플릿마다 다르면 템플릿에 얇은 `groupColor` 래퍼를 둔다. 사용 예: `viz/population-structure`, `viz/ld-decay`. 2026-10-26 승격
- `metZoneColor` / `MET_ZONES` / `MET_ZONE_BY_KEY`: 벼 지역 적응 시험(MET) 권역 라벨과 색. 중부 평야지 파랑 cat[0], 남부 평야지 주황 cat[1], 중북부지 청록 cat[2], 목록 밖 값은 cat[7]. 메가 환경을 권역으로 묶는 화면과 시험지 화면이 같은 권역을 같은 색으로 그리게 한다. 템플릿 `data.ts`는 `export const ZONES = MET_ZONES`처럼 별칭을 둘 수 있다(라벨 문자열을 다시 쓰지 않는다). 사용 예: `viz/met-gxe-stability`, `kpi/trial-site-environment`, `infographic/variety-application-brief`, `infographic/variety-profile`(라벨로 키를 찾는 `useZoneColor` 래퍼, 2026-10-30 로컬 색에서 전환). 권역 색을 템플릿 로컬 상수로 다시 정하지 않는다. 2026-10-27 승격
- `stripeDecal(color, gap)`: 막대 `itemStyle.decal`에 넣는 사선 빗금. `{ symbol: 'rect', symbolSize: 1, color, dashArrayX: [1, 0], dashArrayY: [2, gap], rotation: -π/4 }`를 돌려준다. 바탕은 시리즈 색 그대로라 누적 막대에서 계획·전망·진행 중(미확정) 칸을 계열 색을 잃지 않고 구분한다. `color`는 보통 `theme.surface`. 결측처럼 회색 바탕 빗금이 필요하면 `hatchPattern`(@/design-system)을 쓴다. 타입 `StripeDecal`도 export한다. 사용 예: `kpi/variety-adoption` AreaTrendChart·StagePanels(계획 연도, gap 3), `kpi/genotyping-lab-ops` MonthlyThroughputChart(진행 중인 달, gap 4). 2026-10-27 승격
- `selectionStroke(theme)`: 데이터 위 선택·현재·1위 표시 규격(visual-language 「데이터 위 선택 표시」). 같은 도형을 두 번 그린다 — 표면색 4px 후광 → 글자색 2.5px 선. 강조색은 범주 1색·순차 척도와 같은 파랑이라 데이터 위 선택에 쓰지 않는다. SVG: `<rect stroke={s.haloColor} strokeWidth={s.haloWidth}/><rect stroke={s.lineColor} strokeWidth={s.lineWidth}/>`, ECharts custom: `style: { fill: 'transparent', stroke, lineWidth }` 두 개. HTML 칸은 CSS `select-ring`. 기준 구현 `viz/trait-correlation` CorrelationMatrix 선택 셀. 타입 `SelectionStroke`. 2026-10-30
- `selectionSymbolSeries(theme, { value, symbol?, symbolSize?, z?, name?, haloWidth? })`: 산점·기호 마크 위 선택 표시(위 규격의 점 판). 같은 자리에 빈 고리 두 개(표면색 후광 → 글자색 선)를 silent 시리즈로 돌려준다 — `series: [..., ...selectionSymbolSeries(theme, { value: sel ? [x, y] : null })]`. 툴팁·클릭은 아래 점이 받고, 선택이 없어도 빈 시리즈로 남아 시리즈 번호가 바뀌지 않는다(툴팁 formatter가 `seriesIndex`로 시리즈를 가리면 이 두 시리즈를 맨 뒤에 둔다). 선택 점을 키우는 것은 호출 측(`symbolSize`를 고리와 같게 두면 점 테두리를 덮고, 크게 두면 틈이 생긴다). 점 테두리를 글자색으로 바꾸거나 `shadowBlur`로 후광을 흉내 내지 않는다. 사용 예: `viz/gebv-selection` TraitScatter(원 16), `viz/gwas-manhattan` ManhattanChart(리드 SNP 다이아몬드 16, z 6), `kpi/trial-site-environment` SiteMap(지점 고리 40, z 1, `haloWidth` 6.5). 타입 `SelectionSymbolOptions`. 2026-10-30 C단계 승격(3곳 중복)
- 필요한 ECharts 컴포넌트(Scatter, Line, Bar, Heatmap, Graph, Tree, Boxplot, Custom, Grid, Tooltip, DataZoom, VisualMap, MarkLine, MarkArea, Legend, Title)를 `charts/` 안에서 한 번 등록한다. 템플릿이 `echarts.use()`를 직접 호출하지 않게 하기 위해서다.

## @/lib/rng

```ts
export function createRng(seed: number): {
  next(): number                       // [0,1)
  int(min: number, max: number): number // 양끝 포함
  normal(mean?: number, sd?: number): number
  beta(a: number, b: number): number
  pick<T>(arr: readonly T[]): T
  shuffle<T>(arr: readonly T[]): T[]
}
```

## @/lib/format

```ts
formatNumber(v: number, opts?: { digits?: number; compact?: boolean }): string // 12,480 / 1.2만
formatPercent(v: number, digits?: number): string   // 0.987 → "98.7%"
formatPValue(p: number): string                     // 3.2×10⁻⁹
formatDelta(v: number, opts?: { digits?: number; unit?: string }): string // ▲ 1.2% / ▲ 9,644 ha (정수부 1,000 이상 천 단위 쉼표 — 2026-10-27, 1,000 미만은 toFixed 그대로)
formatDate(d: string | Date, style?: 'short' | 'long'): string
formatSigned(v: number, digits?: number): string     // +45 / −4 / +1.1 (진짜 마이너스 U+2212, 기본 0자리). 반올림해 0이면 부호 없이 "0"·"0.0", 천 단위 쉼표, 비유한 값 "–"
formatFixed(v: number, digits: number): string       // 0.52 / −0.05 / 1.017 (고정 소수, 음수만 U+2212, 양수에 "+" 없음). Math.round로 반올림해 0이면 부호 없이 "0.00"(−0 방지), 천 단위 쉼표, 비유한 값 "–". 2026-10-26 승격(kinship-heatmap fmtD, cross-planner fmt1/fmt2)
```

한국어 조사(2026-10-27 승격, trait-correlation `josa`·ld-decay `hasBatchim`):

```ts
hasBatchim(word: string): boolean  // 마지막 글자 받침 유무. 한글 음절은 종성, 숫자는 읽는 소리(0·1·3·6·7·8 = 받침, 2·4·5·9 = 없음), 그 밖(라틴·기호·빈 문자열)은 없음
josa(word: string, pair: '와과' | '를을' | '는은' | '가이'): string // word + 조사. josa('간장', '를을') → "간장을", josa('rs1234', '는은') → "rs1234는"
```

상수·이름을 넣어 문장을 만들 때 조사를 직접 쓰지 않는다(`${name}은` → `josa(name, '는은')`). 고정 문구의 "은(는)" 병기도 이름이 상수면 `josa`로 바꾼다. 라틴 문자로 끝나는 이름(예: "SNP")은 받침 없음으로 처리하므로, 읽는 소리가 받침으로 끝나면 문장을 바꾸거나 조사를 직접 고른다.

`formatFixed`와 `formatSigned`의 구분: 값 자체(G, f, 신뢰도, GEBV 수준)는 `formatFixed`, 차이·변화량처럼 양수에도 "+"가 필요한 값은 `formatSigned`를 쓴다. 템플릿에서 `toFixed(...)` 뒤에 `replace('-', '−')`를 붙이는 로컬 함수를 새로 만들지 않는다.

## @/lib/genomics

```ts
export const ORGANISMS: Record<string, { name: string; chromosomes: { id: string; lengthMb: number }[] }>
export function simulateGwas(rng, opts: { organism?: string; snpCount?: number; peaks?: { chr: string; posMb: number; logP: number }[]; ldDecayKb?: number }):
  { snps: { id: string; chr: string; posMb: number; cumPos: number; logP: number; maf: number }[]; chrOffsets: { chr: string; start: number; end: number; mid: number }[]; lambda: number }
export function simulateGebv(rng, opts: { n: number; traits: { key: string; h2: number; mean: number; sd: number }[]; accuracy?: number }):
  { id: string; traits: Record<string, { gebv: number; reliability: number; pheno?: number }> }[]
export function lineName(rng, prefix?: string, year?: number): string  // "YR24-0153"
export function selectionIntensity(p: number): number                 // 정규 절단 근사

// 통계 보조(정규분포·GWAS)
export function normCdf(x: number): number            // Φ(x), Abramowitz–Stegun 7.1.26
export function normPdf(x: number): number            // φ(x)
export function normInv(p: number): number            // Φ⁻¹(p), Acklam. p≤0 → −∞, p≥1 → +∞
export function normUpperTail(x: number): number      // 1 − Φ(x), x ≥ 0, 뺄셈 없이 계산(큰 x에서 정밀)
export function logPFromZ(z: number): number          // 양측 z → −log10(p). |z| ≥ 4는 점근 꼬리식(p < 1e-300도 유한)
export function chi2FromLogP(logP: number): number    // −log10(p) → χ²(1) (= z²), 이분법. 피크 목업용(−log10 p ≳ 3)
export const CHI2_1DF_MEDIAN = 0.4549

// 근연 등급(program-baseline 근연 표기: 자식성 벼, "근교 경고"라고 쓰지 않는다)
export const KIN_WARN = 0.375      // f ≥ 0.375 → 'warn' "강한 근연"(자손 분리 분산이 작음)
export const KIN_CAUTION = 0.25    // 0.25 ≤ f < 0.375 → 'caution' "근연 주의"
export type KinLevel = 'warn' | 'caution' | 'ok'
export function kinLevel(f: number): KinLevel
export const KIN_LEVEL_LABEL: Record<KinLevel, string> // { warn: '강한 근연', caution: '근연 주의', ok: '정상' }
export function lambdaGC(logP: ArrayLike<number>): number // [Φ⁻¹(1 − p중앙/2)]² / 0.4549, 중앙값은 짝수 길이면 가운데 두 값 평균

// 벼 KASP 16마커 패널(2026-10-30 승격: crossing-record·variety-application-brief·variety-identity-markers)
export const KASP_MARKERS: readonly ['Pi9','Pi-ta','Pib','Pigm','Xa21','xa5','Bph18','Wx','Hd1','sd1','GS3','ID02','ID04','ID07','ID09','ID11'] // 분석실 패널 순서. 유전형 배열 인덱스 = 이 순서(0 = AA, 2 = BB)
export type KaspMarker = (typeof KASP_MARKERS)[number]
export const KASP_KIND: Record<KaspMarker, string>   // 도열병 ×4 · 흰잎마름병 ×2 · 벼멸구 · 저아밀로스 · 출수 지연형 · 반왜성 · 천립중 증가형 · 식별(중립) ×5
export const KASP_ALLELE_DIRECTION_NOTE: string        // '기능 마커 BB = 효과 대립유전자(저항성·저아밀로스·출수 지연형·반왜성·천립중 증가형) · ID 마커(품종 식별용) BB = 대체 대립유전자'
export const isKaspIdMarker: (m: string) => boolean    // ID02~ID11(식별용 중립 SNP)
```

- KASP 상수의 형질 설명·방향 문구는 breeding-metrics `program-baseline.md` 「KASP 대립유전자 방향」 행과 같아야 한다. 패널 구성·방향 정의가 바뀌면 그 행을 먼저 고치고 이 상수를 고친다(세 템플릿에 함께 반영된다).
- 템플릿은 `export const MARKERS = KASP_MARKERS`처럼 로컬 이름으로 다시 내보내도 된다. 마커 배열·형질 설명·방향 문구를 템플릿에 다시 적지 않는다. 템플릿별 유전형 값(부모·품종 프로필)은 템플릿 `data.ts`에 둔다.

목업 생성기는 출발점일 뿐이다. 템플릿 특유의 데이터는 템플릿의 `data.ts`에서 만든다.

## @/lib/stats

2026-10-27 승격(trial-site-environment·met-gxe-stability 불완전 베타 복제, trait-correlation·gebv-selection 피어슨, trait-correlation·genetic-gain-tracker·gs-model-performance·trial-site-environment 단순 회귀).

```ts
export function pearson(xs: ArrayLike<number>, ys: ArrayLike<number>): number  // 두 단계(평균 → 편차 곱 합). 한쪽 분산 0이면 NaN — 0으로 바꿀지는 호출부가 정한다
export function linearFit(xs: ArrayLike<number>, ys: ArrayLike<number>): { slope: number; intercept: number } // 최소제곱 y = intercept + slope·x
export function lgamma(x: number): number                    // ln Γ(x), x > 0 (Lanczos, NR gammln)
export function ibeta(a: number, b: number, x: number): number // 정규화 불완전 베타 I_x(a, b) (NR betacf, 최대 300회·수렴 3e-14). x ≤ 0 → 0, x ≥ 1 → 1
export const tTwoSided: (t: number, df: number) => number     // t 분포 양측 p = ibeta(df/2, 0.5, df/(df + t²))

// 이항 분포(2026-10-30 승격: variety-application-brief 균일성·variety-identity-markers 순도)
export function binomCdf(k: number, n: number, p: number): number                 // P(X ≤ k | n, p), (1 − p)^n에서 점화식 합산
export function binomAcceptMax(n: number, p: number, acceptProb: number): number  // P(X ≤ k) ≥ acceptProb인 최소 k(UPOV 이형주·이형립 허용 수). (400, 0.001, 0.95) → 2, (188, 0.001, 0.95) → 1
export function clopperPearsonUpper(x: number, n: number, alpha?: number): number // 단측 Clopper–Pearson 상한 p_U(기본 alpha 0.05), 이분법 100회. 순도 하한 = 1 − p_U
```

- 합산 순서·연산 형태를 바꾸지 않는다. 승격 전 템플릿 로컬 구현과 결과가 비트 단위로 같고, 템플릿 DEV 검산(`console.assert` + `[검산]`)이 이 값을 고정값과 비교한다.
- F 상측 확률은 `ibeta(d2/2, d1/2, d2/(d2 + d1·F))`로 템플릿이 만든다(met-gxe-stability `fUpper`, 한 곳뿐이라 공개하지 않음). 임계값 이분법(`T975`, `R_CRIT`)도 템플릿마다 구하는 양이 달라 템플릿에 둔다.
- 고유값 분해·SVD(met-gxe-stability `jacobiEigen`·`svd`)는 한 템플릿에서만 써서 공개하지 않았다. 두 번째 사용처가 생기면 이 모듈로 옮긴다.
