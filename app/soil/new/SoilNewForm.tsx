'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

type FarmOption = { id: string; name: string; fields: { id: string; name: string }[] }

export default function SoilNewForm({
  farms,
  initialFarmId,
}: {
  farms: FarmOption[]
  initialFarmId: string
}) {
  const router = useRouter()
  const [farmId, setFarmId] = useState(
    farms.some((farm) => farm.id === initialFarmId) ? initialFarmId : farms[0]?.id || ''
  )
  const [fieldId, setFieldId] = useState('')
  const fields = farms.find((farm) => farm.id === farmId)?.fields ?? []
  const [diagnosedAt, setDiagnosedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [ph, setPh] = useState('')
  const [ec, setEc] = useState('')
  const [nitrogen, setNitrogen] = useState('')
  const [phosphorus, setPhosphorus] = useState('')
  const [potassium, setPotassium] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body = new FormData(e.currentTarget)
      const res = await fetch('/api/soil-diagnoses', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '登録に失敗しました')
        setLoading(false)
        return
      }
      router.push(farmId ? `/soil?farmId=${farmId}` : '/soil')
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
            <p className="gdd-breadcrumb">
              <Link href="/farms" className="gdd-breadcrumb-link">
                農場管理
              </Link>
              <span className="gdd-breadcrumb-sep">/</span>
              <Link href="/soil" className="gdd-breadcrumb-link">
                土壌診断
              </Link>
              <span className="gdd-breadcrumb-sep">/</span>
              追加
            </p>
            <h1 className="farms-title">土壌診断を追加</h1>
            <p className="farms-subtitle">農場ごとの記録です。空欄の項目は残しません。養分の単位は mg/100g です。</p>
          </div>
        </div>

        <div className="card farm-new-card">
          {farms.length === 0 ? (
            <p className="farms-empty-text">
              先に農場を登録してください。{' '}
              <Link href="/farms/new" className="text-green-700 hover:underline">
                農場を追加
              </Link>
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="farm-new-form">
              {error && (
                <div className="auth-error" role="alert">
                  {error}
                </div>
              )}
              <div className="auth-field">
                <label htmlFor="soil-date" className="label">
                  診断日 <span className="farm-new-required">必須</span>
                </label>
                <input
                  id="soil-date"
                  name="diagnosedAt"
                  type="date"
                  value={diagnosedAt}
                  onChange={(e) => setDiagnosedAt(e.target.value)}
                  required
                  className="input"
                />
              </div>
              <fieldset className="auth-field">
                <legend className="label">測った時期</legend>
                <p className="farms-subtitle">未選択のまま保存できます。選んだときだけ記録します。</p>
                <label className="label">
                  <input type="radio" name="timing" value="作付け前" /> 作付け前（肥料を入れる前）
                </label>
                <label className="label">
                  <input type="radio" name="timing" value="栽培中" /> 栽培中
                </label>
              </fieldset>
              <div className="farm-new-row">
                <div className="auth-field farm-new-half">
                  <label htmlFor="soil-farm" className="label">
                    農場 <span className="farm-new-required">必須</span>
                  </label>
                  <select
                    id="soil-farm"
                    name="farmId"
                    value={farmId}
                    onChange={(e) => {
                      setFarmId(e.target.value)
                      setFieldId('')
                    }}
                    required
                    className="input"
                  >
                    {farms.map((farm) => (
                      <option key={farm.id} value={farm.id}>
                        {farm.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="auth-field farm-new-half">
                  <label htmlFor="soil-field" className="label">
                    圃場
                  </label>
                  <select
                    id="soil-field"
                    name="fieldId"
                    value={fields.some((field) => field.id === fieldId) ? fieldId : ''}
                    onChange={(e) => setFieldId(e.target.value)}
                    className="input"
                  >
                    <option value="">農場全体</option>
                    {fields.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="farm-new-row">
                <div className="auth-field farm-new-half">
                  <label htmlFor="soil-ph" className="label">
                    pH
                  </label>
                  <input id="soil-ph" name="ph" type="number" min="0" max="14" step="0.1" value={ph} onChange={(e) => setPh(e.target.value)} className="input" />
                </div>
                <div className="auth-field farm-new-half">
                  <label htmlFor="soil-ec" className="label">
                    EC（mS/cm）
                  </label>
                  <input id="soil-ec" name="ec" type="number" min="0" step="0.01" value={ec} onChange={(e) => setEc(e.target.value)} className="input" />
                </div>
              </div>
              <div className="auth-field">
                <label htmlFor="soil-n" className="label">
                  硝酸態窒素（mg/100g）
                </label>
                <input id="soil-n" name="nitrogen" type="number" min="0" step="0.1" value={nitrogen} onChange={(e) => setNitrogen(e.target.value)} className="input" />
              </div>
              <div className="auth-field">
                <label htmlFor="soil-p" className="label">
                  有効態リン酸（mg/100g）
                </label>
                <input id="soil-p" name="phosphorus" type="number" min="0" step="0.1" value={phosphorus} onChange={(e) => setPhosphorus(e.target.value)} className="input" />
              </div>
              <div className="auth-field">
                <label htmlFor="soil-k" className="label">
                  交換性カリ（mg/100g）
                </label>
                <input id="soil-k" name="potassium" type="number" min="0" step="0.1" value={potassium} onChange={(e) => setPotassium(e.target.value)} className="input" />
              </div>
              <div className="auth-field">
                <label htmlFor="soil-photo" className="label">
                  分析表の写真（JPEG / PNG / WebP、4MBまで）
                </label>
                <input id="soil-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="input" />
              </div>
              <div className="auth-field">
                <label htmlFor="soil-notes" className="label">
                  メモ
                </label>
                <textarea id="soil-notes" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={3} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? '保存中…' : '保存'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
