'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { formatCropOptionLabel } from '@/components/WorkManagementTabs'

type CropOption = { id: string; name: string; variety: string | null; farmName: string | null }
type FarmOption = { id: string; name: string }
type RecordForForm = {
  id: string
  appliedAt: string
  productName: string
  amount: number
  amountUnit: string
  componentInfo: string
  cropId: string
  farmId: string
  notes: string
}

export default function FertilizerEditForm({
  record,
  crops,
  farms,
}: {
  record: RecordForForm
  crops: CropOption[]
  farms: FarmOption[]
}) {
  const router = useRouter()
  const [appliedAt, setAppliedAt] = useState(record.appliedAt)
  const [productName, setProductName] = useState(record.productName)
  const [amount, setAmount] = useState(String(record.amount))
  const [amountUnit, setAmountUnit] = useState(record.amountUnit)
  const [componentInfo, setComponentInfo] = useState(record.componentInfo)
  const [cropId, setCropId] = useState(record.cropId)
  const [farmId, setFarmId] = useState(record.farmId)
  const [notes, setNotes] = useState(record.notes)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    if (!productName.trim()) {
      setError('肥料名を入力してください')
      setLoading(false)
      return
    }
    const amountNum = parseFloat(amount)
    if (Number.isNaN(amountNum) || amountNum < 0) {
      setError('使用量は0以上の数値を入力してください')
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/fertilizers/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appliedAt,
          productName: productName.trim(),
          amount: amountNum,
          amountUnit: amountUnit || 'kg',
          componentInfo: componentInfo.trim() || null,
          cropId: cropId || null,
          farmId: farmId || null,
          notes: notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '更新に失敗しました')
        setLoading(false)
        return
      }
      router.push(`/fertilizers/${record.id}`)
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
            <Link href={`/fertilizers/${record.id}`} className="farm-new-back">
              ← 詳細に戻る
            </Link>
            <h1 className="farms-title">施肥記録を編集</h1>
            <p className="farms-subtitle">{record.productName}</p>
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
              <label htmlFor="fertilizer-date" className="label">施肥日 <span className="farm-new-required">必須</span></label>
              <input id="fertilizer-date" type="date" value={appliedAt} onChange={(e) => setAppliedAt(e.target.value)} required className="input" />
            </div>
            <div className="auth-field">
              <label htmlFor="fertilizer-product" className="label">肥料名 <span className="farm-new-required">必須</span></label>
              <input id="fertilizer-product" type="text" value={productName} onChange={(e) => setProductName(e.target.value)} required className="input" />
            </div>
            <div className="farm-new-row">
              <div className="auth-field farm-new-half">
                <label htmlFor="fertilizer-amount" className="label">使用量 <span className="farm-new-required">必須</span></label>
                <input id="fertilizer-amount" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required className="input" />
              </div>
              <div className="auth-field farm-new-half">
                <label htmlFor="fertilizer-amount-unit" className="label">単位</label>
                <select id="fertilizer-amount-unit" value={amountUnit} onChange={(e) => setAmountUnit(e.target.value)} className="input">
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="L">L</option>
                  <option value="袋">袋</option>
                </select>
              </div>
            </div>
            <div className="auth-field">
              <label htmlFor="fertilizer-component" className="label">成分（N-P-Kなど）</label>
              <input id="fertilizer-component" type="text" value={componentInfo} onChange={(e) => setComponentInfo(e.target.value)} className="input" />
            </div>
            <div className="auth-field">
              <label htmlFor="fertilizer-crop" className="label">作物</label>
              <select id="fertilizer-crop" value={cropId} onChange={(e) => setCropId(e.target.value)} className="input">
                <option value="">選択しない</option>
                {crops.map((c) => (
                  <option key={c.id} value={c.id}>{formatCropOptionLabel(c)}</option>
                ))}
              </select>
            </div>
            <div className="auth-field">
              <label htmlFor="fertilizer-farm" className="label">農場</label>
              <select id="fertilizer-farm" value={farmId} onChange={(e) => setFarmId(e.target.value)} className="input">
                <option value="">選択しない</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="auth-field">
              <label htmlFor="fertilizer-notes" className="label">メモ</label>
              <textarea id="fertilizer-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="input farm-new-textarea" rows={2} />
            </div>
            <div className="farm-new-actions">
              <button type="submit" disabled={loading} className="btn btn-primary farm-new-submit">
                {loading ? '更新中...' : '更新する'}
              </button>
              <Link href={`/fertilizers/${record.id}`} className="btn btn-outline">キャンセル</Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
