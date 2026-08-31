# App Store 스크린샷

`fastlane deliver`가 읽는 경로다. 로케일 디렉터리(`ko/`) 안에 PNG를 넣으면
`ios release` / `ios metadata` 레인이 자동으로 업로드한다.

```
fastlane/screenshots/ios/
└── ko/
    ├── 1_spin.png
    ├── 2_map.png
    ├── 3_home.png
    ├── 4_stamp.png
    └── 5_settings.png
```

## 규격

**iPhone 6.9" 1290x2796 세로** 한 세트만 준비하면 된다.

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

```bash
cd tools/store-screenshots
npm install
npm run dev          # http://localhost:3000
```

에디터에서:

1. 플랫폼 탭을 **iPhone**으로 전환한다.
2. 툴바의 익스포트 크기 드롭다운에서 **1290x2796 (6.9")** 를 고른다.
3. **Export bundle**로 zip을 받는다.
4. 압축을 풀어 PNG를 `fastlane/screenshots/ios/ko/`에 넣고, 위 표기대로 이름을 붙인다.

## ⚠ 업로드 전 확인

- [ ] **릴리스 서명 빌드로 다시 촬영한다.** 현재 소스 캡처는 Android 디버그 빌드를
      에뮬레이터(Pixel 7)에서 찍은 것이다. 스토어 이미지와 실제 배포 앱이 달라지면 안 된다.
      iOS 실기기 캡처로 교체하는 것이 원칙이나, 두 플랫폼의 화면이 동일하므로
      최소한 **릴리스 빌드** 캡처로는 바꾼다.
- [ ] 상태바에 실제 통신사명·시간이 노출되지 않는지 본다. Apple은 스토어 이미지에
      다른 기기의 UI가 섞이는 것을 리젝 사유로 삼는다 — 특히 **Android 내비게이션 바가
      남아 있으면 안 된다.** 에디터의 iPhone 프레임이 덮는지 익스포트 결과로 확인한다.
- [ ] 스크린샷 안의 카피가 실제 앱 문구와 어긋나지 않는지 본다.

디렉터리가 비어 있으면 `ios release` 레인은 스크린샷 업로드를 **건너뛴다**
(빈 디렉터리를 그대로 올리면 스토어에 있던 이미지가 지워지기 때문이다).
