'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default function NewFarmPage() {
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
      const res = await fetch('/api/farms', {
        method: 'POST',
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
        setError(data.error || '農場の登録に失敗しました')
        setLoading(false)
        return
      }

      router.push('/farms')
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
            <Link href="/farms" className="farm-new-back">
              ← 農場一覧
            </Link>
            <h1 className="farms-title">新規農場を追加</h1>
            <p className="farms-subtitle">農場の名前と任意で説明・位置情報を入力してください</p>
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
                required
                className="input"
                placeholder="例：メイン農場"
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
                className="input farm-new-textarea"
                placeholder="例：露地栽培エリア。トマト・レタスを栽培しています。"
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
                {loading ? '登録中...' : '登録する'}
              </button>
              <Link href="/farms" className="btn btn-outline">
                キャンセル
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
