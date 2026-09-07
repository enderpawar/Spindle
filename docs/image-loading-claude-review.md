# Claude 이미지 로딩 코드 리뷰 — 2026-09-07

Claude Code로 수행한 읽기 전용 검토 원문. 테스트 실행과 빌드는 Codex가 수행했다. 실기기 검증은 포함하지 않는다.

## 최초 검토

## 리뷰 결과

대상 파일(`details.ts`, `tourapi.ts`, `usePoiImage.ts`, `PoiPhoto.tsx`, `details.test.ts`, `docs/image-loading-fix.md`)과 관련 호출부(`SpotsScreen.tsx`, `ThemeDeckScreen.tsx`, `MapPoiPreview.tsx` 등 `<PoiPhoto>` 사용처)를 읽고, `AGENTS.md`·`tourapi/SKILL.md`의 캐싱·엔드포인트 규약과 대조해 분석했습니다. `git status`상 `ResultScreen.tsx`·`App.tsx`·`extraSpots.ts` 등은 언스테이지 변경(다른 에이전트 작업)이라 리뷰 대상에서 제외했고, 참고로만 확인했습니다.

### 결함 1 — [MEDIUM] 대체 사진 조회 자체가 실패하면 재시도 없이 영구히 "사진 없음"으로 고정된다

**위치**: `web/src/components/PoiPhoto.tsx:34-42`

```js
useEffect(() => {
  if (failedUrls.length === 0 || failedUrls.length > 3) return
  let cancelled = false
  fetchPoiImageFallback(contentId, failedUrls, variant)
    .then((next) => { if (!cancelled) setFallbackUrl(next) })
    .catch(() => { /* 사진 조회도 실패하면 기존 배경을 유지한다. */ })
  return () => { cancelled = true }
}, [contentId, failedUrls, variant])
```

**재현 트리거**: `<img>` 파일 로딩이 실패해 `failedUrls`가 채워지고 `fetchPoiImageFallback`이 호출되는 시점에, 그 호출 자체가 일시적 네트워크 오류로 **reject**하는 경우 (`details.test.ts:579-585`의 "대체 사진 API의 일시적 실패도 다음 호출에서 복구할 수 있다" 테스트가 정확히 이 reject 케이스를 검증합니다). `fetchPoiImageFallback`은 내부적으로 `imageItemsCache`를 정상적으로 evict하므로 **함수를 다시 호출하면** 복구되지만, `PoiPhotoContent`는 `.catch(() => {})`로 오류를 삼킬 뿐 재시도를 걸지 않습니다. `failedUrls`는 이미 그대로이므로 effect의 deps가 바뀌지 않아 다시 실행되지 않고, `fallbackUrl`은 `null`로 남아 `url = fallbackUrl ?? primaryUrl`이 원래 실패한 URL로 되돌아가 `failed=true` → `<img>`가 렌더되지 않아 새 `onError`도 발생하지 않습니다. 결과적으로 해당 마운트가 살아있는 한(스크롤로 재마운트되기 전까지) 영구히 플레이스홀더만 보입니다.

`usePoiImage.ts`의 1차 조회 실패는 1초 후 1회 자동 재시도(`usePoiImage.ts:26`)가 있는데, 정확히 같은 성격의 실패(일시적 API 오류)가 대체 사진 검색 단계에서는 재시도되지 않는 비대칭입니다. 이번 PR의 목적 자체가 "실패한 폴백 복구"인데, 그 폴백 검색 단계는 커버되지 않았고, 컴포넌트 레벨 테스트도 없어 회귀 테스트로도 잡히지 않습니다.

**최소 수정안**: `.catch` 블록에서 `usePoiImage`와 동일하게 짧은 지연 후 1회 재시도하도록 `setTimeout`으로 재호출(또는 `failedUrls`를 그대로 재사용해 effect를 다시 트리거할 별도 카운터/타이머 추가), `cancelled`로 언마운트 가드.

### 결함 2 — [LOW, 확인 필요] 썸네일 대체 후보가 없으면 대형 원본으로 폴백해 과거 WKWebView 메모리 크래시 경로가 다시 열린다

**위치**: `web/src/api/details.ts:354-356` (`fetchRepresentativeImageInParallel`의 `commonPromise`), 및 기존 `knownPoiThumbUrl` (`details.ts:649-652`)

```js
const commonPromise = fetchCommonCached(contentId, fetchImpl).then((common) =>
  (variant === "thumb" ? normalizeImageUrl(common.firstimage2) : undefined)
    ?? normalizeImageUrl(common.firstimage) ?? null);
```

`firstimage2`가 비어 있으면 `thumb` 변형에서도 `firstimage`(940×626 원본)를 그대로 반환합니다. 바로 위 `knownPoiThumbUrl`의 주석이 명시한 크래시("940×626 원본을 76px 카드에 넣으면 장당 2.2MB가 디코딩돼 WKWebView 콘텐츠 프로세스가 메모리로 종료된다")와 동일한 조건입니다. `<img>`에 `sizes`/다운스케일 힌트가 없어(`PoiPhoto.tsx:68-78`) 디코딩 비용은 CSS 표시 크기가 아니라 원본 해상도에 비례합니다.

이 동작은 `details.test.ts:769-773`("firstimage2가 비어 있으면 firstimage로 폴백한다")에서 **의도적으로 검증된 스펙**이라 "버그"라기보다 "이미지가 아예 없는 것보다 낫다"는 트레이드오프로 보이며, 신규 코드가 이 트레이드오프를 그대로 계승한 것뿐입니다. 다만 실기기 크래시 이력이 있는 정확한 조건을 새 비동기 경로(리스트 미도착/미인덱스 POI)에서도 재현 가능하게 만들었으므로, 병합 전에 "firstimage2 없는 POI 비율"과 실기기(WKWebView) 검증으로 재발 가능성을 확인할 것을 권합니다. 자동화 테스트로는 메모리 크래시를 잡을 수 없습니다.

### 그 외 — 방어적으로 확인했으나 결함 없음

- **캐시 거부 후 제거(cache rejection eviction)**: `fetchCommonCached`/`fetchImageItemsCached`/`fetchRepresentativeImageCached`/`fetchRepresentativeImageInParallelCached`/`fetchPoiThumbRequest` 모두 `.catch(() => { map.delete(id); throw err })` 패턴을 일관되게 사용하며, JS 마이크로태스크 순서상 "삭제 후 reject 통지"가 보장돼 재시도 시 캐시 미스가 올바르게 발생합니다.
- **Promise.any 부분 실패**: `fetchRepresentativeImageInParallel`은 `empty` 심볼로 "사진 없음"과 실제 오류를 구분해 `AggregateError.errors`에서 실제 오류를 우선 propagate합니다. 국제시장처럼 양쪽 다 빈 결과면 `null`(사진 없음 확정), 한쪽만 실패면 오류를 던져 재시도 가능 상태로 남깁니다 — 문서의 두 리포트 케이스 모두 올바르게 처리됩니다.
- **중복 요청**: 여러 컴포넌트가 동시에 같은 `contentId`를 요청해도, `*_Cached` 래퍼들이 "확인 후 설정" 사이에 `await`가 없는 동기 함수라 마이크로태스크 인터리빙으로도 중복 네트워크 호출이 생기지 않음을 코드·테스트(`details.test.ts:497-527` 등) 양쪽에서 확인했습니다.
- **리스트 리스너 정리**: `whenAreaListsSettled`의 `onIndexChange` 리스너는 race 종료 후 무조건 `imageIndexListeners.delete`되어 누수되지 않습니다.
- **마운트/언마운트/URL 변경**: `<PoiPhoto key={contentId:variant}>`가 contentId·variant 변경 시 완전 리마운트를 강제해 상태 오염을 원천 차단합니다. `usePoiImage`의 `cancelled` 플래그와 `retryTimer` 클로저도 정상 정리됩니다(언마운트해도 진행 중이던 fetch 자체는 계속 실행되지만, 공유 캐시에 이득이 되므로 의도된 설계로 판단).
- **썸네일/원본 선택**: `representativeImageFromItems`의 variant별 우선순위(`smallimageurl`↔`originimgurl`)와 시설 사진 제외 로직 모두 테스트와 일치합니다.

### 결론

**CHANGES_REQUESTED** — 결함 1(대체 사진 조회 실패 시 재시도 부재)은 이 PR의 핵심 목표와 직접 충돌하는 재현 가능한 회귀이며 수정 비용이 작으므로 병합 전 반영을 권합니다. 결함 2는 차단 사유는 아니지만 실기기 확인을 권고합니다.

## 수정 후 재검토

## 재검토 결과 — MEDIUM 결함 1 수정분

`imageRetry.ts`의 `loadImageWithRetry`는 최초 요청 실패 시에만 1초 후 1회 재시도(`canRetry` 플래그로 정확히 1회 제한)하고, 재시도도 실패하면 `onResult(null)`로 확정 종료합니다. `cancelled` 플래그가 `.then`/`.catch` 양쪽 콜백 진입부에서 모두 체크되어 취소 후 도착하는 응답은 무시되고, 반환된 정리 함수가 `cancelled=true` 설정과 `clearTimeout`을 함께 수행합니다.

`PoiPhoto.tsx:38-41`에서 이 헬퍼를 `fetchPoiImageFallback(contentId, failedUrls, variant)` 재조회에 그대로 연결하고, effect의 클린업으로 반환값을 그대로 넘겨 `contentId`/`failedUrls`/`variant` 변경이나 언마운트 시 타이머·취소가 자동 처리됩니다. `fetchPoiImageFallback`이 실패 시 내부 `imageItemsCache`를 evict하는 기존 로직과 결합되어, 재시도 호출은 캐시 미스로 이어져 실제 네트워크 재조회가 정상적으로 일어납니다. 최종 실패 시 `fallbackUrl=null`이 되어 `url`이 다시 `primaryUrl`(이미 `failedUrls`에 포함)로 돌아가 플레이스홀더가 표시되는 기존 안전한 종료 상태와도 일치합니다. "최대 3회" 후보 시도 한도(effect가 `failedUrls.length`로 게이팅)는 이 변경으로 영향받지 않습니다.

테스트 6개(성공 복구, 정상 빈 결과 무재시도, 반복 실패 시 1회로 제한, 취소 시 타이머 정리, 취소 후 지연 resolve/reject 무시 2종)는 구현과 정확히 대응하며 원 결함의 반례(일시적 API 실패 후 영구 고착)를 직접 커버합니다.

새로 도입된 결함은 발견되지 않았습니다.

**결함 1: PASS**

**잔여 사항(별개)**: LOW로 기록한 "firstimage2 부재 시 원본 대체" 항목은 이번 수정과 무관하며 여전히 기존의 의도된 트레이드오프로 남아 있습니다 — 자동화 테스트로는 검증 불가하므로 실기기(WKWebView) 메모리 검증이 별도로 필요합니다.
