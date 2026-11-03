# 디자인 backlog (디자인 개선 2차 입력)

디자인 개선 1차(2026-10-30~31, 공통 먼저)에서 손대지 않은 템플릿별 지적과 결정 대기 항목. 출처: 검토 `07_design_review_{kpi,viz-a,viz-b,infographic,workflow,cross}.md`(지적 번호), B단계 빌더 보고의 「다음 회차」, C단계 설계자 보고, 도메인 검토 `08_domain_review_design.md`. 2차를 시작할 때 이 표의 항목이 아직 남아 있는지 grep·스크린샷으로 확인한다.

## 공통(설계자)

| 항목 | 출처 |
| --- | --- |
| 업무 화면 저장·확정 방식 5종 통일(하단 저장 바·상단 고정 바·확정 줄·일괄 작업 바+모달·상세 맨 아래 버튼), 390 상세 시트 안 저장 | workflow 공통 1 |
| Legend 빈 다이아몬드(◇ 목표)·더하기(+) 견본 — pipeline-flow 연간 차트 ◇는 부제 글리프로 설명, ld-decay 아우스 표식을 빈 원으로 바꿈 | 마무리 빌더 |
| 로컬 요약 타일 3곳(sample-tracking·seed-inventory·crossing-record) SummaryTile 승격 검토(crossing-record는 넓은 대표 타일 막대 옆 배치 로컬 구현) | promotion-holds, 마무리 빌더 |
| `stripePattern`(캔버스 빗금) 두 번째 사용처가 생기면 승격 | promotion-holds |
| 인포그래픽 인쇄 버튼 없는 3곳(digital-breeding-process·variety-application-brief·variety-profile), 각주 표식 ※·① 통일 | infographic G5 |
| 차트에 남은 ▲ 상태 기호 3곳 → 심각도 아이콘 | 도메인 (f) |

## 템플릿별

| 템플릿 | 남은 지적 |
| --- | --- |
| program-overview | 390 차트 라벨(#1·#2), #4, #6, #7, #8 |
| diversity-monitor | 연간 ΔF를 대표 타일로(#2), 390 시나리오 차트 라벨 겹침(#4), 그룹 He 라벨이 하한선에 가려짐(#8), Ne 차트 ▲ 주의 표식 |
| trial-site-environment | 일별 차트 ▲▼ 극값 표식, 지도·경보 카드 높이(#5), 2025 산점도 라벨(#8), 권역 띠·지수 점 색 중복(#9), 768~1279 지도 좌우 여백 |
| genotyping-lab-ops | QC 막대 축 90%(#1), 히스토그램 기준 미달 막대(#2), 표 세로 스크롤 → 페이지 나눔(#3), 경보 플레이트 기본 펼침(#5), TAT 범례·▲ 목표 초과(#7), KPI period(#8) |
| genetic-gain-tracker | 경보 영역 없음(#1), #4, #6, #7, #8 |
| gs-model-performance | Δr + CI 차트(#1), 학습 곡선(#2), 범례 토글 문법(#3), KPI 빈 공간(#4) |
| program-budget | 390 툴팁(#2), 390 월별 누계 라벨 겹침(#4), #5, #8, #9, 경보 카드 이름 |
| variety-adoption | 타임라인 재설계·390 목록(#2), 다크 빗금(#7), 보급 목표 카드 빈 띠 |
| breeding-pipeline-flow | 로그 축 막대, 2019 ○ 표식, 연차 띠 점·선, 생키 높이, 390 후보 표 머리, 원문자 열 머리 |
| gebv-selection | 390 상세 하단 시트, DivergingBar 기준선(C4), 선택 배지 색·범례 견본, 음수 z 흐림, 768 산점 라벨 잘림 |
| gwas-manhattan | QQ 축 범위, QQ 강조색 의미, 결론 KPI 대표 타일 |
| haplotype-viewer | 대립유전자 색 체계(라이트·다크), 트랙 눈금·빈도 라벨 잘림, 390 첫 차트 1,154px(조작 카드 김) |
| kinship-heatmap | 390 단일 셀 탭, 표 배지 전부 빨강 |
| ld-decay | 감소 곡선 교차 라벨·x축 범위, 히트맵 깊이 자르기, 블록 라벨 겹침 |
| met-gxe-stability | 반응 규준 범례 견본(#5), 축 끝값 겹침(#6), 390 바이플롯 라벨 겹침(#7), 1440 순위표 ASV 열 페이드 아래 |
| pedigree-explorer | 390 계통도(3세대 기본·축소·세로 목록)(#2), 루프 번호 모양(#6), 결론 띠(#7) |
| population-structure | 390 ADMIXTURE 압축(#1), 390 PCA 높이(#3), PCA 드래그 터치(#4), AUS 약어(#7), 0.4689 중복(#9), 스크리 강조 막대 = TEJ 색 |
| trait-correlation | 상관 반응 범례 견본(#2), 390 범례 낱말 끊김(#4), 390 SE 스위치(#7), 390 열 머리 약칭 붙음 |
| variety-identity-markers | 막대·표 행 정렬(#4), 최근접 품종 KPI 문구(#6), 1440 행렬 라벨 축약(#8), ID BB 칩 청록(#9), 다른 마커 열 머리 `bg-warning/15` 의미 |
| annual-report-onepager | #1, #2, #4, #5(추세 패널 9 논리 px 넘침), #6, #7 |
| conventional-vs-digital | #1, #4 |
| digital-breeding-process | #2~#5, 숫자 카드 아래 약간 넘침 |
| mas-backcross-story | #1~#4 |
| variety-application-brief | #2, #4, #5 |
| variety-profile | #2, #3, 형질 표 오른쪽 약 10 논리 px 넘침 |
| advancement-decision | 권고·결정 배지 구분(A1), md~lg 서랍(A2), 행 배경(A3 일부), 기준 카드 위치(A4) |
| cross-planner | 단계 이동 바(C2), ①단계 카드 목록 전환, C4 |
| crossing-record | R1, R3 나머지, R4, R6, R8 |
| field-trial-layout | 대표 KPI(F5), 표 높이 제한 520px(F3) |
| phenotype-entry | 저장 바(P4·P5), 미저장 모서리 삼각형 강조색 |
| rga-scheduler | 다크 연한 구간(G4) |
| sample-tracking | 390 바 문구·버튼(S2), S6, S7, 390 웰 24px, 상세 「선택에 추가」 |
| seed-inventory | V1, V2(저장·확정 범위), V5 |
