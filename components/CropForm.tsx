'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { plantingConditionForKind } from '@/lib/benchmarks/planting-conditions'
import {
  COVER_OPTIONS,
  cropKindByKey,
  plantingDateLabel,
} from '@/lib/crops/conditions'
import { CROP_KINDS } from '@/lib/crops/conditions'

type FarmWithFields = { id: string; name: string; fields: { id: string; name: string }[] }

export type SpringDateBrief = {
  latest: { month: number; day: number } | null
  observed: boolean
  dateLabel: string | null
}

function dateIsBeforeLatest(ymd: string, latest: { month: number; day: number }): boolean {
  const [, monthText, dayText] = ymd.split('-')
  const month = Number(monthText)
  const day = Number(dayText)
  if (!month || !day) return false
  return month * 100 + day < latest.month * 100 + latest.day
}

export type CropFormInitial = {
  name: string
  cropKind: string
  variety: string
  farmId: string
  fieldId: string
  fieldUndivided: boolean
  growingSite: string
  covers: string[]
  coverNone: boolean
  heating: string
  plantingMethod: string
  plantCount: string
  areaM2: string
  plantingDate: string
  harvestDate: string
  status: string
}

export const emptyCropForm = (): CropFormInitial => ({
  name: '',
  cropKind: '',
  variety: '',
  farmId: '',
  fieldId: '',
  fieldUndivided: false,
  growingSite: '',
  covers: [],
  coverNone: false,
  heating: '',
  plantingMethod: '',
  plantCount: '',
  areaM2: '',
  plantingDate: '',
  harvestDate: '',
  status: 'growing',
})

export default function CropForm({
  mode,
  cropId,
  initial,
  farms,
  springByFarm = {},
}: {
  mode: 'new' | 'edit'
  cropId?: string
  initial: CropFormInitial
  farms: FarmWithFields[]
  springByFarm?: Record<string, SpringDateBrief>
}) {
  const router = useRouter()
  const [form, setForm] = useState(() => {
    if (initial.farmId || farms.length !== 1) return initial
    return { ...initial, farmId: farms[0].id }
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const kind = cropKindByKey(form.cropKind)
  const selectedFarm = form.farmId ? farms.find((farm) => farm.id === form.farmId) : null
  const fields = selectedFarm?.fields ?? []
  const spring = form.farmId ? springByFarm[form.farmId] : undefined
  const plantingCondition =
    form.growingSite === 'open' && kind && !kind.recordOnly ? plantingConditionForKind(kind.key) : null
  const springEarly =
    plantingCondition && spring?.latest && spring.dateLabel && form.plantingDate && dateIsBeforeLatest(form.plantingDate, spring.latest)
      ? `この日付は、過去10年の${spring.observed ? '観測' : '推計'}でいちばん遅い霜（${spring.dateLabel}）より前です。${
          spring.observed ? '' : '近くの観測所の記録が使えないため、推計の気温から出しています。'
        }`
      : null
  function patch(next: Partial<CropFormInitial>) {
    setForm((current) => ({ ...current, ...next }))
  }

  function applyKind(key: string) {
    patch({ cropKind: key })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.farmId) {
      setError('農場を選んでください')
      return
    }
    setLoading(true)
    const body = {
      cropKind: form.cropKind,
      name: form.name.trim(),
      farmId: form.farmId || null,
      variety: form.variety.trim() || null,
      growingSite: form.growingSite || null,
      covers: form.coverNone ? ['none'] : form.covers,
      coverNone: form.coverNone,
      heating: form.heating || null,
      plantingMethod: form.plantingMethod || null,
      plantCount: form.plantCount,
      areaM2: form.areaM2,
      plantingDate: form.plantingDate || null,
      harvestDate: form.harvestDate || null,
      fieldId: form.fieldUndivided ? null : form.fieldId || null,
      fieldUndivided: form.fieldUndivided,
      status: form.status,
    }
    try {
      const res = await fetch(mode === 'new' ? '/api/crops' : `/api/crops/${cropId}`, {
        method: mode === 'new' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '保存できませんでした')
        setLoading(false)
        return
      }
      if (mode === 'edit' && initial.status === 'growing' && (form.status === 'harvested' || form.status === 'completed')) {
        router.push(`/crops/${cropId}/retrospective?from=status`)
      } else if (mode === 'edit') {
        router.push(`/crops/${cropId}`)
      } else {
        router.push('/crops')
      }
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
            <Link href={mode === 'edit' ? `/crops/${cropId}` : '/crops'} className="farm-new-back">
              ← {mode === 'edit' ? '作物詳細' : '作物一覧'}
            </Link>
            <h1 className="farms-title">{mode === 'edit' ? '作物を編集' : '新規作物を追加'}</h1>
            <p className="farms-subtitle">品目と育て方を選んで登録します。呼び名は空でも、品目の名前が入ります。</p>
          </div>
        </div>
        {farms.length === 0 ? (
          <div className="card farm-new-card">
            <p className="text-gray-800">
              先に農場を登録してください（場所が分かると、天気・霜・積算温度の助言が出ます）
            </p>
            <Link href="/farms/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              農場を登録する
            </Link>
          </div>
        ) : (
        <div className="card farm-new-card">
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="farm-new-form">
            <div className="auth-field">
              <label htmlFor="crop-kind" className="label">
                品目 <span className="farm-new-required">必須</span>
              </label>
              <select id="crop-kind" className="input" value={form.cropKind} onChange={(e) => applyKind(e.target.value)}>
                <option value="">選んでください</option>
                {CROP_KINDS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="auth-field">
              <label htmlFor="crop-name" className="label">
                呼び名 {kind?.key === 'other' && <span className="farm-new-required">必須</span>}
              </label>
              <input
                id="crop-name"
                className="input"
                value={form.name}
                maxLength={200}
                placeholder={kind?.key === 'other' ? '作物の名前' : '空なら品目の名前が入ります'}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="crop-variety" className="label">品種</label>
              <input
                id="crop-variety"
                className="input"
                value={form.variety}
                maxLength={100}
                placeholder="例：紅はるか"
                onChange={(e) => patch({ variety: e.target.value })}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="crop-site" className="label">
                場所 <span className="farm-new-required">必須</span>
              </label>
              <select
                id="crop-site"
                className="input"
                value={form.growingSite}
                onChange={(e) => patch({ growingSite: e.target.value })}
              >
                <option value="">選んでください</option>
                <option value="open">露地</option>
                <option value="house">ハウス（施設）</option>
              </select>
            </div>

            {form.growingSite === 'open' && (
              <fieldset className="auth-field">
                <legend className="label">
                  覆い <span className="farm-new-required">必須</span>
                </legend>
                {COVER_OPTIONS.map((option) => (
                  <label key={option.key} className="block text-sm text-gray-800">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={form.covers.includes(option.key)}
                      disabled={form.coverNone}
                      onChange={(e) => {
                        const covers = e.target.checked
                          ? [...form.covers, option.key]
                          : form.covers.filter((key) => key !== option.key)
                        patch({ covers, coverNone: false })
                      }}
                    />
                    {option.label}
                  </label>
                ))}
                <label className="block text-sm text-gray-800">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={form.coverNone}
                    onChange={(e) => patch({ coverNone: e.target.checked, covers: e.target.checked ? [] : form.covers })}
                  />
                  なし
                </label>
              </fieldset>
            )}

            {form.growingSite === 'house' && (
              <div className="auth-field">
                <label htmlFor="crop-heating" className="label">
                  暖房 <span className="farm-new-required">必須</span>
                </label>
                <select
                  id="crop-heating"
                  className="input"
                  value={form.heating}
                  onChange={(e) => patch({ heating: e.target.value })}
                >
                  <option value="">選んでください</option>
                  <option value="yes">あり</option>
                  <option value="no">なし（雨よけ・無加温）</option>
                </select>
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="crop-method" className="label">
                植え方 <span className="farm-new-required">必須</span>
              </label>
              <select
                id="crop-method"
                className="input"
                value={form.plantingMethod}
                onChange={(e) => patch({ plantingMethod: e.target.value })}
              >
                <option value="">選んでください</option>
                <option value="transplant">苗を植えた</option>
                <option value="direct">種・種いもを直接植えた</option>
              </select>
            </div>

            <div className="farm-new-row">
              <div className="auth-field farm-new-half">
                <label htmlFor="crop-planting" className="label">
                  {plantingDateLabel(form.plantingMethod)}
                </label>
                <input
                  id="crop-planting"
                  type="date"
                  className="input"
                  value={form.plantingDate}
                  onChange={(e) => patch({ plantingDate: e.target.value })}
                />
                {springEarly && (
                  <p className="text-sm text-amber-800 mt-1">
                    {springEarly}
                    {plantingCondition ? plantingCondition.text : ''}
                  </p>
                )}
              </div>
              <div className="auth-field farm-new-half">
                <label htmlFor="crop-harvest" className="label">収穫予定日</label>
                <input
                  id="crop-harvest"
                  type="date"
                  className="input"
                  value={form.harvestDate}
                  onChange={(e) => patch({ harvestDate: e.target.value })}
                />
              </div>
            </div>

            <div className="farm-new-row">
              <div className="auth-field farm-new-half">
                <label htmlFor="crop-count" className="label">株数（株・本）</label>
                <input
                  id="crop-count"
                  type="number"
                  min={1}
                  step={1}
                  className="input"
                  value={form.plantCount}
                  onChange={(e) => patch({ plantCount: e.target.value })}
                />
              </div>
              <div className="auth-field farm-new-half">
                <label htmlFor="crop-area" className="label">栽培面積（㎡）</label>
                <input
                  id="crop-area"
                  type="number"
                  min={0}
                  step="0.1"
                  className="input"
                  value={form.areaM2}
                  onChange={(e) => patch({ areaM2: e.target.value })}
                />
              </div>
            </div>
            <p className="text-sm text-gray-500">株数か栽培面積のどちらかは必要です。</p>

            <div className="auth-field">
              <label htmlFor="crop-farm" className="label">
                農場 <span className="farm-new-required">必須</span>
              </label>
              <select
                id="crop-farm"
                className="input"
                value={form.farmId}
                onChange={(e) => patch({ farmId: e.target.value, fieldId: '', fieldUndivided: false })}
                required
              >
                <option value="">選んでください</option>
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>{farm.name}</option>
                ))}
              </select>
            </div>

            {fields.length > 0 && (
              <div className="auth-field">
                <label htmlFor="crop-field" className="label">
                  圃場 <span className="farm-new-required">必須</span>
                </label>
                <select
                  id="crop-field"
                  className="input"
                  value={form.fieldUndivided ? 'undivided' : form.fieldId}
                  onChange={(e) => {
                    if (e.target.value === 'undivided') patch({ fieldUndivided: true, fieldId: '' })
                    else patch({ fieldUndivided: false, fieldId: e.target.value })
                  }}
                >
                  <option value="">選んでください</option>
                  {fields.map((field) => (
                    <option key={field.id} value={field.id}>{field.name}</option>
                  ))}
                  <option value="undivided">圃場を分けていない</option>
                </select>
              </div>
            )}

            {mode === 'edit' && (
              <div className="auth-field">
                <label htmlFor="crop-status" className="label">状態</label>
                <select
                  id="crop-status"
                  className="input"
                  value={form.status}
                  onChange={(e) => patch({ status: e.target.value })}
                >
                  <option value="growing">栽培中</option>
                  <option value="harvested">収穫済み</option>
                  <option value="completed">完了</option>
                </select>
              </div>
            )}

            <div className="farm-new-actions">
              <button type="submit" disabled={loading} className="btn btn-primary farm-new-submit">
                {loading ? '保存中...' : mode === 'edit' ? '更新する' : '登録する'}
              </button>
              <Link href={mode === 'edit' ? `/crops/${cropId}` : '/crops'} className="btn btn-outline">
                キャンセル
              </Link>
            </div>
          </form>
        </div>
        )}
      </main>
    </div>
  )
}
