# Spindle App Store 출시 인계 문서

> iOS 배포를 진행하기 전에 이 문서를 먼저 읽는다. Google Play 쪽은 `GOOGLE_PLAY_RELEASE.md`에 있다.
>
> 마지막 갱신: 2026-09-06 (Asia/Seoul)

## 0. 지금 상황 요약

**저장소 쪽 iOS 파이프라인과 첫 출시가 완료됐다. 앱은 2026-09-06 App Store에 공개됐다.**

개발 머신이 Windows라 iOS 아카이브·업로드를 로컬에서 할 수 없다. 그래서 빌드는
**GitHub Actions의 macOS 러너**에서 돌리고, 서명은 **App Store Connect API 키를 이용한
클라우드 서명**으로 처리한다. 인증서 `.p12`를 만들어 러너에 설치하거나 `fastlane match`
저장소를 따로 두지 않아도 된다 — Xcode가 API 키로 배포 인증서와 프로비저닝 프로파일을
직접 발급한다.

### 이미 되어 있는 것 (커밋됨)

| | |
|---|---|
| 네이티브 셸 | `web/ios/` Capacitor 8 (SPM 방식 — CocoaPods 불필요) |
| Bundle ID | `kr.spindle.app` (Android와 동일) |
| 권한 문구 | `Info.plist`에 위치·모션 사용 목적 한국어로 기재 완료 |
| 수출 규정 | `ITSAppUsesNonExemptEncryption = false` 기재 완료 |
| 개인정보 매니페스트 | `PrivacyInfo.xcprivacy` (수집·추적 없음) |
| 공유 scheme | `App.xcscheme` — CI가 `xcodebuild -scheme App`을 쓰므로 커밋 필요 |
| 릴리스 파이프라인 | `fastlane/Fastfile` — `build` / `beta` / `release` / `metadata` 레인 |
| CI | `.github/workflows/ios-release.yml` (수동 실행 전용) |
| 스토어 등록정보 | `fastlane/metadata/ios/ko/` — 이름·부제·설명·키워드·심사 노트 |
| 지원 페이지 | `web/public/support.html` → `https://spindle-6vp.pages.dev/support` |
| 스크린샷 | `fastlane/screenshots/ios/ko/` 5장 (1320x2868, RGB, **iOS 상태바**). `npm run capture:ios && npm run export:ios`로 재생성. ⚠ 1.0.6 이전 UI라 결과 카드 지도가 없다 |
| 버전 관리 | ⚠ 저장소에 현재 버전이 없다 — fastlane이 워크플로 입력값으로 주입한다. 0절 "버전 이력" 참조 |

### 출시 완료 상태

~~1. Bundle ID 등록~~ · ~~2. 앱 레코드 생성~~ · ~~3. API 키 발급~~ · ~~4. GitHub secrets 4개~~
— **2026-09-02 완료.** TestFlight 업로드까지 검증했다(0절 "실행 기록").

- **2026-09-02:** `release` 레인이 `submit:false`로 성공했다
  (Actions run `33607578270`, 커밋 `0245b6c`). 바이너리·메타데이터·스크린샷을 업로드했고
  precheck 9개 항목을 통과했다.
- **2026-09-06:** App Store 공개 완료 — 버전 1.0.0, 무료, 4+.
  <https://apps.apple.com/kr/app/spindle/id6807658917>
- **2026-09-09:** **1.1.0 심사 제출 완료** (run `34357709903`, 빌드 19, `ab5235b`).
  `submit` 레인으로 빌드 없이 제출했다 — 스크린샷 5장 교체(업로드 처리 10분), precheck
  무경고 통과, **승인 시 자동 공개**. 더 사람이 누를 것은 없다. 같은 날 TestFlight 빌드 19는
  run `34324537761`로 올렸고 사용자가 실기기 점검을 마쳤다.
- **2026-09-08:** **1.0.9 심사 제출 완료** (run `34138405530`, 빌드 17, `971e9d0`).
  `submit` 레인으로 빌드 없이 제출했다 — precheck 무경고 통과, 스크린샷 5장 교체(기존 중복
  일괄 삭제 후 업로드), **승인 시 자동 공개**로 설정. 더 사람이 누를 것은 없다.

### 버전 이력

> ⚠ **저장소에는 현재 버전이 기록되지 않는다.** `project.pbxproj`의 `MARKETING_VERSION = 1.0`은
> 자리표시자이고, fastlane이 워크플로 입력값(`version`)으로 덮어쓴다(`Fastfile:110`
> `resolve_marketing_version`). 그래서 코드만 보고는 다음 버전 번호를 알 수 없다.
> **다음 번호를 정할 때는 이 표의 마지막 행이나 App Store Connect를 본다.**
> 빌드 번호(`CFBundleVersion`)는 TestFlight 최신값 +1로 자동 결정되므로 사람이 정하지 않는다.
>
> 이 표는 `beta`/`release` 레인을 돌릴 때마다 갱신한다. run 목록에서 버전을 다시 뽑으려면:
> ```bash
> gh run list --workflow ios-release.yml --limit 30 --json databaseId,headSha,conclusion,createdAt
> gh api repos/enderpawar/Spindle/actions/runs/<id>/jobs --jq '.jobs[0].name'   # "iOS beta (v1.0.6)"
> ```
> (`gh`는 `C:\Program Files\GitHub CLI\gh.exe`에 있고 PATH에는 없다)

| 버전 | 날짜 | 커밋 | Actions run | 이 빌드에 들어간 것 |
|---|---|---|---|---|
| 1.0.0 | 2026-09-02 | `0245b6c` | `33607578270` (release) | 최초 출시. 9/06 App Store 공개 |
| 1.0.1 | 2026-09-06 | `0648f11` | `34027088099` | 네이티브 흔들기 스핀 권한, 이미지 폴백 병렬화·워밍업 레이스 제거, 프록시 타임아웃 |
| 1.0.2 | 2026-09-06 | `af20a0f` | `34028551285` | 명소 지도에 카페·음식점 합류, 골목시장/먹거리 테마 분리, 탭 없이 흔들기 |
| 1.0.3 | 2026-09-06 | `39496d0` | `34029482381` | 앱 최초 제스처에서 모션 권한 취득 (0절 "1.0.2 권한 거부 상시 표시" 대응) |
| 1.0.4 | 2026-09-06 | `9211595` | `34032195306` | 먹거리 덱 실시간 카페, 프록시 업스트림 재시도. 아카이브 서명 고정 시도는 되돌림 |
| 1.0.5 | 2026-09-06 | `622ede9` | `34035207845` | 명소 탭 음식점·카페 필터, 썸네일 `firstimage2`, 네이티브 롱프레스 차단 |
| 1.0.6 | 2026-09-07 | `be13370` | `34119346051` | 명소 종류 탭·테마 히어로·사진 뷰어 리프레시, TourAPI 이미지 재시도, 이미지 없는 명소 7곳 제외 |
| 1.0.7 | 2026-09-07 | `1e043a3` | `34128533160` (빌드 15) | 홈 미션 카드 복원, 결과 카드 위치 지도(탭 잠금 해제), **운영 원문 예열을 스핀 후보 시점으로 이전 — 세션당 `detailIntro2` 54회→5~7회**. ⚠ **폐기** — 실기기에서 스핀 버튼 롱프레스 시 iOS Live Text 모서리 브래킷이 뜨는 것을 발견 |
| 1.0.8 | 2026-09-07 | `2ea428d` | `34131237553` (빌드 16) | `main` 머지 후 첫 빌드 — 이 시점부터 웹 프로덕션도 같은 코드다. 장식용 이미지를 히트 테스트에서 제외(`0a0b960`). ⚠ **브래킷은 안 잡혔다** — 실기기에서 스핀 버튼 탭 시 여전히 발생 |
| 1.0.9 | 2026-09-07 | `ee2031a` | `34133375267` (빌드 17) | **스핀 버튼의 `<img>`를 CSS 배경으로 교체.** 브래킷이 32px 이미지 박스의 네 꼭짓점에 맞았고 `pointer-events: none`으로도 안 막혔다 → 히트 테스트가 아니라 **렌더 시점 이미지 분석**이다. WebKit은 CSS 배경을 분석하지 않으므로 `<img>` 요소를 없애 원인을 제거했다. 첫 시도(`34132974977`)는 Development 인증서 한도 초과로 실패 — 0절 "반복되는 실패" 참조 |
| 1.1.0 | 2026-09-09 | `ab5235b` | `34324537761` (빌드 19) | **UI 폴리시 묶음.** 개인정보 시트·결과 카드 방문정보 스켈레톤·테마 아이콘 정리, 홈 배경을 앰비언트 층으로 교체하고 추천 여행지 패널 테두리를 걷어냈다. 프록시 재시도 로직 정리 포함. 같은 1.1.0의 빌드 18(`34306295893`, 커밋 `5125129`)은 홈 폴리시 이전 시점이라 **빌드 19를 쓴다**. 빌드 18 직전 시도(`34306055948`)는 Development 인증서 한도로 실패했고, 인증서를 정리한 뒤로는 재발하지 않았다 |
| 1.1.1 | 2026-09-11 | `236bd1a` | `34550042344` (빌드 20, TestFlight) | **좁은 폰에서 390px 배치 유지** (#20) — 세로에서 짧은 변 390 미만이면 viewport를 `width=390`으로 고정해 축소. iPhone 디스플레이 확대 모드(320px)에서 명소 부제목·지역 선택이 줄바꿈되던 문제. 1.1.0이 9/10 공개돼 번호를 올렸다. 첫 시도는 Development 인증서 한도로 실패 → 사용자가 폐기 후 같은 run 재실행(attempt 2)으로 통과. **확대 모드 실기기 확인 대기**(safe-area 여백·지도 핀 터치) |
| 1.1.1 | 2026-09-11 | `388d994` | `34551491443` (빌드 21, TestFlight) | 빌드 20 실기기 확인에서 나온 두 건 (#21) — 지역 드롭다운이 혼잡 카드에 가려지던 쌓임 순서(지도 래퍼 `isolation: isolate`), 축소 배율에서 iOS 텍스트 자동 확대로 명소 시트 글자가 들쭉날쭉 커지던 것(`text-size-adjust: 100%`). 인증서 한도에 걸리지 않았다. **빌드 21을 쓴다** |

1.0.1~1.0.7은 `fix/tourapi-image-warmup` 브랜치에서 dispatch했다. `main`이 `0245b6c`(9/02)에서
멈춰 있었기 때문이다. **2026-09-07 `cf49159`로 머지·배포를 마쳤으므로 1.0.8부터는 `main`에서
돌린다** — 브랜치를 바꿔야 하는 함정이 없어졌다.

### 2026-09-02 실행 기록 — 파이프라인이 TestFlight까지 완주했다

첫 실행부터 다섯 번 막혔고 전부 해소했다. **여기 적힌 것들은 문서를 읽는 것만으로는
알 수 없고 실제로 돌려야 드러난 것들이라, 재현 조건과 함께 남긴다.**

| # | 막힌 지점 | 원인 | 해소 |
|---|---|---|---|
| 1 | 워크플로 4번째 스텝, 11초 | `.ruby-version`·`.tool-versions`가 없어 `setup-ruby`가 버전을 못 정함 | `RUBY_VERSION: "3.3"` 을 `env`에 명시 (PR #8) |
| 2 | `fastlane build` 진입 직후 | Apple secrets 4개 미등록 | 2절 C·D 수행 |
| 3 | `build_app`, 36초 | Capacitor 템플릿이 **프로젝트 레벨**에 `CODE_SIGN_IDENTITY`를 박아둠. 타깃은 `CODE_SIGN_STYLE = Automatic` → 충돌 | 프로젝트 레벨 두 줄 제거 (PR #9) |
| 4 | 프로파일 발급, 63초 | 팀에 등록된 기기 0대 → Apple이 개발용 프로파일 발급 거부 | 개발자 포털에 iPhone 1대 등록 |
| 5 | **업로드 검증(409)** | `macos-15`의 Xcode 16.4 = iOS 18.5 SDK. Apple이 **iOS 26 SDK 이상**을 요구 | 러너를 `macos-26`으로 (PR #10) |

**5번이 특히 함정이다.** 빌드·서명·프로비저닝이 전부 성공하고 IPA까지 정상 생성된 뒤,
Apple 서버가 업로드 시점에만 SDK를 본다. 즉 `build` 레인은 아무리 돌려도 이 문제를
발견하지 못한다. 그래서 워크플로의 "Show toolchain versions" 스텝에 SDK 버전과 설치된
Xcode 목록을 찍게 해 뒀다 — Apple이 요구 SDK를 또 올리면 40분짜리 빌드가 아니라
첫 10초에 드러난다.

**4번은 자동 서명의 구조 때문이다.** 아카이브는 항상 Development 인증서로 서명하고
배포용 서명은 export 때 다시 입힌다. 그래서 App Store 빌드인데도 개발용 프로파일이
필요하고, 개발용 프로파일은 기기가 최소 1대 등록돼 있어야 발급된다.

#### ⚠ 반복되는 실패 — Development 인증서 한도 초과 (2026-09-07, 빌드 17)

같은 구조 때문에 **일정 횟수마다 반드시 재발한다.** CI 러너는 매번 새 머신이라 키체인이
비어 있고, 클라우드 서명은 재사용할 개인키를 못 찾아 **빌드마다 새 Apple Development
인증서를 발급한다.** 계정 한도에 닿으면 이렇게 죽는다:

```
error: Choose a certificate to revoke. Your account has reached the
       maximum number of certificates.
error: No profiles for 'kr.spindle.app' were found: Xcode couldn't find any
       iOS App Development provisioning profiles matching 'kr.spindle.app'.
```

두 번째 줄이 먼저 눈에 띄지만 **원인은 첫 줄이다.** 인증서를 못 만들어 프로파일도 못 만든 것이라
프로파일이나 기기 등록을 손대면 시간만 버린다. `build_app`이 약 40초에 죽는다.

**해소**: <https://developer.apple.com/account/resources/certificates/list> 에서
**`Apple Development` 타입만** 폐기(Revoke)한다. 오래된 것부터, 사실상 전부 지워도 된다 —
다음 빌드가 새로 발급한다. **`Apple Distribution`은 건드리지 않는다.**
(2026-09-07: 빌드 17에서 발생, 폐기 후 같은 커밋으로 재실행해 통과)

**이번 릴리스에서 쓴 우회** (2026-09-08): 심사 제출에는 새 빌드가 필요 없다. `beta` 레인이
올린 빌드가 이미 App Store Connect에 있으므로, **`submit` 레인**(`skip_binary_upload: true` +
`build_number`)으로 그 빌드를 지정해 제출하면 아카이브를 만들지 않아 인증서를 쓰지 않는다.
바이너리가 바뀌지 않는 재제출·메타데이터 수정에는 `release` 대신 이쪽을 쓴다.

**근본 해결 후보** (마감 뒤에 판단):
1. Development 인증서와 개인키를 `.p12`로 내보내 GitHub secret에 넣고 빌드 전 러너 키체인에
   설치 → 클라우드 서명이 재사용한다. `fastlane match`가 하는 일을 수동으로 하는 것.
2. 아카이브를 배포용 인증서로 직접 서명 — `40f5ea2`에서 시도했다가 `9211595`로 되돌렸다.
   재검토하려면 그 두 커밋을 먼저 읽는다.

#### 실기기(TestFlight)에서만 드러난 것

| 증상 | 원인 | 해소 |
|---|---|---|
| 하단 내비게이션이 59px 떠 있고 아래가 흰 띠 | `mobile-pwa.css`의 `#root`가 `bottom` 없이 높이에서 상단 inset을 뺌. 설치형 PWA용 보정인데 WKWebView에는 전제가 성립하지 않음 | 네이티브 셸에서만 뷰포트 양 끝에 고정 (PR #11) |
| 카카오 베이스맵이 안 뜨고 자체 벡터 지도로 폴백 | 카카오 서버가 커스텀 스킴 Referer의 호스트를 파싱 못 함 — `capacitor://localhost/`를 `caller=capacitor:`로 읽고 401. **콘솔에 등록해도 통과 불가** | 네이티브에서만 Referer 전송 차단 (PR #12) |
| TestFlight 1.0.1에서 탭 전에는 흔들기 이벤트가 없고, 탭하면 권한 팝업 없이 활성화 | WKWebView는 `DeviceMotionEvent.requestPermission()` 호출 전에는 이벤트를 주지 않고, 유효한 제스처 안에서 호출하면 팝업 없이 `granted` 반환 | C6의 스핀 화면 첫 조작 폴백으로 동작 확인 |
| TestFlight 1.0.2에서 모션 권한 거부 안내가 상시 표시 | C7이 사용자 제스처 밖에서 권한 함수를 호출해 거부됐고, 예외를 세션 `denied`로 잘못 확정 | 예외는 재시도 가능 상태로 남기고 네이티브 앱 최초 `pointerup`에서 미리 요청 (C9) |

카카오 건은 앱에 담긴 키로 Referer만 바꿔 요청해 확정했다. Referer가 없으면 200이고,
대조군 `https://example.com`은 `caller=https://example.com`으로 온전히 파싱된다.
**등록 누락이 아니라 카카오 쪽 파싱 한계**이므로, 콘솔에서 해결하려 하면 시간만 버린다.

스크린샷은 익스포트해서 커밋해 뒀다(3절). 이전에 남아 있던 두 가지 문제
(Android 상태바, 카피 없는 스플래시가 첫 장)는 2026-09-02에 해결했다.

### 일정 감각

공모전 마감은 2026-09-21 16:00이다. **App Store 심사는 보통 24~48시간**이라
Play의 프로덕션 액세스(신규 개인 계정 기준 수 주)와 비교가 안 되게 빠르다.
Play가 마감 내 공개를 보장하지 못하는 상황이므로, **iOS 쪽이 먼저 공개될 가능성이 높다.**
지금 시작하면 여유가 충분하다.

---

## 1. 확정된 결정

- **빌드 환경은 GitHub Actions `macos-26` 러너.** 로컬 Mac을 쓰지 않는다.
  버전을 고정하는 이유는 재현성이고, **내리면 안 된다** — Apple이 iOS 26 SDK 이상으로
  빌드한 바이너리만 받는다(0절 실행 기록 5번).
- **서명은 App Store Connect API 키 기반 클라우드 서명**(`-allowProvisioningUpdates`).
  `fastlane match`를 쓰지 않으므로 인증서 보관용 비공개 저장소가 필요 없다.
- **자동 배포하지 않는다.** `deploy.yml`(웹·프록시)은 main push마다 돌지만, iOS는
  `workflow_dispatch` 전용이다. macOS 러너 과금이 ubuntu의 10배이고 스토어 업로드는
  되돌리기 어렵기 때문이다.
- **심사 제출은 옵트인.** `release` 레인은 기본적으로 업로드까지만 하고, `submit:true`를
  명시해야 심사에 넣는다. 승인 후 공개도 자동으로 하지 않는다(`automatic_release: false`).
- **iPhone 전용.** `TARGETED_DEVICE_FAMILY = 1`을 유지한다. iPad를 지원 기기에 넣는 순간
  iPad 스크린샷이 필수가 되고 레이아웃 검증 부담이 생긴다.

### ⚠ Windows에서 `cap sync ios`를 돌린 결과를 커밋하지 않는다

`npm run app:sync:ios`는 Windows에서도 실행되지만, Capacitor CLI가
`web/ios/App/CapApp-SPM/Package.swift`의 플러그인 경로를 **OS 구분자로 쓴다.**
Windows에서 돌리면 이렇게 나온다:

```swift
.package(name: "CapacitorApp", path: "..\..\..\node_modules\@capacitor\app")
```

Swift 문자열에서 `\.`은 잘못된 이스케이프라 **macOS에서 컴파일되지 않는다.**
로컬에서 동기화를 돌려봤다면 커밋 전에 반드시 확인한다:

```bash
git diff web/ios/App/CapApp-SPM/Package.swift   # 백슬래시가 보이면 되돌린다
git checkout web/ios/App/CapApp-SPM/Package.swift
```

CI는 macOS 러너에서 `cap sync ios`를 다시 돌리므로 이 파일을 알아서 올바르게 재생성한다.
저장소에 커밋된 버전은 슬래시 경로이고 `@capacitor/app`·`filesystem`·`share` 3개가 모두 들어 있다.

---

## 2. 사람이 해야 하는 준비

### A. Bundle ID 등록

<https://developer.apple.com/account/resources/identifiers/list>

1. **Identifiers** → **+**
2. **App IDs** → Continue → **App** → Continue
3. 입력:
   - Description: `Spindle`
   - Bundle ID: **Explicit**, `kr.spindle.app`
4. Capabilities는 **아무것도 켜지 않는다.** 푸시 알림, Sign in with Apple,
   백그라운드 모드 모두 쓰지 않는다. 불필요한 capability는 심사 질의만 늘린다.
5. Continue → Register

### B. App Store Connect 앱 레코드 생성

<https://appstoreconnect.apple.com/apps>

**+** → **신규 앱**

| 항목 | 값 |
|---|---|
| 플랫폼 | iOS |
| 이름 | `Spindle` |
| 기본 언어 | 한국어 |
| 번들 ID | `kr.spindle.app` (A에서 등록한 것이 목록에 뜬다) |
| SKU | `spindle-ios` (외부에 노출되지 않는 내부 식별자, 아무 값이나 고유하면 된다) |
| 사용자 액세스 | 전체 액세스 |

> ⚠ **앱 이름은 App Store 전체에서 고유해야 한다.** "Spindle"은 흔한 단어라
> 이미 선점돼 있을 수 있다. 거부되면 `Spindle - 부산 방향 여행` 처럼 부제를 붙인다.
> 이때 `fastlane/metadata/ios/ko/name.txt`도 같은 값으로 고쳐야 한다 —
> 고치지 않으면 `release` 레인이 스토어 이름을 되돌려 놓는다.

### C. App Store Connect API 키 발급

<https://appstoreconnect.apple.com/access/integrations/api>

1. **팀 키(Team Keys)** 탭 → **+**
2. 이름: `GitHub Actions`
3. 액세스: **Admin**
   > App Manager로도 TestFlight 업로드와 메타데이터 갱신은 되지만,
   > **클라우드 서명이 배포 인증서를 새로 만들려면 Admin 권한이 필요하다.**
   > 권한이 모자라면 빌드가 프로비저닝 단계에서 실패한다.
4. **생성** 후 `.p8` 파일을 **즉시 다운로드한다. 재다운로드는 불가능하다.**
   (잃어버리면 키를 폐기하고 새로 만들어야 한다.)
5. 같은 화면에서 **키 ID**와 **발급자 ID(Issuer ID)** 를 복사해 둔다.

### D. GitHub secrets 등록

저장소 → Settings → Secrets and variables → Actions → **New repository secret**

| Secret | 값 | 어디서 |
|---|---|---|
| `ASC_KEY_ID` | 10자 영숫자 (예: `2X9R4HXF34`) | C-5 |
| `ASC_ISSUER_ID` | UUID 형식 | C-5 |
| `ASC_KEY_P8_BASE64` | `.p8` 파일 전체를 base64로 인코딩한 **한 줄** 문자열 | 아래 명령 |
| `APPLE_TEAM_ID` | 10자 영숫자 | <https://developer.apple.com/account> → Membership details → Team ID |
| `VITE_KAKAO_JS_KEY` | 카카오맵 JS 키 | **이미 등록돼 있다** (`deploy.yml`이 쓰는 것과 같은 secret) |

`.p8`를 base64로 바꾸는 명령 (Windows PowerShell, 다운로드 폴더 기준):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\Downloads\AuthKey_XXXXXXXXXX.p8")) | Set-Clipboard
```

클립보드에 들어간 값을 그대로 붙여넣는다. 줄바꿈이 섞이면 안 된다 —
`Fastfile`이 디코드 결과에 `BEGIN PRIVATE KEY`가 있는지 검사해서 잘못된 인코딩을 바로 잡아낸다.

> 🔒 `.p8` 원본은 저장소에 절대 넣지 않는다. `.gitignore`에 `*.p8`이 이미 있지만
> 규칙보다 습관이 먼저다. 로컬 사본은 비밀번호 관리자에 보관하고 다운로드 폴더에서 지운다.

---

## 3. 스크린샷

**커밋 완료.** `fastlane/screenshots/ios/ko/`에 iPhone 6.9" **1320x2868 세로** 5장이
들어 있다(알파 채널 없는 RGB PNG). iPad는 필요 없다(1절 참고).

| 파일 | 화면 | 카피 |
|---|---|---|
| `01_spin.png` | 스핀 | 어디 갈지 고민될 땐 / 휴대폰만 돌리세요! |
| `02_map.png` | 명소 지도 | 붐비는 명소 말고 / 오늘 한산한 부산! |
| `03_home.png` | 홈 | 반나절 코스 짜기 / 탭 한 번이면 끝! |
| `04_stamp.png` | 도장깨기 | 원도심 48곳 / 도장깨기 시작! |
| `05_settings.png` | 설정 | 켜자마자 바로 / 부산 여행 시작! |

### 2026-09-02에 고친 것

**1) 상태바를 iOS로 교체했다.** 소스 캡처가 Android 에뮬레이터(Pixel 7) 것이라
iPhone 목업 안에 Android식 신호 삼각형·배터리·알림 아이콘이 그대로 보였다.
Apple은 다른 기기의 UI가 섞인 스토어 이미지를 리젝 사유로 삼는다(2.3.3).

`tools/store-screenshots/ios-status-bar.mjs`(`npm run capture:ios`)가 캡처 상단
136px 띠만 iOS 규격(9:41 · 셀룰러 4칸 · 와이파이 · 배터리)으로 다시 그려
`public/screenshots/ios/phone/`에 넣는다. **앱 화면 자체는 건드리지 않는다** —
상태바는 앱 콘텐츠가 아니라 OS 크롬이라 앱의 기능이 다르게 보이지 않는다.
Play용 `android` 덱은 원본 Android 캡처를 그대로 보므로 영향이 없다.

**2) 카피 없는 스플래시를 첫 장에서 뺐다.** 검색 결과에서 가장 크게 보이는 것이
첫 장이라 카피가 있는 spin을 앞세웠다. 6장 → 5장이 됐고, Play 덱과 구성이 같아졌다.
(App Store는 최소 1장·최대 10장이라 5장으로 충분하다.)

### 남은 권장 작업 (선택)

앱 화면 자체는 여전히 **Android 디버그 빌드** 캡처다. 두 플랫폼의 화면이 동일해
당장 문제가 되지는 않지만, 4절의 `beta` 실기기 확인 때 iOS 릴리스 빌드로 재촬영해
갈아 끼우는 것이 원칙이다. 교체하려면 새 캡처를 `public/screenshots/ios/phone/`에
같은 파일명으로 넣고 `export:ios`만 다시 돌면 된다(이미 iOS 캡처이므로
`capture:ios`는 건너뛴다).

### 다시 만들려면 (Mac 불필요)

```bash
cd tools/store-screenshots
npm install
npx playwright install chromium   # 최초 1회
npm run capture:ios               # Android 상태바 → iOS 상태바
npm run export:ios
```

`export-ios.mjs`가 next dev를 띄우고 헤드리스 Chromium으로 에디터의 **Export bundle**을
눌러, zip에서 `ios/iphone/1320x2868/ko/`만 골라 `fastlane/screenshots/ios/ko/`에
`01_…` 순번으로 넣는다. 알파 채널은 sharp로 떼어 낸다 —
**App Store Connect는 알파 채널이 있는 스크린샷을 거부한다**
("Invalid Screenshot ... can't contain an alpha channel"). 에디터의 html-to-image는
항상 RGBA로 굽기 때문에 이 후처리가 없으면 업로드 단계에서 막힌다.

카피·레이아웃을 바꾸려면 `npm run dev`로 에디터를 열어 고친 뒤 `export:ios`를 다시 돈다.

자세한 규격과 확인 항목은 `fastlane/screenshots/ios/README.md`에 있다.

> 디렉터리가 비어 있으면 `release`/`metadata` 레인은 스크린샷 업로드를 **건너뛴다.**
> 빈 디렉터리를 그대로 반영하면 스토어에 올라가 있던 이미지가 지워지기 때문이다.

---

## 4. 워크플로 실행

저장소 → **Actions** → **iOS Release** → **Run workflow**

입력 항목:

| 입력 | 설명 |
|---|---|
| `lane` | `build` / `beta` / `metadata` / `release` |
| `version` | 마케팅 버전. **0절 "버전 이력" 마지막 행 + 1** (저장소에는 기록되지 않는다) |
| `submit_for_review` | `release`일 때만 의미가 있다. 켜면 심사까지 제출 |

**`Use workflow from`은 `fix/tourapi-image-warmup`이다.** 기본값 `main`은 `0245b6c`(9/02)에서
멈춰 있어 1.0.0 시점 코드가 빌드된다.

CLI로 돌릴 수도 있다 (`gh`는 PATH에 없다):

```bash
GH="/c/Program Files/GitHub CLI/gh.exe"
"$GH" workflow run ios-release.yml --ref fix/tourapi-image-warmup \
  -f lane=beta -f version=1.0.8 -f submit_for_review=false
"$GH" run watch <run-id> --exit-status --interval 30
```

빌드 번호(`CFBundleVersion`)는 자동이다 — TestFlight의 최신 빌드 번호 + 1을 쓰고,
조회에 실패하면 워크플로 실행 번호로 폴백한다. 직접 정하고 싶으면 `BUILD_NUMBER`
환경변수를 쓴다.

### 권장 실행 순서

**1) `build` — 서명이 되는지만 확인 (스토어에 아무것도 올라가지 않는다)**

가장 실패할 가능성이 높은 단계가 서명이다. 스토어를 건드리지 않고 여기서 먼저 검증한다.
성공하면 Actions 아티팩트로 `Spindle.ipa`가 남는다.

**2) `beta` — TestFlight 업로드**

워크플로 자체는 **약 4분**이면 끝난다(1.0.7 실측 3분 55초). 그 뒤 Apple 처리에 5~15분
걸리고, 완료되면 App Store Connect → TestFlight에서 보인다.
**본인 기기에 설치해 반드시 실기기 확인을 한다:**

- [ ] 동작 권한을 따로 설정하지 않은 상태에서, 스핀 화면에 들어가 바로 흔들면 원판이 도는가
- [ ] 나침반이 실제로 회전에 반응하는가 (시뮬레이터에서는 확인 불가)
- [ ] 위치 권한 요청 문구가 의도한 한국어로 나오는가
- [ ] 권한을 **거부**해도 여행 모드로 전체 기능이 되는가
- [ ] **카카오맵이 뜨는가** — iOS 웹뷰 오리진은 `capacitor://localhost`로
      Android(`https://localhost`)와 다르다. 카카오 개발자 콘솔의 플랫폼 도메인
      등록이 이 오리진을 커버하지 못하면 지도가 자체 벡터 폴백으로 떨어진다.
      폴백이 있어 앱이 깨지지는 않지만, 스토어 스크린샷과 화면이 달라지면 곤란하다.
      문제가 있으면 `web/capacitor.config.ts`에 `ios: { scheme: 'https' }`를 주어
      오리진을 Android와 맞추는 것을 먼저 검토한다.
- [ ] 공유 카드 생성과 공유 시트가 동작하는가

**1.0.9에서 새로 볼 것** (브라우저로는 확인이 안 되는 것만)

- [x] **스핀 버튼을 톡 눌러도, 꾹 눌러도 모서리 브래킷이 안 뜬다** ← 1.0.9의 본체.
      **확인 완료** (2026-09-07, 빌드 17, 사용자 확인)
- [ ] 스핀 버튼 마크가 이전과 똑같이 보이고 탭이 정상 동작한다 (`<img>` → CSS 배경 회귀 확인)
- [ ] 홈 히어로·별이 마스코트·명소 카드 사진을 눌러도 브래킷이 없다 —
      **여기서 나오면 그쪽 `<img>`도 같은 처리가 필요하다.** 결과 카드 대표 사진은 탭 대상이라
      배경으로 못 바꾸므로 별도 방법을 써야 한다
- [ ] 결과 카드 대표 이미지 탭 → 갤러리가 열린다 (규칙에서 제외한 이미지 — 회귀 확인용)

- [ ] 결과 카드 지도 위를 세로로 쓸면 **카드가 스크롤되는가** (지도가 스와이프를 삼키지 않는가)
- [ ] 지도를 탭하면 드래그·줌이 열리고, `지도 잠그기`로 되돌아가는가
- [ ] 다른 후보로 넘기면 지도가 **자동으로 다시 잠기는가**
- [ ] 앱을 여러 번 완전히 종료·재시작해도 결과 카드의 **방문 정보(관람시간·휴무일)가 계속 뜨는가**
      — 1.0.6까지는 `detailIntro2` 트래픽이 몇 세션 만에 소진돼 429로 사라졌다
- [ ] 명소 탭에서 **운영 중단 흐린 핀**이 여전히 나오는가 (전량 예열을 앞쪽 12곳으로 줄인 뒤에도)
- [ ] 결과 카드 지도의 카카오 베이스맵이 뜨는가 (네이티브 Referer 차단 위에 새로 얹은 지도다)

**1.1.0에서 새로 볼 것** (빌드 19)

- [ ] **홈 첫인상** — 배경이 앰비언트 층으로 바뀌고 추천 여행지의 패널 테두리가 사라졌다.
      실기기의 좁은 화면에서 대표 카드(16:9)와 아래 3줄이 한 덩어리로 읽히는가,
      테마 그리드와의 경계가 여백만으로 구분되는가
- [ ] **결과 카드 방문 정보가 도착할 때 카드가 밀리지 않는가** ← 1.1.0에서 고친 것.
      스켈레톤과 실제 표의 오프셋·행 높이를 맞췄다. 상세 시트(compact)에서도 같은지 본다
- [ ] **개인정보 시트** — 본문 텍스트를 한 번 탭한 뒤에도 Escape/뒤로가 먹는가,
      시트가 열린 동안 탭이 뒤쪽 설정 화면·하단 내비로 새지 않는가,
      배경을 탭하면 닫히는가 (배경을 버튼에서 div로 바꿨다)
- [ ] **스핀 버튼 브래킷 회귀 없음** — 1.0.9에서 고친 것이 홈 배경 교체 후에도 유지되는가
- [ ] 하단 내비가 홈 인디케이터·노치 인셋을 그대로 지키는가 (배경 층 교체 후)

**3) `release`, `submit_for_review` 끄고 실행 — 스토어에 바이너리와 등록정보 업로드**

이 시점에 App Store Connect에서 5절의 수동 입력 항목을 채운다.

**4) `release`, `submit_for_review` 켜고 실행 — 심사 제출**

또는 App Store Connect 화면에서 직접 "심사를 위해 제출"을 눌러도 된다.

### 실패했을 때

Actions 실행 페이지 하단에 `fastlane-logs-*` 아티팩트가 붙는다.
`~/Library/Logs/gym/`의 `xcodebuild` 로그에 실제 원인이 있다.

| 증상 | 원인 |
|---|---|
| `maximum number of certificates` + `No profiles for 'kr.spindle.app'` | **Development 인증서 한도 초과.** 0절 "반복되는 실패" 절 — 개발자 포털에서 `Apple Development`만 폐기한다. 빌드 횟수가 쌓이면 반드시 재발한다 |
| `No signing certificate "iOS Distribution" found` | API 키 권한이 Admin이 아니다 (2절 C-3) |
| `Authentication credentials are missing or invalid` | `ASC_KEY_P8_BASE64` 인코딩이 깨졌다. 줄바꿈 없는 한 줄인지 확인 |
| `Could not find app with bundle identifier` | 앱 레코드가 아직 없다 (2절 B) |
| `scheme App not found` | `App.xcscheme`가 커밋되지 않았다 |
| 웹 화면이 비어 있다 | `cap sync` 누락. Fastfile이 처리하므로 `skip_web_sync`를 켰는지 확인 |

---

## 5. App Store Connect 수동 입력 항목

fastlane이 올리지 못하거나 최초 1회만 필요한 항목이다. 한번 넣으면 이후 릴리스에 유지된다.

### 연령 등급 (Age Rating)

앱 정보 → 연령 등급 → 편집. 모든 항목 **없음/해당 없음**으로 답한다
(근거는 `docs/store-listing.md`의 콘텐츠 등급 설문표와 동일하다). 결과는 **4+**.

### App Privacy (앱 개인정보 보호)

앱 개인정보 보호 → 시작하기. **"데이터를 수집하지 않음"을 선택하지 않는다.**

| 항목 | 답변 |
|---|---|
| 수집하는 데이터 | **위치 → 대략적 위치(Coarse Location)** 1건만 |
| 사용 목적 | 앱 기능(App Functionality) |
| 사용자 신원과 연결됨 | 아니요 |
| 추적에 사용됨 | 아니요 |

근거: Spindle 자체는 좌표를 전송하지 않지만 **카카오맵 SDK가 지도 타일을 요청할 때
조회 지역이 카카오 서버로 전달된다.** 제3자 SDK의 수집까지 신고 대상으로 보는 Apple
기준에 맞춘 것이다. 상세 근거는 `docs/store-listing.md`의 "카카오맵 SDK — 처리 결론" 절.

### 심사 연락처 정보 (App Review Information)

이름·성·전화번호·이메일을 입력한다. 개인정보라 저장소에 두지 않았다.
**로그인 정보는 필요 없다** — 계정이 없는 앱이므로 데모 계정 체크박스를 비워 둔다.

심사 노트는 `fastlane/metadata/ios/review_information/notes.txt`에 있고
`release` 레인이 자동으로 올린다.

### 가격 및 사용 가능 여부

- 가격: **무료**
- 국가/지역: 전 세계 또는 대한민국. 부산 한정 서비스이므로 대한민국만으로 좁혀도 된다.

### 수출 규정 준수

`Info.plist`의 `ITSAppUsesNonExemptEncryption = false` 덕분에 업로드마다 묻지 않는다.
별도 입력이 필요 없다.

---

## 6. 리젝 위험과 대응

가장 현실적인 위험은 **가이드라인 4.2 최소 기능성**이다. Capacitor 앱은
"웹사이트를 감싼 앱"으로 오인되기 쉽다. 대응 근거는 이미 갖춰져 있다:

- **원격 URL을 로드하지 않는다.** `capacitor.config.ts`에 `server.url`을 두지 않고
  웹 자산을 번들로 넣는다. 원격 코드 로드는 4.2 + 2.5.2 복합 리젝 사유다.
  **이 설정을 바꾸지 않는다.**
- **네이티브 센서를 실제로 쓴다.** 나침반·모션 기반 추천이 앱의 핵심이며 웹만으로는
  동일 경험이 나오지 않는다. 심사 노트에 실기기 테스트가 필요하다고 명시해 두었다.
- **지원 URL이 있다.** `https://spindle-6vp.pages.dev/support` — 연락처와 FAQ가 있는
  실제 페이지다. 지원 URL이 부실하면 1.5(개발자 정보)로 걸린다.

리젝되면 App Store Connect의 **해결 센터(Resolution Center)** 에 사유가 온다.
문구를 그대로 이 문서에 기록하고 대응한 뒤 재제출한다. 재심사도 보통 24~48시간이다.

---

## 7. 보안 금지사항

- `.p8` API 키, `.p12` 인증서, 프로비저닝 프로파일을 **저장소에 커밋하지 않는다.**
- API 키를 Apple ID 비밀번호로 대체하지 않는다. 2FA 때문에 CI에서 동작하지 않고,
  계정 전체 권한이 노출된다.
- 워크플로 로그에 secret을 `echo` 하지 않는다.
- 팀 키는 필요 이상으로 여러 개 만들지 않는다. 쓰지 않는 키는 폐기한다.

---

## 8. 다음 세션 시작 체크포인트

```bash
# 1) iOS 파이프라인 파일이 전부 있는지
ls fastlane/Fastfile fastlane/Appfile Gemfile .github/workflows/ios-release.yml
ls web/ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme

# 2) 메타데이터가 채워져 있는지
ls fastlane/metadata/ios/ko/

# 3) 스크린샷이 준비됐는지 (비어 있으면 업로드를 건너뛴다)
ls fastlane/screenshots/ios/ko/

# 3-1) 상태바가 iOS인지 — 소스 캡처가 ios/phone 을 가리켜야 한다
grep -o '"/screenshots/[a-z]*/phone' tools/store-screenshots/app-store-screenshots.json | sort -u

# 4) 지원 페이지가 프로덕션에 배포됐는지 — 200이 나와야 한다
curl -s -o /dev/null -w "%{http_code}\n" https://spindle-6vp.pages.dev/support

# 5) 최신 TestFlight 버전 확인 — 저장소에 기록이 없으므로 Actions에서 뽑는다
GH="/c/Program Files/GitHub CLI/gh.exe"
"$GH" run list --workflow ios-release.yml --limit 5 \
  --json databaseId,headSha,conclusion,createdAt
"$GH" api repos/enderpawar/Spindle/actions/runs/<id>/jobs --jq '.jobs[0].name'

# 6) main이 작업 브랜치보다 뒤처져 있는지 — 웹 배포는 main만 따라간다
git fetch origin && git log --oneline origin/main..origin/fix/tourapi-image-warmup | wc -l
```

4번이 404라면 `support.html`이 든 커밋이 `origin/main`에 푸시되지 않아
`deploy.yml`이 돌지 않은 것이다 (Play 때 `privacy.html`에서 똑같은 일이 있었다).

### 2026-09-07 점검 결과 — 아래 2026-09-02 표에서 바뀐 것만

| 항목 | 결과 |
|---|---|
| 최신 TestFlight 버전 | **1.0.9** (빌드 17, run `34133375267`, 커밋 `ee2031a`) — 다음은 `1.1.0`. 1.0.7·1.0.8은 스핀 버튼 브래킷이 남아 폐기 |
| 빌드 브랜치 | ✅ `main`. 1.0.8부터는 `main`에서 dispatch한다 |
| 웹 프로덕션(`spindle-6vp.pages.dev`) | ✅ **해소.** `cf49159` 머지로 배포 완료 (run `34130879541`, 3잡 성공). 번들 `main-DqgMwMWI.js`, `/`·`/support`·`/privacy` 200, 프록시 `resultCode=0000` |
| 스크린샷 | ✅ **해소.** 2026-09-08 `capture:web`으로 라이브 앱에서 재생성 — 관광지·음식점·카페 탭, 새 스핀 마크, 이동시간 한도 반영. 1320x2868·알파 없음·중복 없음. 목업 프레임 하단에서 탭 라벨이 약간 잘리지만 리젝 사유가 아니고 공모전 심사는 웹 URL만 본다 — 여유 있을 때 재생성한다 |
| TourAPI `detailIntro2` 일일 트래픽 | ⚠ **2026-09-07 시점 소진(429).** 예열 수정은 앞으로의 소비를 줄이지만 오늘 쓴 분량은 되돌리지 못한다 — **자정 리셋 후에 방문 정보를 검증한다** |
| `gh` CLI | ✅ `C:\Program Files\GitHub CLI\gh.exe` (PATH에는 없음). `enderpawar` 인증됨, 스코프에 `workflow` 포함 |

나머지 항목(파이프라인 파일, 메타데이터, 지원 페이지, `Package.swift`, `Info.plist`,
`PrivacyInfo.xcprivacy`, `TARGETED_DEVICE_FAMILY`, secrets, 러너, 등록 기기)은
2026-09-02 이후 변경 없이 아래 표 그대로다.

### 2026-09-02 점검 결과 — 저장소 쪽은 전부 통과

| 항목 | 결과 |
|---|---|
| 1) 파이프라인 파일 5종 | ✅ 전부 존재 |
| 2) 메타데이터 | ✅ ko 9개 파일 + 심사 노트. 글자수 제한 전부 여유 (name 7, subtitle 14, keywords 46/100, promo 92/170, description 370/4000) |
| 3) 스크린샷 | ✅ 5장 1320x2868 RGB (알파 없음), **iOS 상태바**, 첫 장은 카피 있는 spin |
| 4) 지원 페이지 | ✅ 200. `/privacy`·루트도 200 |
| `Package.swift` 경로 구분자 | ✅ 슬래시. `@capacitor/app`·`filesystem`·`share` 3개 |
| `Info.plist` | ✅ 위치·모션 문구, `ITSAppUsesNonExemptEncryption=false` |
| `PrivacyInfo.xcprivacy` | ✅ 수집·추적 없음 |
| `TARGETED_DEVICE_FAMILY` | ✅ `1` (iPhone 전용) |
| `capacitor.config.ts`의 `server.url` | ✅ 없음 (원격 코드 로드 금지 유지) |
| GitHub Actions 워크플로 | ✅ "iOS Release" 등록됨 (기본 브랜치 main에 존재) |
| GitHub secrets | ✅ Apple 4개(`ASC_KEY_ID`·`ASC_ISSUER_ID`·`ASC_KEY_P8_BASE64`·`APPLE_TEAM_ID`) 등록·검증 완료 |
| iOS 워크플로 실행 이력 | ✅ `build` 성공(IPA 10.1MB), `beta` 성공(TestFlight `1.0.0` 업로드) — 이후 이력은 0절 "버전 이력" |
| 러너 | ✅ `macos-26` — Xcode 26.6 / **iOS 26.5 SDK**. `macos-15`는 업로드가 409로 거부된다 |
| 등록 기기 | ✅ 1대 — 없으면 프로비저닝 프로파일 발급이 거부된다 |

**`release` 레인은 2026-09-02 `submit:false`로 성공했다**
(Actions run `33607578270`, 커밋 `0245b6c`). 바이너리·메타데이터·스크린샷 업로드와
precheck 9개 항목 통과까지 완료됐다.

**앱은 2026-09-06 App Store에 공개됐다.** 버전 1.0.0, 무료, 4+이며 제품 페이지는
<https://apps.apple.com/kr/app/spindle/id6807658917>이다.

---

## 9. 참고 링크

- App Store Connect — <https://appstoreconnect.apple.com>
- 인증서·식별자·프로파일 — <https://developer.apple.com/account/resources>
- API 키 관리 — <https://appstoreconnect.apple.com/access/integrations/api>
- App Store 심사 지침 — <https://developer.apple.com/app-store/review/guidelines/>
- 스크린샷 규격 — <https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/>
- fastlane deliver 메타데이터 레퍼런스 — <https://docs.fastlane.tools/actions/deliver/>
