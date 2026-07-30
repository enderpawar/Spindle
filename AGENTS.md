# Spindle

휴대폰을 돌려 가리키는 방향의 부산 원도심·영도 관광지를 추천하는 **관광 분산형 게임 탐색 PWA**.
2026 관광데이터 활용 공모전(웹·앱 개발 부문) 출품작. **마감: 2026-09-21(월) 16:00.**

> 이 파일은 모든 AI 코딩 에이전트(Claude Code, Codex 등)가 공유하는 **단일 규칙 소스**다.
> 규칙을 추가·변경할 때는 이 파일만 수정한다. (CLAUDE.md는 이 파일을 import만 한다)

## 절대 원칙 (위반 코드는 작성 금지)

1. **좌표 무전송**: 사용자 GPS 좌표·방위각은 어떤 서버로도 전송하지 않는다. 위치 관련 계산(방향 매칭, 거리, 필터)은 전부 단말 내에서 수행한다.
2. **`locationBasedList2` 사용 금지**: 좌표 기반 TourAPI 엔드포인트는 의도적으로 쓰지 않는다. POI 조회는 지역코드 기반 `areaBasedList2`만 사용.
3. **TourAPI 실시간 호출만**: 응답을 로컬 DB·파일·localStorage·IndexedDB·service worker 캐시 등 영속 저장소에 적재하지 않는다. 메모리/세션 범위 캐시만 허용. (공모전 규정 — 위반 시 감점/제외)
4. **인증키는 프록시 환경변수에만**: API 키를 클라이언트 코드·저장소·커밋에 절대 포함하지 않는다.
5. **비로그인 유지**: 계정·개인정보 수집 기능을 추가하지 않는다.
6. **출처 표기와 운영 주체 구분**: 공공데이터를 사용한 화면·문서에는 `출처: ⓒ한국관광공사` 또는 `출처: ⓒ한국관광콘텐츠랩`을 텍스트로 반드시 표기한다. 공식 CI/BI 로고 이미지를 사용하거나 서비스명·브랜딩에 기관명을 넣어 공사가 직접 개발·운영하는 것처럼 오인시키지 않는다.

## 구현 규약 문서 (작업 전 필독)

아래 영역의 코드를 작성·수정하기 전에 **반드시 해당 규약 문서를 먼저 읽는다.**
(Claude Code는 스킬로 자동 로드되지만, 다른 에이전트는 직접 읽어야 한다)

| 작업 영역 | 규약 문서 |
|---|---|
| TourAPI 호출·프록시 | `.claude/skills/tourapi/SKILL.md` |
| 추천 알고리즘 (점수·존 모델·실패 처리) | `.claude/skills/algorithm/SKILL.md` |
| 방향 기반 여행 코스 | `.claude/skills/algorithm/SKILL.md` + `docs/course.md` |
| 나침반·GPS 센서 | `.claude/skills/sensors/SKILL.md` |
| PWA (manifest·service worker·배포) | `.claude/skills/pwa/SKILL.md` |
| 제출 전 점검 | `.claude/skills/submission-check/SKILL.md` |

## 기술 스택

- 프론트: React(Vite) + TypeScript, PWA (manifest + service worker 오프라인 셸)
- 프록시: Cloudflare Workers (키 주입·요청 중계만, 로그 미저장)
- 배포: Cloudflare Pages — 심사 제출용 고정 URL
- 지도: 카카오맵/네이버지도 딥링크 (자체 SDK는 여행 모드 출발점 선택에만 최소 사용)

## 명령어

루트에서 실행 (루트 `package.json`이 `web/`·`proxy/`로 위임):

- `npm run dev` — web dev 서버 (Vite). `/api`는 로컬 프록시(127.0.0.1:8787)로 전달되므로 아래 프록시도 함께 띄울 것
- `npm run dev:proxy` — 프록시 로컬 실행 (`wrangler dev`, 포트 8787). 키는 `proxy/.dev.vars`에 (예시: `proxy/.dev.vars.example`)
- `npm run build` — web 프로덕션 빌드 (`tsc -b && vite build`)
- `npm run check` — 품질 게이트 전체: guard(금지 패턴) + web(typecheck·lint·test) + proxy(typecheck·test). pre-commit이 자동 실행
- `npm run guard` — 금지 패턴 스캔만

## 품질 게이트 (자동 강제)

- `node scripts/guard.mjs` — 금지 패턴 스캐너 (locationBasedList2, 클라이언트 내 serviceKey·mapX/mapY). **git pre-commit(`.githooks/`)과 Claude Code hook이 자동 실행**하며, 위반 시 커밋·편집이 거부된다.
- guard 위반을 우회하지 않는다: `guard-allow` 주석은 정말 오탐일 때만, 사유와 함께 사용.
- Phase 1 이후에는 pre-commit이 `npm run check`(typecheck + lint + test + guard)까지 실행한다. **check가 깨진 상태로 커밋하지 않는다** (`--no-verify` 사용 금지).

## 구현 진행 방식

- 구현 작업은 **`PLAN.md`의 phase 단위로만** 진행하며, 실행 절차는 **PLAN.md의 "실행 절차 (모든 에이전트 공통)" 절**을 따른다 (선행 DoD 확인 → 규약 로드 → 구현 → DoD 실검증 → 체크박스 갱신·커밋).
- 진입점: Claude Code = `/phase N` 스킬, Codex = `spindle-phase` 스킬(`~/.codex/skills`). 어느 쪽이든 절차의 원본은 PLAN.md 하나다.
- 화면·연출·카피는 `docs/ui.md`를 따른다. ⚠ 표시(미확정 제안) 항목은 제안값대로 구현하되 보고에 명시한다.

## 백엔드 확장 체크포인트 (2026-08-15)

Spring 백엔드(익명 토큰 기반 "도장깨기" 서버 전환 — 현재는 `docs/zones.md`/Phase 7 커밋대로 단말 내 저장) 추가 여부는 **2026-08-15에 판단**한다. 그 전에는 아래를 지킨다.

- **8/15 이전**: Phase 1~6 DoD 실검증(실기기 테스트) + Cloudflare 실배포를 최우선으로 완료한다. 백엔드 착수는 이 시점 전에 시작하지 않는다.
- **8/15 판단 기준**: Phase 1~6이 끝나 있고 9/21 마감까지 남은 시간 예산으로 40~60시간을 확보할 수 있으면 착수, 아니면 스킵한다 — PLAN.md Phase 7("시간 부족 시 스킵")과 동일하게 조건부 취급. 제출 안전망(MVP)이 항상 백엔드보다 우선이며, 스킵해도 감점 요인 아님(공모전 배점표에 백엔드 유무 항목 없음).
- **착수할 경우의 제약**: 절대 원칙 1(좌표 무전송)·3(TourAPI 응답 영속 저장 금지)·5(비로그인)는 백엔드에도 그대로 적용된다.
  - 계정은 이메일/비밀번호가 아닌 **익명 디바이스 토큰**(클라이언트 자체 생성 UUID)으로 발급 — 로그인 화면·개인정보 수집 없음.
  - 서버 DB에는 **방문 POI ID + 토큰**만 저장한다. TourAPI 응답(장소명·주소·이미지 등) 캐싱은 여전히 금지.
  - 좌표·방위각은 이 백엔드에도 절대 전송하지 않는다 — 위치기반서비스사업자 신고 대상 회피 근거(공모전 Notion FAQ "위치기반서비스사업자 신고 대상" 항목: 좌표를 서버로 전송하면 DB 저장 여부와 무관하게 신고 대상, 단말 내부 처리·미전송이면 대상 제외).
  - 배포는 Cloudflare Workers 대신 별도 인프라(예: GCP Cloud Run) 사용 가능 — 이 경우 프론트(Cloudflare Pages)와 분리 배포, 프론트 핵심 동선(스핀→추천→결과, 여행 모드)은 이 백엔드가 죽어도 100% 동작해야 한다.

## 문서 맵

- `PLAN.md` — 구현 phase 정의 (범위·DoD·검증 방법). **구현 작업의 기준 문서.**
- `SPEC.md` — 전체 명세 v0.3. 기능·알고리즘·심사 기준 매핑·일정·리스크. **기능을 추가·변경하면 반드시 해당 절을 함께 갱신한다.**
- `docs/ui.md` — 화면 흐름·스핀 연출·카피 톤 명세
- `docs/course.md` — 스핀 방위 기반 2~4개 장소 코스의 구성·순서·실패 처리 규칙
- `docs/competition.md` — 공모전 규정·심사 배점·FAQ 제약·연락처·사무국 질의 상태. 규정 판단은 이 문서 먼저.
- `docs/zones.md` — 존-교량 접근 가능성 모델 데이터 (존 구획, 존 간 보정거리, 우회계수)
- `docs/curation.md` — POI 인기도 티어 큐레이션 표 (분산 가중치의 원천 데이터)
- `docs/pitch.md` — 기획력·발전성 설득 근거 데이터 (기능설명서 배경·발전방향, 2차 발표 스크립트의 원천)
- `docs/deploy.md` — Cloudflare Pages/Workers 프로덕션 배포 절차 (사람 체크리스트 + GitHub Actions 연동)
- `docs/(양식1)…제안서_Spindule(이진우).pdf` — 최초 제안서 원문 (전국형)

## 작업 시 유의

- 우선순위는 SPEC.md 10장을 따른다: MVP(스핀→8방위→추천→결과 카드→공유 카드, 여행 모드)가 끝나기 전에 2순위(방향 기반 여행 코스·테마 덱·축제 카드·도장깨기)를 시작하지 않는다.
- 심사위원은 서울에서 URL만 열어 시연한다 → **여행 모드(센서 불필요)가 항상 완전 동작해야 한다.**
- iOS Safari가 1차 검증 대상 (DeviceOrientation 권한 프롬프트, `webkitCompassHeading`).
- 여러 에이전트가 이 저장소에서 작업한다: 작업 단위마다 커밋하고, 커밋되지 않은 다른 에이전트의 변경(git status 확인)이 있으면 해당 파일은 건드리지 않는다.
