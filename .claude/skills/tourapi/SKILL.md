---
name: tourapi
description: TourAPI(KorService2·관광지 집중률 예측) 호출 코드를 작성·수정·리뷰할 때 사용. 허용 엔드포인트, 프록시 경유 규약, 좌표 무전송·실시간 호출 제약, 공통 파라미터와 에러 처리 규칙 포함.
---

# TourAPI 호출 규약

## 허용 엔드포인트 (이 목록 밖은 사용 금지)

| 용도 | 엔드포인트 | 필수 파라미터 |
|---|---|---|
| 지역 POI 목록 | `areaBasedList2` | `areaCode=6`(부산) + `sigunguCode`(중·동·서·영도구) |
| 상세 공통 | `detailCommon2` | `contentId` |
| 상세 소개 (이용시간·쉬는날) | `detailIntro2` | `contentId`, `contentTypeId` |
| 이미지 | `detailImage2` | `contentId` |
| 축제·행사 | `searchFestival2` | `areaCode=6`, `eventStartDate` |
| 지역코드 조회 | `areaCode2` | 시군구코드는 하드코딩하지 말고 이 API로 확인 |
| 관광지 집중률 예측 | `TatsCnctrRateService/tatsCnctrRatedList` | `areaCd=26`(부산) + `signguCd`(중·동·서·영도구 법정동 코드) |

- **`locationBasedList2` 등 좌표(mapX/mapY) 파라미터를 보내는 호출은 금지** — 좌표 무전송 원칙 (CLAUDE.md 절대 원칙 1·2).
- 집중률 예측 서비스의 `areaCd`·`signguCd`는 KorService2의 `areaCode`·`sigunguCode`와 다른 코드 체계다. 서로 바꿔 쓰지 않는다.

## 호출 경로

- 클라이언트는 TourAPI를 직접 호출하지 않는다. 항상 **프록시(Cloudflare Workers)** 를 경유한다.
- 프록시 역할은 두 가지뿐: `serviceKey` 환경변수 주입, 요청 중계. 좌표를 받는 라우트를 만들지 않는다.
- 프록시 라우트 설계: 클라이언트가 보낼 수 있는 파라미터를 화이트리스트(엔드포인트명, areaCode, sigunguCode, contentId, contentTypeId, pageNo, eventStartDate 등)로 제한하고 나머지는 거부.
- `tatsCnctrRatedList`만 별도 upstream `https://apis.data.go.kr/B551011/TatsCnctrRateService`로 보낸다. 엔드포인트별 파라미터 화이트리스트를 적용해 다른 TourAPI 호출에 `areaCd`·`signguCd`가 섞이지 않게 한다.

## 공통 파라미터

- `MobileOS=ETC`, `MobileApp=Spindle`, `_type=json`
- 페이징: `numOfRows`는 구별 POI 수를 감안해 충분히 크게 (기본 100), `totalCount` 확인 후 필요 시 추가 페이지 호출.
- 집중률 예측 응답의 `baseYmd`는 예측 대상일, `tAtsNm`은 관광지명, `cnctrRate`는 해당 관광지 최고 혼잡 시점을 100으로 둔 예상 집중률이다. 현재 현장 인원수나 실시간 혼잡으로 표현하지 않는다.

## 캐싱 규칙 (공모전 규정)

- 응답은 **메모리/세션 범위**에만 보관. localStorage·IndexedDB·서버 DB·빌드 시점 정적 파일화 전부 금지.
- 세션 시작 시 4개 구 `areaBasedList2`를 실시간 호출, 상세·이미지·축제는 결과 표시 시점에 추가 호출 — 이렇게 해야 운영계정 호출 이력이 자연스럽게 쌓인다.
- 운영 상태 축(SPEC 4.0)을 위해 세션 시작 목록 호출 직후 큐레이션 POI의 `detailIntro2`를 1회/POI로 예열한다(`primeOperationInfo`, 동시 3). 목록이 알려준 `contentTypeId`가 있을 때만 호출해 `detailCommon2`를 추가로 태우지 않으며, 원문은 세션 메모리 색인에만 둔다. 예열 실패는 무시한다 — 모르는 POI는 1.0 보수 통과라 추천이 막히지 않는다.
- service worker가 API 응답을 캐싱하지 않도록 fetch 핸들러에서 API 경로는 network-only로 처리한다 (오프라인 셸은 정적 자산만).

## 에러·데이터 품질 처리

- `resultCode !== "0000"`이면 사용자에게 재시도 UI, 콘솔에 resultMsg 로깅.
- `detailIntro2`의 이용시간·쉬는날은 자유 텍스트라 파싱이 불완전하다 → **파싱 실패 시 보수적으로 통과**(후보 유지)시키고, 결과 카드에 원문을 그대로 노출.
- 이미지 없음(`detailImage2` 빈 배열)인 POI가 많다 → 결과 카드에 이미지 폴백(방위 색상 배경 + 아이콘) 필수.
- 응답 필드는 전부 문자열로 온다 (숫자·좌표 포함) — 타입 변환 유틸을 한 곳에 모은다.
- 집중률 예측은 관광지명 정규화 후 큐레이션 POI와 유일하게 일치할 때만 연결한다. 일치하지 않는 항목은 억지로 추정하지 않으며 추천 점수에는 사용하지 않는다.
