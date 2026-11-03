# 기반 검증용 스타터 (`_starter`)

- 카테고리: kpi (내부용 — `_` 접두라 갤러리 목록에는 숨겨지고 URL로만 열린다)
- URL: `/#/t/kpi/_starter`, 임베드 `/?embed=1#/t/kpi/_starter`

## 목적
디자인 토큰, 공통 컴포넌트(`KpiTile`, `ChartCard`, `PageGrid`, `SectionHeader`), 차트 래퍼(`EChart`, `useChartTheme`),
시드 RNG(`createRng`), 갤러리 계약(`data-template-root`, `?embed=1`, `?theme=`)이 함께 동작하는지 확인한다.
새 템플릿의 최소 예제로도 참고할 수 있다.

## 사용 지표
- 연간 유전 획득량(kg/10a/년): 연도별 평균 육종가의 기울기
- GEBV 선발 정확도: corr(GEBV, TBV) 근사
- 평균 세대 간격(년): 낮을수록 좋음(`better="down"`)

## 실제 데이터로 교체하기
`data.ts`의 export(`YEARS`, `conventional`, `genomic`, `GS_START`, `kpis`) 형태를 유지한 채 API 응답으로 바꾼다.

## 변경 이력
- 2026-10-23 초기 구축 시 생성
- 2026-10-30 디자인 개선 1차: 머리·KPI·결론을 `PageHeader`·`KpiRow`·`SummaryCallout`로 옮기고, 아래에 「공통 컴포넌트 점검」(목표 없는 심각도 KpiTile, 5단계 Stepper, 숫자 열·hideBelow·기본 스크롤 안내 DataTable, 값 칸 AlertList, SeverityTag, ScrollRegion + select-ring, summary를 받은 ScaledCanvas)을 추가 — 폭(390·768·1440)에 따라 달라지는 공통 동작을 한곳에서 확인
