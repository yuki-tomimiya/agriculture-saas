'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

type CropOption = { id: string; name: string; farmName: string | null }
type FarmOption = { id: string; name: string }

export default function SalesNewForm({ crops, farms }: { crops: CropOption[]; farms: FarmOption[] }) {
  const router = useRouter()
  const [date, setDate] = useState(() => {
    const d = new Date()
    return d.toISOString().slice(0, 10)
  })
  const [cropId, setCropId] = useState(crops[0]?.id ?? '')
  const [farmId, setFarmId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('kg')
  const [unitPrice, setUnitPrice] = useState('')
  const [amount, setAmount] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [channel, setChannel] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAutoAmount = () => {
    const q = parseFloat(quantity)
    const u = parseInt(unitPrice, 10)
    if (!Number.isNaN(q) && !Number.isNaN(u)) {
      setAmount(String(Math.round(q * u)))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const q = parseFloat(quantity)
    const u = parseInt(unitPrice, 10)
    const a = amount ? parseInt(amount, 10) : Math.round(q * u)

    if (Number.isNaN(q) || q < 0) {
      setError('数量は0以上の数値を入力してください')
      setLoading(false)
      return
    }
    if (Number.isNaN(u) || u < 0) {
      setError('単価は0以上の数値を入力してください')
      setLoading(false)
      return
    }
    if (!customerName.trim()) {
      setError('販売先を入力してください')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          cropId: cropId || null,
          farmId: farmId || null,
          quantity: q,
          unit: unit || 'kg',
          unitPrice: u,
          amount: a,
          customerName: customerName.trim(),
          channel: channel.trim() || null,
          notes: notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '売上の登録に失敗しました')
        setLoading(false)
        return
      }
      router.push('/sales')
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
            <Link href="/sales" className="farm-new-back">
              ← 販売一覧
            </Link>
            <h1 className="farms-title">販売を記録</h1>
            <p className="farms-subtitle">作物・数量・販売先・金額を入力して販売実績を記録します</p>
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
              <label htmlFor="sale-date" className="label">
                日付 <span className="farm-new-required">必須</span>
              </label>
              <input
                id="sale-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="input"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="sale-crop" className="label">
                作物
              </label>
              <select
                id="sale-crop"
                value={cropId}
                onChange={(e) => setCropId(e.target.value)}
                className="input"
              >
                <option value="">選択しない</option>
                {crops.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.farmName ? `${c.name}（${c.farmName}）` : c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="auth-field">
              <label htmlFor="sale-farm" className="label">
                農場
              </label>
              <select
                id="sale-farm"
                value={farmId}
                onChange={(e) => setFarmId(e.target.value)}
                className="input"
              >
                <option value="">選択しない</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="farm-new-row">
              <div className="auth-field farm-new-half">
                <label htmlFor="sale-qty" className="label">
                  数量 <span className="farm-new-required">必須</span>
                </label>
                <input
                  id="sale-qty"
                  type="number"
                  min="0"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  className="input"
                  placeholder="例：10"
                />
              </div>
              <div className="auth-field farm-new-half">
                <label htmlFor="sale-unit" className="label">
                  単位
                </label>
                <select
                  id="sale-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="input"
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="個">個</option>
                  <option value="箱">箱</option>
                  <option value="束">束</option>
                </select>
              </div>
            </div>

            <div className="farm-new-row">
              <div className="auth-field farm-new-half">
                <label htmlFor="sale-unit-price" className="label">
                  単価（円） <span className="farm-new-required">必須</span>
                </label>
                <input
                  id="sale-unit-price"
                  type="number"
                  min="0"
                  step="1"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  required
                  className="input"
                  placeholder="例：250"
                  onBlur={handleAutoAmount}
                />
              </div>
              <div className="auth-field farm-new-half">
                <label htmlFor="sale-amount" className="label">
                  販売金額（円）
                </label>
                <input
                  id="sale-amount"
                  type="number"
                  min="0"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input"
                  placeholder="数量×単価から自動計算されます"
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="sale-customer" className="label">
                販売先 <span className="farm-new-required">必須</span>
              </label>
              <input
                id="sale-customer"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className="input"
                placeholder="例：◯◯直売所、◯◯スーパー"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="sale-channel" className="label">
                販売チャネル
              </label>
              <input
                id="sale-channel"
                type="text"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="input"
                placeholder="例：直売所、市場、JA など"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="sale-notes" className="label">
                メモ
              </label>
              <textarea
                id="sale-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input farm-new-textarea"
                rows={2}
                placeholder="特売・規格外など、気づいたことがあれば記録しておきましょう"
              />
            </div>

            <div className="farm-new-actions">
              <button type="submit" disabled={loading} className="btn btn-primary farm-new-submit">
                {loading ? '登録中...' : '登録する'}
              </button>
              <Link href="/sales" className="btn btn-outline">
                キャンセル
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

