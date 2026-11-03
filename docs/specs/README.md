# 템플릿 명세

템플릿마다 하나씩 있는 도메인 명세다. `{slug}.md`는 `src/templates/{category}/{slug}/`와 짝을 이룬다. 지표 정의·계산식·단위, 목업 데이터 생성 규칙(시드), 화면 구성, 수용 기준, 검산 기록, 변경 이력이 들어 있다. 템플릿을 다시 만들거나 숫자를 고칠 때 기준이 되는 원본이다.

- **누가 쓰나**: 하네스의 도메인 분석가(`breeding-domain-analyst`)가 명세 모드로 쓰고, 템플릿을 고친 뒤 동기화 모드로 코드에 맞춘다. 형식은 `.claude/skills/breeding-metrics/SKILL.md` 「명세 문서 형식」을 따른다.
- **템플릿 사이 공유 숫자**: 여러 템플릿이 함께 쓰는 가상 프로그램의 기준값은 `.claude/skills/breeding-metrics/references/program-baseline.md`에 있다. 명세는 그 값을 따른다.
- **고칠 때**: 숫자·생성 규칙을 바꾸면 명세와 템플릿 코드를 같은 PR에 넣는다. 명세만 바뀌고 코드가 그대로면(또는 반대면) 다음 재생성 때 오류가 되살아난다.
- **열린 지적**: 한 템플릿에서 고칠 수 없는 공유 기준값 문제는 `../backlog/baseline.md`, 미룬 작은 지적은 `../backlog/minor.md`, 디자인 지적은 `../backlog/design.md`에 모은다.

## 검산 기록의 경로

「검산 기록」의 `<scratchpad>/…`, `_workspace/spec_check/…`, `_workspace/cleanup/…` 경로는 작성 당시 분석가가 로컬에서 실행한 스크립트다. 저장소에는 없다(2026-11-03에 명세를 `_workspace/`에서 이곳으로 옮겼다). 기록은 그때 무엇을 실행해 어떤 값을 얻었는지 보여 주는 이력으로 남긴다. 다시 검산하려면 명세의 「목업 데이터 생성 규칙」을 새 스크립트로 옮겨 실행하거나(`breeding-metrics` 「명세 검산」), 템플릿 `data.ts`의 DEV 검산(`console.assert('[검산] …')`)이 통과하는지 verify로 확인한다.
