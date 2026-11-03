# 육종 파이프라인 계통 흐름 (`viz/breeding-pipeline-flow`)

연말 진급 심의 전에 연구 관리자·육종 책임자가 "올해 각 단계에 몇 계통이 있고, 한 코호트가 몇 년에 걸쳐 어디까지 갔으며, 어디서 왜 빠졌는가"를 보는 화면.

- 명세: `docs/specs/breeding-pipeline-flow.md` (기준일 2026-10-23, 시드 20261023)
- 작물: 벼, 중부 평야지 가상 프로그램(program-baseline 준수)

## 구성

| 영역 | 내용 | 파일 |
| --- | --- | --- |
| B | 2026 KPI 4개(세대 진전 후보, 시험 계통, 출원 후보, 품종 출원 달성률) | `index.tsx` |
| C | 2026 연간 단계 현황(로그 축 가로 막대, 목표 ◇, 2019 ○) | `components/AnnualSnapshot.tsx` |
| D·E | GS 1차 코호트 선택(`aria-pressed` 버튼), 연차 띠(G ~ G+4) | `index.tsx`, `components/CohortPanels.tsx` |
| F·G | 코호트 계통 흐름 생키(전체 / PYT 이후 확대). custom 시리즈로 직접 그림 | `components/FlowSankey.tsx` |
| H | 탈락 사유 100% 누적 막대(사유 7종 고정 순서) | `components/ReasonBars.tsx` |
| I | 출원 후보·결과 표 | `components/CohortPanels.tsx` |
| J | 코호트 진급률 표 + 횡단 통과율 참고 행 | `components/CohortPanels.tsx` |
| K | GS 도입 전후(2019 vs 2026) 통과율 + 결론 문장 | `components/GsCompare.tsx` |
| 390px | 생키 대신 단계 카드 목록, C·H 요약 목록, KPI `MobileSummary` | `components/MobileLists.tsx` |

## 지표

- 통과율(같은 해 단계 수 비) = 100 · N_Y[k] / N_Y[k−1]
- 진급률(코호트) = 100 · C_G[k] / C_G[k−1], 코호트 G = GS 1차 연도
- 코호트 단계 수: ①②③ = PIPELINE[G], ④ = PIPELINE[G+1][3], ⑤ = PIPELINE[G+3][4], ⑥ = PIPELINE[G+3][5], ⑦ = 출원 목록
- 탈락 사유: T1~T4 = 기본 비중 × exp(0.2·N(0,1)) 후 최대 나머지법, T5·T6 = 판정 규칙·심의 결과 고정값

## 데이터 교체

`data.ts`의 `PIPELINE`, `PIPELINE_TARGET_2026`, `cohortCounts`, `DROPS`, `PENDING`, `CANDIDATES`를 실제 육종 정보 시스템 응답으로 바꾼다. 화면은 이 값만 읽는다.
탈락 사유는 계통별 주원인 코드(`REASONS` 7종)를 전환별로 집계해 넣는다.

## 생키 구현 메모

공통 `src/charts/registry.ts`에 `SankeyChart`가 등록돼 있지 않고 템플릿은 `echarts.use()`를 호출할 수 없어, `FlowSankey`가 노드·리본을 custom 시리즈(`coordinateSystem: 'none'`)로 그린다.
레이아웃: 열 = 단계, 같은 열에서 진급 노드가 위·탈락 노드가 아래, 노드 높이와 리본 폭은 계통 수에 선형 비례(최소 1.5px). 대기·진행 노드는 `hatchPattern` 빗금.

## 상태

- `?state=loading|empty|error`
- `qa-states.json`: 코호트 2023·2024·2026

## 변경 이력

- 2026-10-29 처음 작성
- 2026-10-29 명세 동기화 반영: T1 근거 "GEBV·마커(6K 칩)", 2022 T6 "선정 제외"(품질 1 · 도열병 1, YR19-0611 도열병(MET 발병)), 2024 MET 연도 "2026~27", C 각주 1년차 세트 제외 문구, 390 J 스크롤 단서
- 2026-10-29 정리 회차 4(A2·A3·B1·B2): C 각주를 MET 세트 정의(완료 18 · 1년차 20 · 포장 38)로 확정, 2025 코호트 대기 노드 "(11-06)"(`REVIEW_2027_MET` = advancement-decision 심사회의), 2026 코호트 "(12월)", 출원 KPI 등급을 연말 전망 2/3건(66.7%)에서 계산(`forecastAchievement`, program-overview와 같은 식, 경보 유지), qa-states에 `expect`와 2025 상태 추가, DEV 검산 추가
- 2026-10-30 디자인 개선 1차 B: 머리를 `PageHeader`(약어 풀이는 「자세히」)로, KPI를 `KpiRow`(390 MobileSummary 대신 2열 타일)로, KPI 아래 결론 띠 `SummaryCallout`(목표 미달 단계·출원 전망, 톤 = MET 등급) 추가. 연차 띠 '현재' 카드의 강조색 테두리·바탕 제거(점 + 글자), 생키 '출원 예정'을 info 파랑 대신 단계색 빗금(+ 범례 견본 빗금), 진급률 표 `numeric`, 출원 후보 표 머리 선·`ScrollRegion`, 출원 후보 카드 늘어남 제거, 탈락 사유 설명의 내부 slug를 화면 이름으로
- 2026-10-31 디자인 개선 1차 마무리: 데이터 문장 "유전체 선발(GS) 1차 코호트"(도메인 m15), 생키 범례 빗금 견본을 color 문자열 우회 → Legend shape('missing'·'hatch')
- 2026-11-02 디자인 개선 2차: 화면 순서를 머리 → 결론 → 생키 + 시험 단계 확대(높이 320, 나란히) → 코호트 선택 → 지표 → 연간 현황·GS 전후 → 탈락 사유·출원 후보 → 진급률 표로 변경, 연간 현황을 로그 축 점 그림(값은 오른쪽 열, ◇ 목표 · ○ 2019 범례 견본)으로, 390 목록 막대도 로그 위치 점으로, 연차 띠를 점·선 타임라인으로, 코호트 선택을 Segmented로, 진급률 표 머리에 도착 단계 이름, 선택 코호트는 activeRow, 390 출원 후보는 2줄 목록, 지표는 가로 띠
