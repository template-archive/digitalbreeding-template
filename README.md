# 디지털육종 템플릿 라이브러리

육종 KPI·유전체 시각화·보고서·현장 업무 화면을 제공하는 사내 템플릿 라이브러리입니다. 예제의 기관·품종·수치는 목업이며 업무 저장·승인은 시뮬레이션입니다.

## 실행

Node.js 24와 npm을 사용합니다.

```sh
npm ci
npm run dev
```

## 검증 및 배포

```sh
npm run typecheck
npm run build
npm run preview
```

빌드 전에 33종의 실행 가능한 스타터 ZIP·샘플 데이터·명세·가이드를 자동 생성합니다. 생성물은 Git에 포함하지 않습니다.

Vercel은 이 비공개 저장소를 연결하고 `vercel.json`의 빌드 명령 `npm run build`, 출력 디렉터리 `dist`를 사용합니다. 운영 공유 전 계정 설정에서 Vercel Authentication과 All Deployments 보호를 활성화하고 다운로드 URL까지 인증 없이 접근할 수 없는지 확인하세요. 저장소가 비공개인 것만으로 배포 사이트가 보호되지는 않습니다.

## 데이터 연결

- 전체 템플릿에서 코드 ZIP, 목업 JSON, 데이터 구조 참고 명세와 적용 가이드를 받을 수 있습니다.
- 육종 프로그램 KPI 개요는 CSV·JSON 파일 업로드와 열 매핑을 지원합니다. 연결된 연간 지표와 기본 목업의 다른 결과는 섞지 않습니다.
- 업로드 파일은 브라우저 메모리에서만 처리하며 서버·브라우저 저장소에 저장하지 않습니다.
- 다른 템플릿의 자동 데이터 연결, 로그인·공동 저장·실제 승인 API는 후속 범위입니다.

자세한 계약과 배포 절차는 [템플릿 배포 안내](docs/template-distribution.md)를 참고하세요.

## 템플릿 피드백

로그인 없이 위치 코멘트와 답글을 남기고 팀과 공유합니다. Neon PostgreSQL을 Vercel Storage에 연결하고 서버 환경 변수 `DATABASE_URL`을 설정합니다. 로컬 개발은 `.env.example`을 참고하세요. 저장 구조·익명 삭제 권한·배포 환경 분리와 검증 방법은 [피드백 DB 안내](docs/template-feedback.md)에 있습니다.
