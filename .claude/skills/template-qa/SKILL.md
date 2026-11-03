---
name: template-qa
description: "디지털육종 템플릿의 품질을 검증하는 절차와 스크립트. 정적 규약 검사(lint-templates.mjs), 타입 검사, Playwright 브라우저 검증(verify-templates.mjs: 390/768/1440px × 라이트·다크 렌더, 콘솔 오류, 가로 넘침, 카드 밖 텍스트, axe 접근성, 스크린샷), 갤러리 미리보기 썸네일 생성(gen-thumbs.mjs), 스크린샷 육안 체크리스트, 이슈 심각도 기준을 제공한다. ui-design-reviewer 에이전트가 쓰는 디자인 검토 기준(시각 위계·밀도·차트 판독성·카테고리 일관성, references/design-review.md)도 담는다. 템플릿을 구현·수정한 뒤 검증하거나, '템플릿 검사', 'QA', '스크린샷 확인', '렌더링 확인', '다크 모드 확인'을 요청받으면 사용한다. 여러 템플릿의 디자인 검토·개선 회차 진행은 breeding-template-orchestrator, 도메인 정확성 검토는 breeding-metrics 스킬을 쓴다."
---

# 템플릿 QA 절차

"빌드 성공"은 화면이 올바르다는 뜻이 아니다. 차트가 0px 높이로 접히거나, 다크 모드에서 축 글자가 사라지거나, 390px에서 표가 화면을 밀어내도 빌드는 성공한다. 그래서 실제 브라우저 렌더와 스크린샷 육안 확인을 함께 한다.

모든 명령은 프로젝트 루트에서 실행한다.

## 1. 정적 검사

```bash
node .claude/skills/template-qa/scripts/lint-templates.mjs --slug {slug} --json _workspace/qa/{slug}/lint.json
npm run typecheck
node .claude/skills/template-qa/scripts/check-ssr.mjs --slug {slug}
```

- `check-ssr.mjs`는 다운로드 스타터 준비(`scripts/prepare-downloads.mjs`, `predev`·`prebuild`)가 하는 것처럼 템플릿의 `index.tsx`·`data.ts`를 Vite SSR로 불러오고, `README.md`가 있는지, `data.ts` 내보내기를 JSON으로 만들 수 있는지, 연결형 템플릿의 데이터 계약 내보내기가 있는지 본다. 실패는 major로 올린다. 템플릿 하나가 여기서 실패하면 모든 사람의 `npm run dev`·`build`가 멈추는데, verify는 브라우저로만 열어 이를 잡지 못한다. 지정한 템플릿만 검사하고 `public/downloads`에 쓰지 않으므로 여러 빌더가 동시에 돌려도 된다.

- lint 오류(Math.random, 다른 템플릿 import, meta 불일치, EChart ariaLabel 누락 등)는 모두 이슈로 올린다.
- typecheck는 출력에서 `src/templates/{category}/{slug}/` 경로 오류만 이슈로 올린다. 다른 경로 오류는 `notes`에 적는다(다른 빌더가 작업 중일 수 있다).

## 2. 브라우저 검증

```bash
node .claude/skills/template-qa/scripts/verify-templates.mjs --slug {slug} --out _workspace/qa
```

- 빈 포트에 Vite 개발 서버를 직접 띄우므로 여러 QA가 동시에 실행돼도 충돌하지 않는다.
- 결과: `_workspace/qa/{slug}/report.json`, 스크린샷 `_workspace/qa/{slug}/{390|768|1440}-{light|dark}.png`
- **상태 검증**: 템플릿 폴더에 `qa-states.json`이 있으면 verify가 기본 화면 뒤에 그 상태(행 선택, 탭 전환, 경고가 붙는 요청 등)를 라이트 테마·모든 뷰포트로 다시 열어 같은 기준(가로 넘침·콘솔·빈 차트)으로 검사하고 `{width}-light-{state}.png`를 남긴다. 보고서 오류 접두어는 `[390px/light/{state}]`다. 기본 화면에 없는 긴 문구는 기본 화면 검증에 잡히지 않는다(정리 회차 3: 선택해야 나오는 경고 배지가 1440px 화면을 1,533px로 밀었는데 verify는 통과). 상태 재현 실패(`steps` 확인)는 major로 올린다. `expect` 단계가 없는 상태는 재현됐는지 스크린샷으로 직접 확인하고, 빠졌으면 minor로 적는다.
- 갤러리 피드백 도구(`src/features/feedback`의 `.fb-dock-stack`·`.fb-panel`·`[data-feedback-pin]`·`.fb-target-highlight`)는 `data-template-root` 안에 화면 고정으로 그려진다. verify와 gen-thumbs는 페이지를 열 때 이 도구들을 숨기고 템플릿만 검사·촬영한다. 기능 자체는 `npm run test:feedback`이 검사한다. 문서 높이로 늘린 스크린샷에서 「피드백」 버튼이 마지막 표를 가렸기 때문이다(2026-11-03). 템플릿을 감싸는 `.fb-wrapper`·`.fb-surface`는 숨기지 않는다.
- 가로 넘침은 요소 상자뿐 아니라 상자 밖으로 넘친 텍스트(`whitespace-nowrap` 등)도 `텍스트 "…" in {요소}`로 보고한다.
- verify가 직접 띄우는 서버는 파일 감시·HMR을 끄고 실행별 의존성 캐시를 쓴다(`vite.config.ts`의 `VERIFY_SERVER=1`). 여러 빌더가 동시에 고치며 돌려도 HMR 새로고침으로 일시 실패하지 않는다. `--base-url`로 기존 서버(5173 등)를 쓰면 그 서버의 HMR이 그대로이므로 동시 작업 중에는 쓰지 않는다.
- 기본 화면 스크린샷은 뷰포트를 문서 높이로 늘린 뒤 찍는다. Chromium 전체 페이지 캡처가 큰 ECharts 산점도를 눌린 채 찍었기 때문이다(gwas-manhattan). 상태 화면은 열린 시트가 함께 커지므로 기존 방식이다.
- 페이지가 넘치지 않아도 텍스트가 카드(양옆 테두리가 있는 상자) 밖으로 나가면 `카드 밖으로 나간 텍스트: "…" in {요소} → {카드} 밖 Npx`로 보고한다(major). 사이에 잘라 내거나 스크롤되는 조상이 있으면 잘림이라 세지 않는다. 의도된 돌출(배지 점 등)은 `data-allow-overflow`로 뺀다. 디자인 검토(2026-10-30)에서 390px KPI 2열 칸의 큰 값이 카드 테두리를 넘었는데 verify가 통과시켜 추가했다.
- 종료 코드 2는 환경 문제(서버 미기동, playwright 미설치)다. 템플릿 이슈가 아니라 `blocker` 환경 이슈로 보고하고 출력 전문을 `evidence`에 넣는다.

## 3. 스크린샷 육안 확인(필수)

Read 도구로 최소 `1440-light`, `1440-dark`, `390-light` 세 장을 연다. 상태 스크린샷이 있으면 `390-light-{state}.png`도 하나 이상 연다. 상태가 선언되지 않았는데 선택·입력에 따라 문구가 길어지는 패널이 보이면 minor로 「상태 선언 누락」을 올린다. 아래 체크리스트로 판정한다.

| 항목 | 확인 내용 |
| --- | --- |
| 차트 내용 | 모든 차트에 데이터 마크가 보이는가(빈 축만 있는 차트 없음) |
| 필수 주석 | 명세의 임계선·목표선·기준선·축 제목·단위가 보이는가 |
| 텍스트 | 잘림·겹침·말줄임으로 의미가 사라진 라벨이 없는가 |
| 다크 모드 | 축·범례·표 글자가 배경과 구분되는가, 흰 배경 덩어리가 남지 않았는가 |
| 모바일 | 1열로 재배치되고 KPI가 읽히는가, 차트가 너무 납작하지 않은가(240px 이상) |
| 위계 | 가장 중요한 숫자·차트가 첫눈에 들어오는가 |
| 일관성 | 공통 컴포넌트(Card, KpiTile, 표)의 모양이 다른 템플릿과 같은가 |

## 4. 심각도 기준

| severity | 기준 | 예 |
| --- | --- | --- |
| blocker | 화면이 안 뜨거나 핵심 기능이 동작하지 않음 | 렌더 오류, 빈 차트, 콘솔 pageerror, 환경 문제 |
| major | 사용자가 오해하거나 쓰기 어려움, 규약 위반 | 가로 넘침, 다크 모드 판독 불가, axe serious/critical, lint 오류, 필수 주석 누락 |
| minor | 다듬기 | 간격 불균형, 라벨 표현, lint 경고(hex 색 등) |

blocker나 major가 하나라도 있으면 `verdict: "fail"`.

## 5. 보고서와 반환값

`_workspace/03_qa_{slug}_r{round}.md`에 쓴다.

```markdown
# QA — {slug} (회차 {round})
## 결과: PASS | FAIL
## 이전 회차 이슈 해결 여부   (round ≥ 1)
## 이슈
| # | severity | 영역 | 내용 | 위치/근거 |
## 스크린샷 확인 메모
## notes (범위 밖 관찰)
```

워크플로 반환값:

```json
{ "verdict": "fail", "reportPath": "_workspace/03_qa_gwas-manhattan_r0.md",
  "issues": [{ "severity": "major", "area": "반응형", "description": "390px에서 피크 SNP 표가 가로로 넘침", "file": "src/templates/viz/gwas-manhattan/index.tsx", "evidence": "_workspace/qa/gwas-manhattan/390-light.png, scrollWidth 512" }] }
```

## 디자인 검토(ui-design-reviewer)

기계 검증을 통과한 화면의 위계·밀도·차트 판독성·일관성을 사람 눈으로 보는 별도 절차다. 위 1~5단계(QA)와 섞지 않는다. QA는 정해진 기준으로 pass/fail을 내고, 디자인 검토는 high·medium·low 지적과 고침 방향을 낸다. 관점·자료·심각도·보고서 형식은 `references/design-review.md`를 끝까지 읽고 따른다. 디자인 회차의 전체 순서(검토 → 사용자 결정 → 공통 → 템플릿 → 회귀)는 오케스트레이터 「디자인 회차」에 있다.

## 전체 회귀 검사

공통 컴포넌트·토큰을 바꾼 뒤에는 `--slug` 없이 전체를 돌린다.

```bash
node .claude/skills/template-qa/scripts/lint-templates.mjs && node .claude/skills/template-qa/scripts/verify-templates.mjs --out _workspace/qa
npm run build   # prebuild(다운로드 준비, 전체 템플릿 SSR) → test:feedback → typecheck → vite build
```

## PR CI(`.github/workflows/ci.yml`)

사내 허브에서는 누구나 템플릿을 고친다. 그래서 PR마다 GitHub Actions가 같은 기준을 돌린다. 하네스의 자체 검증을 대신하지 않는다. 사람이나 다른 도구로 만든 PR도 같은 문턱을 넘게 하는 장치다.

PR 검사는 셋이 나눠 맡는다.
- **Vercel 미리보기 배포**: PR마다 `npm run build`(다운로드 준비의 전체 템플릿 SSR, `test:feedback`, 타입 검사, vite build)를 돌린다. 빌드가 깨지면 여기서 실패하므로 CI에서 다시 빌드하지 않는다(2026-11-03, 사용자 결정: 겹치는 검사를 빼고 가볍게).
- **규약 검사**: `lint-templates.mjs` 전체. Node 기본 모듈만 써서 `npm ci` 없이 수 초.
- **브라우저 검증**: `.github/scripts/verify-scope.mjs`가 범위를 정한다.
  - 문서·하네스 문서만 바뀌면(`docs/`, `.md`, `.claude/agents`·`skills`의 문서) 건너뛴다.
  - 공통 모듈·갤러리·빌드 설정·이 스크립트들(`template-qa/scripts`)·CI 설정(`.github/workflows`·`scripts`)이 바뀌면 전체.
  - 템플릿 폴더만 바뀌면 그 템플릿(README만 바뀐 것은 제외).
  - 그 밖(서버·CI 스크립트 등)은 `_starter`로 동작만 확인.
- **나눠서 동시에**: 템플릿 하나가 약 1분(6화면 + 상태 화면)이라 6개씩 최대 6개 작업(`브라우저 검증 i/n`)으로 나눠 돌린다.
  - 걸리는 시간: 보통 PR(템플릿 1~2개) 2~3분, 전체 34개 약 7.5분(2026-11-03 실측: 조각 4~7.3분, 하나로 돌릴 때 31개에 32분).
  - 병합 규칙(필수 검사)에는 「Vercel」·「규약 검사」·「브라우저 검증」(조각 결과를 모은 작업, 조각 수는 PR마다 다르다)을 건다.
- `check-ssr.mjs`는 CI에서 돌리지 않는다(Vercel 빌드의 다운로드 준비가 같은 SSR 로드를 한다). 하네스 빌더는 여러 명이 동시에 일할 때 자기 템플릿만 빠르게 보려고 로컬에서 계속 쓴다.
  - 조각마다 스크린샷과 `report.json`을 결과물 `qa-screens-{run_id}-{i}`(14일 보관)로 올린다.
- 범위 규칙을 바꾸면 이 절과 스크립트를 함께 고친다. 새 공통 폴더를 만들면 `verify-scope.mjs`의 `FULL`에 넣는다.

## 갤러리 썸네일

갤러리 목록은 `src/gallery/thumbs/{category}-{slug}-{light|dark}.webp`(임베드 화면 1440×900 첫 화면을 720px로 줄인 16:10)를 미리보기로 쓴다. 파일이 없으면 빈 자리를 보이므로 깨지지는 않지만, 템플릿 화면이 바뀐 뒤 그대로 두면 목록이 옛 화면을 보인다. 그래서 다음 때 다시 만든다.

- 새 템플릿을 추가했거나 템플릿 첫 화면(1440 첫 900px)이 바뀌었을 때: 그 slug만 다시 만든다.
- 공통 컴포넌트·토큰을 바꿔 전체 회귀를 돌릴 때: `--slug` 없이 전체를 다시 만든다. 이때 지금 없는 템플릿의 옛 썸네일도 지운다.

```bash
node .claude/skills/template-qa/scripts/gen-thumbs.mjs [--slug a,b]
```

오류·없음 화면이나 10초 안에 렌더가 끝나지 않은 차트가 있는 템플릿은 썸네일을 만들지 않고 「건너뜀」으로 알리며, 종료 코드는 1이다. 깨진 화면을 정상 미리보기처럼 보이지 않게 하기 위해서다. 다시 만든 뒤에는 바뀐 파일 몇 장을 직접 열어 확인한다.
