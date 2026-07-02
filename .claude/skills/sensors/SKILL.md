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

## GPS (Geolocation)

- `getCurrentPosition` 1회 취득이 기본, `watchPosition` 상시 구독 금지 (배터리·권한 피로).
- `enableHighAccuracy: true`, timeout 10초, 실패 시 여행 모드 폴백.
- 취득한 좌표는 존(zone) 판정과 거리 계산에만 단말 내에서 사용하고, 어떤 상태 저장소에도 영속화하지 않는다.

## 실기기 검증 체크리스트 (1–2주차)

- [ ] iPhone Safari: 권한 프롬프트 → 허용 → heading 취득 → 8방위 분류 정확
- [ ] iPhone Safari: 권한 거부 → 여행 모드 폴백 동작
- [ ] Android Chrome: absolute orientation 취득, 방위 편차 ±15° 이내 확인
- [ ] 나침반 보정 안 된 단말에서의 편차 → 결과에 "방향은 근사치" 안내 문구 검토
