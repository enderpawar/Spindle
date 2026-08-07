---
name: sensors
description: 나침반(DeviceOrientation)·GPS(Geolocation) 관련 코드를 작성·수정할 때 사용. iOS 권한 프롬프트, webkitCompassHeading 폴백, 8방위 분류 수학, 좌표 단말 내 처리 원칙 포함.
---

# 센서 처리 규약 (현장 모드)

## 대원칙

- GPS 좌표·방위각은 **단말 밖으로 내보내지 않는다**. 네트워크 요청, 로그 수집, 에러 리포팅 페이로드에 포함 금지.
- 센서는 **현장 모드에서만** 사용. 여행 모드는 센서 없이 완전 동작해야 한다 (심사위원 시연 경로).
- 센서 실패(권한 거부·미지원·값 불안정) 시 항상 여행 모드로 자연스럽게 유도하는 폴백 UI를 둔다.

## 방위각 (나침반)

- **iOS 13+**: `DeviceOrientationEvent.requestPermission()`을 반드시 **사용자 제스처(버튼 클릭) 핸들러 안에서** 호출해야 한다. 페이지 로드 시 자동 호출하면 조용히 거부됨.
- **iOS**: `event.webkitCompassHeading` 사용 (진북 기준, 시계방향 0–360). `alpha`는 iOS에서 절대값이 아니므로 쓰지 않는다.
- **Android**: `deviceorientationabsolute` 이벤트 우선, 없으면 `deviceorientation`의 `alpha` + `absolute === true` 확인. heading = `360 - alpha` 변환 주의.
- 값 안정화: 최근 N개 샘플의 원형 평균(circular mean)으로 스무딩 — 방위각은 0/360 경계 때문에 산술 평균 금지.

## 8방위 분류

- 45° 부채꼴, **북(N) = 337.5°–22.5°** 중심 정렬:
  `sectorIndex = Math.round(heading / 45) % 8` → [N, NE, E, SE, S, SW, W, NW]
- 방위 중심선 근접 가중치: `1 - |heading - sectorCenter| / 22.5` (경계 보정 필요 — 0/360 wrap).
- 스핀 애니메이션의 최종 각도와 알고리즘에 넘기는 방위각이 반드시 일치해야 한다 (연출 따로 계산 따로 금지).

## 흔들기 (DeviceMotion) — 여행 모드 보조 입력

- **iOS 13+**: `DeviceMotionEvent.requestPermission()`도 방위 권한과 **별개**다. 나침반 권한을 이미 받았어도 따로 요청해야 하고, 마찬가지로 사용자 제스처 핸들러 안에서만 호출한다.
- 권한 개념이 없는 환경(안드로이드·데스크톱)은 스핀 화면 진입 시 바로 구독하고, 화면을 떠나면 반드시 해제한다.
- 세기는 `accelerationIncludingGravity`의 **직전 표본 대비 변화량**으로 계산한다 — 중력은 차분에서 상쇄되므로 별도 필터가 필요 없다. 기기별 이벤트 주기 편차는 60Hz 기준으로 정규화한다 (`engine/shake.ts`의 `ShakeMeter`).
- 손떨림·걸음걸이가 원판을 돌리지 않도록 데드존을 두고, **스핀을 새로 시작하는 문턱은 그보다 높게** 잡는다.
- 흔들기는 보조 입력이다. 미지원·거부 시 드래그·플릭 스핀만으로 전 동선이 완전 동작해야 하며, 실패는 한 줄 안내로만 알린다.
- 가속도 값도 방위각과 같은 취급 — 네트워크·로그로 내보내지 않는다.

## GPS (Geolocation)

- `getCurrentPosition` 1회 취득이 기본이며 `watchPosition` 상시 구독은 **금지한다.** 2026-08-02에 자체 경로안내를 폐기하면서 유일한 예외였던 활성 코스 안내 화면도 사라졌다 — 길찾기는 전부 카카오맵에 위임하고 도착 판정은 사용자 확인 버튼으로 대체했다 (docs/course.md §8).
- `enableHighAccuracy: true`, timeout 10초, 실패 시 여행 모드 폴백.
- 취득한 좌표는 존(zone) 판정과 거리 계산에만 단말 내에서 사용하고, 어떤 상태 저장소에도 영속화하지 않는다.

## 실기기 검증 체크리스트 (1–2주차)

- [ ] iPhone Safari: 권한 프롬프트 → 허용 → heading 취득 → 8방위 분류 정확
- [ ] iPhone Safari: 권한 거부 → 여행 모드 폴백 동작
- [ ] Android Chrome: absolute orientation 취득, 방위 편차 ±15° 이내 확인
- [ ] 나침반 보정 안 된 단말에서의 편차 → 결과에 "방향은 근사치" 안내 문구 검토
- [ ] iPhone Safari: `휴대폰을 흔들어서 돌리기` 탭 → 권한 허용 → 흔드는 동안 원판 지속 회전 → 멈추면 감속·정착
- [ ] iPhone Safari: 동작 권한 거부 → 안내 한 줄 + 드래그 스핀 정상
- [ ] Android Chrome: 스핀 화면 진입만으로 흔들기 동작, 주머니에 넣고 걸을 때 오작동 없음
