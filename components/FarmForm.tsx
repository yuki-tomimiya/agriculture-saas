'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PREFECTURES, municipalitiesIn } from '@/lib/places/catalog'

type Initial = {
  name: string
  description: string
  latitude: string
  longitude: string
  prefectureCode: string
  municipalityCode: string
}

type Suggestion = {
  prefectureCode: string
  prefectureName: string
  stationName: string
  distanceKm: string
}

export default function FarmForm({
  mode,
  farmId,
  initial,
}: {
  mode: 'create' | 'edit'
  farmId?: string
  initial?: Initial
}) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [prefectureCode, setPrefectureCode] = useState(initial?.prefectureCode ?? '')
  const [municipalityCode, setMunicipalityCode] = useState(initial?.municipalityCode ?? '')
  const [suggestionNote, setSuggestionNote] = useState('')
  const [placeTouched, setPlaceTouched] = useState(Boolean(initial?.prefectureCode))

  const cities = prefectureCode ? municipalitiesIn(prefectureCode) : []

  const applySuggestion = async (latitude: string, longitude: string) => {
    if (placeTouched) return
    const lat = Number(latitude)
    const lon = Number(longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || latitude === '' || longitude === '') return
    const res = await fetch(`/api/farms/place-suggestion?latitude=${lat}&longitude=${lon}`)
    if (!res.ok) return
    const data = (await res.json()) as { suggestion: Suggestion | null }
    if (!data.suggestion) return
    setPrefectureCode(data.suggestion.prefectureCode)
    setMunicipalityCode('')
    setSuggestionNote(
      `近くの観測所（${data.suggestion.stationName}・${data.suggestion.distanceKm}km）から${data.suggestion.prefectureName}を入れました。違っていたら直して、保存してください。`,
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const form = e.currentTarget as HTMLFormElement
    const fd = new FormData(form)
    const name = String(fd.get('name') ?? '')
    const description = String(fd.get('description') ?? '')
    const latitude = String(fd.get('latitude') ?? '')
    const longitude = String(fd.get('longitude') ?? '')
    if (!prefectureCode) {
      setError('都道府県を選んでください')
      setLoading(false)
      return
    }
    if (!municipalityCode) {
      setError('市区町村を選んでください')
      setLoading(false)
      return
    }
    try {
      const res = await fetch(mode === 'create' ? '/api/farms' : `/api/farms/${farmId}`, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          latitude: latitude === '' ? null : latitude,
          longitude: longitude === '' ? null : longitude,
          prefectureCode,
          municipalityCode,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '農場の保存に失敗しました')
        setLoading(false)
        return
      }
      router.push(mode === 'create' ? '/farms' : `/farms/${farmId}`)
      router.refresh()
    } catch {
      setError('エラーが発生しました')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="farm-new-form">
      {error && (
        <div className="auth-error" role="alert">
          {error}
        </div>
      )}
      <div className="auth-field">
        <label htmlFor="farm-name" className="label">
          農場名 <span className="farm-new-required">必須</span>
        </label>
        <input
          id="farm-name"
          type="text"
          name="name"
          required
          defaultValue={initial?.name ?? ''}
          className="input"
          placeholder="例：メイン農場"
          maxLength={200}
        />
      </div>
      <div className="auth-field">
        <label htmlFor="farm-description" className="label">説明</label>
        <textarea
          id="farm-description"
          name="description"
          defaultValue={initial?.description ?? ''}
          className="input farm-new-textarea"
          rows={3}
        />
      </div>
      <div className="farm-new-row">
        <div className="auth-field farm-new-half">
          <label htmlFor="farm-latitude" className="label">緯度</label>
          <input
            id="farm-latitude"
            type="text"
            name="latitude"
            inputMode="decimal"
            defaultValue={initial?.latitude ?? ''}
            className="input"
            placeholder="例：34.99"
            onBlur={(e) => {
              const longitude = (e.currentTarget.form?.elements.namedItem('longitude') as HTMLInputElement | null)?.value ?? ''
              void applySuggestion(e.currentTarget.value, longitude)
            }}
          />
        </div>
        <div className="auth-field farm-new-half">
          <label htmlFor="farm-longitude" className="label">経度</label>
          <input
            id="farm-longitude"
            type="text"
            name="longitude"
            inputMode="decimal"
            defaultValue={initial?.longitude ?? ''}
            className="input"
            placeholder="例：139.87"
            onBlur={(e) => {
              const latitude = (e.currentTarget.form?.elements.namedItem('latitude') as HTMLInputElement | null)?.value ?? ''
              void applySuggestion(latitude, e.currentTarget.value)
            }}
          />
        </div>
      </div>
      <div className="farm-new-row">
        <div className="auth-field farm-new-half">
          <label htmlFor="farm-prefecture" className="label">
            都道府県 <span className="farm-new-required">必須</span>
          </label>
          <select
            id="farm-prefecture"
            className="input"
            value={prefectureCode}
            onChange={(e) => {
              setPlaceTouched(true)
              setSuggestionNote('')
              setPrefectureCode(e.target.value)
              setMunicipalityCode('')
            }}
          >
            <option value="">選んでください</option>
            {PREFECTURES.map((prefecture) => (
              <option key={prefecture.code} value={prefecture.code}>{prefecture.name}</option>
            ))}
          </select>
        </div>
        <div className="auth-field farm-new-half">
          <label htmlFor="farm-municipality" className="label">
            市区町村 <span className="farm-new-required">必須</span>
          </label>
          <select
            id="farm-municipality"
            className="input"
            value={municipalityCode}
            onChange={(e) => {
              setPlaceTouched(true)
              setMunicipalityCode(e.target.value)
            }}
            disabled={!prefectureCode}
          >
            <option value="">{prefectureCode ? '選んでください' : '先に都道府県'}</option>
            {cities.map((city) => (
              <option key={city.code} value={city.code}>{city.name}</option>
            ))}
          </select>
        </div>
      </div>
      {suggestionNote && <p className="text-sm text-gray-600">{suggestionNote}</p>}
      <div className="farm-new-actions">
        <button type="submit" disabled={loading} className="btn btn-primary farm-new-submit">
          {loading ? '保存中...' : mode === 'create' ? '登録する' : '保存する'}
        </button>
        <Link href={mode === 'create' ? '/farms' : `/farms/${farmId}`} className="btn btn-outline">
          キャンセル
        </Link>
      </div>
    </form>
  )
}
