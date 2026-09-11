# fastlane — 스토어 등록물과 iOS 릴리스 파이프라인

두 플랫폼의 성격이 다르다.

| | iOS | Android |
|---|---|---|
| 빌드·업로드 | **자동** (`Fastfile` + GitHub Actions macOS 러너) | 수동 (AAB를 Play Console에 직접 업로드) |
| 등록정보 | **자동** (`metadata/ios/` → deliver) | 수동 (`metadata/android/`는 보관처일 뿐) |
| 인계 문서 | `APP_STORE_RELEASE.md` | `GOOGLE_PLAY_RELEASE.md` |

> ⚠ `fastlane docs` / `fastlane init`을 실행하지 않는다. 두 명령 모두 이 `README.md`를
> 자동 생성물로 덮어쓴다.

```
fastlane/
├── Appfile                  # 앱 식별자·팀 ID (iOS 전용)
├── Fastfile                 # build / beta / release / metadata 레인
├── metadata/
│   ├── ios/                 # deliver가 App Store에 올리는 등록정보
│   │   ├── copyright.txt
│   │   ├── primary_category.txt
│   │   ├── ko/              # 이름·부제·설명·키워드·프로모션·릴리스 노트·URL
│   │   └── review_information/notes.txt
│   └── android/             # Play 등록물 보관처 (자동 업로드 미연결)
└── screenshots/
    └── ios/ko/              # App Store 스크린샷 (README.md 참고)
```

---

## iOS

레인은 `Fastfile` 상단 주석에 정리돼 있다. **macOS에서만 동작하므로** 개발 머신(Windows)에서는
실행할 수 없고, 저장소 → Actions → **iOS Release**로 돌린다.

| 레인 | 하는 일 |
|---|---|
| `build` | 서명된 IPA만 생성. 스토어를 건드리지 않아 서명 검증용으로 안전하다 |
| `beta` | 빌드 + TestFlight 업로드 |
| `release` | 빌드 + App Store 업로드. `submit:true`를 줘야 심사 제출까지 간다 |
| `metadata` | 바이너리 없이 등록정보·스크린샷만 갱신 |

절차 전체(Bundle ID 등록 → 앱 레코드 생성 → API 키 발급 → secrets 등록 → 실행)는
**`APP_STORE_RELEASE.md`** 에 있다.

### 등록정보를 고칠 때

`metadata/ios/ko/`의 텍스트를 고친 뒤 `metadata` 레인을 돌리면 스토어에 반영된다.
문구의 출처와 심사 답변 근거는 `docs/store-listing.md`에 있다 — **문안을 바꾸면 양쪽을 함께 고친다.**

글자 수 상한: 이름 30 / 부제 30 / 프로모션 텍스트 170 / 키워드 100 / 설명 4000.

---

## Android

Google Play가 기대하는 fastlane 표준 디렉터리 구조다. 지금은 **텍스트·그래픽 원본의
단일 보관처** 역할이며 자동 업로드(`supply`)는 연결하지 않았다.

```
fastlane/metadata/android/
├── default.txt                  # 기본 언어 (ko-KR)
└── ko-KR/
    ├── title.txt                # 7자 / 상한 30
    ├── short_description.txt    # 33자 / 상한 80
    ├── full_description.txt     # 372자 / 상한 4000
    ├── changelogs/default.txt
    └── images/
        ├── icon.png             # 512x512 32비트(RGBA) PNG
        ├── featureGraphic.png   # 1024x500
        ├── phoneScreenshots/      # 5장, 1442x2868 — App Store와 같은 iPhone 덱
        ├── sevenInchScreenshots/  # phoneScreenshots와 같은 파일
        └── tenInchScreenshots/    # phoneScreenshots와 같은 파일
        # 세 폴더 모두 tools/store-screenshots에서 `npm run export:android`로 만든다
```

### 제출 전 확인할 것

- [ ] **스크린샷을 릴리스 서명 빌드로 다시 촬영한다.** 현재 파일은 디버그 빌드를
      에뮬레이터(Pixel 7)에서 찍은 임시본이다. 스토어 이미지와 실제 배포 앱이 달라지면 안 된다.
      (같은 원본을 iOS 스크린샷도 공유하므로 교체하면 양쪽을 함께 다시 만든다.)
- [x] **스크린샷 종횡비 확인.** 2026-09-11 해소 — 1442x2868(1:1.99)로 Play 규정(긴 변 ≤ 짧은 변×2)을
      통과한다. App Store 이미지(1320x2868)와 같은 덱에서 캔버스 폭만 넓혀 굽는다.
- [x] 스크린샷을 2~8장으로 채운다. 2026-09-11 기준 5장(스핀·명소 지도·홈·도장·설정).
- [ ] `featureGraphic.png`는 마크만 올린 임시안이다. 카피를 넣은 디자인으로 교체할지 판단한다.
- [ ] 아이콘 원본이 512px뿐이라 상위 해상도가 필요한 곳은 업스케일본이다. 벡터/고해상도 원본이
      확보되면 전부 재생성한다.
