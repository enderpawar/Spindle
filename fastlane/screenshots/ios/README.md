# App Store 스크린샷

`fastlane deliver`가 읽는 경로다. 로케일 디렉터리(`ko/`) 안에 PNG를 넣으면
`ios release` / `ios metadata` 레인이 자동으로 업로드한다.

```
fastlane/screenshots/ios/
└── ko/
    ├── 01_splash.png
    ├── 02_spin.png
    ├── 03_map.png
    ├── 04_home.png
    ├── 05_stamp.png
    └── 06_settings.png
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
`app-store-screenshots.json`의 `slidesByDevice.iphone`에 6장짜리 덱이 구성돼 있고,
소스 이미지는 Android 실기기 캡처(`public/screenshots/android/phone/`)를 공유한다.

### 자동 (권장)

```bash
cd tools/store-screenshots
npm install
npx playwright install chromium   # 최초 1회
npm run export:ios
```

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

- [ ] **릴리스 서명 빌드로 다시 촬영한다.** 현재 소스 캡처는 Android 디버그 빌드를
      에뮬레이터(Pixel 7)에서 찍은 것이다. 스토어 이미지와 실제 배포 앱이 달라지면 안 된다.
      iOS 실기기 캡처로 교체하는 것이 원칙이나, 두 플랫폼의 화면이 동일하므로
      최소한 **릴리스 빌드** 캡처로는 바꾼다.
- [x] Android **내비게이션 바**는 남아 있지 않다 (2026-09-01 익스포트 결과 확인 —
      하단은 앱 자체 탭바다).
- [ ] **상태바가 아직 Android다.** iPhone 프레임 안의 상태바에 Android식 신호/배터리
      아이콘과 알림 아이콘이 그대로 보인다(`02_spin.png` 상단). Apple은 스토어 이미지에
      다른 기기의 UI가 섞이는 것을 리젝 사유로 삼는다(2.3.3). 해결책은 두 가지 —
      (a) iOS 실기기/TestFlight 빌드로 재촬영, (b) 소스 캡처의 상태바 영역을 잘라
      내고 재익스포트. (a)가 원칙이고, 위의 "릴리스 빌드 재촬영" 항목과 함께 처리하면 된다.
- [ ] 첫 장이 `01_splash.png`(카피 없는 스플래시)다. App Store 검색 결과에서 가장 크게
      보이는 것이 첫 장이라 카피가 있는 `02_spin`을 앞세우는 편이 낫다. Play 덱은
      실제로 splash를 빼고 spin부터 시작한다(`app-store-screenshots.json`의 `android` 덱).
- [ ] 스크린샷 안의 카피가 실제 앱 문구와 어긋나지 않는지 본다.

디렉터리가 비어 있으면 `ios release` 레인은 스크린샷 업로드를 **건너뛴다**
(빈 디렉터리를 그대로 올리면 스토어에 있던 이미지가 지워지기 때문이다).
