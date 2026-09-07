import { useMemo, useState } from 'react'
import { bearingDeg, haversineMeters } from '../engine/geo'
import { directionFromHeading, type Departure, type Poi } from '../mock/pois'
import { MapView } from '../map/MapView'

/** 결과 지도는 이미 정해진 한 곳만 보여준다 — 핀·빈 지도 탭으로 선택이 풀리면 경로선이 사라진다. */
const keepSelection = () => {}

/** 지도에 찍을 수 있는 좌표인지 — 결측을 0,0으로 채운 값도 걸러낸다. */
export function isMappablePoint(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return false
  return lat !== 0 || lon !== 0
}

/** 직선거리 표기 — 1km 미만은 10m 단위, 그 이상은 0.1km 단위. 도보 경로 거리가 아니다. */
export function straightLineLabel(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters / 10) * 10}m`
    : `${(meters / 1000).toFixed(1)}km`
}

/**
 * 추천에 사용한 기준점과 목적지를 한 화면에 보여준다.
 * 거리·방위는 단말 안에서만 계산하고, 좌표는 카카오맵 SDK 외 어디로도 나가지 않는다 (절대 원칙 1).
 */
export function ResultLocationMap({ poi, departure }: { poi: Poi; departure: Departure }) {
  const pois = useMemo(() => [poi], [poi])
  const [provider, setProvider] = useState<'kakao' | 'local' | null>(null)
  const [attempt, setAttempt] = useState(0)

  const originOk = isMappablePoint(departure.lat, departure.lon)
  const targetOk = isMappablePoint(poi.lat, poi.lon)

  const from = { lat: departure.lat, lng: departure.lon }
  const to = { lat: poi.lat, lng: poi.lon }
  const ready = originOk && targetOk
  const distance = ready ? straightLineLabel(haversineMeters(from, to)) : ''
  const direction = ready ? directionFromHeading(bearingDeg(from, to)).label : ''

  return (
    <section className="result-location" aria-labelledby="result-location-title">
      <div className="result-location-heading">
        <h3 id="result-location-title">여기에 있어요</h3>
        {ready && <span>{direction}쪽 · 직선 {distance}</span>}
      </div>
      <p className="result-location-origin">{departure.name} 기준</p>

      {!targetOk && (
        <p className="result-location-fallback">
          이 장소의 좌표가 없어 지도에 표시할 수 없어요. 아래 길찾기에서 장소 이름으로 확인해 주세요
        </p>
      )}
      {targetOk && !originOk && (
        <p className="result-location-fallback">
          기준 위치를 확인할 수 없어 지도를 그리지 못했어요. 출발점을 다시 선택해 주세요
        </p>
      )}

      {ready && (
        <>
          <div
            className="result-location-map"
            role="region"
            aria-label={`${departure.name}에서 ${poi.name}까지의 위치 지도`}
          >
            <MapView
              key={attempt}
              pois={pois}
              departure={departure}
              selectedId={poi.id}
              onPick={keepSelection}
              showSelectedPreview={false}
              compactOverview
              onProviderChange={setProvider}
            />
            {provider === null && (
              <div className="result-location-loading" role="status">지도를 불러오는 중이에요</div>
            )}
          </div>
          {/* 출처 표기는 결과 화면 하단 SourceLine 하나로 유지한다 (중복 표기 방지). */}
          <p className="result-location-caption">점선은 방향 표시예요. 실제 길은 길찾기에서 확인하세요</p>
          {provider === 'local' && (
            <p className="result-location-fallback" role="status">
              카카오맵 연결이 어려워 기본 지도로 보여드려요
              <button
                type="button"
                onClick={() => {
                  setProvider(null)
                  setAttempt((value) => value + 1)
                }}
              >
                다시 시도
              </button>
            </p>
          )}
        </>
      )}
    </section>
  )
}
