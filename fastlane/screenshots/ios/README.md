# App Store 스크린샷

`fastlane deliver`가 읽는 경로다. 로케일 디렉터리(`ko/`) 안에 PNG를 넣으면
`ios release` / `ios metadata` 레인이 자동으로 업로드한다.

```
fastlane/screenshots/ios/
└── ko/
    ├── 01_spin.png
    ├── 02_map.png
    ├── 03_home.png
    ├── 04_stamp.png
    └── 05_settings.png
```

## 규격

**iPhone 6.9" 1320x2868 세로** 한 세트만 준비하면 된다.
(App Store Connect는 6.9"로 1320x2868과 1290x2796을 모두 받는다. 에디터의 6.9" 프리셋이
1320x2868이라 이쪽으로 통일한다 — `tools/store-screenshots/src/lib/constants.ts`)

- Apple은 iPhone 6.9"(또는 6.5") 한 세트만 요구하고, 더 작은 화면용은 자동으로 축소해 쓴다.
- Spindle은 `TARGETED_DEVICE_FAMILY = 1`(iPhone 전용)이라 **iPad 스크린샷이 필요 없다.**
  iPad를 지원 기기에 넣는 순간 iPad 스크린샷이 필수가 되므로 지금 설정을 유지한다.
- 최소 1장, 최대 10장. 목록에서 가장 많이 보이는 것은 첫 2장이다.
- deliver는 **파일명 알파벳 순**으로 업로드하므로 접두 번호로 순서를 고정한다.
- 알파 채널 없는 PNG로 저장한다.

## 만드는 법 (Mac 불필요)

원본 캡처와 카피·레이아웃이 `tools/store-screenshots`에 이미 준비돼 있다.
`app-store-screenshots.json`의 `slidesByDevice.iphone`에 5장짜리 덱이 구성돼 있다.

소스 이미지는 **iOS 상태바로 갈아 끼운 캡처**(`public/screenshots/ios/phone/`)를 쓴다.
원본은 Play와 공유하는 Android 캡처(`public/screenshots/android/phone/`)지만, 그대로
쓰면 iPhone 목업 안에 Android식 상태바가 보여 2.3.3 리젝 위험이 있다. `capture:ios`가
상단 136px 띠만 iOS 규격으로 다시 그린다 — 앱 화면 자체는 건드리지 않는다.
Play용 `android` 덱은 원본 Android 캡처를 그대로 본다.

### 자동 (권장)

```bash
cd tools/store-screenshots
npm install
npx playwright install chromium   # 최초 1회
npm run capture:ios               # Android 상태바 → iOS 상태바
npm run export:ios
```

`capture:ios`(`ios-status-bar.mjs`)는 소스 캡처가 1080x2400이 아니면 좌표가 어긋나므로
바로 실패한다. 원본 캡처를 새로 찍어 넣었다면 이 스크립트의 `BAR_H`를 다시 재야 한다.

`export-ios.mjs`가 next dev를 띄우고 헤드리스 Chromium으로 에디터의 **Export bundle**을
눌러, zip에서 `ios/iphone/1320x2868/ko/`만 골라 이 디렉터리에 `01_…` 순번으로 넣는다.
사람이 UI를 클릭하는 것과 결과가 같다. 이전 산출물은 지우고 새로 쓰므로 슬라이드 수가
줄어도 옛 파일이 남지 않는다.

알파 채널은 스크립트가 sharp로 떼어 낸다 — App Store Connect가 알파 있는 PNG를
거부하기 때문이다("Invalid Screenshot ... can't contain an alpha channel").
에디터의 html-to-image는 항상 RGBA로 굽는다.

### 수동

```bash
cd tools/store-screenshots
npm install
npm run dev          # http://localhost:3000
```

1. 플랫폼 탭을 **iPhone**으로 전환한다.
2. 툴바의 익스포트 크기 드롭다운에서 **1320x2868 (6.9")** 를 고른다.
3. **Export bundle**로 zip을 받는다.
4. 압축을 풀어 PNG를 `fastlane/screenshots/ios/ko/`에 넣고, 위 표기대로 이름을 붙인다.
5. **알파 채널을 떼어 낸다** (자동 경로를 쓰면 필요 없다).

## ⚠ 업로드 전 확인

- [x] **상태바가 iOS다.** `capture:ios`가 Android 상태바 띠를 iOS 규격(9:41 · 셀룰러
      4칸 · 와이파이 · 배터리)으로 교체한다. 2026-09-02 익스포트 결과에서 확인했다.
- [x] Android **내비게이션 바**는 남아 있지 않다 (2026-09-01 익스포트 결과 확인 —
      하단은 앱 자체 탭바다).
- [x] 첫 장이 카피가 있는 `01_spin.png`다. 카피 없는 스플래시는 덱에서 뺐다
      (Play의 `android` 덱과 같은 구성).
- [ ] **릴리스 서명 빌드로 다시 촬영한다.** 상태바는 해결했지만 앱 화면 자체는 여전히
      Android 디버그 빌드를 에뮬레이터(Pixel 7)에서 찍은 것이다. 두 플랫폼의 화면이
      동일해 당장 문제가 되지는 않지만, TestFlight 빌드를 실기기에 깔았을 때
      iOS 캡처로 갈아 끼우는 것이 원칙이다. 교체하려면 새 캡처를
      `public/screenshots/ios/phone/`에 같은 파일명으로 넣고 `export:ios`만 다시 돈다
      (이미 iOS 캡처라면 `capture:ios`는 건너뛴다).
- [ ] 스크린샷 안의 카피가 실제 앱 문구와 어긋나지 않는지 본다.

디렉터리가 비어 있으면 `ios release` 레인은 스크린샷 업로드를 **건너뛴다**
(빈 디렉터리를 그대로 올리면 스토어에 있던 이미지가 지워지기 때문이다).
