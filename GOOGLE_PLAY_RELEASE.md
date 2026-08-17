# Spindle Google Play 출시 인계 문서

> 다음 세션에서 Google Play 등록 또는 Doply 비공개 테스트를 진행하기 전에 이 문서를 먼저 읽는다.
>
> 마지막 갱신: 2026-08-17 (Asia/Seoul)

## 0. 지금 상황 요약 (2026-08-17)

**개발자 계정 인증 완료. 개인정보처리방침 배포 완료. 선행 블로커 없음.**
이제 앱 생성 → 비공개 테스트 → 프로덕션 액세스 순으로 바로 진행할 수 있다.

### 해소된 블로커 — privacy.html 프로덕션 배포 (2026-08-17)

원인은 `privacy.html`이 든 커밋(`0828094`)이 `origin/main`에 푸시되지 않아 CI가 돌지 않은 것이었다.
로컬 `main`이 `origin/main`보다 5커밋 앞서 있었다. `git push origin main:main`으로 해소했다.

| | |
|---|---|
| 배포 실행 | 2026-08-17, GitHub Actions run `31993780857` — check·web·proxy 3잡 전부 성공 |
| 배포된 `main` | `4eaa7a5` (`95ddb8b..4eaa7a5`, 5커밋) |
| 검증 | `https://spindle-6vp.pages.dev/privacy` → 200, 6,275B, 정책 본문 확인 |
| 배포 방식 | `main`에 push → GitHub Actions(`.github/workflows/deploy.yml`)가 자동 배포 |

**⚠ Play Console에 넣을 URL은 `https://spindle-6vp.pages.dev/privacy` (`.html` 없이).**
Cloudflare Pages가 `.html`을 벗겨 `/privacy`로 308 리다이렉트한다. `.html`도 결국 도달하지만
심사에는 리다이렉트 없이 200을 주는 쪽을 쓴다. 앱 내부 링크(`SettingsScreen`)는 `/privacy.html`
그대로 유지한다 — Capacitor WebView는 로컬 파일을 직접 열기 때문에 실제 파일명이 필요하다.

작업 브랜치 `feat/session-catalog`의 엔진 관련 커밋 2개와 미커밋 변경은 이 배포에 포함되지 않았다.

### 마감 역산 일정 (공모전 마감 2026-09-21 16:00)

| 시점 | 할 일 | 비고 |
|---|---|---|
| 8/16~8/17 | privacy.html 배포, 앱 생성, 스토어 등록정보·콘텐츠 등급·데이터 안전·타겟층 입력, 비공개 트랙에 AAB 게시 | 자산은 모두 준비 완료 |
| ~8/20 | 비공개 출시 검토 통과 → Doply 결제 후 테스트 시작 | 신규 계정 첫 출시 검토에 며칠 걸릴 수 있음 |
| 8/20 ~ 9/3 | **12명 이상 14일 연속** opt-in 유지 | 이 14일은 단축 불가 |
| 9/5 전후 | 프로덕션 액세스 신청 (15~16일째 확인 후) | |
| 9/8 ~ 9/19 | 프로덕션 액세스 심사 → 프로덕션 출시 → 출시 검토 | **가장 큰 변수. 신규 개인 계정은 더 걸리기도 한다** |

**결론: 마감 내 프로덕션 공개는 가능하지만 보장되지 않는다.**
공모전은 이미 **웹 URL 단독으로 제출 준비가 끝나 있고**(`presentation/`), 규정상 웹은 스토어 등록이 불필요하다.
따라서 Play 등록은 실패해도 공모전에 손해가 없는 **병행 과제**로 진행한다.
9/7까지 프로덕션 공개가 확정되면 콘텐츠랩 제출을 `웹, 앱`으로 수정하고 기능설명서 2장도 함께 고친다.

## 1. 확정된 결정

- Google Play의 신규 개인 개발자 계정 비공개 테스트는 **Doply**를 사용한다.
- 서비스 URL: <https://www.doply.io/ko>
- 확인한 첫 이용 표시 가격: **USD 6.99**. 실제 청구 금액과 조건은 결제 화면에서 다시 확인한다.
- Doply에는 테스터 참여에 필요한 정보만 제공한다. Play Console 권한이나 서명 자격은 제공하지 않는다.
- Google의 기준은 최소 12명이 14일 연속 비공개 테스트에 opt-in하는 것이다. Doply의 표시 기간이 더 길더라도 Google Play Console 대시보드의 충족 상태를 최종 기준으로 삼는다.

## 2. 현재 상태

- [x] 서명된 릴리스 AAB 생성 — **2026-08-17 재빌드본을 올린다**
  - 파일: `web/android/spindle-1.0-vc2-release.aab`
  - versionCode: `2` / versionName: `1.0`
  - 크기: 8,497,606 bytes
  - `jarsigner -verify`: `jar verified.`
  - 빌드 기준: `main` `c1d15bc` (웹 배포본과 동일 코드)
  - ⚠ `superseded-do-not-upload_spindle-1.0-vc1.aab`(8/14 빌드)는 올리지 않는다 —
    출처 표기 정리·설정 문구 변경·현 위치 출발점이 빠져 있어 웹과 어긋난다
- [x] 릴리스 키스토어와 설정 파일이 Git에서 제외됨
  - `web/android/spindle-release.jks`
  - `web/android/keystore.properties`
- [x] AAB도 Git에서 제외됨
- [x] 비공개 테스트 서비스는 Doply로 결정
- [x] **실제 Android 휴대기기 인증 완료** (2026-08-16, 사용자 확인)
- [x] **Play 등록 자산 규격 검증·수정 완료** (2026-08-16)
  - 휴대전화 스크린샷 **5장**: 1080×1920 (9:16). 기존 1080×2400은 Play 규정
    "최대 변은 최소 변의 2배를 넘을 수 없다"(2400 > 2160) 위반이라 **업로드 거부 대상**이었다.
    `tools/play-screenshots.py`가 원본을 자르지 않고 1080×1920 캔버스에 맞춰 재생성한다.
  - 피처 그래픽 1024×500: RGBA → **RGB로 변환**(Play는 피처 그래픽에 알파 채널 금지)
  - 앱 아이콘 512×512 RGBA: 규격 그대로 유지(아이콘은 알파 필요)
  - 텍스트 메타데이터 길이 확인: 제목 7/30, 짧은 설명 33/80, 자세한 설명 372/4000, 변경사항 48/500
- [x] **`privacy.html` 프로덕션 배포 완료** (2026-08-17) — `https://spindle-6vp.pages.dev/privacy` 200 확인
- [x] **Spindle 앱 생성 완료** (2026-08-17, 사용자 확인)
- [ ] ⚠ `5_settings.png` 재캡처 — **선택**. 안 할 거면 스크린샷 1~4번만 올린다
      (2026-08-17 UI 변경으로 실제 화면과 다름. 사람만 할 수 있는 작업)
- [ ] 필수 앱 콘텐츠 설문 입력 (`docs/play-console-입력값.md` 2절)
- [ ] 스토어 등록정보 입력 (문안·아이콘·그래픽 이미지·스크린샷)
- [ ] Doply 테스터 목록을 비공개 트랙에 등록
- [ ] 서명된 AAB를 비공개 트랙에 게시
- [ ] Doply 테스트 시작
- [ ] 12명 이상, 14일 연속 요건 충족
- [ ] 프로덕션 액세스 신청

### 현재 바로 해야 할 일 (2026-08-17 기준)

앱 생성까지 끝났고, 업로드할 산출물은 전부 준비돼 있다. 남은 것은 Play Console 입력뿐이다.

1. 대시보드 → **앱 설정** 태스크를 `docs/play-console-입력값.md` 2절대로 채운다.
2. **스토어 등록정보**: 문안 + 아이콘 + 그래픽 이미지 + **스크린샷 1~4번**
   (5_settings는 앱과 어긋나 있다 — 같은 문서 1절의 경고 참고).
   태블릿 슬롯도 필수다 — `sevenInchScreenshots/`·`tenInchScreenshots/`에 4장씩 준비돼 있다.
3. **비공개 테스트 트랙**에 `web/android/spindle-1.0-vc2-release.aab`를 올린다.
4. 그다음은 3절 B(Doply 테스터) → D(설치 가능 확인 후 결제) 순서.

사람만 할 수 있어 남겨둔 것: 설정 화면 실기기 재캡처(선택), Doply 결제, Play Console 입력.

배포본을 다시 검증해야 할 때:

```bash
curl -sL -o /dev/null -w "%{url_effective} %{http_code} %{size_download}\n" \
  https://spindle-6vp.pages.dev/privacy
# https://spindle-6vp.pages.dev/privacy 200 6275 가 나와야 한다
```

## 3. 등록 및 비공개 테스트 절차

### A. Play Console 개발자 계정과 앱 설정

1. 실제 Android 휴대폰으로 위 기기 인증을 완료한다.
2. Play Console 홈에 남은 개발자 계정 필수 작업을 모두 완료한다.
3. Spindle 앱을 만들거나 기존 앱을 선택한다.
4. 패키지명이 `kr.spindle.app`인지 확인한다.
5. 스토어 등록정보, 앱 액세스, 광고, 콘텐츠 등급, 타겟층, 개인정보처리방침, 데이터 안전 등 필수 항목을 완료한다.
6. 문안과 설문 판단 근거는 `docs/store-listing.md` 및 `fastlane/metadata/android/ko-KR/`를 사용한다.

업로드할 자산은 전부 규격 검증을 마쳤다(2절 참고).

**화면 순서대로 복사·붙여넣을 값은 `docs/play-console-입력값.md`에 정리해 뒀다.**
스토어 등록정보 문안, 앱 액세스·광고·콘텐츠 등급·타겟층 설문 답, 데이터 안전 답변표,
비공개 출시 노트, 프로덕션 액세스 신청서 항목까지 그 문서 하나로 끝난다.

### B. Doply 테스터 목록 등록

1. Doply 한국어 사이트에 로그인한다.
2. 대시보드에서 Spindle을 새 앱으로 등록한다.
3. Doply가 제공하는 테스터 이메일 CSV를 다운로드한다.
4. Play Console에서 `테스트 및 출시 > 테스트 > 비공개 테스트 > 트랙 관리 > 테스터`로 이동한다.
5. 이메일 목록 `doply-spindle`을 만들고 Doply CSV를 업로드한다.
6. 생성한 목록을 현재 비공개 트랙의 테스터로 선택한다.
7. 본인이 관리하는 피드백 이메일 또는 URL을 입력하고 저장한다.

CSV 업로드는 같은 목록의 기존 주소를 덮어쓸 수 있다. 지인 테스터는 별도 이메일 목록으로 관리하거나 업로드 전 CSV에 포함한다.

### C. 비공개 트랙에 AAB 게시

1. 비공개 테스트 트랙에서 새 출시를 만든다.
2. `web/android/spindle-1.0-vc2-release.aab`를 직접 Play Console에 업로드한다.
   2026-08-17에 `main` `c1d15bc` 기준으로 재빌드한 versionCode 2 번들이며, 서명·패키지명·
   번들된 웹 자산 내용까지 검증했다. 8/14 빌드(vc1)는 웹 배포본과 어긋나므로 올리지 않는다.

   다시 빌드해야 할 때 (web 코드가 바뀐 뒤):

   ```bash
   cd web && npm run build:app && npx cap sync android
   cd android && ./gradlew bundleRelease
   # 산출물: web/android/app/build/outputs/bundle/release/app-release.aab
   ```

   `web/.env.local`(카카오 JS 키)과 `web/android/keystore.properties`가 있어야 하며 둘 다
   git에서 제외돼 있다. 코드가 바뀌면 `versionCode`를 반드시 올린다.
3. 출시 이름 예시: `Spindle 1.0 비공개 테스트`
4. 출시 노트 예시:

   > Spindle 1.0 첫 비공개 테스트 버전입니다. 위치 기반 부산 관광 스핀 기능과 관광지 탐색 기능을 테스트합니다.

5. 오류와 경고를 검토한 뒤 비공개 테스트로 출시하거나 검토를 위해 변경사항을 전송한다.
6. 상태가 `초안` 또는 `검토 중`이 아니라 `게시됨`, `사용 가능` 또는 이에 준하는 활성 상태가 될 때까지 기다린다.
7. 첫 테스트 링크 활성화에는 몇 시간이 걸릴 수 있다.

### D. Doply에서 설치 가능 여부 확인 후 결제

1. Play Console 비공개 트랙의 `테스터` 탭에서 Android 참여 링크를 복사한다.
2. 링크는 보통 `https://play.google.com/apps/testing/kr.spindle.app` 형태다. 화면에 표시된 실제 링크를 사용한다.
3. Doply의 Spindle 설정에 참여 링크를 입력한다.
4. Doply의 설치 가능 여부 검사를 실행한다.
5. 최소 12대 이상이 설치 가능한 상태인지 확인한다.
6. 설치 가능 기기가 부족하면 아래 항목을 확인한다.
   - `doply-spindle` 목록이 비공개 트랙에 선택되어 있는가
   - 변경사항을 저장했는가
   - 비공개 출시가 게시 완료됐는가
   - 국가/지역 제한이 Doply 기기를 막고 있지 않은가
   - 내부 테스트 링크가 아니라 비공개 테스트 참여 링크인가
7. 설치 가능 상태를 확인한 뒤에만 첫 이용가 USD 6.99 결제를 진행한다.
8. Doply에서 테스트 시작을 누른다.

### E. 테스트 기간 운영

1. Doply 대시보드에서 첫날 설치 기기가 12대 이상인지 확인한다.
2. 매일 설치 유지, 실행 기록, 스크린샷, 업데이트 상태와 중도 이탈을 확인한다.
3. 테스트 중 다음 항목을 변경하거나 중지하지 않는다.
   - 비공개 트랙 일시중지
   - `doply-spindle` 목록 삭제 또는 해제
   - 참여 국가 제거
   - 패키지명 변경
   - 서명키 변경
4. 실제 지인 2~3명 이상에게 위치 권한, 스핀, 센서 방향, POI 선택을 실기기에서 테스트하도록 요청한다.
5. Play Console 비공개 의견 또는 별도 기록으로 실제 피드백을 남긴다.
6. 피드백을 반영해 업데이트할 경우 versionCode를 `2`, `3`처럼 증가시키고 같은 릴리스 키로 서명한다.
7. 단순히 업데이트 횟수를 채우기 위해 내용이 동일한 번들을 반복 제출하지 않는다.

### F. 프로덕션 액세스 신청

1. 최소 12명이 14일 연속 opt-in한 상태인지 Play Console 대시보드에서 확인한다.
2. 정확히 14일이 되는 순간보다 15~16일째 확인 후 신청하는 편이 안전하다.
3. `대시보드 > 프로덕션 액세스 신청`으로 이동한다.
4. 다음 내용을 실제 테스트 기록에 맞춰 작성한다.
   - 테스터 모집 방식
   - 사용한 주요 기능
   - 받은 피드백
   - 피드백을 반영한 변경사항
   - 프로덕션 준비가 됐다고 판단한 근거
5. 승인 결과가 나올 때까지 비공개 트랙과 테스터 목록을 유지한다.

## 4. 보안 금지사항

Doply 또는 다른 제3자에게 아래 파일과 권한을 절대 제공하지 않는다.

- `web/android/spindle-release.jks`
- `web/android/keystore.properties`
- 키스토어 비밀번호 또는 키 별칭 비밀번호
- Play Console 로그인 비밀번호
- Play Console 사용자 또는 관리자 권한
- Google Play Developer API 서비스 계정 JSON

AAB 업로드는 프로젝트 소유자가 Play Console에서 직접 수행한다. Doply에는 테스터 CSV 등록에 필요한 흐름과 비공개 테스트 참여 링크만 사용한다.

릴리스 키스토어와 `keystore.properties`는 OneDrive 외의 별도 저장소에도 백업한다. OneDrive 동기화는 삭제도 동기화되므로 단독 백업으로 보지 않는다.

## 5. 다음 세션 시작 체크포인트

기기 인증과 자산 준비는 끝났다. 다음 세션은 사용자에게 아래를 먼저 확인한다.

1. Spindle 앱 생성과 필수 앱 콘텐츠 설정이 어디까지 완료됐는가 (`docs/play-console-입력값.md` 기준)
2. 비공개 트랙에 AAB를 게시했는가 / Doply 테스트를 시작했다면 며칠째인가
3. (회귀 확인) `curl -sL .../privacy` 가 여전히 정책 본문 200을 주는가

완료 상태에 따라 2절 체크박스를 갱신하고, 아직 하지 않은 첫 단계부터 이어간다.
테스트가 진행 중이라면 **14일 연속 카운터가 끊기지 않았는지**(3절 E의 금지 항목)를 함께 확인한다.

## 6. 참고 링크

- Doply 한국어: <https://www.doply.io/ko>
- Google Play Console: <https://play.google.com/console/>
- Google 실제 Android 기기 인증: <https://support.google.com/googleplay/android-developer/answer/14316361?hl=ko>
- Google 비공개 테스트 설정: <https://support.google.com/googleplay/android-developer/answer/9845334?hl=ko>
- Google 신규 개인 계정 테스트 요건: <https://support.google.com/googleplay/android-developer/answer/14151465?hl=ko>
