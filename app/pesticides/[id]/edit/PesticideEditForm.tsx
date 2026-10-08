'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

type CropOption = { id: string; name: string; farmName: string | null }
type FarmOption = { id: string; name: string }
export type RecordForForm = {
  id: string
  appliedAt: string
  productName: string
  amount: number | ''
  amountUnit: string
  dilution: string
  applicationCount: number | ''
  daysBeforeHarvest: number | ''
  cropId: string
  farmId: string
  notes: string
}

export default function PesticideEditForm({
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
  const [dilution, setDilution] = useState(record.dilution)
  const [applicationCount, setApplicationCount] = useState(String(record.applicationCount))
  const [daysBeforeHarvest, setDaysBeforeHarvest] = useState(String(record.daysBeforeHarvest))
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
      setError('農薬名を入力してください')
      setLoading(false)
      return
    }
    const amountNum = amount === '' ? undefined : parseFloat(amount)
    if (amount !== '' && (Number.isNaN(amountNum!) || amountNum! < 0)) {
      setError('使用量は0以上の数値を入力してください')
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/pesticides/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appliedAt,
          productName: productName.trim(),
          amount: amountNum,
          amountUnit: amountUnit || null,
          dilution: dilution.trim() || null,
          applicationCount: applicationCount === '' ? undefined : parseInt(applicationCount, 10),
          daysBeforeHarvest: daysBeforeHarvest === '' ? undefined : parseInt(daysBeforeHarvest, 10),
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
      router.push(`/pesticides/${record.id}`)
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
            <Link href={`/pesticides/${record.id}`} className="farm-new-back">
              ← 詳細に戻る
            </Link>
            <h1 className="farms-title">農薬記録を編集</h1>
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
              <label htmlFor="pesticide-date" className="label">散布日 <span className="farm-new-required">必須</span></label>
              <input id="pesticide-date" type="date" value={appliedAt} onChange={(e) => setAppliedAt(e.target.value)} required className="input" />
            </div>
            <div className="auth-field">
              <label htmlFor="pesticide-product" className="label">農薬名 <span className="farm-new-required">必須</span></label>
              <input id="pesticide-product" type="text" value={productName} onChange={(e) => setProductName(e.target.value)} required className="input" />
            </div>
            <div className="farm-new-row">
              <div className="auth-field farm-new-half">
                <label htmlFor="pesticide-amount" className="label">使用量</label>
                <input id="pesticide-amount" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" />
              </div>
              <div className="auth-field farm-new-half">
                <label htmlFor="pesticide-amount-unit" className="label">単位</label>
                <select id="pesticide-amount-unit" value={amountUnit} onChange={(e) => setAmountUnit(e.target.value)} className="input">
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
                <input id="pesticide-dilution" type="text" value={dilution} onChange={(e) => setDilution(e.target.value)} className="input" placeholder="例：1000倍" />
              </div>
              <div className="auth-field farm-new-half">
                <label htmlFor="pesticide-days" className="label">収穫前日数</label>
                <input id="pesticide-days" type="number" min="0" value={daysBeforeHarvest} onChange={(e) => setDaysBeforeHarvest(e.target.value)} className="input" />
              </div>
            </div>
            <div className="auth-field">
              <label htmlFor="pesticide-application-count" className="label">使用回数</label>
              <input id="pesticide-application-count" type="number" min="1" value={applicationCount} onChange={(e) => setApplicationCount(e.target.value)} className="input" />
            </div>
            <div className="auth-field">
              <label htmlFor="pesticide-crop" className="label">作物</label>
              <select id="pesticide-crop" value={cropId} onChange={(e) => setCropId(e.target.value)} className="input">
                <option value="">選択しない</option>
                {crops.map((c) => (
                  <option key={c.id} value={c.id}>{c.farmName ? `${c.name}（${c.farmName}）` : c.name}</option>
                ))}
              </select>
            </div>
            <div className="auth-field">
              <label htmlFor="pesticide-farm" className="label">農場</label>
              <select id="pesticide-farm" value={farmId} onChange={(e) => setFarmId(e.target.value)} className="input">
                <option value="">選択しない</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="auth-field">
              <label htmlFor="pesticide-notes" className="label">メモ</label>
              <textarea id="pesticide-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="input farm-new-textarea" rows={2} />
            </div>
            <div className="farm-new-actions">
              <button type="submit" disabled={loading} className="btn btn-primary farm-new-submit">
                {loading ? '更新中...' : '更新する'}
              </button>
              <Link href={`/pesticides/${record.id}`} className="btn btn-outline">キャンセル</Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
