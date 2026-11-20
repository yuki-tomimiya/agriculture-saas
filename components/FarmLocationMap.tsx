'use client'

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import * as leaflet from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { FarmCoordinates } from '@/lib/farms/coordinates'
import type { FarmArea } from '@/lib/farms/registration-area'
import { PREFECTURES, municipalitiesIn } from '@/lib/places/catalog'
import { MUNICIPALITY_POINT_SOURCE, municipalityMapCenter, prefectureMapCenter } from '@/lib/places/map-center'

const tiles = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'
const attribution = '<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'

export default function FarmLocationMap({
  point, area, disabled, onPick, onAreaChange,
}: {
  point: FarmCoordinates | null
  area: FarmArea
  disabled: boolean
  onPick: (point: FarmCoordinates) => void
  onAreaChange: (area: FarmArea) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<leaflet.Map | null>(null)
  const marker = useRef<leaflet.Marker | null>(null)
  const previousPoint = useRef(point)
  const [tileError, setTileError] = useState(false)
  const { prefectureCode, municipalityCode } = area
  const municipalities = prefectureCode ? municipalitiesIn(prefectureCode) : []
  const center = useMemo(() => {
    const municipality = municipalityMapCenter(municipalityCode)
    if (municipality) return { ...municipality, zoom: 12 }
    const prefecture = prefectureMapCenter(prefectureCode)
    return prefecture ? { ...prefecture, zoom: 8 } : null
  }, [prefectureCode, municipalityCode])
  const selectPoint = useEffectEvent(({ lat, lng }: leaflet.LatLng) => {
    if (!disabled) onPick({ latitude: lat, longitude: lng })
  })
  const initialView = useEffectEvent(() => center ??
    (point ? { ...point, zoom: 13 } : { latitude: 36.5, longitude: 138.5, zoom: 5 }))

  useEffect(() => {
    if (!container.current) return
    const view = initialView()
    const current = leaflet.map(container.current, {
      minZoom: 5, maxZoom: 18, scrollWheelZoom: false,
    }).setView([view.latitude, view.longitude], view.zoom)
    map.current = current
    current.attributionControl.setPrefix(false)
    leaflet.tileLayer(tiles, { attribution, noWrap: true, keepBuffer: 0, updateWhenIdle: true })
      .on('loading', () => setTileError(false))
      .on('tileerror', () => setTileError(true))
      .addTo(current)
    current.on('click', (event: leaflet.LeafletMouseEvent) => selectPoint(event.latlng))
    return () => {
      current.remove()
      map.current = null
      marker.current = null
    }
  }, [])

  useEffect(() => {
    if (center) {
      map.current?.setView([center.latitude, center.longitude], center.zoom, { animate: false })
    }
  }, [center])

  useEffect(() => {
    const current = map.current
    if (!current) return
    const pointChanged = previousPoint.current !== point
    previousPoint.current = point
    if (!point) {
      marker.current?.remove()
      marker.current = null
      return
    }
    const position = leaflet.latLng(point.latitude, point.longitude)
    if (marker.current) {
      marker.current.setLatLng(position)
    } else {
      const pin = leaflet.marker(position, {
        title: '選んだ地点',
        alt: '選んだ地点',
        draggable: true,
        icon: leaflet.divIcon({
          className: 'rounded-full border-2 border-white bg-green-700 shadow',
          iconSize: [20, 20],
        }),
      }).addTo(current)
      pin.on('dragend', () => selectPoint(pin.getLatLng()))
      marker.current = pin
    }
    if (disabled) marker.current.dragging?.disable()
    else marker.current.dragging?.enable()
    if (pointChanged && !current.getBounds().contains(position)) current.panTo(position, { animate: false })
  }, [point, disabled])

  return (
    <div className="min-w-0">
      <fieldset disabled={disabled} className="mb-2 grid min-w-0 gap-2">
        <legend className="text-sm font-semibold">地図の表示位置</legend>
        <label className="grid min-w-0 gap-1 text-sm">都道府県
          <select className="input min-w-0" value={prefectureCode} onChange={event =>
            onAreaChange({ prefectureCode: event.target.value, municipalityCode: '' })}>
            <option value="">選んでください</option>
            {PREFECTURES.map(prefecture =>
              <option key={prefecture.code} value={prefecture.code}>{prefecture.name}</option>)}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm">市区町村
          <select className="input min-w-0" disabled={!prefectureCode} value={municipalityCode}
            onChange={event => onAreaChange({ prefectureCode, municipalityCode: event.target.value })}>
            <option value="">選んでください</option>
            {municipalities.map(municipality =>
              <option key={municipality.code} value={municipality.code}>{municipality.name}</option>)}
          </select>
        </label>
      </fieldset>
      <div ref={container} aria-label="農場の場所を選ぶ地図"
        className="relative isolate h-56 w-full rounded-md border border-gray-200 sm:h-80" />
      <p className="mt-2 text-xs text-gray-600">
        出典：<a href={MUNICIPALITY_POINT_SOURCE.url} className="underline">{MUNICIPALITY_POINT_SOURCE.text}</a>{' '}
        <a href={MUNICIPALITY_POINT_SOURCE.licenseUrl} className="underline">{MUNICIPALITY_POINT_SOURCE.license}</a>
      </p>
      {tileError && <p role="status" className="mt-2 text-sm text-gray-700">
        地図を読み込めない場所があります。地図で選べないときは、現在地か緯度・経度の入力を使ってください。
      </p>}
    </div>
  )
}
