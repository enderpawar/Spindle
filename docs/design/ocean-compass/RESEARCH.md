# Spindle ocean compass research

작성일: 2026-08-04

## 리서치 범위와 표기 원칙

이 문서는 항해 나침반을 그대로 복각하는 자료가 아니라, Spindle의 8방위 스핀 상호작용에 옮기기 위한 디자인 리서치다. 출처에서 직접 확인한 내용은 **확인된 사실**, 형태를 보고 내린 기능적 설명은 **형태 분석**, 근거가 충분하지 않은 내용은 **확인 필요**로 구분했다.

현재 Spindle은 흰 원판, 8방위 색 아크, 회전하는 한글 라벨, 중앙 캐릭터 허브, 화면 12시의 고정 주황 포인터로 구성된다. 결과 각도는 회전 원판의 화면 각도에서 직접 계산되므로, 이번 안에서도 회전부와 고정부를 시각적으로 분리하는 계약을 최우선으로 뒀다.

## 1. 항해 나침반의 시각 언어

### 컴퍼스 로즈와 윈드 로즈

**확인된 사실**

- 역사적으로 컴퍼스 로즈는 윈드 로즈에서 발전했다. 초기 윈드 로즈는 바람이 불어오는 방향을 표시했고, 자기 나침반과 결합되면서 같은 방사형 구조가 항해 방위를 나타내는 컴퍼스 로즈가 됐다. 초기 근대 해도 연구는 윈드 로즈가 늦어도 13세기 말 나침반의 일부가 되었고, 해도에는 1375년부터 나타났다고 정리한다. [Springer, Symbolism of Compass Roses on Early Modern Nautical Charts of the Adriatic Sea](https://link.springer.com/article/10.1007/s42489-022-00129-z)
- 현대 기상학에서 윈드 로즈는 방향 표지가 아니라 데이터 도표다. 각 방향 막대의 길이는 그 방향에서 바람이 분 시간 비율, 색 분할은 풍속 구간을 나타낸다. [NOAA National Weather Service, Dalhart Wind Rose Information](https://www.weather.gov/ama/dalhartwindroseinformation)
- 현대 지도와 해도에서 컴퍼스 로즈는 지도 또는 선박의 방향을 읽는 기준이다. 장식 수준에는 고정 규칙이 없고, 단순한 북쪽 화살표부터 32포인트까지 폭이 넓다. [Smithsonian National Postal Museum, Compass Roses](https://postalmuseum.si.edu/exhibition/allan-lee-collection-of-map-stamps-volume-6/compass-roses)

따라서 Spindle에 필요한 것은 기상 데이터형 윈드 로즈가 아니라, 사용자가 돌린 회전체와 고정 인덱스의 관계를 읽는 컴퍼스 로즈다. 다만 파도와 바람의 리듬은 기능을 방해하지 않는 범위에서 조형 모티프로 사용할 수 있다.

### 해도 로즈의 주요 구성 요소

| 요소 | 원래 기능 | Spindle 관점 |
|---|---|---|
| 외곽 진방위환 | 진북 0도를 기준으로 시계 방향 0-360도 방위를 읽는다. | 고정 포인터 아래의 실제 결과 각도를 읽는 구조로 번안할 수 있다. |
| 안쪽 자방위환 | 해당 위치의 자북을 기준으로 자방위를 읽는다. | 실제 자편차를 다루지 않는 Spindle에는 그대로 넣지 않는다. 가짜 자방위환은 오해를 만든다. |
| 중심 편차 정보 | 자편각의 동서 방향, 기준 연도, 연간 변화량을 기록한다. | 추천 방향 선택과 무관하므로 제거한다. |
| 북방 표시 | 진북 기준점을 빠르게 찾게 한다. 별, 화살촉, 플뢰르드리스 등이 쓰였다. | 회전 원판에서 북쪽을 찾는 2차 기준으로 유지할 가치가 있다. 선택 포인터보다 강해서는 안 된다. |
| 32방위 포인트 | 원을 11.25도씩 나눠 세밀한 항로 방향과 럼선을 읽게 했다. | 8방위 스냅 사이의 회전 속도감과 정밀감을 주는 얇은 보조 눈금으로만 사용한다. |
| 눈금 링 | 방위를 수치로 옮기고 항로선을 평행자 등으로 전이하는 기준이 된다. | 45도 스냅 지점과 중간 이동을 보이게 하는 회전 베젤로 유효하다. |

NOAA의 현재 Custom Chart 가이드는 외곽환이 진방위, 안쪽환이 자방위를 나타내고, 중심에 자편차와 연간 변화가 들어간다고 설명한다. [NOAA Custom Chart User Guide, 8쪽](https://devgis.charttools.noaa.gov/pod/helpDocFiles/NOAACustomChartUserGuide.pdf) 16세기 후반 항해 기구 실물에도 32포인트, 0-360도 눈금, 북쪽 플뢰르드리스가 함께 나타난다. [British Museum, astronomical compendium and compass](https://www.britishmuseum.org/collection/object/H_1866-0221-1)

32방위는 장식용 숫자가 아니었다. 32개 방향은 11.25도 간격이며, 더 세밀한 항로 설정과 럼선 네트워크를 위한 실용적 분해였다. 초기 근대 아드리아 해도 연구는 15세기 중반 32방위 로즈가 등장했고, 16세기 이후 표준적으로 널리 쓰였다고 확인한다. [Springer 연구](https://link.springer.com/article/10.1007/s42489-022-00129-z)

## 2. 왜 그렇게 생겼는가

### 긴 날과 짧은 날의 교대

**확인된 사실**

- 4방위에서 8, 16, 32방위로 갈수록 각 방향의 계층이 늘었다. 32포인트는 원을 계속 이등분해 만든다. [Smithsonian National Postal Museum](https://postalmuseum.si.edu/exhibition/allan-lee-collection-of-map-stamps-volume-6/compass-roses)
- 해도 로즈는 방향 표지와 장식 기능을 동시에 가졌지만, 제작법에 하나의 엄격한 형태 규칙은 없었다. 같은 시대에도 화살촉, 별, 문자, 색이 서로 다르게 쓰였다. [Springer 연구](https://link.springer.com/article/10.1007/s42489-022-00129-z)

**형태 분석**

오늘날 흔히 왕관처럼 보이는 긴 날과 짧은 날의 교대는 방위 계층을 길이로 압축해 보여준다. 가장 긴 날은 주방위, 중간 날은 간방위, 가장 짧은 날은 세부 방위를 맡으므로 문자 없이도 큰 방향부터 훑을 수 있다. 방사형 실루엣이 회전할 때는 속도와 관성을 드러내는 시각적 마커 역할도 한다.

**확인 필요**

이번 조사에서 이 긴 날과 짧은 날의 정확한 최초 제작자나 단일한 발생 이유를 설명하는 박물관 또는 해도 기관 출처는 확인하지 못했다. 따라서 이를 특정 시대의 필수 규격이나 특정 왕관 상징으로 단정하지 않는다.

### 2톤으로 접힌 날

**형태 분석**

한 날을 밝은 면과 어두운 면으로 나누면 중앙 능선을 기준으로 종이를 접은 듯 보인다. 평면 인쇄에서도 날의 방향, 중심축, 앞뒤 관계가 빠르게 읽히며, 인접한 날이 겹쳐 보여도 경계가 유지된다. 흑백 인쇄에서는 색 없이도 방향 계층을 남길 수 있다.

**확인 필요**

2톤 분할이 특정 항해 장비의 광학적 요구에서 시작됐다는 근거는 찾지 못했다. 확인된 것은 오래된 로즈가 다색 또는 흑백으로 다양하게 제작됐다는 점까지다. 그러므로 proto-1의 2톤 날은 역사적 사실의 재현이 아니라, 작은 모바일 화면에서 방사형 면을 분리하는 현대적 번안이다.

### 북쪽만 특별히 표시하는 관습

**확인된 사실**

- 북쪽은 항로와 방위를 계산하는 기준 방향이므로 다른 방향과 즉시 구분할 필요가 있었다. 초기 로즈에서는 화살촉, 자기 바늘의 끝, 북극성, 문자 등이 북쪽을 표시했다. [Springer 연구](https://link.springer.com/article/10.1007/s42489-022-00129-z)
- 플뢰르드리스는 15세기 말부터 북방 표지로 나타난다. 같은 연구는 1492년 Jorge de Aguiar의 해도 사례를 언급한다. 다만 그 모양은 단순한 화살촉의 장식화, 문장 모티프, 기독교 도상 등 여러 방식으로 해석돼 왔다. 하나의 확정된 유래만 제시하기 어렵다.
- 16세기 후반 British Museum 소장 기구는 북쪽을 플뢰르드리스, 동쪽을 십자가, 남쪽을 화살, 서쪽을 스페이드로 구분한다. 이는 북쪽 강조가 널리 쓰였지만 모든 로즈의 표식 체계가 같지는 않았음을 보여준다. [British Museum](https://www.britishmuseum.org/collection/object/H_1866-0221-1)

Spindle에서는 플뢰르드리스를 역사적 권위의 상징으로 과장하지 않고, 회전 원판 안에서 북쪽을 다시 찾게 하는 작은 표지로만 쓰는 편이 안전하다. 고정 주황 포인터가 결과 선택의 1차 기준이고, 북방 표시는 회전체에 붙은 2차 기준이어야 한다.

## 3. 현대 디지털 UI의 번안 유형

이번 조사는 제품명을 추측하지 않고 공식 사용자 가이드나 SDK 문서에서 기능을 확인할 수 있는 사례만 포함했다.

### 일반 스마트폰 나침반: 원형 눈금과 숫자 방위

Apple Compass는 원형 다이얼을 유지하지만 플뢰르드리스, 32개 장식 날, 자편차환은 쓰지 않는다. 현재 방위, 위치, 고도를 함께 보여주고, 방향을 잠그면 이탈량을 빨간 밴드로 표시한다. 남긴 것은 원형 눈금, 중앙 정렬, 수치 방위, 한 가지 상태 강조색이다. [Apple iPhone User Guide, Use the compass on iPhone](https://support.apple.com/en-lamr/guide/iphone/iph1ac0b663/ios)

### 다이빙 컴퓨터: 설정 방위와 이탈량

Garmin Descent의 다이브 컴퍼스는 현재 heading, 설정한 heading, 그 기준에서 벗어난 정도를 핵심 정보로 둔다. 반대 방향은 빨간 마크로 표시하고, 좌우 90도 기준도 설정할 수 있다. 전통 로즈의 장식보다 기준선, 현재값, 오차를 우선하는 번안이다. [Garmin Descent Mk2/Mk2s Owner's Manual](https://www8.garmin.com/manuals/webhelp/GUID-120241CE-9583-49CD-A0BC-8839B887F7CA/EN-US/GUID-8B118BD5-91E0-402A-8B57-784C0CF0A8FA.html)

### 요트와 해양 차트플로터: 선박 중심의 로즈

Garmin GPSMAP은 선박 주위에 compass rose를 표시해 선박 heading에 맞춘 방위를 보여준다. wind rose는 연결된 풍향 센서의 각도 또는 방향을 표시하는 별도 모드이며, compass rose와 동시에 켜지지 않는다. 디지털 해양 UI도 두 로즈의 의미를 구분한다. [Garmin GPSMAP Owner's Manual](https://www8.garmin.com/manuals/webhelp/GUID-3E67C80C-0812-4EEC-BC60-699751B9CF6F/EN-US/GPSMAP_x3_OM_EN-US.pdf)

### 지도 앱과 지도 SDK: 북쪽 표지만 남긴 최소형

Mapbox Maps SDK의 나침반은 지도가 회전했을 때만 나타나고, 화면 지도 회전에 따라 돌며, 누르면 bearing 0인 북쪽 위 상태로 복귀한 뒤 사라진다. 물리 센서 나침반이 아니라 화면 지도 방향을 설명하는 작은 상태 제어다. [Mapbox Maps SDK, UI settings](https://docs.mapbox.com/android/legacy/maps/guides/ui-settings/) Google Maps의 Wear OS 안내도 북쪽 위와 heading 위 보기 전환, 북쪽을 가리키는 바늘에 집중한다. [Google Maps Help, Wear OS](https://support.google.com/maps/answer/6056852?hl=en)

### 공통 경향

현대 사례가 버리는 것:

- 플뢰르드리스와 종교적 동쪽 표식 같은 역사 장식
- 16-32개의 방위 이름을 모두 적는 고밀도 문자
- 실제 계산에 쓰지 않는 자편차 정보
- 재질 모사와 장식 테두리

현대 사례가 남기는 것:

- 회전하는 방위 눈금과 고정 기준점
- 현재 방위의 숫자 또는 짧은 방위명
- 북쪽의 단일 강조
- 설정 방위, 이탈, 반대 방향처럼 과업에 직접 필요한 상태
- 작은 화면에서 읽히는 한 가지 강한 강조색

서핑 앱의 나침반 UI는 이번 확인 범위에서 공식 제품 문서로 검증하지 못했다. 특정 앱 이름이나 화면 패턴을 추가하지 않고 **확인 필요**로 남긴다.

## 4. Spindle 적용 판단

### 가져올 것

1. **고정 인덱스와 회전 로즈의 강한 분리**
   - 모든 SVG에서 회전부는 `data-part="rotating-disc"`, 고정부는 `data-part="fixed-indicator"` 그룹이다.
   - 고정 인덱스는 허용 팔레트의 `#ff7a45`로 통일했다. 회전부의 북방 표식보다 항상 강하다.

2. **8방위의 구조적 스냅**
   - 45도마다 긴 눈금, 섹터 경계, 포트홀 또는 파도 패널을 둔다.
   - 32방위는 선택지가 아니라 회전 감각을 보여주는 보조 눈금으로만 쓴다.

3. **선택값의 중복 표기**
   - 중앙 고정부에 한글 방위명과 각도를 함께 표시한다.
   - 색을 몰라도 현재 결과를 알 수 있고, 회전 원판의 12시 표식과 교차 확인할 수 있다.

4. **북쪽의 제한적 특수 표시**
   - 북쪽 표식은 회전부에 붙인다. 사용자가 원판이 얼마나 돌아갔는지 파악하는 기준이 되지만, 선택 결과를 가리키는 고정 포인터로 오해되지 않게 크기와 색을 낮춘다.

5. **부산 항구에 맞는 기계적 은유**
   - 해도 눈금, 선수선, 항구 게이트, 부표, 파도 리듬을 사용한다.
   - 황동, 양피지, 밧줄, 해적 장식은 쓰지 않는다. Spindle의 밤바다 토큰과 모바일 게임 동작에 맞지 않고, 기능 정보보다 테마 장식이 앞설 위험이 크다.

### 버릴 것

1. **실제 자편차환과 연간 변화 정보**
   - Spindle은 화면 최종 각도와 알고리즘 입력 각도가 같아야 한다. 진북과 자북을 따로 보여주는 장식은 계산이 다른 것처럼 오해시킨다.

2. **8방위 고유색 체계**
   - 기존 8방위 색 중 `#ff7a45`를 제외한 색은 이번 기술 제약의 색상 카드 밖에 있다. 따라서 네 안 모두 방위별 고유색을 사용하지 않았다.
   - 대체 수단은 45도 구조, 방위명 또는 국제 약어, 중앙 한글명, 숫자 각도, 고정 포인터의 정렬이다. 색각에 의존하지 않는 장점도 있다.

3. **모든 역사 요소의 동시 사용**
   - 플뢰르드리스, 32포인트, 이중환, 방위 문자, 접힌 날을 한 화면에 모두 넣으면 280px에서 뭉친다. proto-1만 전통 로즈의 밀도를 의도적으로 시험하고, 나머지는 요소를 분산했다.

4. **고정 중앙 허브가 회전하는 듯 보이는 처리**
   - 중앙 선택값과 선수선은 고정한다. 회전 애니메이션은 외곽 로즈에만 적용해야 화면 각도와 알고리즘 방위각의 관계가 명확하다.

## 5. 프로토타입 설명

### proto-1: Folded Admiralty Rose

- 배경: **밤바다 배경용**
- 정지 예시: 북동 045°
- 전통 32눈금, 긴 주방위 날, 짧은 간방위 날, 2톤 접힘, 작은 북방 플뢰르드리스형 표식을 결합했다.
- 영어 약어는 회전 로즈에 붙고, 고정 중앙에는 한글과 각도가 남는다.
- 장점은 가장 즉시 항해 나침반처럼 보인다는 점이다. 단점은 작은 화면에서 시각 밀도가 높고, 회전 북방 표식과 고정 주황 인덱스가 경쟁할 수 있다는 점이다.

### proto-2: Hydrographic Bearing Dial

- 배경: **밝은 배경용**
- 정지 예시: 남동 135°
- 현대 해도의 동심원과 정밀 눈금을 가져오되, 안쪽환은 자방위환이 아니라 8방위 선택 레이어로 재정의했다.
- 외곽 10도 눈금, 45도 긴 눈금, 방위 약어와 각도, 중앙 한글 선택값을 중복 표시한다.
- 고정 인덱스가 가장 명확하고 계측기처럼 신뢰감이 높다. 다만 정밀 눈금이 게임의 8방위 결과보다 더 정밀한 선택이 가능한 것처럼 보일 수 있어, 실제 구현에서는 중간 눈금 대비를 더 낮춰야 한다.

### proto-3: Harbor Gate Tide Dial

- 배경: **밤바다 배경용**
- 정지 예시: 동 090°
- 별 모양을 버리고 8개의 파도 패널과 항구 입구 형태의 고정 게이트를 사용한다.
- 방향색과 원주 라벨을 모두 버리고, 45도 패널 경계와 중앙의 실시간 한글명+각도로 현재 방위를 읽는다.
- 가장 게임답고 부산 항구 맥락이 강하다. 반면 중앙 텍스트가 회전 중에도 실시간 갱신되지 않으면 방위를 알 수 없으므로, 데이터 바인딩 의존도가 가장 높다.

### proto-4: Open Vessel Bezel

- 배경: **밝은 배경용**
- 정지 예시: 서 270°
- 원형 원판 대신 팔각 선박 베젤과 8개 포트홀을 사용한다. 각 포트홀에 한글 라벨을 직접 넣고, 중앙 선택값을 다시 표시한다.
- 고정 선수선이 외곽 포트홀에서 중앙까지 이어져 선택 방위를 한 선으로 묶는다.
- 8방위 스냅 구조가 가장 직접적이고 색 없이도 읽힌다. 전통 로즈의 역사성은 줄지만, 작은 화면에서 과업 수행성이 높다.

## 출처 목록

- [NOAA Custom Chart User Guide](https://devgis.charttools.noaa.gov/pod/helpDocFiles/NOAACustomChartUserGuide.pdf)
- [NOAA National Weather Service, Dalhart Wind Rose Information](https://www.weather.gov/ama/dalhartwindroseinformation)
- [Smithsonian National Postal Museum, Compass Roses](https://postalmuseum.si.edu/exhibition/allan-lee-collection-of-map-stamps-volume-6/compass-roses)
- [Springer, Symbolism of Compass Roses on Early Modern Nautical Charts of the Adriatic Sea](https://link.springer.com/article/10.1007/s42489-022-00129-z)
- [British Museum, astronomical compendium and compass](https://www.britishmuseum.org/collection/object/H_1866-0221-1)
- [Apple iPhone User Guide, Use the compass on iPhone](https://support.apple.com/en-lamr/guide/iphone/iph1ac0b663/ios)
- [Garmin Descent Mk2/Mk2s Owner's Manual](https://www8.garmin.com/manuals/webhelp/GUID-120241CE-9583-49CD-A0BC-8839B887F7CA/EN-US/GUID-8B118BD5-91E0-402A-8B57-784C0CF0A8FA.html)
- [Garmin GPSMAP Owner's Manual](https://www8.garmin.com/manuals/webhelp/GUID-3E67C80C-0812-4EEC-BC60-699751B9CF6F/EN-US/GPSMAP_x3_OM_EN-US.pdf)
- [Mapbox Maps SDK, UI settings](https://docs.mapbox.com/android/legacy/maps/guides/ui-settings/)
- [Google Maps Help, Wear OS](https://support.google.com/maps/answer/6056852?hl=en)

## 6. 비교와 추천

| 프로토타입 | 배경 | 핵심 은유 | 방위 판독 | 고정/회전 분리 | 280-360px 예상 | 주요 위험 |
|---|---|---|---|---|---|---|
| proto-1 | 밤바다 | 전통 32포인트 접힌 로즈 | 회전 약어 + 중앙 한글/각도 | 명확하나 북방 장식이 경쟁 | 보통 | 장식 밀도, 두 주황 표식의 경쟁 |
| proto-2 | 밝음 | 현대 해도 방위환 | 약어/각도 + 중앙 한글/각도 | 가장 명확 | 좋음 | 세부 눈금이 8방위보다 정밀해 보임 |
| proto-3 | 밤바다 | 항구 게이트와 파도 패널 | 중앙 한글/각도 | 매우 명확 | 좋음 | 중앙값 실시간 갱신에 의존 |
| proto-4 | 밝음 | 팔각 선박 베젤과 선수선 | 원주 한글 + 중앙 한글/각도 | 가장 직접적 | 가장 좋음 | 전통 로즈 인상이 약함 |

**추천: proto-4.** 이유는 미감보다 기능 제약에 있다. 8개 포트홀이 알고리즘의 8방위 스냅과 일대일 대응하고, 회전 베젤의 한글 라벨, 고정 선수선, 중앙 한글+각도가 같은 결과를 세 방식으로 교차 확인한다. 방위별 고유색을 쓰지 않아도 구분되며, 고정 선수선과 회전 베젤의 소속이 형태만으로 분명하다. proto-2를 차선으로 두되, 실제 구현 탐색을 시작한다면 proto-4의 정보 구조에 proto-2의 얇은 해도 눈금만 제한적으로 결합하는 방향이 가장 안전하다.

---

## 이후 경과 (2026-08-05)

이 문서의 프로토타입 SVG(proto-1~4, beach/light/min/star/navy 각 3안)는 디자인 확정 후 삭제했다.
최종 채택안은 어느 한 프로토타입이 아니라 사용자 제시 목업을 기준으로 `components/CompassRose.tsx`에
직접 구현한 형태다: 8방위 눈금 링 + 불투명도로 접은 2톤 4방위 날 + 회전하지 않는 중앙 보스와
Spindle 로고 + 12시 주황 고정 인덱스. 위 리서치는 그 판단의 근거로 남긴다.

특히 아래 두 결론이 최종안에 반영됐다.

- 자방위환·편차 정보는 넣지 않는다 — 실제 자편차를 다루지 않으므로 가짜 눈금이 된다.
- 촘촘한 보조 눈금은 8방위 스냅보다 정밀해 보여 실제 동작을 오해하게 만든다. 8방위 눈금만 남겼다.
