'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import FarmPlaceCard from '@/components/FarmPlaceCard'
import { readFarmCoordinates, roundFarmCoordinates, type FarmCoordinates } from '@/lib/farms/coordinates'
import { initialFarmArea, type FarmArea } from '@/lib/farms/registration-area'
import type { PlaceCard } from '@/lib/farms/place-card'
import { PREFECTURES, municipalitiesIn } from '@/lib/places/catalog'

function FarmMapUnavailable() {
  return <p role="status" className="text-sm">
    地図を読み込めませんでした。現在地か緯度・経度の入力を使ってください。
  </p>
}

const FarmLocationMap = dynamic(
  () => import('@/components/FarmLocationMap').catch(() => FarmMapUnavailable),
  { ssr: false, loading: () => <p role="status" className="text-sm">地図を読み込んでいます。</p> },
)

type PlaceState = { status: 'idle' | 'locating' } |
  { status: 'loading'; point: FarmCoordinates } |
  { status: 'ready'; point: FarmCoordinates; card: PlaceCard } |
  { status: 'error'; point: FarmCoordinates; message: string }

const emptyArea: FarmArea = { prefectureCode: '', municipalityCode: '' }

export default function NewFarmForm() {
  const router = useRouter()
  const [place, setPlace] = useState<PlaceState>({ status: 'idle' })
  const [manualOpen, setManualOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [{ mapArea, saveArea }, setAreas] = useState({ mapArea: emptyArea, saveArea: emptyArea })
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [locationError, setLocationError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const requestNumber = useRef(0)
  const previewRequest = useRef<AbortController | null>(null)

  useEffect(() => () => {
    requestNumber.current += 1
    previewRequest.current?.abort()
  }, [])

  function resetLocationRequest() {
    previewRequest.current?.abort()
    requestNumber.current += 1
    setLocationError('')
    setSaveError('')
    return requestNumber.current
  }

  async function preview(point: FarmCoordinates, retryWeather = false) {
    const number = resetLocationRequest()
    const controller = new AbortController()
    previewRequest.current = controller
    setPlace({ status: 'loading', point })
    try {
      const response = await fetch('/api/farms/place-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...point, retryWeather }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(data?.error ?? 'この土地のカードを取得できませんでした。')
      }
      const card = await response.json() as PlaceCard
      if (controller.signal.aborted || number !== requestNumber.current) return
      setAreas(areas => ({
        ...areas,
        saveArea: initialFarmArea(areas.saveArea, areas.mapArea, card.suggestion?.prefectureCode ?? ''),
      }))
      setPlace({ status: 'ready', point, card })
    } catch (error) {
      if (controller.signal.aborted || number !== requestNumber.current) return
      setPlace({ status: 'error', point,
        message: error instanceof Error && error.name !== 'TypeError' ? error.message : 'この土地のカードを取得できませんでした。' })
    }
  }

  function choosePoint(point: FarmCoordinates) {
    const rounded = roundFarmCoordinates(point)
    setLatitude(String(rounded.latitude))
    setLongitude(String(rounded.longitude))
    void preview(rounded)
  }

  function changeMapArea(area: FarmArea) {
    setAreas(areas => ({
      mapArea: area,
      saveArea: place.status === 'ready' && area.municipalityCode
        ? initialFarmArea(areas.saveArea, area, '')
        : areas.saveArea,
    }))
  }

  function toggleMap() {
    if (!mapOpen && !mapArea.prefectureCode) {
      setAreas(areas => ({ ...areas, mapArea: areas.saveArea }))
    }
    setMapOpen(!mapOpen)
  }

  function chooseCurrentLocation() {
    const number = resetLocationRequest()
    const showManualEntry = (message: string) => {
      if (number !== requestNumber.current) return
      setPlace({ status: 'idle' })
      setLocationError(message)
      setManualOpen(true)
    }
    if (!window.isSecureContext || !navigator.geolocation) {
      showManualEntry('この接続では現在地を取得できません。緯度・経度を入力してください。')
      return
    }
    setPlace({ status: 'locating' })
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (number !== requestNumber.current) return
        const point = readFarmCoordinates(coords.latitude, coords.longitude)
        if (!point) {
          showManualEntry('現在地を取得できませんでした。緯度・経度を入力してください。')
          return
        }
        choosePoint(point)
      },
      error => showManualEntry(error.code === error.PERMISSION_DENIED
        ? '位置情報の利用が許可されませんでした。緯度・経度を入力してください。'
        : '現在地を取得できませんでした。緯度・経度を入力してください。'),
      { timeout: 10000 },
    )
  }

  function editCoordinates(update: (value: string) => void, value: string) {
    resetLocationRequest()
    setPlace({ status: 'idle' })
    update(value)
  }

  function chooseManualLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const point = readFarmCoordinates(latitude, longitude)
    if (!point) {
      setLocationError('緯度・経度を正しく入力してください。')
      return
    }
    void preview(point)
  }

  async function saveFarm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (place.status !== 'ready' || saving) return
    setSaving(true)
    setSaveError('')
    const fields = new FormData(event.currentTarget)
    try {
      const response = await fetch('/api/farms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...place.point,
          name: String(fields.get('name') ?? '').trim(),
          description: String(fields.get('description') ?? '').trim() || null,
          ...saveArea,
        }),
      })
      const data = await response.json() as { farm?: { id: string }; error?: string }
      if (!response.ok || !data.farm) {
        setSaveError(data.error ?? '農場の登録に失敗しました。')
        setSaving(false)
        return
      }
      router.push(`/farms/${data.farm.id}`)
      router.refresh()
    } catch {
      setSaveError('農場の登録に失敗しました。')
      setSaving(false)
    }
  }

  const suggestion = place.status === 'ready' ? place.card.suggestion : null
  const { prefectureCode, municipalityCode } = saveArea
  const cities = prefectureCode ? municipalitiesIn(prefectureCode) : []
  const point = 'point' in place ? place.point : null
  return (
    <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
      <section aria-labelledby="farm-location-heading">
        <h2 id="farm-location-heading" className="text-lg font-semibold">場所を選ぶ</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-primary max-w-full whitespace-normal !px-2" type="button"
            onClick={chooseCurrentLocation} disabled={saving || place.status === 'locating'}>現在地を使う</button>
          <button className="btn btn-outline max-w-full whitespace-normal !px-2" type="button"
            aria-controls="farm-map" aria-expanded={mapOpen} disabled={saving}
            onClick={toggleMap}>{mapOpen ? '地図を閉じる' : '地図で選ぶ'}</button>
          <button className="btn btn-outline max-w-full whitespace-normal !px-2" type="button"
            aria-controls="farm-coordinates" aria-expanded={manualOpen} disabled={saving}
            onClick={() => setManualOpen(!manualOpen)}>緯度・経度を入れる</button>
        </div>
        <div id="farm-map" hidden={!mapOpen}>
          {mapOpen && <div className="mt-3 space-y-2">
            <p className="text-sm text-gray-700">地図を押して、農場の位置に印を置きます。</p>
            <FarmLocationMap point={point} onPick={choosePoint} disabled={saving}
              area={mapArea} onAreaChange={changeMapArea} />
          </div>}
        </div>
        <form id="farm-coordinates" onSubmit={chooseManualLocation} hidden={!manualOpen}>
          <fieldset disabled={saving} className="mt-3 grid min-w-0 gap-2">
            <label className="grid min-w-0 gap-1">緯度
              <input className="input min-w-0" value={latitude} inputMode="decimal" required
                onChange={e => editCoordinates(setLatitude, e.target.value)} />
            </label>
            <label className="grid min-w-0 gap-1">経度
              <input className="input min-w-0" value={longitude} inputMode="decimal" required
                onChange={e => editCoordinates(setLongitude, e.target.value)} />
            </label>
            <button type="submit" className="btn btn-outline max-w-full whitespace-normal !px-2 justify-self-start">この地点のカードを見る</button>
          </fieldset>
        </form>
        {locationError && <p className="mt-2 text-sm text-red-700" role="alert">{locationError}</p>}
      </section>

      <div aria-live="polite">
        {place.status === 'locating' && <p role="status">現在地を取得しています。</p>}
        {place.status === 'loading' && <p role="status">
          この土地の情報を調べています。はじめての場所は、過去10年の天気の取り込みに数十秒かかることがあります。
        </p>}
        {place.status === 'error' && <div>
          <p role="alert" className="text-sm text-red-700">{place.message}</p>
          <button className="btn btn-outline mt-2 max-w-full whitespace-normal !px-2" type="button"
            onClick={() => void preview(place.point, true)}>もう一度取る</button>
        </div>}
        {place.status === 'ready' && <>
          <p className="mb-2 text-sm text-gray-600">緯度 {place.point.latitude}、経度 {place.point.longitude}</p>
          <FarmPlaceCard card={place.card} onRetryWeather={() => void preview(place.point, true)} retryDisabled={saving} />
        </>}
      </div>

      <div hidden={place.status !== 'ready'}>
        <form onSubmit={saveFarm}>
          <fieldset disabled={saving} className="grid min-w-0 gap-3">
            <h2 className="text-lg font-semibold">農場の情報</h2>
            {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
            <label className="grid min-w-0 gap-1">農場名
              <input className="input min-w-0" name="name" maxLength={200} required />
            </label>
            <label className="grid min-w-0 gap-1">都道府県
              <select className="input min-w-0" required value={prefectureCode} onChange={event => {
                const code = event.target.value
                setAreas(areas => ({ ...areas, saveArea: { prefectureCode: code, municipalityCode: '' } }))
              }}>
                <option value="">選んでください</option>
                {PREFECTURES.map(pref => <option key={pref.code} value={pref.code}>{pref.name}</option>)}
              </select>
            </label>
            {!municipalityCode && suggestion?.prefectureCode === prefectureCode && <p className="text-sm text-gray-600">
              近くの{suggestion.stationName}観測所をもとに、{suggestion.prefectureName}を入れました。違っていたら選び直してください。
            </p>}
            <label className="grid min-w-0 gap-1">市区町村
              <select className="input min-w-0" required disabled={!prefectureCode}
                value={municipalityCode} onChange={event => {
                  const code = event.target.value
                  setAreas(areas => ({ ...areas, saveArea: { ...areas.saveArea, municipalityCode: code } }))
                }}>
                <option value="">{prefectureCode ? '選んでください' : '先に都道府県'}</option>
                {cities.map(city => <option key={city.code} value={city.code}>{city.name}</option>)}
              </select>
            </label>
            <label className="grid min-w-0 gap-1">説明（任意）
              <textarea className="input min-w-0 farm-new-textarea" name="description" rows={3} />
            </label>
            <button className="btn btn-primary max-w-full whitespace-normal !px-2 justify-self-start" type="submit">
              {saving ? '登録中…' : 'この場所で農場を登録'}
            </button>
          </fieldset>
        </form>
      </div>
    </div>
  )
}
