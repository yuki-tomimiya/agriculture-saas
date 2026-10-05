'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

type CropOption = { id: string; name: string; farmName: string | null }
type FarmOption = { id: string; name: string }

export default function PesticideNewForm({
  crops,
  farms,
  initialCropId = '',
  initialFarmId = '',
  initialDate = '',
}: {
  crops: CropOption[]
  farms: FarmOption[]
  initialCropId?: string
  initialFarmId?: string
  initialDate?: string
}) {
  const router = useRouter()
  const [appliedAt, setAppliedAt] = useState(() =>
    /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : new Date().toISOString().slice(0, 10)
  )
  const [productName, setProductName] = useState('')
  const [amount, setAmount] = useState('')
  const [amountUnit, setAmountUnit] = useState('mL')
  const [dilution, setDilution] = useState('')
  const [applicationCount, setApplicationCount] = useState('')
  const [daysBeforeHarvest, setDaysBeforeHarvest] = useState('')
  const [cropId, setCropId] = useState(crops.some((crop) => crop.id === initialCropId) ? initialCropId : '')
  const [farmId, setFarmId] = useState(farms.some((farm) => farm.id === initialFarmId) ? initialFarmId : '')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!productName.trim()) {
      setError('農薬名を入力してください')
      setLoading(false)
      return
    }

    const amountNum = amount === '' ? null : parseFloat(amount)
    if (amount !== '' && (Number.isNaN(amountNum!) || amountNum! < 0)) {
      setError('使用量は0以上の数値を入力してください')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/pesticides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appliedAt,
          productName: productName.trim(),
          amount: amountNum,
          amountUnit: amountUnit || undefined,
          dilution: dilution.trim() || undefined,
          applicationCount: applicationCount === '' ? undefined : parseInt(applicationCount, 10),
          daysBeforeHarvest: daysBeforeHarvest === '' ? undefined : parseInt(daysBeforeHarvest, 10),
          cropId: cropId || undefined,
          farmId: farmId || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '登録に失敗しました')
        setLoading(false)
        return
      }
      router.push('/pesticides')
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
            <Link href="/pesticides" className="farm-new-back">
              ← 農薬管理一覧
            </Link>
            <h1 className="farms-title">農薬散布記録を追加</h1>
            <p className="farms-subtitle">散布日・農薬名・作物などを入力して記録します</p>
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
              <label htmlFor="pesticide-date" className="label">
                散布日 <span className="farm-new-required">必須</span>
              </label>
              <input
                id="pesticide-date"
                type="date"
                value={appliedAt}
                onChange={(e) => setAppliedAt(e.target.value)}
                required
                className="input"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="pesticide-product" className="label">
                農薬名 <span className="farm-new-required">必須</span>
              </label>
              <input
                id="pesticide-product"
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
                className="input"
                placeholder="例：〇〇乳剤"
              />
            </div>

            <div className="farm-new-row">
              <div className="auth-field farm-new-half">
                <label htmlFor="pesticide-amount" className="label">使用量</label>
                <input
                  id="pesticide-amount"
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input"
                  placeholder="例：10"
                />
              </div>
              <div className="auth-field farm-new-half">
                <label htmlFor="pesticide-amount-unit" className="label">単位</label>
                <select
                  id="pesticide-amount-unit"
                  value={amountUnit}
                  onChange={(e) => setAmountUnit(e.target.value)}
                  className="input"
                >
                  <option value="mL">mL</option>
                  <option value="L">L</option>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>

            <div className="farm-new-row">
              <div className="auth-field farm-new-half">
                <label htmlFor="pesticide-dilution" className="label">希釈倍率</label>
                <input
                  id="pesticide-dilution"
                  type="text"
                  value={dilution}
                  onChange={(e) => setDilution(e.target.value)}
                  className="input"
                  placeholder="例：1000倍"
                />
              </div>
              <div className="auth-field farm-new-half">
                <label htmlFor="pesticide-days" className="label">収穫前日数</label>
                <input
                  id="pesticide-days"
                  type="number"
                  min="0"
                  value={daysBeforeHarvest}
                  onChange={(e) => setDaysBeforeHarvest(e.target.value)}
                  className="input"
                  placeholder="例：7"
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="pesticide-application-count" className="label">使用回数（この作付けで何回目か）</label>
              <input
                id="pesticide-application-count"
                type="number"
                min="1"
                value={applicationCount}
                onChange={(e) => setApplicationCount(e.target.value)}
                className="input"
                placeholder="例：2"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="pesticide-crop" className="label">作物</label>
              <select
                id="pesticide-crop"
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
              <label htmlFor="pesticide-farm" className="label">農場</label>
              <select
                id="pesticide-farm"
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

            <div className="auth-field">
              <label htmlFor="pesticide-notes" className="label">メモ</label>
              <textarea
                id="pesticide-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input farm-new-textarea"
                placeholder="適用病害虫など"
                rows={2}
              />
            </div>

            <div className="farm-new-actions">
              <button type="submit" disabled={loading} className="btn btn-primary farm-new-submit">
                {loading ? '登録中...' : '登録する'}
              </button>
              <Link href="/pesticides" className="btn btn-outline">
                キャンセル
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
