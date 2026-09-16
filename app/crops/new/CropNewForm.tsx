'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

type FarmWithFields = { id: string; name: string; fields: { id: string; name: string }[] }

export default function CropNewForm({ farms }: { farms: FarmWithFields[] }) {
  const router = useRouter()
  const [farmId, setFarmId] = useState('') // 空 = 農場に紐づけない
  const [name, setName] = useState('')
  const [variety, setVariety] = useState('')
  const [plantingDate, setPlantingDate] = useState('')
  const [harvestDate, setHarvestDate] = useState('')
  const [fieldId, setFieldId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedFarm = farmId ? farms.find((f) => f.id === farmId) : null
  const fields = selectedFarm?.fields ?? []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/crops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          farmId: farmId || null,
          variety: variety.trim() || null,
          plantingDate: plantingDate || null,
          harvestDate: harvestDate || null,
          fieldId: fieldId || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '作物の登録に失敗しました')
        setLoading(false)
        return
      }

      router.push('/crops')
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
            <Link href="/crops" className="farm-new-back">
              ← 作物一覧
            </Link>
            <h1 className="farms-title">新規作物を追加</h1>
            <p className="farms-subtitle">
              作物名を入力して登録します。農場・品種・日付は任意です
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
              <label htmlFor="crop-name" className="label">
                作物名 <span className="farm-new-required">必須</span>
              </label>
              <input
                id="crop-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="input"
                placeholder="例：トマト"
                maxLength={200}
              />
            </div>

            {farms.length > 0 && (
              <div className="auth-field">
                <label htmlFor="crop-farm" className="label">
                  農場（任意）
                </label>
                <select
                  id="crop-farm"
                  value={farmId}
                  onChange={(e) => {
                    setFarmId(e.target.value)
                    setFieldId('')
                  }}
                  className="input"
                >
                  <option value="">紐づけない</option>
                  {farms.map((farm) => (
                    <option key={farm.id} value={farm.id}>
                      {farm.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="crop-variety" className="label">
                品種
              </label>
              <input
                id="crop-variety"
                type="text"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                className="input"
                placeholder="例：桃太郎"
                maxLength={100}
              />
            </div>

            {fields.length > 0 && (
              <div className="auth-field">
                <label htmlFor="crop-field" className="label">
                  圃場
                </label>
                <select
                  id="crop-field"
                  value={fieldId}
                  onChange={(e) => setFieldId(e.target.value)}
                  className="input"
                >
                  <option value="">指定しない</option>
                  {fields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="farm-new-row">
              <div className="auth-field farm-new-half">
                <label htmlFor="crop-planting" className="label">
                  植え付け日
                </label>
                <input
                  id="crop-planting"
                  type="date"
                  value={plantingDate}
                  onChange={(e) => setPlantingDate(e.target.value)}
                  className="input"
                />
              </div>
              <div className="auth-field farm-new-half">
                <label htmlFor="crop-harvest" className="label">
                  収穫予定日
                </label>
                <input
                  id="crop-harvest"
                  type="date"
                  value={harvestDate}
                  onChange={(e) => setHarvestDate(e.target.value)}
                  className="input"
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
              <Link href="/crops" className="btn btn-outline">
                キャンセル
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
