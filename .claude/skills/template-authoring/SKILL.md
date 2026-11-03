---
name: template-authoring
description: "디지털육종 UI/UX 템플릿 하나를 명세에서 React+TS 코드로 구현하는 절차. 폴더 구조(index.tsx·data.ts·README.md), meta export, 시드 기반 목업 데이터, 카테고리별(KPI 대시보드·데이터 시각화·인포그래픽·업무 화면) 구성 원칙, 상태 화면, 반응형·다크 모드·접근성 규칙, 자체 점검 방법을 다룬다. 템플릿을 새로 만들거나 고칠 때, 템플릿 디자인을 수정·보완할 때 사용한다. 공통 컴포넌트·토큰 자체를 바꾸는 일은 db-design-system 스킬을 쓴다."
---

# 템플릿 작성 절차

템플릿은 "그대로 복사해 실제 서비스에 옮겨 쓸 수 있는 화면"이어야 한다. 그래서 데이터는 `data.ts`로, 화면은 `index.tsx`로 분리하고 공통 API만 쓴다. 실제 API로 교체할 때 `data.ts`만 바꾸면 되게 하기 위해서다.

## 1. 시작

1. 명세 `docs/specs/{slug}.md`를 끝까지 읽는다. 수용 기준이 완료의 정의다.
2. 공통 API를 확인한다: `.claude/skills/db-design-system/references/api-contract.md`. 실제 구현은 `src/design-system/index.ts`, `src/charts/index.ts`에서 확인한다(계약과 다르면 실제 코드가 우선, 차이는 `notes`에 보고).
3. 폴더가 없으면 스캐폴드를 만든다.
   ```bash
   node .claude/skills/template-authoring/scripts/new-template.mjs --category viz --slug gwas-manhattan --title "GWAS 결과 뷰어"
   ```

## 2. 폴더 구조

```
src/templates/{category}/{slug}/
├── index.tsx      # export const meta, export default 컴포넌트 — 화면 조립만
├── data.ts        # 시드 RNG로 만든 목업 데이터와 타입. 순수 함수·상수만
├── components/    # (선택) 이 템플릿 전용 하위 컴포넌트
└── README.md      # 목적, 사용 지표, 데이터 교체 방법, 변경 이력
```

- 다른 템플릿 폴더를 import하지 않는다. 템플릿끼리 의존하면 하나를 복사해 가져갈 때 따라오는 파일이 생긴다.
- `src/design-system`, `src/charts`, `src/lib`, `src/gallery`는 읽기 전용이다. 필요한 것이 없으면 `components/`에 로컬로 만들고 보고한다.

### 로컬 컴포넌트를 만들 때

공통 모듈에 없는 컴포넌트를 `components/`에 만들기 전에 `.claude/skills/db-design-system/references/promotion-holds.md`를 보고, 같은 역할의 로컬 구현이 다른 템플릿에 있는지 grep한다(요약 타일, 필터 칩, 큰 숫자 카드, 색 보간 등). 있으면 import하지 말고 그 구현의 시각 규격(크기·간격·구성 순서)과 계산 규칙을 그대로 옮겨 쓰고, `sharedCandidates`에 "기존 {slug} 규격과 같음"이라고 적는다. 배치 11~14의 승격 후보 대부분이 "같은 역할인데 템플릿마다 9곳이 달라 합치면 화면이 바뀐다"는 이유로 보류됐다. 빌더마다 새로 만들면 같은 컴포넌트가 영영 공통 모듈이 되지 못한다.

### 다운로드 스타터(2026-11-03)

갤러리의 「프로젝트에 가져오기」는 템플릿마다 `starter.zip`·`sample-data.json`·`schema.json`·`guide.md`를 내려받게 한다. 이 파일은 `scripts/prepare-downloads.mjs`가 `npm run dev`·`build` 직전(`predev`·`prebuild`)에 **모든 템플릿**의 `index.tsx`·`data.ts`를 Vite SSR(브라우저 없이 Node)로 불러와 만든다. 템플릿 하나가 실패하면 모든 사람의 dev·build가 멈춘다.

- `index.tsx`·`data.ts`의 **모듈 최상위**에서 `window`·`document`·`location`·`localStorage`·`matchMedia`를 쓰지 않는다. `?state=` 읽기, 미디어 쿼리, 저장소 접근은 컴포넌트·훅 안에서 한다.
- `README.md`는 `guide.md`의 원문이다. 템플릿을 받아 가는 사람이 읽을 수 있게 목적·쓰는 지표·데이터 교체 방법을 쓴다(없으면 다운로드 준비가 실패한다).
- `data.ts`의 함수가 아닌 내보내기는 `sample-data.json`으로 스냅샷된다. JSON으로 바꿀 수 있는 값(배열·객체·Map·Set)으로 두고, 공개하면 안 되는 값을 내보내지 않는다.
- 연결형 템플릿 `kpi/program-overview`: `data?: ProgramDataset` prop과 `data.ts`의 `MU`·`YEARS`·`I`·`R`·`SIGMA_A`·`L`·`dGTargetPct` 이름을 유지한다(다운로드 스크립트의 데이터 계약).
- 확인: `node .claude/skills/template-qa/scripts/check-ssr.mjs --slug {slug}`(「6. 품질 기준」 3). verify는 브라우저로만 열어 이 실패를 잡지 못한다.
- 새 템플릿은 피드백 API 허용 목록(`server/feedback-templates.ts`)에도 들어가야 코멘트를 받는다. 공유 파일이라 빌더는 고치지 않는다. 메인이 `npm run sync:feedback-templates`로 갱신한다(오케스트레이터 5단계). 빌더 혼자 일할 때는 보고 `notes`에 "피드백 목록 갱신 필요"라고 적는다.

## 3. 코드 규칙

| 규칙 | 이유 |
| --- | --- |
| 목업 데이터는 `createRng(seed)`로 생성, 모듈 최상위에서 한 번 계산 | 렌더마다 값이 바뀌지 않아야 스크린샷 비교가 가능 |
| 색은 Tailwind 토큰 클래스(`bg-surface`, `text-muted` 등)와 `palettes`만 사용, hex 직접 금지 | 다크 모드·테마 교체가 토큰만으로 반영됨 |
| 모든 `EChart`에 결론형 `ariaLabel`과 가능하면 `fallbackTable` | 스크린리더 사용자도 차트의 결론을 얻음 |
| 숫자 표시는 `@/lib/format` 사용(음수 값은 `formatFixed`, 변화량은 `formatSigned`) | 단위·자릿수 표기가 템플릿 간 일관, −0·하이픈 마이너스 방지 |
| 문장·라벨·`ariaLabel`·각주에 들어가는 숫자도 `data.ts`의 값·상수에서 만들어 넣는다. 문자열에 숫자를 직접 쓰지 않는다 | 표·차트는 계산값이 바뀌면 따라가지만 직접 쓴 숫자는 남는다. 실제로 "0.066"(표는 0.065)이나 정리 회차 뒤 옛 기울기가 문구에 남았다. 꼭 직접 써야 하면 같은 값을 DEV 검산으로 확인한다 |
| 화면 텍스트는 한국어, 용어는 `breeding-metrics`의 용어집 | 사용자층이 국내 육종 연구자 |
| 상호작용 상태(필터 등)는 컴포넌트 `useState`로 충분, 전역 상태 라이브러리 금지 | 복사해 쓰기 쉬워야 함 |
| 최상위 요소에 고정 너비를 주지 않는다(인포그래픽 캔버스 제외) | 390px에서 가로 넘침 방지 |

### 화면 문법(2026-10-30 디자인 개선 1차, 앱 화면 규칙)

모든 템플릿(인포그래픽 캔버스 안 제외)이 같은 공통 컴포넌트로 머리·KPI·결론을 만든다. 근거와 규격은 `db-design-system` `references/visual-language.md` 「앱 화면 규칙」, 옵션은 `api-contract.md`.

| 규칙 | 쓰는 것 | 이유 |
| --- | --- | --- |
| 페이지 머리는 `PageHeader` 하나: 범위·소속은 제목 위 회색 텍스트 한 줄(`context`, pill 금지), h1 하나, 둘째 줄은 데이터 한 문장(`scope`, 인터페이스 안내 금지, '목업'·'가상'도 여기 텍스트로), 기준일·필터는 제목 줄 오른쪽, 긴 정의·규칙 문단은 `details` | `PageHeader` | 앱 화면 규칙 「pill은 제목 위에 두지 않음」, 머리 배치 3종·긴 문단이 390px 첫 화면을 밀어냄 |
| KPI는 `KpiRow` 안에 `KpiTile`만(타일에 col-span 금지). 대표 지표는 `size="hero"` + `<KpiRow hero>`. 로딩은 `<KpiRow loading …>` | `KpiRow` | 데스크톱 열 수 = 항목 수, 390px 2열(홀수 마지막 전체 폭), 고아 칸 없음. 4/5 템플릿이 모바일 1열·스켈레톤 2열이었다 |
| 결론 한 문장은 KPI 줄 바로 아래 한 곳의 `SummaryCallout`. 문장 강조는 `<b>`만, 결론이 주의·경보면 `tone="warning"`·`"negative"`(왼쪽 표시만 색) | `SummaryCallout` | 결론 띠 17곳 개별 구현(13/14px·위치 혼재), 색 틴트·색 밑줄 금지 |
| KPI 타일에 `spark`를 넘기지 않는다(무시된다). 추세가 필요하면 화면의 차트로 | — | 앱 화면 규칙: KPI 스파크라인 0/23 |
| 표의 숫자 열은 `numeric: true`(오른쪽 정렬), 비교하는 ISO 날짜 열도 권장. 좁은 화면에서 덜 중요한 열은 `hideBelow`, 결론 열이 스크롤 끝에 숨으면 좁은 화면용 열 배열에서 앞으로 당긴다 | `DataTable` | 앱 화면 규칙 7.4, 결론 열(상태·판정·지수)이 390px 스크롤 끝에 숨던 표 15개 이상 |
| 가로 스크롤 안내는 직접 쓰지 않는다: 표는 DataTable이 넘칠 때 기본 안내·페이드를 보이고(`scrollHint`로 문구만 바꿈), 표가 아닌 넓은 영역은 `ScrollRegion`으로 감싼다. `md:hidden`·`narrow` 조건 안내 금지 | `DataTable`, `ScrollRegion` | 768px에서 넘치는데 안내가 숨던 문제 |
| 인포그래픽 요약 카드는 `<ScaledCanvas summary={<MobileSummary …/>}>`. `useMediaQuery('(max-width: 639px)')`로 직접 띄우지 않는다 | `ScaledCanvas summary` | 캔버스가 잘리는 768px에서도 요약이 보여야 한다 |
| 데이터 위 선택·현재·1위 표시는 강조색이 아니라 글자색 테두리 + 표면색 후광: SVG·ECharts `selectionStroke(theme)`, ECharts 산점·기호 `...selectionSymbolSeries(theme, { value, symbol })`, HTML 칸 `select-ring`, 표 행 `activeRow`. 군집 경계 같은 구조선은 선택과 다른 모양(muted 1.5px·점선) | `selectionStroke`, `selectionSymbolSeries`, `select-ring` | 강조색 = 범주 1색(ΔE 3.6), 선택이 데이터에 묻힘 |
| 범례 견본은 차트 마크와 같은 모양: `Legend` `shape`(`circle`·`ring`·`diamond`·`triangle`·`hatch`·`missing`). 모양을 글자로 적거나 빗금 문자열을 `color`에 넣지 않는다 | `Legend` | 2026-10-30 C단계(viz-a C3) |
| UI 크롬(직접 만든 버튼·칩·토글·범례 토글·확정 줄)에 강조색 채움을 쓰지 않는다: 주 동작은 `Button variant="primary"`(거의 검정), 켜짐은 회색 채움(`bg-active`)이나 잉크 밑줄. accent와 info를 한 그림의 다른 계열로 쓰지 않는다 | `Button`, `FilterChip`, `--color-active` | 앱 화면 규칙: 강조색은 데이터·선택 표시에만 |
| ▲▼는 증감에만. 상태(경보·주의·달성)는 `SeverityTag`(아이콘 + '경보'/'주의'), 텍스트 '⚠'·'△' 금지, '경고'라고 쓰지 않는다. 메타 배지('금액 추정' 등)는 neutral | `SeverityTag` | 기호·심각도 아이콘이 템플릿마다 달랐다 |
| 좁은 화면·터치에서 누를 수 있는 것은 44px: 공통 컴포넌트는 자동, 직접 만든 작은 버튼·칩은 `touch-hit`(붙은 묶음은 `touch-hit-y`), 맨 체크박스는 `<label className="touch-hit">`로 감싼다. 인접 대상 간격 8px. 선택이 Shift·Ctrl 클릭 전용이면 안 된다(터치 대안 필요) | `touch-hit`, `touch:` 변형 | 390px 조작 요소 13~28px |
| 화면 글자는 11px 이상(`text-[9px]`·`text-[10px]`·`text-[10.5px]` 금지, 차트 라벨 fontSize도) | — | lint 경고(2026-10-30) |
| 상세 패널을 옆 카드와 나란히 둘 때 `self-start`(필요하면 `lg:sticky lg:top-4`) | — | 옆 카드 높이로 늘어나 400~590px 빈 영역 |
| 화면 문구에 내부 slug(`gwas-manhattan`)를 쓰지 않고 화면 이름(GWAS 결과 뷰어)을 쓴다 | — | 사용자에게 의미 없는 식별자 |

### DEV 검산

명세의 수용 기준 숫자는 `data.ts` 끝에 개발 모드 검산으로 남긴다(`if (import.meta.env.DEV) { … }`). 실패는 `console.assert(조건, '[검산] 무엇이 기대값과 다른지')`로 알린다. QA 브라우저 검증이 `assert` 타입과 `[검산]` 태그가 붙은 메시지를 문제로 센다. 태그 없는 `console.warn`은 잡히지 않아 검산이 실패해도 아무도 모른다.

## 4. 카테고리별 구성 원칙

자세한 레이아웃 패턴과 예시는 `references/category-patterns.md`를 읽는다. 요점만:

- **kpi**: `PageHeader`(기간 필터는 제목 줄 오른쪽) → `KpiRow` → `SummaryCallout` → 가장 중요한 추세 차트 하나를 크게 → 보조 차트·표. "좋은 방향"이 지표마다 다름(`better`)에 주의. 기준 예시 `kpi/program-overview`.
- **viz**: 표준 차트 + 필수 주석(유의선, 기준선, 설명 분산 %). 차트와 연동되는 상세 표·패널. 대용량은 캔버스·`large` 모드.
- **infographic**: 고정 비율 캔버스, 큰 숫자 3~6개, 읽는 순서가 분명한 흐름(위→아래 또는 왼→오른). 인쇄는 늘 라이트 토큰·흰 캔버스(공통)라 라이트 기준으로 디자인한다. 요약 카드는 `ScaledCanvas summary`.
- **workflow**: 실제 업무 흐름의 한 단계를 끝까지 수행할 수 있어야 한다. 목록·필터·선택·확인·저장 피드백까지 동작하는 목업(저장은 로컬 상태 + 토스트).

## 5. 상태 화면

데이터를 받는 영역은 로딩·빈 데이터·오류 상태를 가진다. 템플릿에서는 개발용 토글(갤러리 URL `?state=loading|empty|error`를 읽어 분기)로 확인할 수 있게 한다. 쿼리 읽기는 컴포넌트 안에서 `new URLSearchParams(location.search)` 한 줄로 충분하다(모듈 최상위에 두면 다운로드 준비의 SSR 로드가 실패한다 — 「다운로드 스타터」).

### 상태 검증 선언

verify는 기본 화면만 연다. 선택·탭·입력 뒤에야 나오는 화면(상세 패널, 경고·차단 문구, 펼친 행, 다른 좌위·필터)은 템플릿 폴더의 `qa-states.json`에 선언해야 검증된다. 업무 화면(workflow)은 필수(lint 경고), 그 밖의 카테고리도 선택하면 문구가 길어지는 패널이 있으면 선언한다.

```json
[{ "name": "rq045-selected", "note": "경고 5건이 붙는 가장 긴 점검 문구", "steps": [{ "click": "RQ26-045" }] }]
```

- 상태는 "가장 긴 문구가 나오는 경우"와 "경고·차단 등 단계별 대표"를 고른다. 모든 행을 넣지 않는다(검증 시간).
- `click`은 화면 텍스트(정확 일치 우선), `clickSelector`는 CSS 선택자(둘 다 `modifiers: ["Shift"]` 가능), `fill`은 입력 선택자 + `value`, `press`는 키, `wait`는 ms. 마지막 단계에는 `expect`(상태가 적용됐을 때만 보이는 요소의 선택자: 오류 요약, 상세 패널, 선택된 행)를 둔다. 없으면 첫 클릭이 빗나가도 verify가 기본 화면을 그 상태로 알고 통과시킨다(15차 배치). 입력 오류·저장 충돌처럼 입력해야 나오는 상태도 선언할 수 있다. 390px에서도 같은 단계로 재현되는 텍스트를 고른다.
- 길이가 데이터에 따라 바뀌는 문구는 `Badge`처럼 `whitespace-nowrap`인 컴포넌트에 넣지 않는다. 넣어야 하면 안쪽 텍스트에 `whitespace-normal`을 준다.
- 줄바꿈 금지 텍스트(`whitespace-nowrap`, 고정 폭 칸·표 머리·카드 한 줄)는 가장 좁은 화면(390·768, 인포그래픽은 최소 배율)에서도 칸 안쪽 폭이 글자 폭보다 **12% 이상** 남게 둔다. PR CI는 리눅스에서 verify를 돌리는데, 같은 Pretendard도 작은 크기에서 Windows보다 약 10% 넓게 그려진다. 2026-11-03에 Windows 여유 0~4.7px였던 칸 2곳이 CI에서 카드 밖으로 넘쳤다. 칸 높이가 고정이면 줄바꿈으로 풀지 말고 가로 여유를 만든다.

## 6. 품질 기준(빌더 자체 점검)

구현을 마쳤다고 보고하기 전에 확인한다.

1. 명세의 수용 기준을 하나씩 대조했다.
2. `npm run typecheck` — 자기 폴더 오류 0건
3. `node .claude/skills/template-qa/scripts/lint-templates.mjs --slug {slug}` — 오류 0건, `node .claude/skills/template-qa/scripts/check-ssr.mjs --slug {slug}` — 실패 0(「다운로드 스타터」)
4. `node .claude/skills/template-qa/scripts/verify-templates.mjs --slug {slug} --out _workspace/qa`를 반드시 실행하고 `1440-light.png`를 직접 열어 본다(`qa-states.json`을 선언했으면 `390-light-{state}.png`도). 출력 경로를 바꾸지 않는다(스크래치패드 금지). QA와 도메인 검토가 동시에 시작되므로, 도메인 검토자가 화면의 숫자를 대조할 수 있는 스크린샷은 이 단계에서 만든 것뿐이다.
5. "평범한 템플릿" 점검: 첫눈에 가장 중요한 숫자·차트가 무엇인지 분명한가? 육종 맥락(기준선, 작물, 기간)이 드러나는가? 회색 카드만 반복되지 않는가?

## 7. 반환 형식(워크플로)

```json
{
  "slug": "gwas-manhattan",
  "files": ["src/templates/viz/gwas-manhattan/index.tsx", "..."],
  "sharedCandidates": [{ "name": "ThresholdLegend", "reason": "유의선 범례, GWAS·QQ·LD 템플릿에서 반복", "path": "src/templates/viz/gwas-manhattan/components/ThresholdLegend.tsx" }],
  "notes": "명세와 다르게 구현한 점, 공통 API 부족 사항"
}
```

## 8. 수정 요청 처리

- 이슈 목록을 받으면 severity가 blocker → major → minor 순으로 고친다. minor는 시간이 허락하면 고친다.
- 통과 판정을 받은 부분은 리팩터링하지 않는다(재검증 범위가 커진다).
- 사용자 피드백 반영 후 README 「변경 이력」에 `YYYY-MM-DD 내용`을 한 줄 추가한다.
