---
name: pwa
description: PWA 관련 코드(manifest, service worker, 오프라인 셸, 설치 배너, 배포 설정)를 작성·수정할 때 사용. API 응답 캐싱 금지 경계, iOS PWA 제약, 심사용 URL 요건 포함.
---

# PWA 구현 규약

## Service Worker — 캐싱 경계 (규정 직결)

- **precache 대상은 정적 자산만**: HTML 셸, JS/CSS 번들, 폰트, 아이콘, 방위 폴백 이미지.
- **API 경로(프록시 포함)는 network-only**. TourAPI 응답이 Cache Storage에 들어가는 순간 "실시간 호출만 인정" 규정 위반이 된다. fetch 핸들러에서 프록시 도메인/경로를 명시적으로 제외하고, 테스트로 검증한다 (`submission-check` 항목).
- 오프라인 시 동작: 셸은 뜨되 스핀 시도 시 "네트워크 연결이 필요해요" 안내. 오프라인에서 추천이 되는 것처럼 보이면 안 된다 (= 캐시를 쓰고 있다는 뜻).

## Manifest

- `display: standalone`, 세로 고정(`orientation: portrait`), 테마 컬러, 512px 마스커블 아이콘 포함.
- 이름: Spindle (짧은 이름 동일). 시작 URL에 추적 파라미터 붙이지 않는다.

## iOS 제약 (1차 검증 대상)

- iOS는 beforeinstallprompt가 없다 → 설치 유도는 Safari 공유 시트 안내 UI로 별도 구현 (Android는 `beforeinstallprompt` 저장 후 커스텀 배너).
- iOS 홈 화면 실행(standalone)에서도 DeviceOrientation 권한 프롬프트가 정상 동작하는지 실기기 확인 — Safari 탭과 동작이 다를 수 있어 현장 모드 검증 필수.
- iOS는 저장소·SW 수명이 짧다 → 세션 캐시(메모리) 전제 설계라 영향 없음을 확인만.

## 업데이트 전략

- 심사 기간 중 구버전이 보이면 안 된다: SW 업데이트 감지 시 자동 `skipWaiting` + 리로드 토스트. 복잡한 버전 관리 불필요 (비로그인, 로컬 상태 없음).

## 배포 (Cloudflare Pages)

- 심사 제출 URL은 커스텀 도메인 또는 pages.dev 고정 URL — 제출 후 프로젝트명 변경 금지.
- 프록시(Workers)와 Pages는 같은 계정, 프리뷰 배포 URL이 제출물에 섞이지 않도록 프로덕션 브랜치 고정.
- HTTPS 필수 (센서·Geolocation·SW 전부 secure context 요구) — Pages 기본 충족.
