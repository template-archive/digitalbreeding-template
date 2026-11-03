---
name: db-design-system
description: "디지털육종 템플릿 라이브러리의 프로젝트 구조, 디자인 토큰(라이트·다크), 공통 컴포넌트·차트 래퍼·목업 유틸의 공개 API 계약, 갤러리 URL 규칙을 정의한다. 프로젝트 기반을 처음 구축하거나, 토큰·테마·공통 컴포넌트를 바꾸거나, 템플릿 빌더가 사용할 수 있는 공통 API를 확인할 때 사용한다. 개별 템플릿 화면을 구현하는 절차는 template-authoring 스킬을 쓴다."
---

# 디지털육종 디자인 시스템 계약

템플릿 빌더 여러 명이 병렬로 일하고, QA 스크립트가 갤러리를 자동으로 순회한다. 둘 다 이 문서의 **계약**(경로·export 이름·URL·DOM 속성)에 의존한다. 계약을 바꾸면 이 문서를 먼저 고치고, `template-qa/scripts/`와 기존 템플릿을 함께 고친다.

## 기술 스택

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| 빌드 | Vite + React 18 + TypeScript(strict) | 빠른 HMR, 갤러리 자동 등록에 `import.meta.glob` 사용 |
| 스타일 | Tailwind CSS v4(`@tailwindcss/vite`) + CSS 변수 토큰 | 토큰을 `@theme`에 연결해 유틸리티 클래스와 차트가 같은 값을 쓴다 |
| 차트 | Apache ECharts 5(`echarts/core` 모듈식 import) | 캔버스 기반 대용량(SNP 수만 개) 렌더, 히트맵·그래프·트리 내장 |
| 폰트 | Pretendard Variable(npm `pretendard`) | 한글 가독성, 숫자는 `font-variant-numeric: tabular-nums` |
| 아이콘 | lucide-react | 일관된 선 굵기 |
| 검증 | playwright, @axe-core/playwright (devDependencies) | QA 스크립트가 프로젝트의 node_modules에서 불러온다 |

라우터 라이브러리는 쓰지 않는다. 갤러리는 해시 라우팅을 직접 처리한다(의존성 최소화).

## 디렉터리 구조와 공개 API

```
src/
├── main.tsx, index.css            # index.css: tailwind import + tokens.css + @theme 연결
├── design-system/
│   ├── tokens.css                 # CSS 변수(라이트 기본, 다크는 아래 규칙)
│   ├── index.ts                   # 컴포넌트 배럴 export (@/design-system)
│   ├── hooks/*.ts                 # useMediaQuery·useElementWidth(공개), useScrollOverflow·useContentWidth(내부)
│   └── components/*.tsx
├── charts/
│   ├── index.ts                   # @/charts
│   ├── EChart.tsx                 # 공통 차트 래퍼
│   ├── theme.ts                   # 토큰 → ECharts 테마 변환, useChartTheme()
│   ├── selection.ts               # selectionStroke(데이터 위 선택 표시 규격)
│   └── palettes.ts                # categorical / sequential / diverging / chromosome
├── lib/
│   ├── rng.ts                     # @/lib/rng
│   ├── format.ts                  # @/lib/format
│   ├── genomics.ts                # @/lib/genomics (목업 생성기)
│   └── stats.ts                   # @/lib/stats (상관·회귀·t 분포 꼬리 확률)
├── gallery/                       # 갤러리 앱(하네스 밖 PR에서도 바뀐다 — api-contract 「갤러리 셸·상세 화면」)
│   ├── types.ts                   # TemplateMeta, TemplateCategory
│   ├── registry.ts                # import.meta.glob('../templates/*/*/index.tsx') 지연 로드(eager 아님) — hasTemplate·loadTemplate·useTemplateList
│   ├── router.ts                  # 해시 라우팅: #/ 홈, #/library 목록, #/t/{category}/{slug} 상세, ?embed=1·?theme=
│   ├── Shell.tsx · Home.tsx       # 셸(사이드바·좁은 화면 메뉴 시트), 홈
│   ├── Gallery.tsx · ListSections.tsx · TemplateCard.tsx  # 목록(카테고리·검색·카드, 로드 실패 상자)
│   ├── TemplatePage.tsx · template-page.css  # 상세: 상단 메타 → 미리보기 프레임(폭 iframe) → 이전·다음
│   ├── TemplateResources.tsx      # 「프로젝트에 가져오기」 모달(public/downloads)
│   ├── order.ts · thumbs.ts · reveal.ts  # 정렬, 썸네일 지도(src/gallery/thumbs/*.webp), 스크롤 등장
│   ├── Readme.tsx · markdown.tsx  # README 패널과 의존성 없는 마크다운 변환기
│   └── TemplateView.tsx           # 해당 템플릿 모듈만 로드 + FeedbackOverlay + ErrorBoundary + data-template-root
├── features/
│   ├── feedback/                  # 템플릿 위치 코멘트(공유 저장: server/·api/feedback.ts·db/, 테스트 tests/feedback*.test.mjs)
│   └── template-data/             # 사용자 데이터 가져오기 계약(ProgramDataset — 연결형 템플릿 program-overview)
└── templates/{category}/{slug}/   # 템플릿(빌더 소유)
scripts/prepare-downloads.mjs      # predev·prebuild: 템플릿별 starter.zip·sample·schema·guide → public/downloads(git 제외)
```

경로 별칭 `@/` → `src/`를 `tsconfig`와 `vite.config.ts`에 모두 설정한다.

필수 export 목록과 시그니처는 `references/api-contract.md`에 있다. 초기 구축 시 이 목록을 **모두** 구현하고, 빌더는 이 목록에 있는 것만 쓴다.

## 갤러리 URL·DOM 계약(QA 스크립트 의존)

- 홈: `/#/`, 목록: `/#/library?category=&q=`
- 템플릿 보기: `/#/t/{category}/{slug}` — 갤러리 사이드바·상단 메타·미리보기 프레임 포함. 구성은 `references/api-contract.md` 「갤러리 셸·상세 화면」
- 임베드(스크린샷용): `/?embed=1#/t/{category}/{slug}` — 템플릿만 렌더, 여백 24px
- 테마 강제: `?theme=dark` 또는 `?theme=light` (없으면 `prefers-color-scheme`을 따름)
- 템플릿을 감싸는 요소에 `data-template-root="{slug}"`를 붙인다. 그 안에서 `FeedbackOverlay`가 템플릿을 감싼다(임베드 포함). 피드백 도구는 화면 고정이라 QA 스크립트가 숨기고 검사한다.
- ErrorBoundary가 오류를 잡으면 `data-template-error="{slug}"` 요소에 메시지를 렌더한다.
- 존재하지 않는 slug면 `data-template-missing` 요소를 렌더한다.
- 템플릿 모듈은 지연 로드한다. 로딩 중에는 `data-template-loading`만 렌더하고(루트·missing 없음), 모듈 로드(import·평가) 실패는 `data-template-error`에 모듈 경로와 함께 보인다. 한 템플릿의 로드 실패는 다른 템플릿 화면·목록에 번지지 않는다. 상태별 DOM과 목록 동작은 `references/api-contract.md`의 「갤러리 로딩·DOM 계약」.
- `_`로 시작하는 slug(예: `_starter`)는 내부 검증용이다. 목록에는 숨기고 URL로는 열 수 있게 한다.
- 인쇄 캔버스: `ScaledCanvas`에 `print`를 주면 `<html data-print-mode="canvas">`가 켜지고, 인쇄 시 `[data-print-hide]`(갤러리 사이드바·상단 바·가져오기 모달·피드백 도구·이전/다음)는 숨고 `[data-print-flat]`(캔버스를 감싼 레이아웃 래퍼, `data-template-root` 포함)은 여백·폭 제한을 잃는다. 규칙은 `src/index.css`에 있다. 갤러리 레이아웃을 바꾸면 두 속성을 유지한다.

## 디자인 토큰 규칙

- 의미 기반 이름을 쓴다: `--color-bg`, `--color-surface`, `--color-surface-2`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-contrast`, `--color-primary`, `--color-primary-contrast`, `--color-active`, `--color-positive`, `--color-negative`, `--color-warning`, `--color-info`.
- 강조색(`--color-accent`)은 데이터와 선택 표시(포커스 링 포함)에만 쓴다. 주 버튼은 `--color-primary`(거의 검정), UI 크롬 활성은 `--color-active`(회색 채움)나 잉크 밑줄이다(앱 화면 규칙, 2026-10-30).
- 데이터 색은 별도 이름을 쓴다: `--viz-cat-1` … `--viz-cat-8`, `--viz-seq-1` … `--viz-seq-7`, `--viz-div-neg-3` … `--viz-div-pos-3`(0은 중립), `--viz-chr-a`, `--viz-chr-b`(맨해튼 교대 2색), `--viz-threshold`(유의선).
- 다크 모드: `:root`에 라이트 값, `@media screen and (prefers-color-scheme: dark) { :root:not([data-theme="light"]):not([data-printing]) {…} }`와 `@media screen { :root[data-theme="dark"]:not([data-printing]) {…} }`에 다크 값. 다크는 화면 전용이라 인쇄는 늘 라이트 토큰이다(2026-10-30).
- 토큰 색을 바꾸면 `node .claude/skills/db-design-system/scripts/check-palette.mjs`로 전·후 대비·색차(ΔE00, 색각 이상 시뮬레이션)를 검산하고 위반 0건을 확인한다.
- 간격 4px 단위, 모서리 반경 `--radius-sm/md/lg`, 그림자 `--shadow-1/2`(다크에서는 약하게).
- 범주형 팔레트는 색약 안전(인접 색 명도 차)을 확인한다. 상세 기준은 `references/visual-language.md`.

## 시각 언어

농업·생명과학이라고 녹색 일색으로 만들지 않는다. 연구 도구다운 절제된 중립 배경 위에, 강조색 하나와 데이터 색만 채도를 갖는다. 방향성, 타이포 위계, 밀도 기준은 `references/visual-language.md`를 읽는다.

## 완료 조건(초기 구축·변경 공통)

1. `npm run typecheck` 0 오류, `npm run build` 성공
2. `node .claude/skills/template-qa/scripts/lint-templates.mjs` 통과(템플릿이 없으면 0건 통과)
3. 기반 검증용 예제 템플릿 `src/templates/kpi/_starter/`가 있으면 `verify-templates.mjs --slug _starter`가 라이트·다크 모두 오류 없이 렌더
4. `_workspace/00_foundation_report.md`에 구현한 API 목록과 계약에서 벗어난 점을 기록
