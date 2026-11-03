# 허브 로그인(관리자용)

허브의 보기 기능(템플릿·다운로드·피드백·작업 요청 목록)은 누구나 쓸 수 있습니다. **요청 만들기만** 로그인이 필요하고, 로그인은 허용한 메일 도메인의 직원만 할 수 있습니다. 메일로 받은 6자리 코드로 로그인하며, 처음 로그인할 때 표시 이름을 정하면 그대로 가입됩니다. 비밀번호는 없습니다.

설계: `docs/superpowers/specs/2026-11-03-hub-auth-design.md`

## 한 번 할 설정

1. **허브 전용 Gmail 계정**을 만들고 2단계 인증을 켭니다. 그다음 [앱 비밀번호](https://myaccount.google.com/apppasswords)를 만듭니다. 16자리이고, 공백은 빼고 씁니다.
2. **운영 전용 Neon DB**를 만듭니다. 같은 Neon 프로젝트의 새 데이터베이스여도 됩니다. 연결 문자열이 `AUTH_DATABASE_URL`이 됩니다.
3. **Vercel 환경 변수**를 넣고 다시 배포합니다.

| 변수 | Production | Preview | 설명 |
| --- | --- | --- | --- |
| `AUTH_ALLOWED_DOMAINS` | 넣음 | 같은 값 | 허용 메일 도메인. 여러 개면 쉼표로 구분합니다. 하위 도메인은 따로 적어야 합니다 |
| `AUTH_SECRET` | 넣음 | **다른 값** | 32자 이상 무작위 값. `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `AUTH_DATABASE_URL` | 넣음 | 넣지 않음 | 운영 전용 계정 DB |
| `SMTP_USER` | 넣음 | 넣지 않음 | 허브 Gmail 주소 |
| `SMTP_PASS` | 넣음 | 넣지 않음 | Gmail 앱 비밀번호(Sensitive로 표시) |
| `MAIL_FROM_NAME` | 선택 | — | 보내는 이름. 기본값은 「템플릿 허브」 |

운영 계정 데이터와 Gmail 비밀번호를 Production에만 두는 이유가 있습니다. 미리보기 배포는 PR 브랜치의 코드를 그대로 실행하기 때문에, Preview에 두면 PR을 올릴 수 있는 사람 누구나 그 값을 읽을 수 있습니다.

운영(`VERCEL_ENV=production`)에서 `AUTH_DATABASE_URL`이나 `SMTP_*`가 없으면 로그인이 닫힙니다. 이때도 다른 DB나 로그 출력으로 대신하지 않습니다.

## 미리보기와 로컬

- **미리보기**: 공용 `DATABASE_URL`의 `preview` 범위를 쓰고, 코드는 메일 대신 **Vercel 함수 로그**에 찍힙니다. 해당 배포 → Functions → `/api/auth/[action]` 로그에서 `[auth] 로그인 코드 …` 줄을 보면 됩니다.
- **로컬**: `.env`에 `AUTH_ALLOWED_DOMAINS`, 로컬용 `AUTH_SECRET`, `DATABASE_URL`을 넣고 `npm run dev`를 실행합니다. 코드는 터미널에 찍힙니다. `SMTP_*`는 넣지 않습니다.
- 설정이 모자라면 `/api/auth/me`가 `available: false`를 돌려주고, 화면의 「로그인」을 누르면 "로그인을 아직 사용할 수 없습니다."가 보입니다. 서버 로그에는 `[auth] login closed: <이유>`가 남습니다.

| 이유 | 뜻 |
| --- | --- |
| `domains` | `AUTH_ALLOWED_DOMAINS` 없음 |
| `secret` | `AUTH_SECRET`이 없거나 32자 미만 |
| `database` | 운영: `AUTH_DATABASE_URL` 없음 / 그 밖: `DATABASE_URL` 없음 |
| `mail` | 운영: `SMTP_USER`·`SMTP_PASS` 없음 |

## 값과 한도

- 코드: 6자리, 10분 유효, 5번 틀리면 무효. 새 코드를 받으면 이전 코드는 무효가 됩니다. 다시 받기는 60초 뒤부터 됩니다.
- 세션: HttpOnly 쿠키 `db_hub_session`. 마지막 사용 뒤 30일이면 만료되고, 처음 로그인한 뒤 90일이 지나면 다시 로그인해야 합니다.
- 발송 한도
  - 같은 주소: 분 1·시간 5·하루 10통
  - 같은 IP: 시간 20번
  - 전체 실제 발송: 하루 300통(Gmail 일반 계정 한도보다 낮게)
- 코드 확인 한도: 같은 IP에서 분 10번
- 허용되지 않은 주소에도 "코드를 보냈습니다"로 똑같이 답하고, 메일은 보내지 않습니다. 화면만으로는 어느 도메인이 허용되는지 알 수 없게 하기 위해서입니다.
- DB에는 코드·세션 토큰의 해시만 저장합니다. 메일 주소는 원문으로 저장하지만, 어떤 API 응답에도 넣지 않습니다.

## 발송 서비스 바꾸기

발송은 SMTP만 씁니다. 도메인이 생겨 Resend·SES 같은 서비스로 옮길 때는 `SMTP_*`와 `MAIL_FROM`만 바꾸면 됩니다.

예: Resend는 `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend`, `SMTP_PASS=<API 키>`, `MAIL_FROM=hub@<도메인>`입니다.

## 계정 정리(운영 DB에서 직접)

관리 화면은 없습니다. 운영 DB에 접속해 직접 실행합니다.

```sql
-- 사용자 찾기
SELECT id, name, email, created_at, last_login_at FROM hub_users WHERE scope = 'production' ORDER BY last_login_at DESC;
-- 특정 사용자의 모든 세션 끝내기(로그아웃시키기)
DELETE FROM hub_sessions WHERE scope = 'production' AND user_id = '<id>';
-- 사용자 삭제(세션은 함께 지워짐). 다음에 코드로 로그인하면 새로 가입된다
DELETE FROM hub_users WHERE scope = 'production' AND id = '<id>';
```

허용 도메인에서 뺀 주소의 세션은 다음 요청 때 자동으로 끝납니다.

## 문제 해결

- **메일이 스팸함으로 감**: 회사 메일에서 허브 Gmail 주소를 안전한 보낸 사람으로 등록해 달라고 안내합니다. 계속 그러면 도메인 발송 서비스로 옮깁니다(위 「발송 서비스 바꾸기」).
- **"코드 메일을 보내지 못했습니다"**: 함수 로그의 `[auth] mail failure <오류 이름>`을 봅니다. 앱 비밀번호가 바뀌었거나, Gmail이 보안 알림으로 막았을 수 있습니다. 허브 Gmail 받은편지함의 보안 알림을 확인하세요.
- **"요청이 많습니다"**: 한도에 걸린 것입니다. 창(분·시간·하루)이 지나면 풀립니다.

## 공개 저장소 주의

이 저장소는 공개입니다. 회사 이름·메일 도메인·고객 정보를 코드, 문서, 이슈, 커밋 작성자에 쓰지 않습니다. 커밋 작성자 메일은 GitHub 비공개용 주소(`<ID>+<아이디>@users.noreply.github.com`)를 씁니다. 저장소에서 `git config user.email <주소>`로 설정하면 됩니다. 빌드는 서버 전용 값이 공개 번들에 들어가면 실패합니다(`scripts/check-bundle-secrets.mjs`, `postbuild`).
