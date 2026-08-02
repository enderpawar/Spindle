# 배포 절차 (Cloudflare Pages + Workers)

> Phase 6("PWA 완성 + 프로덕션 배포")의 배포 절차 문서. 대상 독자는 **사람(저장소 소유자)** —
> 여기 적힌 단계는 Cloudflare 계정 로그인이 필요해 에이전트가 대신 실행할 수 없다.
> CI(`.github/workflows/deploy.yml`)는 이 문서의 1~3단계가 끝난 뒤부터 자동으로 동작한다.

## 구성 요약

- `web/` → 정적 빌드(`web/dist`) → **Cloudflare Pages**
- `proxy/` → **Cloudflare Workers** (`spindle-proxy`, TourAPI 키 주입·중계 전용)
- 두 프로젝트는 **같은 Cloudflare 계정**에 있어야 한다 (`pwa` 스킬 규약).
- 심사 제출 URL은 Pages 프로덕션 브랜치(고정 URL) — 제출 후 프로젝트명 변경 금지.

## 0. 사전 확인

- [ ] `npm run check` 로컬에서 통과 (guard + web + proxy 품질 게이트)
- [ ] `npm run pwa:verify` 통과 (manifest·service worker 캐시 정책 검증)
- [ ] TourAPI **운영계정** 인증키 확보 (Phase 0 항목, 발급 완료 상태여야 함)
- [ ] 공공데이터포털에서 `한국관광공사_관광지 집중률 방문자 추이 예측 정보` 별도 활용신청 승인. 미승인 상태에서는 명소 지도에 재시도 안내만 표시되고 핵심 탐색 동선은 정상 동작

## 1. Cloudflare 계정 준비 (최초 1회, 사람)

1. https://dash.cloudflare.com 에서 계정 생성/로그인.
2. 로컬에서 wrangler 로그인 (1회):
   ```
   npx wrangler login
   ```
   브라우저 인증 후 로컬 머신에 토큰이 저장된다. (에이전트는 이 명령을 대신 실행하지 않는다.)
3. Cloudflare 계정 ID 확인: 대시보드 우측 사이드바 또는 `npx wrangler whoami`.

## 2. Cloudflare Pages 프로젝트 생성 (web/)

방법 A — 대시보드에서 생성 후 최초 배포는 CI에 맡긴다:
1. Cloudflare 대시보드 → Workers & Pages → Pages → "Create a project" → "Direct Upload" 방식으로 이름만 `spindle`로 생성 (Git 연동은 사용하지 않음 — 배포는 GitHub Actions가 담당).

방법 B — 로컬에서 최초 배포와 동시에 프로젝트 생성:
```
npm --prefix web run build
npx wrangler pages deploy web/dist --project-name=spindle
```
처음 실행 시 wrangler가 프로젝트가 없으면 생성할지 물어본다.

- 프로젝트명은 `spindle`로 통일한다 (`.github/workflows/deploy.yml`의 `CLOUDFLARE_PAGES_PROJECT`와 반드시 일치). 다른 이름을 쓰려면 워크플로 파일의 값도 함께 바꿀 것.
- 배포 후 발급된 기본 도메인은 `https://spindle-6vp.pages.dev`다. (`spindle.pages.dev`가 이미 사용 중이어서 Cloudflare가 접미사를 부여함.) 커스텀 도메인을 붙이려면 Pages 프로젝트 → Custom domains에서 연결(선택 사항, DNS가 Cloudflare에 있어야 간편).

## 3. Cloudflare Workers 배포 + 시크릿 등록 (proxy/)

1. 운영계정 TourAPI 인증키를 Workers 시크릿으로 등록 (로컬 1회, 값은 **디코딩된** 키):
   ```
   cd proxy
   npx wrangler secret put TOURAPI_SERVICE_KEY
   ```
   프롬프트에 키를 붙여넣는다. 이 값은 Cloudflare에 영구히 저장되며, 이후 `wrangler deploy`(CI 포함)로 재배포해도 유지된다 — GitHub Actions는 이 시크릿을 다루지 않는다.
2. 최초 배포(선택, CI가 나중에 자동으로 해도 되지만 먼저 한 번 확인하고 싶다면):
   ```
   npx wrangler deploy
   ```
3. 배포된 Workers URL은 `https://spindle-proxy.enderpawar.workers.dev`다. 프로덕션 프론트는 `web/.env.production`의 `VITE_API_BASE`로 이 Worker의 `/api`를 직접 호출한다. 로컬 개발은 계속 `web/vite.config.ts`의 `server.proxy['/api']`를 통해 `127.0.0.1:8787`을 사용한다.

## 4. GitHub repo secrets 등록 (CI가 동작하려면 필수)

GitHub 저장소 → Settings → Secrets and variables → Actions → New repository secret:

| Secret 이름 | 값 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare 대시보드 → My Profile → API Tokens → Create Token. "Edit Cloudflare Workers" + "Cloudflare Pages: Edit" 권한(또는 이 두 권한을 포함하는 커스텀 토큰)으로 발급 |
| `CLOUDFLARE_ACCOUNT_ID` | 1단계에서 확인한 계정 ID |

이 두 값이 등록되면 `master`에 push할 때마다 `.github/workflows/deploy.yml`이:
1. `npm run check` (품질 게이트) 실행 — 실패 시 배포 중단
2. `web/` 빌드 후 Cloudflare Pages(`spindle` 프로젝트, `master` 브랜치)에 배포
3. `proxy/`를 Cloudflare Workers(`spindle-proxy`)에 배포

`TOURAPI_SERVICE_KEY`는 GitHub secrets에 등록하지 않는다 — 3단계에서 이미 Cloudflare 쪽에 영구 등록했으므로 CI 배포와 무관하게 유지된다.

## 5. ALLOWED_ORIGIN 갱신 (Pages 도메인 확정 후, 사람)

`proxy/wrangler.toml`의 `[vars] ALLOWED_ORIGIN`은 실제 Pages 도메인 `https://spindle-6vp.pages.dev`로 고정한다. 도메인을 변경하면:

1. `proxy/wrangler.toml`의 `ALLOWED_ORIGIN` 값을 실제 도메인으로 수정 (현재 `https://spindle-6vp.pages.dev`, 커스텀 도메인을 쓴다면 그 값).
2. 커밋 후 `master`에 push → CI가 프록시를 재배포하며 새 CORS 설정이 반영된다. (급하면 로컬에서 `npm --prefix proxy run deploy`로 즉시 반영 가능.)
3. 반영 후 시크릿 창에서 프로덕션 Pages URL을 열어 여행 모드가 완주되는지 확인 (CORS가 막히면 브라우저 콘솔에 `Access-Control-Allow-Origin` 에러가 뜬다).

## 6. 배포 후 검증 (Phase 6 사람 체크리스트, PLAN.md와 동일)

- [ ] Chrome Lighthouse: PWA installable 통과 (`npm run pwa:verify`는 빌드 산출물 정적 검증만 하므로, 배포된 URL에서 Lighthouse 실측 필요)
- [ ] Chrome DevTools → Network → Offline: 셸 표시 + 추천 버튼 비활성 + "네트워크 필요" 안내
- [ ] Android Chrome: 설치 배너 → 홈 화면 설치
- [ ] iPhone Safari: 공유 시트 "홈 화면에 추가" 안내 확인
- [ ] 시크릿 창 + 프로덕션 URL에서 여행 모드(출발점 선택 → 스핀 → 결과 카드) 완주
- [ ] 브라우저 개발자도구 Network 탭에서 `/api` 요청에 좌표·방위각 파라미터가 없는지 육안 확인 (guard·테스트로 이미 고정돼 있지만 배포 환경에서도 재확인)

## 7. 프리뷰 배포 주의

- `wrangler pages deploy`는 브랜치명이 `master`가 아니면 프리뷰 URL(`<hash>.spindle.pages.dev`)을 생성한다. **심사 제출물에는 프로덕션 URL만 사용** — 프리뷰 URL을 제출하지 않는다.
- CI 워크플로는 `master` push에서만 동작하므로 일반적인 PR/브랜치 작업은 자동 배포되지 않는다(의도된 동작).
