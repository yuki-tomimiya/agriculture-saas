'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import * as leaflet from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { FarmCoordinates } from '@/lib/farms/coordinates'

const tiles = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'
const attribution = '<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'

type MapCenter = FarmCoordinates & { zoom: number }

export default function FarmLocationMap({
  point, center, disabled, onPick,
}: {
  point: FarmCoordinates | null
  center?: MapCenter | null
  disabled: boolean
  onPick: (point: FarmCoordinates) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<leaflet.Map | null>(null)
  const marker = useRef<leaflet.Marker | null>(null)
  const [tileError, setTileError] = useState(false)
  const selectPoint = useEffectEvent(({ lat, lng }: leaflet.LatLng) => {
    if (!disabled) onPick({ latitude: lat, longitude: lng })
  })
  const initialView = useEffectEvent(() => point
    ? { ...point, zoom: 13 }
    : center ?? { latitude: 36.5, longitude: 138.5, zoom: 5 })

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
    if (center) map.current?.setView([center.latitude, center.longitude], center.zoom)
  }, [center])

  useEffect(() => {
    const current = map.current
    if (!current) return
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
    if (!current.getBounds().contains(position)) current.panTo(position, { animate: false })
  }, [point, disabled])

  return (
    <div className="min-w-0">
      <div ref={container} aria-label="農場の場所を選ぶ地図"
        className="relative isolate h-56 w-full rounded-md border border-gray-200 sm:h-80" />
      {tileError && <p role="status" className="mt-2 text-sm text-gray-700">
        地図を読み込めない場所があります。地図で選べないときは、現在地か緯度・経度の入力を使ってください。
      </p>}
    </div>
  )
}
