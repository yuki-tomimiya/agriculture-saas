'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

type CropOption = { id: string; name: string; farmName: string | null; status: string }

function safeReturnTo(value?: string): string | null {
  if (!value || !value.startsWith('/crops/') || value.includes('//')) return null
  return value
}

export default function HarvestNewForm({
  crops,
  initialCropId,
  initialDate,
  returnTo,
}: {
  crops: CropOption[]
  initialCropId?: string
  initialDate?: string
  returnTo?: string
}) {
  const router = useRouter()
  const backHref = safeReturnTo(returnTo)
  const [cropId, setCropId] = useState(
    initialCropId && crops.some((crop) => crop.id === initialCropId) ? initialCropId : (crops[0]?.id ?? '')
  )
  const [date, setDate] = useState(() => {
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) return initialDate
    const d = new Date()
    return d.toISOString().slice(0, 10)
  })
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('kg')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [savedCropId, setSavedCropId] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const num = parseFloat(quantity)
    if (Number.isNaN(num) || num < 0) {
      setError('収穫量は0以上の数値を入力してください')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/harvests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cropId: cropId || null,
          date: date || null,
          quantity: num,
          unit: unit || 'kg',
          notes: notes.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '収穫の登録に失敗しました')
        setLoading(false)
        return
      }

      const saved = crops.find((crop) => crop.id === cropId)
      if (saved?.status === 'growing') {
        setSavedCropId(cropId)
        setLoading(false)
        return
      }
      router.push(backHref ?? '/harvests')
      router.refresh()
    } catch {
      setError('エラーが発生しました')
      setLoading(false)
    }
  }

  const finishSeason = async () => {
    if (!savedCropId) return
    setFinishing(true)
    setError('')
    try {
      const res = await fetch(`/api/crops/${savedCropId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'harvested' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : '状態の更新に失敗しました')
        setFinishing(false)
        return
      }
      router.push(`/crops/${savedCropId}/retrospective?from=status`)
      router.refresh()
    } catch {
      setError('エラーが発生しました')
      setFinishing(false)
    }
  }

  if (savedCropId) {
    return (
      <div className="dashboard-page min-h-screen flex">
        <Sidebar />
        <main className="dashboard-main farms-page">
          <div className="card farm-new-card">
            <h1 className="farms-title">収穫を記録しました</h1>
            <p className="farms-subtitle">この作付けは終了しましたか？数回に分けて掘る場合は、まだ続くを選んでください。</p>
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}
            <div className="farm-new-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => router.push(backHref ?? '/harvests')}
                disabled={finishing}
              >
                まだ続く
              </button>
              <button type="button" className="btn btn-primary" onClick={finishSeason} disabled={finishing}>
                {finishing ? '振り返りを開いています…' : '終了する'}
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (crops.length === 0) {
    return (
      <div className="dashboard-page min-h-screen flex">
        <Sidebar />
        <main className="dashboard-main farms-page">
          <div className="card farm-new-card">
            <p className="farms-empty-text">
              先に作物を登録してください。作物がないと収穫を記録できません。
            </p>
            <Link href="/crops/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              作物を追加する
            </Link>
            <Link href="/harvests" className="btn btn-outline" style={{ marginTop: '0.5rem' }}>
              収穫管理に戻る
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <Link href="/harvests" className="farm-new-back">
              ← 収穫管理
            </Link>
            <h1 className="farms-title">収穫を記録</h1>
            <p className="farms-subtitle">
              作物・日付・収穫量を入力して記録します
            </p>
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
              <label htmlFor="harvest-crop" className="label">
                作物 <span className="farm-new-required">必須</span>
              </label>
              <select
                id="harvest-crop"
                value={cropId}
                onChange={(e) => setCropId(e.target.value)}
                required
                className="input"
              >
                {crops.map((crop) => (
                  <option key={crop.id} value={crop.id}>
                    {crop.farmName ? `${crop.name}（${crop.farmName}）` : crop.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="farm-new-row">
              <div className="auth-field farm-new-half">
                <label htmlFor="harvest-date" className="label">
                  日付 <span className="farm-new-required">必須</span>
                </label>
                <input
                  id="harvest-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="input"
                />
              </div>
              <div className="auth-field farm-new-half">
                <label htmlFor="harvest-unit" className="label">
                  単位
                </label>
                <select
                  id="harvest-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="input"
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="個">個</option>
                  <option value="本">本</option>
                  <option value="袋">袋</option>
                  <option value="箱">箱</option>
                </select>
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="harvest-quantity" className="label">
                収穫量 <span className="farm-new-required">必須</span>
              </label>
              <input
                id="harvest-quantity"
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="input"
                placeholder="例：12.5"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="harvest-notes" className="label">
                メモ
              </label>
              <textarea
                id="harvest-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input farm-new-textarea"
                placeholder="例：天候良好。品質良好"
                rows={3}
              />
            </div>

            <div className="farm-new-actions">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary farm-new-submit"
              >
                {loading ? '登録中...' : '登録する'}
              </button>
              <Link href="/harvests" className="btn btn-outline">
                キャンセル
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
