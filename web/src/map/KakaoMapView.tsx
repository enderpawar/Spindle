import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapPoiPreview } from '../components/MapPoiPreview'
import { type Poi } from '../mock/pois'
import type { MapViewProps } from './LocalMapView'
import { CLOSED_PIN_OPACITY, COURSE_PIN_SIZE, DEFAULT_PIN_COLOR, MAP_PIN_SIZE, MapClusterPin, MapPin, pinColorOf } from './MapPin'
import type { KakaoCustomOverlay, KakaoMap, KakaoMapsNs, KakaoPolyline } from './kakaoLoader'
import { mapPinLabel, type CongestionVisualStatus } from './congestionStatus'
import {
  buildPinLayout,
  densityModeForKakao,
  pinLayerOf,
  PIN_LAYER,
  type PinCluster,
  type PinLayoutResult,
} from './pinLayout'

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

interface ClusterOverlayHost {
  clusterId: string
  host: HTMLDivElement
}

interface ClusterOverlayRecord extends ClusterOverlayHost {
  overlay: KakaoCustomOverlay
}

interface PoiPinProps {
  poi: Poi
  selected: boolean
  status?: CongestionVisualStatus
  /** 운영 중단·운영시간 외 — 핀을 흐리게 그린다 */
  closed: boolean
  order?: number
  showLabel: boolean
  onPick: (id: string | null) => void
  onOpen?: (poi: Poi) => void
  showPreview: boolean
}

function PoiPin({ poi, selected, status, closed, order, showLabel, onPick, onOpen, showPreview }: PoiPinProps) {
  const color = pinColorOf(poi)
  const inCourse = order !== undefined
  const sizePx = inCourse ? COURSE_PIN_SIZE : MAP_PIN_SIZE

  return (
    <div style={{ position: 'relative', width: 0, height: 0, pointerEvents: 'none' }}>
      <button
        className="map-pin"
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onPick(poi.id)
        }}
        aria-label={mapPinLabel(poi.name, closed, status)}
        style={closed ? { opacity: CLOSED_PIN_OPACITY } : undefined}
      >
        <MapPin
          color={color}
          size={sizePx}
          order={order}
          selected={selected}
          variant={inCourse ? 'course' : 'curated'}
          status={status}
          label={selected || showLabel || inCourse ? poi.name : undefined}
        />
      </button>

      {selected && showPreview && <MapPoiPreview poi={poi} color={color} onOpen={onOpen} />}
    </div>
  )
}

function ExtraSpotPin({ spot, selected, status, closed, showLabel, onPick, onOpen, showPreview }: {
  spot: ExtraSpot
  selected: boolean
  status?: CongestionVisualStatus
  closed: boolean
  showLabel: boolean
  onPick: (id: string | null) => void
  onOpen?: (poi: Poi) => void
  showPreview: boolean
}) {
  const color = pinColorOf(spot)

  return (
    <div style={{ position: 'relative', width: 0, height: 0, pointerEvents: 'none' }}>
      <button
        className="map-pin"
        type="button"
        style={closed ? { opacity: CLOSED_PIN_OPACITY } : undefined}
        aria-label={mapPinLabel(spot.name, closed, status)}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onPick(spot.id)
        }}
      >
        <MapPin
          color={color}
          size={MAP_PIN_SIZE}
          selected={selected}
          variant="standard"
          status={status}
          label={selected || showLabel ? spot.name : undefined}
        />
      </button>

      {selected && showPreview && <MapPoiPreview poi={spot} color={color} onOpen={onOpen} />}
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

function CurrentPositionPin({ headingDeg }: { headingDeg: number }) {
  return (
    <div className="map-current-position" role="img" aria-label="현재 위치">
      <span className="map-current-position__accuracy" />
      <span className="map-current-position__heading" style={{ transform: `translateX(-50%) rotate(${headingDeg}deg)` }} />
      <span className="map-current-position__dot" />
    </div>
  )
}

/** 카카오 베이스맵 위에 기존 핀·프리뷰·경로 디자인을 DOM 오버레이로 유지한다. */
export function KakaoMapView({
  pois,
  departure,
  selectedId,
  statusByPoiId,
  closedPoiIds,
  extraSpots = EMPTY_EXTRA_SPOTS,
  onPick,
  onOpen,
  showSelectedPreview = true,
  selectionOffsetRatio = 0.12,
  courseOrder,
  currentPosition,
  currentHeadingDeg = 0,
  navigationMode = false,
  followCurrentPosition = false,
  pickMode = false,
  onPickPoint,
  focusPoint,
}: MapViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<KakaoMap | null>(null)
  const mapsRef = useRef<KakaoMapsNs | null>(window.kakao?.maps ?? null)
  const routeRef = useRef<KakaoPolyline | null>(null)
  const poiOverlaysRef = useRef<PoiOverlayRecord[]>([])
  const extraOverlaysRef = useRef<ExtraOverlayRecord[]>([])
  const clusterOverlaysRef = useRef<ClusterOverlayRecord[]>([])
  const selectionPanTimerRef = useRef<number | null>(null)
  const followTimerRef = useRef<number | null>(null)
  const latestFollowPositionRef = useRef(currentPosition)
  const currentOverlayRef = useRef<KakaoCustomOverlay | null>(null)
  const routeStyleRef = useRef<string | null>(null)
  const initialDepartureRef = useRef(departure)
  const onPickRef = useRef(onPick)
  const [ready, setReady] = useState(false)
  const [level, setLevel] = useState(7)
  const [layoutRevision, setLayoutRevision] = useState(0)
  const [poiHosts, setPoiHosts] = useState<PoiOverlayHost[]>([])
  const [extraHosts, setExtraHosts] = useState<ExtraOverlayHost[]>([])
  const [clusterHosts, setClusterHosts] = useState<ClusterOverlayHost[]>([])
  const [departureHost, setDepartureHost] = useState<HTMLDivElement | null>(null)
  const [currentPositionHost, setCurrentPositionHost] = useState<HTMLDivElement | null>(null)

  const onPickPointRef = useRef(onPickPoint)

  onPickRef.current = onPick
  onPickPointRef.current = onPickPoint
  latestFollowPositionRef.current = currentPosition

  const poiById = useMemo(() => new Map(pois.map((poi) => [poi.id, poi])), [pois])
  const extraById = useMemo(() => new Map(extraSpots.map((spot) => [spot.id, spot])), [extraSpots])
  const orderNum = useMemo(() => {
    const order = new Map<string, number>()
    courseOrder?.forEach((id, index) => order.set(id, index + 1))
    return order
  }, [courseOrder])
  const firstCoursePoi = pois.find((poi) => orderNum.has(poi.id))
  const routeColor = firstCoursePoi ? pinColorOf(firstCoursePoi) : DEFAULT_PIN_COLOR

  const pinLayout = useMemo<PinLayoutResult>(() => {
    void layoutRevision
    const allVisible = () => ({
      visibleIds: new Set([...pois.map((poi) => poi.id), ...extraSpots.map((spot) => spot.id)]),
      clusters: [],
    })
    const maps = mapsRef.current
    const map = mapRef.current
    if (!ready || !maps || !map || navigationMode || pickMode || (courseOrder?.length ?? 0) > 0) {
      return allVisible()
    }

    try {
      const projection = map.getProjection()
      return buildPinLayout([
        ...pois.map((poi) => {
          const point = projection.containerPointFromCoords(new maps.LatLng(poi.lat, poi.lon))
          return {
            id: poi.id,
            kind: 'curated' as const,
            tier: poi.tier,
            selected: poi.id === selectedId,
            screenX: point.x,
            screenY: point.y,
            positionX: poi.lon,
            positionY: poi.lat,
          }
        }),
        ...extraSpots.map((spot) => {
          const point = projection.containerPointFromCoords(new maps.LatLng(spot.lat, spot.lon))
          return {
            id: spot.id,
            kind: 'standard' as const,
            selected: spot.id === selectedId,
            screenX: point.x,
            screenY: point.y,
            positionX: spot.lon,
            positionY: spot.lat,
          }
        }),
      ], densityModeForKakao(level))
    } catch {
      return allVisible()
    }
  }, [courseOrder, extraSpots, layoutRevision, level, navigationMode, pickMode, pois, ready, selectedId])
  const clusterById = useMemo(
    () => new Map(pinLayout.clusters.map((cluster) => [cluster.id, cluster])),
    [pinLayout.clusters],
  )
  // 팬 이동은 화면 좌표만 바꾸므로 같은 묶음의 CustomOverlay·React 포털을 재사용한다.
  const clusterOverlayKey = useMemo(
    () => pinLayout.clusters
      .map((cluster) => `${cluster.id}@${cluster.positionX},${cluster.positionY}`)
      .join('\u001f'),
    [pinLayout.clusters],
  )

  useEffect(() => {
    const maps = mapsRef.current
    const container = mapContainerRef.current
    if (!maps || !container) return

    const initialDeparture = initialDepartureRef.current
    const map = new maps.Map(container, {
      center: new maps.LatLng(initialDeparture.lat, initialDeparture.lon),
      level: navigationMode ? 5 : pickMode ? 4 : 7,
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
    // 찍기 모드의 중심 보고와 핀 묶음 재계산을 같은 idle 이벤트에서 처리한다.
    const handleIdle = () => {
      setLayoutRevision((value) => value + 1)
      if (!pickMode) return
      const center = map.getCenter()
      onPickPointRef.current?.({ lat: center.getLat(), lng: center.getLng() })
    }
    const idleEvent = 'idle' as Parameters<typeof maps.event.addListener>[1]
    maps.event.addListener(map, 'click', handleMapClick)
    maps.event.addListener(map, 'dragstart', handleDragStart)
    maps.event.addListener(map, 'zoom_changed', handleZoom)
    maps.event.addListener(map, idleEvent, handleIdle)
    if (pickMode) handleIdle()

    return () => {
      maps.event.removeListener(map, 'click', handleMapClick)
      maps.event.removeListener(map, 'dragstart', handleDragStart)
      maps.event.removeListener(map, 'zoom_changed', handleZoom)
      maps.event.removeListener(map, idleEvent, handleIdle)
      handleDragStart()
      if (followTimerRef.current !== null) window.clearTimeout(followTimerRef.current)
      followTimerRef.current = null
      if (mapRef.current === map) mapRef.current = null
      container.replaceChildren()
    }
  }, [navigationMode, pickMode])

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

    // 찍기 모드에서 departure는 "지금 화면 중앙"이라 다시 맞출 대상이 없다.
    if (pickMode) return

    if (navigationMode) {
      map.setCenter(new maps.LatLng(departure.lat, departure.lon))
      map.setLevel(5)
      return
    }

    const bounds = new maps.LatLngBounds()
    for (const poi of pois) bounds.extend(new maps.LatLng(poi.lat, poi.lon))
    for (const spot of extraSpots) bounds.extend(new maps.LatLng(spot.lat, spot.lon))
    bounds.extend(new maps.LatLng(departure.lat, departure.lon))
    map.setBounds(bounds, 64, 44, 196, 44)
  }, [departure.lat, departure.lon, extraSpots, navigationMode, pickMode, pois])

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
      const closed = closedPoiIds?.has(record.poiId) ?? false
      const status = closed ? undefined : statusByPoiId?.get(record.poiId)
      const zIndex = pinLayerOf({
        selected: record.poiId === selectedId,
        status,
        kind: 'curated',
      })
      record.overlay.setZIndex(zIndex)
    }
  }, [closedPoiIds, poiById, poiHosts, selectedId, statusByPoiId])

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
      const closed = closedPoiIds?.has(record.spotId) ?? false
      const status = closed ? undefined : statusByPoiId?.get(record.spotId)
      record.overlay.setZIndex(pinLayerOf({
        selected: record.spotId === selectedId,
        status,
        kind: 'standard',
      }))
    }
  }, [closedPoiIds, extraHosts, selectedId, statusByPoiId])

  useEffect(() => {
    for (const record of poiOverlaysRef.current) {
      record.host.style.display = pinLayout.visibleIds.has(record.poiId) ? '' : 'none'
    }
    for (const record of extraOverlaysRef.current) {
      record.host.style.display = pinLayout.visibleIds.has(record.spotId) ? '' : 'none'
    }
  }, [extraHosts, pinLayout.visibleIds, poiHosts])

  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!ready || !maps || !map) return

    const records = pinLayout.clusters.map((cluster) => {
      const host = document.createElement('div')
      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(cluster.positionY, cluster.positionX),
        content: host,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: PIN_LAYER.cluster,
        clickable: true,
      })
      overlay.setMap(map)
      return { clusterId: cluster.id, host, overlay }
    })

    clusterOverlaysRef.current = records
    setClusterHosts(records.map(({ clusterId, host }) => ({ clusterId, host })))
    return () => {
      records.forEach(({ overlay }) => overlay.setMap(null))
      if (clusterOverlaysRef.current === records) clusterOverlaysRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 같은 id·좌표 묶음은 기존 포털 host를 유지한다
  }, [clusterOverlayKey, ready])

  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!ready || !maps || !map) return

    // 찍기 모드에서는 중앙 십자선이 출발 마커를 대신한다.
    if (navigationMode || pickMode) {
      setDepartureHost(null)
      return
    }

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
  }, [departure.lat, departure.lon, navigationMode, pickMode, ready])

  // 내 위치 등 외부에서 지정한 좌표로 이동 (찍기 모드 전용)
  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!ready || !pickMode || !focusPoint || !maps || !map) return
    map.panTo(new maps.LatLng(focusPoint.lat, focusPoint.lng))
    if (map.getLevel() > 4) map.setLevel(4, { animate: true })
  }, [focusPoint, pickMode, ready])

  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!ready || !navigationMode || !currentPosition || !maps || !map) return

    if (!currentOverlayRef.current) {
      const host = document.createElement('div')
      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(currentPosition.lat, currentPosition.lng),
        content: host,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 120,
        clickable: false,
      })
      overlay.setMap(map)
      currentOverlayRef.current = overlay
      setCurrentPositionHost(host)
      return
    }

    currentOverlayRef.current.setPosition(new maps.LatLng(currentPosition.lat, currentPosition.lng))
  }, [currentPosition, navigationMode, ready])

  useEffect(() => () => {
    currentOverlayRef.current?.setMap(null)
    currentOverlayRef.current = null
  }, [])

  useEffect(() => {
    if (navigationMode) return
    currentOverlayRef.current?.setMap(null)
    currentOverlayRef.current = null
    setCurrentPositionHost(null)
  }, [navigationMode])

  // 가상 GPS만 지도 카메라가 추종한다. 실제 GPS 좌표는 카카오 지도 중심·타일 요청에 쓰지 않는다.
  useEffect(() => {
    if (!ready || !navigationMode || !followCurrentPosition || !currentPosition) return
    if (followTimerRef.current !== null) return

    followTimerRef.current = window.setTimeout(() => {
      followTimerRef.current = null
      const maps = mapsRef.current
      const map = mapRef.current
      const point = latestFollowPositionRef.current
      if (!maps || !map || !point) return
      map.setCenter(new maps.LatLng(point.lat, point.lng))
    }, 120)

  }, [currentPosition, followCurrentPosition, navigationMode, ready])

  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!ready || !maps || !map) return

    const routeStart = navigationMode && currentPosition
      ? new maps.LatLng(currentPosition.lat, currentPosition.lng)
      : new maps.LatLng(departure.lat, departure.lon)
    const path = [routeStart]
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
        color = pinColorOf(selected)
        strokeWeight = 2
        strokeOpacity = 0.85
      }
    }

    if (path.length < 2) {
      routeRef.current?.setMap(null)
      routeRef.current = null
      routeStyleRef.current = null
      return
    }

    const routeStyle = `${color}:${strokeWeight}:${strokeOpacity}`
    if (routeRef.current && routeStyleRef.current === routeStyle) {
      routeRef.current.setPath(path)
      return
    }

    routeRef.current?.setMap(null)

    const route = new maps.Polyline({
      path,
      strokeWeight,
      strokeColor: color,
      strokeOpacity,
      strokeStyle: 'shortdash',
    })
    route.setMap(map)
    routeRef.current = route
    routeStyleRef.current = routeStyle
  }, [courseOrder, currentPosition, departure.lat, departure.lon, navigationMode, poiById, ready, routeColor, selectedId])

  useEffect(() => () => {
    routeRef.current?.setMap(null)
    routeRef.current = null
    routeStyleRef.current = null
  }, [])

  useEffect(() => {
    if (!ready || !selectedId) return
    const maps = mapsRef.current
    const map = mapRef.current
    const point = poiById.get(selectedId) ?? extraById.get(selectedId)
    if (!maps || !map || !point) return

    const target = new maps.LatLng(point.lat, point.lon)
    const offsetPx = Math.round((wrapRef.current?.clientHeight ?? 0) * selectionOffsetRatio)

    // 핀을 화면 정중앙이 아니라 하단 시트 위쪽의 가운데에 놓는다.
    // 좌표↔컨테이너 픽셀 변환으로 목표 중심을 미리 구해 panTo 한 번으로 부드럽게 이동한다
    // (예전의 panTo → 300ms 뒤 panBy 2단계는 큰 오프셋에서 두 번 움직이는 것처럼 보였다).
    if (offsetPx > 0) {
      try {
        const projection = map.getProjection()
        const pin = projection.containerPointFromCoords(target)
        map.panTo(projection.coordsFromContainerPoint(new maps.Point(pin.x, pin.y + offsetPx)))
        return
      } catch {
        /* 프로젝션 API를 쓸 수 없는 환경은 아래 2단계 방식으로 내려간다 */
      }
    }

    map.panTo(target)
    if (offsetPx <= 0) return
    const timeoutId = window.setTimeout(() => {
      if (mapRef.current === map) map.panBy(0, offsetPx)
      selectionPanTimerRef.current = null
    }, 300)
    selectionPanTimerRef.current = timeoutId
    return () => {
      window.clearTimeout(timeoutId)
      if (selectionPanTimerRef.current === timeoutId) selectionPanTimerRef.current = null
    }
  }, [extraById, poiById, ready, selectedId, selectionOffsetRatio])

  const zoomIn = () => {
    const map = mapRef.current
    if (map) map.setLevel(Math.max(1, map.getLevel() - 1), { animate: true })
  }

  const zoomOut = () => {
    const map = mapRef.current
    if (map) map.setLevel(map.getLevel() + 1, { animate: true })
  }

  const openCluster = (cluster: PinCluster) => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!maps || !map) return
    onPick(null)
    map.setCenter(new maps.LatLng(cluster.positionY, cluster.positionX))
    map.setLevel(Math.max(1, map.getLevel() - 1), { animate: true })
  }

  return (
    // isolation: 핀 오버레이(z 20~120)와 줌 컨트롤(z 200)을 지도 안에 가둔다. 없으면
    // z-index:auto라 쌓임 맥락이 안 생겨 부모 맥락으로 올라오고, 명소 시트(.spot-sheet
    // z-12)와 출처 표기(.spots-source-overlay z-10) 위에 그려진다.
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, isolation: 'isolate', overflow: 'hidden', background: '#c3dcf9' }}>
      <div
        ref={mapContainerRef}
        style={{ position: 'absolute', inset: navigationMode ? '0 0 min(48dvh, 430px) 0' : 0 }}
      />

      {poiHosts.map(({ poiId, host }) => {
        const poi = poiById.get(poiId)
        if (!poi) return null
        const closed = closedPoiIds?.has(poiId) ?? false
        const status = closed ? undefined : statusByPoiId?.get(poiId)
        return createPortal(
          <PoiPin
            key={poiId}
            poi={poi}
            showPreview={showSelectedPreview}
            selected={poiId === selectedId}
            status={status}
            closed={closed}
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
        const closed = closedPoiIds?.has(spotId) ?? false
        const status = closed ? undefined : statusByPoiId?.get(spotId)
        return createPortal(
          <ExtraSpotPin
            key={spotId}
            spot={spot}
            selected={spotId === selectedId}
            status={status}
            closed={closed}
            showLabel={level <= 4}
            onPick={onPick}
            onOpen={onOpen}
            showPreview={showSelectedPreview}
          />,
          host,
          spotId,
        )
      })}
      {clusterHosts.map(({ clusterId, host }) => {
        const cluster = clusterById.get(clusterId)
        if (!cluster) return null
        return createPortal(
          <MapClusterPin count={cluster.count} onClick={() => openCluster(cluster)} />,
          host,
          clusterId,
        )
      })}
      {departureHost && !navigationMode && createPortal(<DeparturePin name={departure.name} />, departureHost)}
      {currentPositionHost && navigationMode && createPortal(<CurrentPositionPin headingDeg={currentHeadingDeg} />, currentPositionHost)}

      <div style={{ position: 'absolute', right: 14, top: navigationMode ? 76 : 14, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
        {!pickMode && (
          <button className="l-icon-btn" aria-label="전체 보기" onPointerDown={(event) => event.stopPropagation()} onClick={fitAll}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3a5a9e" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
              <path d="M9 4 H4 v5 M15 4 h5 v5 M9 20 H4 v-5 M15 20 h5 v-5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
