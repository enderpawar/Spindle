import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapPoiPreview } from '../components/MapPoiPreview'
import { directionOf, type Poi } from '../mock/pois'
import type { MapViewProps } from './LocalMapView'
import type { KakaoCustomOverlay, KakaoMap, KakaoMapsNs, KakaoPolyline } from './kakaoLoader'

interface PoiOverlayHost {
  poiId: string
  host: HTMLDivElement
}

interface PoiOverlayRecord extends PoiOverlayHost {
  overlay: KakaoCustomOverlay
}

type ExtraSpot = NonNullable<MapViewProps['extraSpots']>[number]
const EMPTY_EXTRA_SPOTS: readonly ExtraSpot[] = []

interface ExtraOverlayHost {
  spotId: string
  host: HTMLDivElement
}

interface ExtraOverlayRecord extends ExtraOverlayHost {
  overlay: KakaoCustomOverlay
}

interface PoiPinProps {
  poi: Poi
  selected: boolean
  busy: boolean
  order?: number
  showLabel: boolean
  onPick: (id: string | null) => void
  onOpen?: (poi: Poi) => void
}

function PoiPin({ poi, selected, busy, order, showLabel, onPick, onOpen }: PoiPinProps) {
  const color = directionOf(poi.direction).color
  const inCourse = order !== undefined
  const sizePx = inCourse ? (selected ? 30 : 26) : selected ? 22 : 16

  return (
    <div style={{ position: 'relative', width: 0, height: 0, pointerEvents: 'none' }}>
      <button
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onPick(poi.id)
        }}
        aria-label={busy ? `${poi.name}, 오늘 혼잡 예상` : poi.name}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          padding: 0,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
      >
        <svg
          width={sizePx}
          height={sizePx * 1.28}
          viewBox="0 0 30 38"
          style={{
            display: 'block',
            transform: 'translate(-50%,-100%)',
            filter: selected ? `drop-shadow(0 6px 10px ${color}88)` : 'drop-shadow(0 3px 5px rgba(25,55,130,.35))',
            transition: 'width .18s ease, height .18s ease',
          }}
          aria-hidden
        >
          <path d="M15 1 C7.3 1 1.5 6.9 1.5 14.4 C1.5 24 12 33.5 15 36.6 C18 33.5 28.5 24 28.5 14.4 C28.5 6.9 22.7 1 15 1 Z" fill={color} stroke="#fff" strokeWidth={2.4} />
          {inCourse ? (
            <text x="15" y="19.4" textAnchor="middle" fontSize="15" fontWeight="900" fill="#fff">
              {order}
            </text>
          ) : poi.tier === 3 ? (
            <path d="M15 8.6 L16.7 12.9 L21 14.6 L16.7 16.3 L15 20.6 L13.3 16.3 L9 14.6 L13.3 12.9 Z" fill="#fff" />
          ) : (
            <circle cx="15" cy="14.4" r="4.6" fill="#fff" />
          )}
        </svg>
        {busy && (
          <span className="map-congestion-pin" style={{ left: sizePx * 0.18, top: sizePx * -1.35 }} aria-hidden="true">
            !
          </span>
        )}
        {(selected || showLabel || inCourse) && (
          <span
            style={{
              position: 'absolute',
              left: 0,
              top: 3,
              padding: '2px 7px',
              borderRadius: 7,
              background: selected ? '#fff' : 'rgba(255,255,255,.82)',
              boxShadow: selected ? '0 3px 10px -3px rgba(20,50,140,.4)' : 'none',
              color: '#1d3a75',
              fontSize: 10.5,
              fontWeight: 800,
              whiteSpace: 'nowrap',
              transform: 'translateX(-50%)',
            }}
          >
            {poi.name}
          </span>
        )}
      </button>

      {selected && <MapPoiPreview poi={poi} color={color} onOpen={onOpen} />}
    </div>
  )
}

function ExtraSpotPin({ spot, selected, showLabel, onPick }: {
  spot: ExtraSpot
  selected: boolean
  showLabel: boolean
  onPick: (id: string | null) => void
}) {
  return (
    <div style={{ position: 'relative', width: 0, height: 0, pointerEvents: 'none' }}>
      <button
        className={`map-extra-spot${selected ? ' map-extra-spot--selected' : ''}`}
        type="button"
        aria-label={spot.name}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onPick(spot.id)
        }}
      >
        <svg className="map-extra-spot__pin" viewBox="0 0 18 23" aria-hidden="true">
          <path d="M9 1.25a7.75 7.75 0 0 0-7.75 7.75c0 5.15 5.45 10.35 7.75 12.55 2.3-2.2 7.75-7.4 7.75-12.55A7.75 7.75 0 0 0 9 1.25Z" />
          <circle cx="9" cy="9" r="2.65" />
        </svg>
        {(selected || showLabel) && <span className="map-extra-spot__label">{spot.name}</span>}
      </button>
    </div>
  )
}

function DeparturePin({ name }: { name: string }) {
  return (
    <div style={{ position: 'relative', width: 0, height: 0, pointerEvents: 'none' }}>
      <span style={{ position: 'absolute', left: -22, top: -22, width: 44, height: 44, borderRadius: '50%', background: 'rgba(47,92,255,.22)', animation: 'maprip 2.4s ease-out infinite' }} />
      <span style={{ position: 'absolute', left: -8, top: -8, width: 16, height: 16, borderRadius: '50%', background: '#2f5cff', border: '3px solid #fff', boxShadow: '0 2px 8px rgba(20,50,140,.45)' }} />
      <span style={{ position: 'absolute', left: 12, top: -9, padding: '3px 8px', borderRadius: 8, background: 'rgba(255,255,255,.92)', color: '#17347f', fontSize: 10.5, fontWeight: 800, whiteSpace: 'nowrap', boxShadow: '0 3px 10px -3px rgba(20,50,140,.35)' }}>
        출발 · {name}
      </span>
    </div>
  )
}

/** 카카오 베이스맵 위에 기존 핀·프리뷰·경로 디자인을 DOM 오버레이로 유지한다. */
export function KakaoMapView({
  pois,
  departure,
  selectedId,
  busyPoiIds,
  extraSpots = EMPTY_EXTRA_SPOTS,
  onPick,
  onOpen,
  courseOrder,
}: MapViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<KakaoMap | null>(null)
  const mapsRef = useRef<KakaoMapsNs | null>(window.kakao?.maps ?? null)
  const routeRef = useRef<KakaoPolyline | null>(null)
  const poiOverlaysRef = useRef<PoiOverlayRecord[]>([])
  const extraOverlaysRef = useRef<ExtraOverlayRecord[]>([])
  const selectionPanTimerRef = useRef<number | null>(null)
  const initialDepartureRef = useRef(departure)
  const onPickRef = useRef(onPick)
  const [ready, setReady] = useState(false)
  const [level, setLevel] = useState(7)
  const [poiHosts, setPoiHosts] = useState<PoiOverlayHost[]>([])
  const [extraHosts, setExtraHosts] = useState<ExtraOverlayHost[]>([])
  const [departureHost, setDepartureHost] = useState<HTMLDivElement | null>(null)

  onPickRef.current = onPick

  const poiById = useMemo(() => new Map(pois.map((poi) => [poi.id, poi])), [pois])
  const extraById = useMemo(() => new Map(extraSpots.map((spot) => [spot.id, spot])), [extraSpots])
  const orderNum = useMemo(() => {
    const order = new Map<string, number>()
    courseOrder?.forEach((id, index) => order.set(id, index + 1))
    return order
  }, [courseOrder])
  const firstCoursePoi = pois.find((poi) => orderNum.has(poi.id))
  const routeColor = firstCoursePoi ? directionOf(firstCoursePoi.direction).color : '#2f5cff'

  useEffect(() => {
    const maps = mapsRef.current
    const container = mapContainerRef.current
    if (!maps || !container) return

    const initialDeparture = initialDepartureRef.current
    const map = new maps.Map(container, {
      center: new maps.LatLng(initialDeparture.lat, initialDeparture.lon),
      level: 7,
    })
    mapRef.current = map
    setLevel(map.getLevel())
    setReady(true)

    const handleMapClick = () => onPickRef.current(null)
    const handleDragStart = () => {
      if (selectionPanTimerRef.current !== null) window.clearTimeout(selectionPanTimerRef.current)
      selectionPanTimerRef.current = null
    }
    const handleZoom = () => setLevel(map.getLevel())
    maps.event.addListener(map, 'click', handleMapClick)
    maps.event.addListener(map, 'dragstart', handleDragStart)
    maps.event.addListener(map, 'zoom_changed', handleZoom)

    return () => {
      maps.event.removeListener(map, 'click', handleMapClick)
      maps.event.removeListener(map, 'dragstart', handleDragStart)
      maps.event.removeListener(map, 'zoom_changed', handleZoom)
      handleDragStart()
      if (mapRef.current === map) mapRef.current = null
      container.replaceChildren()
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    const map = mapRef.current
    const container = mapContainerRef.current
    if (!map || !container) return

    const observer = new ResizeObserver(() => map.relayout())
    observer.observe(container)
    map.relayout()
    return () => observer.disconnect()
  }, [ready])

  const fitAll = useCallback(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!maps || !map) return

    const bounds = new maps.LatLngBounds()
    for (const poi of pois) bounds.extend(new maps.LatLng(poi.lat, poi.lon))
    for (const spot of extraSpots) bounds.extend(new maps.LatLng(spot.lat, spot.lon))
    bounds.extend(new maps.LatLng(departure.lat, departure.lon))
    map.setBounds(bounds, 64, 44, 196, 44)
  }, [departure.lat, departure.lon, extraSpots, pois])

  useEffect(() => {
    if (ready) fitAll()
  }, [fitAll, ready])

  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!ready || !maps || !map) return

    const records = pois.map((poi) => {
      const host = document.createElement('div')
      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(poi.lat, poi.lon),
        content: host,
        xAnchor: 0.5,
        yAnchor: 1,
        zIndex: poi.tier === 1 ? 30 : 20,
        clickable: true,
      })
      overlay.setMap(map)
      return { poiId: poi.id, host, overlay }
    })

    poiOverlaysRef.current = records
    setPoiHosts(records.map(({ poiId, host }) => ({ poiId, host })))

    return () => {
      records.forEach(({ overlay }) => overlay.setMap(null))
      if (poiOverlaysRef.current === records) poiOverlaysRef.current = []
    }
  }, [pois, ready])

  useEffect(() => {
    for (const record of poiOverlaysRef.current) {
      const poi = poiById.get(record.poiId)
      const zIndex = record.poiId === selectedId ? 100 : busyPoiIds?.has(record.poiId) ? 40 : poi?.tier === 1 ? 30 : 20
      record.overlay.setZIndex(zIndex)
    }
  }, [busyPoiIds, poiById, poiHosts, selectedId])

  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!ready || !maps || !map) return

    const records = extraSpots.map((spot) => {
      const host = document.createElement('div')
      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(spot.lat, spot.lon),
        content: host,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 5,
        clickable: true,
      })
      overlay.setMap(map)
      return { spotId: spot.id, host, overlay }
    })

    extraOverlaysRef.current = records
    setExtraHosts(records.map(({ spotId, host }) => ({ spotId, host })))

    return () => {
      records.forEach(({ overlay }) => overlay.setMap(null))
      if (extraOverlaysRef.current === records) extraOverlaysRef.current = []
    }
  }, [extraSpots, ready])

  useEffect(() => {
    for (const record of extraOverlaysRef.current) {
      record.overlay.setZIndex(record.spotId === selectedId ? 9 : 5)
    }
  }, [extraHosts, selectedId])

  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!ready || !maps || !map) return

    const host = document.createElement('div')
    const overlay = new maps.CustomOverlay({
      position: new maps.LatLng(departure.lat, departure.lon),
      content: host,
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: 10,
      clickable: false,
    })
    overlay.setMap(map)
    setDepartureHost(host)

    return () => overlay.setMap(null)
  }, [departure.lat, departure.lon, ready])

  useEffect(() => {
    routeRef.current?.setMap(null)
    routeRef.current = null

    const maps = mapsRef.current
    const map = mapRef.current
    if (!ready || !maps || !map) return

    const path = [new maps.LatLng(departure.lat, departure.lon)]
    let color = routeColor
    let strokeWeight = 2.5
    let strokeOpacity = 0.9

    if (courseOrder && courseOrder.length > 0) {
      for (const id of courseOrder) {
        const poi = poiById.get(id)
        if (poi) path.push(new maps.LatLng(poi.lat, poi.lon))
      }
    } else if (selectedId) {
      const selected = poiById.get(selectedId)
      if (selected) {
        path.push(new maps.LatLng(selected.lat, selected.lon))
        color = directionOf(selected.direction).color
        strokeWeight = 2
        strokeOpacity = 0.85
      }
    }

    if (path.length < 2) return

    const route = new maps.Polyline({
      path,
      strokeWeight,
      strokeColor: color,
      strokeOpacity,
      strokeStyle: 'shortdash',
    })
    route.setMap(map)
    routeRef.current = route

    return () => {
      route.setMap(null)
      if (routeRef.current === route) routeRef.current = null
    }
  }, [courseOrder, departure.lat, departure.lon, poiById, ready, routeColor, selectedId])

  useEffect(() => {
    if (!ready || !selectedId) return
    const maps = mapsRef.current
    const map = mapRef.current
    const point = poiById.get(selectedId) ?? extraById.get(selectedId)
    if (!maps || !map || !point) return

    map.panTo(new maps.LatLng(point.lat, point.lon))
    const timeoutId = window.setTimeout(() => {
      const height = wrapRef.current?.clientHeight ?? 0
      if (mapRef.current === map) map.panBy(0, Math.round(height * 0.12))
      selectionPanTimerRef.current = null
    }, 300)
    selectionPanTimerRef.current = timeoutId
    return () => {
      window.clearTimeout(timeoutId)
      if (selectionPanTimerRef.current === timeoutId) selectionPanTimerRef.current = null
    }
  }, [extraById, poiById, ready, selectedId])

  const zoomIn = () => {
    const map = mapRef.current
    if (map) map.setLevel(Math.max(1, map.getLevel() - 1), { animate: true })
  }

  const zoomOut = () => {
    const map = mapRef.current
    if (map) map.setLevel(map.getLevel() + 1, { animate: true })
  }

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#c3dcf9' }}>
      <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />

      {poiHosts.map(({ poiId, host }) => {
        const poi = poiById.get(poiId)
        if (!poi) return null
        return createPortal(
          <PoiPin
            key={poiId}
            poi={poi}
            selected={poiId === selectedId}
            busy={busyPoiIds?.has(poiId) ?? false}
            order={orderNum.get(poiId)}
            showLabel={level <= 5}
            onPick={onPick}
            onOpen={onOpen}
          />,
          host,
          poiId,
        )
      })}
      {extraHosts.map(({ spotId, host }) => {
        const spot = extraById.get(spotId)
        if (!spot) return null
        return createPortal(
          <ExtraSpotPin
            key={spotId}
            spot={spot}
            selected={spotId === selectedId}
            showLabel={level <= 4}
            onPick={onPick}
          />,
          host,
          spotId,
        )
      })}
      {departureHost && createPortal(<DeparturePin name={departure.name} />, departureHost)}

      <div style={{ position: 'absolute', right: 14, top: 14, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="l-icon-btn" aria-label="확대" onPointerDown={(event) => event.stopPropagation()} onClick={zoomIn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3a5a9e" strokeWidth={2.6} strokeLinecap="round" aria-hidden>
            <path d="M12 5 v14 M5 12 h14" />
          </svg>
        </button>
        <button className="l-icon-btn" aria-label="축소" onPointerDown={(event) => event.stopPropagation()} onClick={zoomOut}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3a5a9e" strokeWidth={2.6} strokeLinecap="round" aria-hidden>
            <path d="M5 12 h14" />
          </svg>
        </button>
        <button className="l-icon-btn" aria-label="전체 보기" onPointerDown={(event) => event.stopPropagation()} onClick={fitAll}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3a5a9e" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
            <path d="M9 4 H4 v5 M15 4 h5 v5 M9 20 H4 v-5 M15 20 h5 v-5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
