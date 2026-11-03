---
name: breeding-template-orchestrator
description: "디지털육종 UI/UX 템플릿 라이브러리(KPI·지표 대시보드, GWAS·GEBV·계통도 등 육종 데이터 시각화, 인포그래픽·리포트, 교배 설계·시험포장 등 업무 화면) 제작을 조율한다. '템플릿 만들어줘', '대시보드 템플릿', '인포그래픽 추가', '육종 지표 화면', '디자인 시스템 구축', '템플릿 카탈로그 진행', '다음 배치', '새 템플릿 후보 추가', '카탈로그 확장' 같은 요청에 사용하며, 기존 템플릿 수정·보완·재실행·디자인 검토·디자인 개선(2차 등)·다크 모드 수정·특정 템플릿만 다시·이전 결과 개선·전체 회귀 검사·정리 회차(템플릿 간 공유 기준값 재정의) 같은 후속 요청에도 반드시 사용한다. 육종 용어 뜻만 묻는 단순 질문에는 직접 답한다."
---

# 디지털육종 템플릿 오케스트레이터

## 실행 모드: 혼합

| 단계 | 실행 모드 | 선택 이유 |
| --- | --- | --- |
| 0. 기존 작업 확인 | 메인 직접 | 처음 실행·부분 수정·새 배치를 구분해야 한다 |
| 1. 기반 점검·구축 | 서브에이전트 위임(`design-system-architect` 1명) | 한 번 만들고 결과만 받으면 된다. 모든 템플릿의 선행 조건 |
| 2. 배치 확정 | 메인 직접 | 사용자 요청과 카탈로그로 목록을 확정해 `args`로 넘긴다 |
| 3. 템플릿 제작 | **워크플로 조율** (`references/build-workflow.js`) | 템플릿 목록·단계·검증 기준·수정 횟수를 코드로 정할 수 있다 |
| 4. 공통 컴포넌트 승격 | 서브에이전트 위임(`design-system-architect` 1명) | 승격 후보가 있을 때만, 한 번 |
| 5. 회귀 검사·보고 | 메인 직접(스크립트 실행) | 결과가 항상 같아야 하는 검사라 스크립트로 충분 |
| 별도: 정리 회차 | 서브에이전트(분석가 → 빌더 병렬 → 분석가) | 기준값은 한 사람이 한 번에 정해야 템플릿 사이 숫자가 맞는다 |
| 별도: 디자인 회차 | 서브에이전트(검토자 병렬 → 설계자 → 빌더 병렬 → 분석가) | 사이에 사용자 결정(색·범위)이 끼고, 공통 원인을 먼저 고쳐야 템플릿 수정이 한 번에 끝난다 |
| 별도: 카탈로그 확장 | 서브에이전트(분석가 1명) + 사용자 선택 | 후보를 고르는 일은 이후 여러 배치의 범위를 정한다 |

이 스킬을 불러오면 3단계의 Workflow 사용에 동의한 것으로 본다. 기본 배치는 템플릿 2개(에이전트 호출 약 8~12회)다. 사용자가 "카테고리마다", "여러 개", "전체", "모두"라고 하면 `breeding-metrics/references/template-catalog.md`의 「배치 구성 기본값」에 따라 늘린다.

## 에이전트 구성

| 역할 | `agentType` / `subagent_type` | 모델 | 스킬 | 산출물 |
| --- | --- | --- | --- | --- |
| 도메인 분석가(명세·검토·동기화·카탈로그 제안) | `breeding-domain-analyst` | opus | breeding-metrics | `docs/specs/{slug}.md`(검산 기록·변경 이력 포함), `03_domain_{slug}_r{n}.md`, `10_catalog_proposal_x{N}.md` |
| 디자인 시스템 설계자 | `design-system-architect` | opus | db-design-system | `src/design-system`, `src/charts`, `src/lib`, `src/gallery`, `00_foundation_report.md` |
| 템플릿 빌더 | `template-builder` | opus | template-authoring | `src/templates/{category}/{slug}/` |
| UI QA | `ui-qa-inspector` | sonnet | template-qa | `03_qa_{slug}_r{n}.md`, `_workspace/qa/{slug}/*.png` |
| UI 디자인 검토자 | `ui-design-reviewer` | opus | template-qa(`references/design-review.md`) | `07_design_review_r{n}_{group}.md` |

## 작업 절차

### 0단계: 기존 작업 확인

먼저 요청 유형을 판단한다.

| 상황 | 처리 |
| --- | --- |
| `package.json` 또는 `src/design-system/`이 없음 | 1단계부터 |
| 새 템플릿 요청, 기반 있음 | 1단계 점검만 하고 2단계로 |
| 특정 템플릿 한두 곳의 작은 수정("색만", "표를 카드로"), 누적 minor 일괄 수정 | **빠른 경로**: 워크플로 없이 템플릿마다 `template-builder` 서브에이전트 1회(피드백 + 기존 파일 경로 전달, 여러 템플릿이면 한 메시지에서 병렬) → `lint-templates.mjs`·`check-ssr.mjs`·`verify-templates.mjs`를 메인이 실행 → 스크린샷 확인 → 숫자·상수·용어가 바뀌었거나 빌더가 "spec-only"로 넘긴 항목이 있으면 `breeding-domain-analyst` 동기화 모드 1회(바뀐 템플릿을 한 번에 묶어 전달) → 보고. 순수 스타일 수정이면 동기화를 생략한다 |
| 특정 템플릿을 지표·구성부터 다시 | 해당 템플릿만 `args.templates`에 넣고 `feedback`을 채워 3단계 실행 |
| 토큰·테마·공통 컴포넌트 변경 | `design-system-architect` 서브에이전트 → 5단계 전체 회귀 검사 |
| "정리 회차", "기준값 다시", 공유 기준값 지적 일괄 해결 | 아래 「정리 회차」 절차 |
| "디자인 검토", "디자인 개선 2차", `docs/backlog/design.md` 일괄 처리, 여러 템플릿에 걸친 화면 문법 변경 | 아래 「디자인 회차」 절차 |
| "다음 배치", "계속" | `src/templates/`에 없는 카탈로그 항목에서 2단계. 남은 항목이 없으면 「카탈로그 확장」을 먼저 한다 |
| "새 템플릿 후보", "카탈로그 확장" | 아래 「카탈로그 확장」 절차 |

**저장 위치 원칙(2026-11-03, 사내 허브 전환):** 템플릿 명세 `docs/specs/{slug}.md`와 backlog `docs/backlog/{baseline,minor,design}.md`는 저장소에 커밋되는 원본이다. 다른 사람의 Claude Code, 클라우드 실행(GitHub Actions, claude.ai/code)도 같은 명세를 읽어야 템플릿 사이 숫자가 어긋나지 않는다. 명세를 고친 작업은 템플릿 코드와 같은 PR에 함께 넣는다. `_workspace/`에는 실행 중간 산출물(계획, 검토·QA 보고서, 스크린샷, `run_meta.json`, 정리 회차 작업 파일)만 두고 git에 넣지 않는다.

`_workspace/`가 있고 새 배치를 시작하면 기존 템플릿별 파일은 그대로 두고(템플릿 slug가 파일명에 있어 충돌하지 않는다) `_workspace/run_meta.json`의 `runs` 배열에 새 실행을 추가한다. 직전 워크플로가 중단됐고 `run_meta.json`에 `runId`가 있으면 `resumeFromRunId`로 재개한다.

### 1단계: 기반 점검·구축

**실행 모드:** 서브에이전트 위임

1. 점검: `package.json`, `src/design-system/index.ts`, `src/charts/index.ts`, `src/lib/rng.ts`, `src/gallery/registry.ts`가 있고 `npm run typecheck`가 통과하면 2단계로 간다.
2. 없거나 깨졌으면 `Agent(subagent_type: "design-system-architect", prompt: …)`로 맡긴다. 프롬프트에 넣을 것:
   - 작업 종류(초기 구축 / 복구), `db-design-system` 스킬을 Skill 도구로 불러와 계약을 모두 구현하라는 지시
   - 기반 검증용 `src/templates/kpi/_starter/` 예제(KpiTile 3개 + EChart 1개) 작성
   - playwright 브라우저 설치(`npx playwright install chromium`)까지 끝내라는 지시
   - 완료 조건: 스킬의 「완료 조건」 1~4
3. 완료 알림을 받으면 메인이 직접 확인한다: `npm run typecheck`, `npm run build`, `node .claude/skills/template-qa/scripts/verify-templates.mjs --slug _starter --out _workspace/qa`. 실패하면 오류 전문을 넘겨 같은 에이전트 유형으로 한 번 더 맡긴다.

### 2단계: 배치 확정

**실행 모드:** 메인 직접

1. 사용자 요청에서 템플릿을 고른다. 요청이 구체적이면 그대로 브리프를 쓰고, 막연하면 `template-catalog.md`에서 아직 없는 항목 가운데 우선순위 숫자가 가장 작은 것부터 카테고리가 겹치지 않게 고른다. `src/templates/`에 이미 있는 slug는 사용자가 다시 만들라고 하지 않는 한 제외한다. 고를 항목이 없으면 「카탈로그 확장」으로 간다.
2. 브리프에는 화면 목적과 범위만 쓴다. 다른 템플릿과 맞출 숫자는 브리프에 옮겨 적지 말고 분석가가 `breeding-metrics/references/program-baseline.md`에서 읽게 한다(명세 단계 프롬프트에 이미 들어 있다). 기준값 파일 한 곳만 고치면 이후 모든 템플릿에 반영되기 때문이다.
3. 각 항목을 `{slug, category, title, brief, feedback?}`로 정리해 `_workspace/00_plan.json`에 저장하고, 목록을 사용자에게 한 줄씩 알린다(확인을 기다리지 않고 진행해도 된다. 단 5개 이상이면 확인받는다).

### 3단계: 템플릿 제작

**실행 모드:** 워크플로 조율

```
Workflow(scriptPath: ".claude/skills/breeding-template-orchestrator/references/build-workflow.js",
         args: { now: "{오늘 YYYY-MM-DD}", templates: [...00_plan.json], maxFixRounds: 2 })
```

스크립트 구조:
- `meta.phases`: 명세 → 구현 → 검증 → 수정 → 명세 동기화 → 동기화 반영
- 템플릿마다 `pipeline()`: 분석가 명세+검산(`SPEC` 스키마) → 빌더 구현(`BUILD`) → QA와 도메인 검토 병렬(`ISSUES` ×2) → blocker·major가 남으면 빌더 수정 → 재검증(최대 `maxFixRounds`회) → 분석가 명세 동기화(`SYNC`) → `codeIssues`가 있으면 빌더가 고치고 자체 검증(`BUILD`)
- 동기화 반영이 워크플로 안에 있는 이유: 명세 동기화 뒤 남는 "명세가 맞고 코드가 틀린" 항목은 거의 항상 나온다(배치 5~8의 8개 템플릿 모두 3~8건). 메인이 매번 빠른 경로로 손수 돌리던 일을 고정 단계로 옮겼다. 재검토는 하지 않는다. 기준이 동기화된 명세이고 항목이 minor이기 때문이다.
- 명세 동기화가 있는 이유: 수정 단계에서 바뀐 상수와 "명세 오류" 지적이 명세에 되돌아가지 않으면 재생성 때 같은 오류가 되살아난다(첫 4개 배치에서 8개 템플릿 모두 명세 관련 지적이 남았다).
- 템플릿 간에는 동기화 장벽이 없다. 먼저 명세가 끝난 템플릿부터 구현에 들어간다.
- 반환: `{ summary[{slug, status: pass|fail|unverified|failed:단계, rounds, openIssues, deferredMinors, minorCountAtVerify, reports, notes, specSync, codeFix}], sharedCandidates[], missing[] }`
- 반환 `codeFix`: `{done: true, notes}`이면 동기화 반영 완료, `{done: false}`이면 빌더가 결과를 못 낸 것이므로 빠른 경로로 다시 돌린다. `notes`의 `[공통]` 항목(공통 모듈 수정이 필요한 것)은 4단계 승격 작업에 함께 넘긴다.

호출 직후 반환된 `runId`를 `_workspace/run_meta.json`에 기록한다. 완료 알림을 받기 전에 결과를 추측하지 않는다. 반환값은 `_workspace/02_workflow_result.json`에 저장한다.

빌더들은 각자 템플릿 폴더만 수정하므로 `isolation: 'worktree'`가 필요 없다. 공통 모듈 수정은 4단계에서 한 번에 한다.

### 4단계: 공통 컴포넌트 승격

**실행 모드:** 서브에이전트 위임 (`sharedCandidates`가 있을 때만)

1. 후보를 `_workspace/04_shared_candidates.json`에 저장한다.
2. 이름·용도가 겹치는 후보가 2개 템플릿 이상에서 나왔거나, 이미 있는 템플릿에서도 쓸 수 있는 것만 승격 대상으로 표시한다. 대상이 없으면 4단계를 건너뛴다.
3. `Agent(subagent_type: "design-system-architect")`에 승격 작업을 맡긴다: 공통 모듈로 옮기고, 해당 템플릿들이 공통 모듈을 쓰도록 고치고, `api-contract.md`를 갱신한다. 보류한 후보는 `db-design-system/references/promotion-holds.md`에 이유(사용처 1곳 / 화면 차이 / 알고리즘 차이)와 다시 검토할 조건을 남기고, 승격한 항목은 표에서 지운다. 이 표를 빌더가 읽어 같은 역할의 컴포넌트를 기존 규격대로 만든다(회고 3).
4. 후보가 모두 이 표에 있고 다시 검토할 조건을 채우지 못하면 4단계를 건너뛴다.

### 5단계: 회귀 검사·보고

**실행 모드:** 메인 직접

0. 템플릿을 추가·삭제했으면 먼저 `npm run sync:feedback-templates`로 피드백 API 허용 목록(`server/feedback-templates.ts`)을 갱신하고 함께 커밋한다. 공유 파일이라 빌더가 아니라 메인이 한다. 빠뜨리면 그 템플릿의 코멘트가 모두 404가 되고, `test:feedback`(build)이 실패한다.
1. `npm run typecheck`, `node .claude/skills/template-qa/scripts/lint-templates.mjs`, `npm run build`(다운로드 준비가 전체 템플릿을 SSR로 불러오고 피드백 테스트도 돈다), 4단계를 했거나 공통 모듈이 바뀌었으면 `verify-templates.mjs --out _workspace/qa`(전체)를 실행한다. 이어서 갤러리 썸네일을 `gen-thumbs.mjs`로 다시 만든다. 새 템플릿만 바뀌었으면 `--slug`로 그 템플릿만, 공통 모듈이 바뀌었으면 전체를 만든다. 목록이 옛 화면을 미리보기로 보이지 않게 하기 위해서다(template-qa 「갤러리 썸네일」).
2. 새 템플릿마다 `1440-light.png`를 직접 열어 확인한다.
3. 사용자에게 보고한다:
   - 템플릿별 상태(pass / fail + 남은 이슈 / 실패 단계), 수정 회차
   - 갤러리 확인 방법: `npm run dev` → `http://localhost:5173/#/t/{category}/{slug}`
   - 스크린샷 경로, 승격된 공통 컴포넌트, 이월 minor(`deferredMinors`), 누락 항목(`missing`)
   - `deferredMinors` 가운데 kind `later`는 `docs/backlog/minor.md`의 「열림」 표(`| 날짜 | 템플릿 | 항목 | 파일 | 출처 배치 |`)에 메인이 옮긴다. `baseline`은 분석가가 이미 `docs/backlog/baseline.md`에 올렸는지 확인만 한다. 이월 목록을 보고서에만 두면 몇 배치 뒤 정리 회차 계획을 세울 때 이미 고친 것과 남은 것을 구분하지 못한다(회고 3)
   - 다음 배치 제안(카탈로그에서 남은 P1/P2)
   - `docs/backlog/baseline.md`에 열린 항목이 3건 이상이거나 한 항목이 3개 이상 템플릿에 걸치면, 또는 `docs/backlog/minor.md` 열린 항목이 4개 이상 템플릿에 걸치면 정리 회차를 함께 제안한다. 템플릿이 늘수록 같은 기준값을 고칠 곳이 늘어나므로 미룰수록 비싸진다.
   - 카탈로그 확장 한 묶음을 다 만들었거나, 마지막 디자인 회차(`run_meta.json`의 `mode: design-review` 날짜) 뒤 새 템플릿이 6개 이상이면 디자인 회차를 제안한다. `docs/backlog/design.md`에 열린 항목이 있으면 그 수와 함께 알린다. 빌더마다 화면 문법이 조금씩 갈라지므로, 쌓인 뒤에 한 번에 맞추는 편이 싸다(1차: 33개 검토 → 공통 원인 8묶음).
   - 카탈로그에 남은 항목이 2개 이하면 「카탈로그 확장」을 제안한다.

### 정리 회차(공유 기준값 재정의)

여러 템플릿이 함께 쓰는 기준값을 바꾸는 작업이다. 워크플로(템플릿 단위 파이프라인)에 맞지 않는다. 기준값은 한 사람이 한 번에 정해야 템플릿 사이 숫자가 어긋나지 않기 때문이다.

1. **기준값 재정의** (서브에이전트 1명, `breeding-domain-analyst` 명세 모드)
   - 입력: `docs/backlog/baseline.md`와 `docs/backlog/minor.md`의 열린 항목. minor는 계획에 넣기 전에 해당 파일을 grep해 아직 남아 있는지 확인한다. 메인이 `_workspace/06_cleanup_plan.md`에 항목 표와 원칙을 적어 넘긴다.
   - 원칙: 다른 템플릿이 보여 주는 앵커 숫자는 지키고 분포·부호·편향만 바꾼다. 난수 호출 순서를 바꾸지 않는다. 바뀔 수밖에 없는 앵커는 그 숫자를 쓰는 모든 템플릿을 grep으로 찾아 같은 회차에 넣는다.
   - 산출물:
     - 새 생성 규칙을 반영한 참조 구현 `_workspace/cleanup/{slug}/data.ts`와 실행 검산 스크립트
     - 영향받는 명세들
     - `program-baseline.md` 개정 행(「(날짜 정리 회차 개정)」 표시)
     - 템플릿별 변경 요약 `_workspace/06_cleanup_spec_changes.md`
2. **템플릿 반영** (서브에이전트, `template-builder` 병렬)
   - 코드를 같이 쓰거나(같은 `kinOf` 등) 숫자가 서로 이어지는 템플릿은 같은 빌더에게 묶는다.
   - 빌더는 참조 구현과 실제 data.ts 출력을 대조하고 verify까지 통과시킨다.
3. **교차 검토** (서브에이전트 1명, `breeding-domain-analyst` 검토 모드)
   - 실제 data.ts를 실행해 명세와 대조한다.
   - 템플릿 간 숫자 일치와 `src/templates` 전체의 옛 숫자 잔존을 grep으로 확인한다.
   - 보고서는 `_workspace/06_cleanup_review.md`에 쓴다.
4. **마무리** (메인)
   - minor는 빠른 경로나 직접 수정으로 처리하고, 승격 후보가 나오면 4단계를 거친다.
   - 전체 회귀 검사(5단계)를 한다.
   - 해결한 backlog 항목(두 파일 모두)을 「해결」로 옮기고, `run_meta.json`에 `mode: cleanup`으로 기록한다.

### 디자인 회차(디자인 검토·개선)

여러 템플릿에 걸쳐 위계·화면 문법·일관성을 고치는 작업이다. 템플릿 단위 워크플로에 맞지 않는다. 공통 원인을 먼저 고쳐야 템플릿 수정이 한 번에 끝나고, 검토와 개선 사이에 사용자 결정(색·범위)이 들어가기 때문이다. 그룹 나누기, 종합·계획 형식, 단계별 브리프 템플릿은 `references/design-round.md`에 있다. 회차 번호 n은 `run_meta.json`의 `mode: design-review` 기록 수 + 1이다.

| 단계 | 실행 모드 | 담당 | 산출물 |
| --- | --- | --- | --- |
| 0. 준비 | 메인 직접 | — | 전체 `verify-templates.mjs --out _workspace/qa`(스크린샷 최신화), 썸네일이 템플릿보다 오래됐으면 `gen-thumbs.mjs`, 개발 서버 1개 기동(PID 기록) |
| 1. 검토 | 서브에이전트 병렬(한 메시지) | `ui-design-reviewer` × 그룹 수 + 카테고리 간 1명 | `07_design_review_r{n}_{group}.md` |
| 2. 종합·결정 | 메인 직접 | — | `07_design_review_r{n}_summary.md`(high는 메인이 직접 확인) → 사용자 보고, 색·범위 결정 받기 |
| 3. 계획 | 메인 직접 | — | `08_design_fix_plan_r{n}.md`, `08_phase_b_brief_r{n}.md` |
| 4. A 공통 | 서브에이전트 1명 | `design-system-architect` | 공통 모듈·스킬 문서, 기준 예시 템플릿 1곳, `08_architect_design_fix_r{n}.md` |
| 5. B 템플릿 | 서브에이전트 병렬(묶음별) | `template-builder` × 묶음 수 | 템플릿 폴더, 보고(고친 것·다음 회차·`[공통]`·명세 이탈) |
| 6. C 공통 요청 | 서브에이전트 1명(요청 있을 때만) | `design-system-architect` | `08_common_requests_r{n}.md` 「처리」 열 |
| 7. 도메인·명세 | 서브에이전트 1명 | `breeding-domain-analyst` 검토 → 동기화 | `08_domain_review_design_r{n}.md`, 명세 변경 이력 |
| 8. 마무리 | 서브에이전트 1명(지적 있을 때만) | `template-builder` | 도메인 지적 수정 |
| 9. 회귀·보고 | 메인 직접 | — | 5단계 전체 회귀, 썸네일 전체 재생성, `docs/backlog/design.md` 갱신, 0단계 서버 PID로 종료 |

- "디자인 검토해줘"만 요청받으면 2단계에서 보고하고 멈춘다. 개선 범위는 사용자가 결과를 보고 정한다(1차가 그랬다: 팔레트 유지, 공통 먼저, medium은 다음 회차).
- 개선 2차부터는 1단계를 **재검토**로 돌린다. 검토자는 `docs/backlog/design.md` 행과 지난 보고서 지적의 해결 여부를 판정하고, 마지막 디자인 회차 뒤 새로 생기거나 바뀐 템플릿만 전체 관점으로 본다. backlog는 시간이 지나면 다른 작업에서 이미 고쳐진 항목이 섞인다. 확인 없이 계획을 세우면 이미 고친 것을 다시 작업하게 된다(정리 회차 3과 같은 문제).
- 검토 그룹과 B단계 빌더 묶음을 같게 나눈다. 검토 보고서 하나를 빌더 한 명이 그대로 읽게 하기 위해서다.
- B단계 도중 다른 빌더를 막는 공통 버그는 메인이 바로 고치고, 진행 중인 빌더들에게 `SendMessage`로 알린다. 고친 내용은 C단계 표에 적는다.
- 회차가 끝나면 `run_meta.json`에 `{mode: 'design-review' | 'design-fix', round: n, …}`를 남긴다. 종합의 「하네스 개선 후보」(verify·lint가 놓친 것)는 사용자에게 알리고, 반영은 `harness:evolve`나 template-qa 수정으로 따로 한다.

### 카탈로그 확장

카탈로그의 모든 항목이 `src/templates/`에 있으면 "다음 배치"에 고를 후보가 없다. 확장 1(2026-10-27)과 확장 2(2026-10-29)를 이 방식으로 진행했다.

**실행 모드:** 서브에이전트 위임(`breeding-domain-analyst` 1명) + 메인

1. 분석가에게 후보 제안을 맡긴다. 입력은 `template-catalog.md`(「확장 후보 기준」), `program-baseline.md`, `src/templates/` 목록, 사용자가 말한 방향이다. 산출물은 `_workspace/10_catalog_proposal_x{N}.md`: 후보 6~8개(`| 우선 | 카테고리 | slug | 제목 | 브리프 | 쓰는 기준값 | 새로 정할 기준값 |`)와 카테고리 분포.
2. 메인이 후보를 사용자에게 보여 주고 고르게 한다(추가·삭제·수정 가능). 카탈로그는 이후 여러 배치의 범위를 정하므로 확인 없이 확정하지 않는다.
3. 확정한 후보를 `template-catalog.md`에 「확장 N (날짜)」 절로 추가한다. 우선순위는 확장 N마다 두 단계 P(2N+2)·P(2N+3)를 쓴다(확장 1 = P4·P5, 확장 2 = P6·P7).
4. 2단계로 간다.

## 데이터 전달 경로

| 단계 경계 | 전달 방식 | 경로 |
| --- | --- | --- |
| 2 → 3 | `args.templates` | `_workspace/00_plan.json` |
| 명세 → 구현 | 파일 + 구조화 반환값의 `specPath` | `docs/specs/{slug}.md` |
| 구현 → 검증 | 템플릿 폴더 경로 | `src/templates/{category}/{slug}/` |
| 검증 → 수정 | `ISSUES` 반환값 + 보고서 경로 | `_workspace/03_{qa|domain}_{slug}_r{n}.md` |
| 3 → 4 | 워크플로 반환값 | `_workspace/02_workflow_result.json`, `04_shared_candidates.json` |
| 디자인 검토 → 종합 | 그룹 보고서 + 검토자 요약 응답 | `_workspace/07_design_review_r{n}_{group}.md` |
| 종합 → 개선 단계 | 계획·브리프 파일 | `08_design_fix_plan_r{n}.md`, `08_phase_b_brief_r{n}.md`, `08_architect_design_fix_r{n}.md` |
| 디자인 회차 → 다음 회차 | backlog 파일 | `docs/backlog/design.md` |
| 카탈로그 제안 → 2단계 | 제안 파일 → 사용자 선택 → 카탈로그 절 | `10_catalog_proposal_x{N}.md` → `template-catalog.md` |

## 오류 처리

| 상황 | 대응 |
| --- | --- |
| 워크플로에서 일부 `agent()`가 `null` | 스크립트가 `failed:{단계}` 또는 `unverified`로 표시한다. 보고서에 누락을 밝히고, 해당 템플릿만 다음 실행에서 다시 넣는다 |
| 워크플로 전체 실패 | 실행 기록(journal)에서 실제 반환값을 확인 → 원인 수정 → `resumeFromRunId`로 재개(완료된 `agent()`는 캐시) |
| QA가 환경 blocker 보고(서버 미기동, playwright 없음) | 템플릿 문제가 아니다. 메인이 `npm i`, `npx playwright install chromium`으로 고친 뒤 해당 템플릿의 검증만 다시 실행한다(빠른 경로) |
| `maxFixRounds` 후에도 fail | 더 반복하지 않는다. 남은 이슈를 보고하고 사용자에게 방향(명세 조정 / 수동 수정 / 다음 실행)을 묻는다. 같은 이슈가 반복되면 명세나 공통 API 문제일 가능성이 높다 |
| 도메인 검토와 빌더 판단이 충돌(빌더가 "명세 오류"라고 notes에 씀) | 지우지 않고 양쪽 근거를 보고서에 나란히 적는다. 분석가 서브에이전트로 명세를 고친 뒤 해당 템플릿만 재실행 |
| 사용량 한도·인증 만료·권한 거부 | 다시 시도하지 않는다. 부분 산출물을 직접 확인해 어디까지 됐는지 `_workspace/99_incomplete.md`에 기록하고 사용자에게 알린다(한도라면 풀리는 시각 포함). 에이전트의 판단을 추측해 채우지 않는다 |
| 절반 넘는 템플릿 실패 | 진행을 멈추고 공통 원인(기반 깨짐, 계약 불일치)을 먼저 점검해 사용자에게 보고 |
| 디자인 검토자 한 그룹이 결과 없음 | 같은 유형으로 한 번 더 맡긴다. 또 실패하면 그 그룹 없이 종합하고, 종합 보고서 숫자 표에 「미검토」로 남긴다(다른 그룹 지적으로 메우지 않는다) |

## 테스트 시나리오

### 정상 흐름
1. 빈 프로젝트에서 "디지털육종 대시보드 템플릿 기본 세트 만들어줘"
2. 0단계: 기반 없음 → 1단계 설계자가 기반 구축, `_starter` 검증 통과
3. 2단계: 카탈로그 P1에서 `program-overview`(kpi), `gwas-manhattan`(viz) 확정
4. 3단계: 템플릿별 명세 → 구현 → 검증(QA·도메인) → 수정 1회 → 둘 다 pass
5. 4단계: 두 빌더가 모두 `ThresholdLine` 비슷한 후보 보고 → 승격
6. 5단계: 전체 회귀 통과, 갤러리 URL과 스크린샷 경로 보고

### 오류 흐름
1. 3단계에서 `gwas-manhattan`의 QA가 "390px 가로 넘침(major)", 도메인 검토가 "λ=1.35인데 QQ가 대각선(blocker)" 보고
2. 빌더 수정 1회차 → 재검증에서 넘침은 해결, λ 불일치는 여전히 남음 → 2회차 수정 → 해결
3. 만약 2회차 후에도 남으면 `status: fail`로 보고하고, 명세의 λ 값과 데이터 생성 규칙이 서로 모순인지 분석가에게 확인하도록 사용자에게 제안
4. 통과했든 아니든 명세 동기화 단계가 빌더가 바꾼 상수(예: 시드 오프셋)와 명세 오류 지적을 명세에 반영하고 `specSync.changes`에 남긴다

### 빠른 경로
1. "program-overview 다크 모드에서 KPI 숫자가 안 보여, 고쳐줘"
2. 워크플로 없이 빌더 1회 → 메인이 `verify-templates.mjs --slug program-overview --themes dark` 실행 → `1440-dark.png` 확인 → 보고

### 디자인 회차(개선 2차)
1. "디자인 개선 2차 진행해줘"
2. 0단계: 「디자인 회차」. `run_meta.json`의 `design-review` 기록 1건 → n = 2, `docs/backlog/design.md` 열린 항목이 입력
3. 준비: 전체 verify, 썸네일 확인, 서버 기동 → 1단계 재검토(검토자 5명 + 카테고리 간 1명): backlog 행별 해결·일부·남음 판정, 1차 이후 바뀐 템플릿만 전체 관점
4. 2단계 종합 → 사용자가 범위 결정 → 3~8단계 → 9단계 회귀·썸네일 → backlog 해결 행을 「해결」 표로 이동
5. 오류 분기: viz-b 검토자가 결과 없음 → 1회 재시도 → 또 실패하면 종합 표에 「미검토」로 남기고 사용자에게 알림

### 카탈로그 확장
1. "다음 배치 진행해" → 0단계: 카탈로그 33/33 완료 → 「카탈로그 확장」
2. 분석가 후보 7개(`10_catalog_proposal_x3.md`) → 사용자가 5개 선택·1개 수정 → `template-catalog.md`에 「확장 3」(P8·P9) 추가 → 2단계에서 P8 두 개로 배치 확정
