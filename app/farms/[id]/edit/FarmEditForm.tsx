'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

type Initial = {
  id: string
  name: string
  description: string
  latitude: string
  longitude: string
}

export default function FarmEditForm({
  farmId,
  initial,
}: {
  farmId: string
  initial: Initial
}) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

    try {
      const res = await fetch(`/api/farms/${farmId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          latitude: latitude === '' ? null : latitude,
          longitude: longitude === '' ? null : longitude,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '農場の更新に失敗しました')
        setLoading(false)
        return
      }

      router.push(`/farms/${farmId}`)
      router.refresh()
    } catch {
      setError('エラーが発生しました')
      setLoading(false)
    }
  }

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <Link href={`/farms/${farmId}`} className="farm-new-back">
              ← 農場詳細
            </Link>
            <h1 className="farms-title">農場を編集</h1>
            <p className="farms-subtitle">農場名・説明・位置情報を更新できます</p>
          </div>
        </div>

        <div className="card farm-new-card">
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="farm-new-form">
            <div className="auth-field">
              <label htmlFor="farm-name" className="label">
                農場名 <span className="farm-new-required">必須</span>
              </label>
              <input
                id="farm-name"
                type="text"
                name="name"
                defaultValue={initial.name}
                required
                className="input"
                maxLength={200}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="farm-description" className="label">
                説明
              </label>
              <textarea
                id="farm-description"
                name="description"
                defaultValue={initial.description}
                className="input farm-new-textarea"
                rows={3}
              />
            </div>

            <div className="farm-new-row">
              <div className="auth-field farm-new-half">
                <label htmlFor="farm-latitude" className="label">
                  緯度
                </label>
                <input
                  id="farm-latitude"
                  type="text"
                  name="latitude"
                  inputMode="decimal"
                  defaultValue={initial.latitude}
                  className="input"
                  placeholder="例：43.05"
                />
              </div>
              <div className="auth-field farm-new-half">
                <label htmlFor="farm-longitude" className="label">
                  経度
                </label>
                <input
                  id="farm-longitude"
                  type="text"
                  name="longitude"
                  inputMode="decimal"
                  defaultValue={initial.longitude}
                  className="input"
                  placeholder="例：141.35"
                />
              </div>
            </div>

            <div className="farm-new-actions">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary farm-new-submit"
              >
                {loading ? '更新中...' : '更新する'}
              </button>
              <Link href={`/farms/${farmId}`} className="btn btn-outline">
                キャンセル
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

