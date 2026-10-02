'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { WorkManagementTabs, formatCropOptionLabel } from '@/components/WorkManagementTabs'
import { WORK_TASK_TYPES } from '@/lib/work-records'

type FarmWithRelations = {
  id: string
  name: string
  crops: { id: string; name: string; variety: string | null }[]
  tasks: { id: string; title: string }[]
}

export default function WorkRecordNewForm({
  farms,
  initialDate,
  initialCropId,
  initialFarmId,
  initialTaskType,
  initialDescription,
}: {
  farms: FarmWithRelations[]
  initialDate?: string
  initialCropId?: string
  initialFarmId?: string
  initialTaskType?: string
  initialDescription?: string
}) {
  const router = useRouter()
  const startingFarmId =
    initialFarmId && farms.some((farm) => farm.id === initialFarmId)
      ? initialFarmId
      : (farms[0]?.id ?? '')
  const startingFarm = farms.find((farm) => farm.id === startingFarmId)
  const [farmId, setFarmId] = useState(startingFarmId)
  const [cropId, setCropId] = useState(
    initialCropId && startingFarm?.crops.some((crop) => crop.id === initialCropId) ? initialCropId : ''
  )
  const [taskId, setTaskId] = useState('')
  const [date, setDate] = useState(() => {
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) return initialDate
    return new Date().toISOString().slice(0, 10)
  })
  const [taskType, setTaskType] = useState<string>(
    initialTaskType && (WORK_TASK_TYPES as readonly string[]).includes(initialTaskType)
      ? initialTaskType
      : WORK_TASK_TYPES[0]
  )
  const [description, setDescription] = useState(initialDescription ?? '')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedFarm = farms.find((f) => f.id === farmId)
  const crops = selectedFarm?.crops ?? []
  const tasks = selectedFarm?.tasks ?? []

  const handleFarmChange = (nextFarmId: string) => {
    setFarmId(nextFarmId)
    setCropId('')
    setTaskId('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!farmId) {
      setError('農場を選択してください')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/work-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmId,
          cropId: cropId || null,
          taskId: taskId || null,
          date,
          taskType,
          description: description.trim() || null,
          notes: notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '登録に失敗しました')
        setLoading(false)
        return
      }
      router.push('/work-records')
      router.refresh()
    } catch {
      setError('エラーが発生しました')
      setLoading(false)
    }
  }

  if (farms.length === 0) {
    return (
      <div className="dashboard-page min-h-screen flex">
        <Sidebar />
        <main className="dashboard-main farms-page">
          <div className="card farm-new-card">
            <p className="farms-empty-text">
              先に農場を登録してください。農場がないと作業記録を追加できません。
            </p>
            <Link href="/farms/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              農場を追加する
            </Link>
            <Link href="/work-records" className="btn btn-outline" style={{ marginTop: '0.5rem' }}>
              作業記録一覧に戻る
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
            <Link href="/work-records" className="farm-new-back">
              ← 作業管理
            </Link>
            <h1 className="farms-title">作業管理</h1>
            <p className="farms-subtitle">作業日・種別・内容を入力して記録します</p>
            <WorkManagementTabs active="work-records" mode="new" />
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
              <label htmlFor="work-date" className="label">
                作業日 <span className="farm-new-required">必須</span>
              </label>
              <input
                id="work-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="input"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="work-farm" className="label">
                農場 <span className="farm-new-required">必須</span>
              </label>
              <select
                id="work-farm"
                value={farmId}
                onChange={(e) => handleFarmChange(e.target.value)}
                required
                className="input"
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="auth-field">
              <label htmlFor="work-type" className="label">
                作業種別 <span className="farm-new-required">必須</span>
              </label>
              <select
                id="work-type"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                required
                className="input"
              >
                {WORK_TASK_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                施肥は「施肥記録」、防除は「農薬管理」で登録してください。
              </p>
            </div>

            <div className="auth-field">
              <label htmlFor="work-crop" className="label">作物</label>
              <select
                id="work-crop"
                value={cropId}
                onChange={(e) => setCropId(e.target.value)}
                className="input"
              >
                <option value="">選択しない</option>
                {crops.map((c) => (
                  <option key={c.id} value={c.id}>
                    {formatCropOptionLabel(c)}
                  </option>
                ))}
              </select>
            </div>

            <div className="auth-field">
              <label htmlFor="work-task" className="label">関連タスク</label>
              <select
                id="work-task"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="input"
              >
                <option value="">選択しない</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="auth-field">
              <label htmlFor="work-description" className="label">作業内容</label>
              <input
                id="work-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input"
                placeholder="例：A区画の除草、支柱立て"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="work-notes" className="label">メモ</label>
              <textarea
                id="work-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input farm-new-textarea"
                placeholder="天候や作業時間など"
                rows={2}
              />
            </div>

            <div className="farm-new-actions">
              <button type="submit" disabled={loading} className="btn btn-primary farm-new-submit">
                {loading ? '登録中...' : '登録する'}
              </button>
              <Link href="/work-records" className="btn btn-outline">
                キャンセル
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
