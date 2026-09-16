'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

type FarmWithFields = { id: string; name: string; fields: { id: string; name: string }[] }

type Initial = {
  id: string
  name: string
  variety: string
  farmId: string
  fieldId: string
  plantingDate: string
  harvestDate: string
  status: string
}

export default function CropEditForm({
  cropId,
  initial,
  farms,
}: {
  cropId: string
  initial: Initial
  farms: FarmWithFields[]
}) {
  const router = useRouter()
  const [farmId, setFarmId] = useState(initial.farmId)
  const [name, setName] = useState(initial.name)
  const [variety, setVariety] = useState(initial.variety)
  const [plantingDate, setPlantingDate] = useState(initial.plantingDate)
  const [harvestDate, setHarvestDate] = useState(initial.harvestDate)
  const [fieldId, setFieldId] = useState(initial.fieldId)
  const [status, setStatus] = useState(initial.status)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedFarm = farmId ? farms.find((f) => f.id === farmId) : null
  const fields = selectedFarm?.fields ?? []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`/api/crops/${cropId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          farmId: farmId || null,
          variety: variety.trim() || null,
          plantingDate: plantingDate || null,
          harvestDate: harvestDate || null,
          fieldId: fieldId || null,
          status,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '作物の更新に失敗しました')
        setLoading(false)
        return
      }

      router.push(`/crops/${cropId}`)
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
            <Link href={`/crops/${cropId}`} className="farm-new-back">
              ← 作物詳細
            </Link>
            <h1 className="farms-title">作物を編集</h1>
            <p className="farms-subtitle">
              作物名・農場・品種・日付を変更できます。あとから農場を紐づけることも可能です
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
                  農場（任意・あとから紐づけ可能）
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

            <div className="auth-field">
              <label htmlFor="crop-status" className="label">
                状態
              </label>
              <select
                id="crop-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="input"
              >
                <option value="growing">栽培中</option>
                <option value="harvested">収穫済み</option>
                <option value="completed">完了</option>
              </select>
            </div>

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
                {loading ? '更新中...' : '更新する'}
              </button>
              <Link href={`/crops/${cropId}`} className="btn btn-outline">
                キャンセル
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
