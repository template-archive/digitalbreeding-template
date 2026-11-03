# 사내 템플릿 배포와 데이터 연결

## 배포
Node.js 24에서 `npm ci`, `npm run build`를 실행합니다. `prebuild`가 `public/downloads`에 33종의 스타터 ZIP·목업 JSON·JSON Schema·적용 가이드를 생성하고, Vite가 이를 `dist/downloads`에 포함합니다. 생성물이 없으면 빌드 단계가 실패하므로 다운로드 없는 페이지를 배포하지 않습니다. 개발 서버도 `predev`에서 같은 파일을 준비합니다.

Vercel 등에서는 Vite 프로젝트, 빌드 명령 `npm run build`, 결과 디렉터리 `dist`를 사용합니다. Node 버전은 `package.json`의 `24.x`를 따릅니다. 루트·미리보기·운영 도메인과 **다운로드 URL 모두** 사내 접근 정책에 맞게 보호한 뒤 공유하세요. 이 작업에는 로그인이나 사내 SSO 설정이 포함되지 않습니다.

### Vercel 접근 제한 적용 전 확인
저장소의 `vercel.json`은 빌드와 결과 디렉터리만 설정합니다. 파일을 추가하거나 배포하는 것만으로 접근 제한이 활성화되지 않습니다.

Vercel 프로젝트의 Settings → Deployment Protection에서 **Vercel Authentication**을 켜고 보호 범위를 **All Deployments**로 저장해야 합니다. Standard Protection은 운영 도메인을 제외하므로 사내 전용 배포에는 충분하지 않습니다. 사내 사용자에게 필요한 프로젝트 접근 권한을 부여하고, 공개 공유 링크·보호 예외·불필요한 우회 토큰도 점검하세요. 회사 이메일 주소만으로 자동 허용되거나 사내 SSO가 자동 구성되는 설정은 아닙니다.

설정 후 인증 정보가 없는 새 브라우저에서 운영 도메인, 생성된 배포 URL, `/downloads/manifest.json`, `/downloads/kpi/program-overview/starter.zip`을 각각 직접 열어 로그인 요구 또는 접근 거부를 확인합니다. 권한 있는 계정에서는 페이지와 ZIP 다운로드가 모두 동작해야 합니다. 보호를 확인하기 전 사내 공유나 공개 배포가 완료되었다고 간주하지 않습니다.

공식 안내: [Deployment Protection](https://vercel.com/docs/deployment-protection), [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication).

스타터는 별도 프로젝트로 압축 해제한 후 `npm ci`, `npm run dev`, `npm run build`로 사용합니다. 소스 공개를 의도한 파일만 허용 목록에서 복사합니다. `.env`, 자격증명, 저장소 설정, 작업 문서, 다른 템플릿 소스는 ZIP에 포함하지 않습니다. 공통 디자인 시스템·차트·유틸리티, 폰트 패키지 의존성, 경로 별칭, 잠금 파일을 포함하므로 특정 템플릿 폴더만 복사했을 때의 누락 문제를 피합니다.

## 전체 템플릿에 제공하는 자료
- `starter.zip`: 선택한 템플릿과 공통 의존 소스, 실행 설정, 패키지 잠금 파일.
- `sample-data.json`: `data.ts`에서 JSON으로 직렬화할 수 있는 목업 상수. 함수는 제외하고 Map/Set은 객체/배열로 변환합니다.
- `schema.json`: 목업 스냅샷의 참고 구조. 배열은 첫 항목에서 추출하며, 실제 API 필수 필드·단위·허용 범위를 보장하는 계약은 아닙니다.
- `guide.md`: 실행, 기존 프로젝트 적용, 데이터 연결, 운영 전 확인사항과 원래 템플릿의 지표 정의.

외부 파일 계약이 구현된 `kpi/program-overview`는 예외로, 아래 계약에 맞는 JSON·CSV와 실제 입력 검증 명세를 제공합니다. 나머지 템플릿에 범용 자동 연결이 구현되어 있다고 표시하지 않습니다.

## 대표 연결: 연간 유전적 개량량
`src/features/template-data/contract.ts`에서 입력 계약, CSV 파싱·매핑과 검증을 정의합니다.

JSON 객체에는 프로젝트 이름 `projectName`(1–100자), 기준 수량 `baselineYield`(양수, kg/10a), `rows`(1–200행)가 필요합니다. 각 행의 필드는 다음과 같습니다.

| 필드 | 의미 | 범위·단위 |
| --- | --- | --- |
| year | 연도 | 1900–2200 정수, 중복 불가 |
| selectionIntensity | 선발 강도 i | 0 이상 |
| accuracy | 선발 정확도 r | 0–1 |
| geneticSd | 상가적 유전 표준편차 σA | 0 이상, kg/10a |
| generationInterval | 세대 간격 L | 0 초과, 년 |
| targetGainPct | 연간 개량량 목표 | 0 초과, %/년 |

모든 숫자는 유한해야 합니다. 빈칸·NA·자동 단위 환산은 지원하지 않습니다. CSV는 UTF-8·쉼표 구분이며 최대 100열이고, 머리글을 화면에서 위 필드에 매핑합니다. 기준 수량과 프로젝트 이름은 별도로 입력합니다. 따옴표·쉼표·CRLF·BOM을 지원하며 중복 열·중복 매핑을 거부합니다.

계산: `ΔG = i × r × σA / L`, `%/년 = ΔG / baselineYield × 100`. 입력·계산 결과가 올바른지 검증한 뒤 렌더합니다. 기본 예제의 파이프라인·출원·형질별 정확도는 사용자 데이터에 섞지 않습니다.

파일은 1MB로 제한하고 브라우저 메모리에서만 처리합니다. 네트워크 전송·URL 포함·브라우저 저장소 기록·공동 저장은 하지 않습니다. 새로고침 시 초기화되며 임베드 링크는 기본 목업 화면을 엽니다.

## 기존 코드/API 연결
`ProgramOverviewTemplate`은 선택적 `data` 속성을 받습니다. API 응답을 `validateProgramData`로 검증하고 `<Template data={data} />`로 전달하면 연결된 연간 지표 화면을 표시합니다. 속성을 생략하면 기존 목업 화면을 유지합니다. API 인증·로딩·오류 처리는 연결 프로젝트가 담당합니다.

다른 템플릿은 해당 도메인의 검증 계약과 어댑터를 순차적으로 추가합니다. 업무 화면의 저장·승인·충돌 동작은 여전히 목업입니다. 로그인·DB·동시 편집·프로젝트별 권한은 후속 제품 범위입니다.

## 검증
`_workspace/qa`의 진단 스크립트는 ZIP 누락/경로 검사와 압축 해제 후 33종 빌드, 데이터 계약 경계값, 실제 파일 선택·필드 매핑·미리보기, 정적 배포에서의 다운로드를 검사합니다. 별도 의존성 설치 없이 현재 설치된 잠금 버전으로 압축 해제한 프로젝트를 빌드합니다.
