'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { formatCropOptionLabel } from '@/components/WorkManagementTabs'
import { WORK_TASK_TYPES } from '@/lib/work-records'

type FarmWithRelations = {
  id: string
  name: string
  crops: { id: string; name: string; variety: string | null }[]
  tasks: { id: string; title: string }[]
}

type RecordForForm = {
  id: string
  date: string
  farmId: string
  cropId: string
  taskId: string
  taskType: string
  description: string
  notes: string
}

export default function WorkRecordEditForm({
  record,
  farms,
}: {
  record: RecordForForm
  farms: FarmWithRelations[]
}) {
  const router = useRouter()
  const [farmId, setFarmId] = useState(record.farmId)
  const [cropId, setCropId] = useState(record.cropId)
  const [taskId, setTaskId] = useState(record.taskId)
  const [date, setDate] = useState(record.date)
  const [taskType, setTaskType] = useState(record.taskType)
  const [description, setDescription] = useState(record.description)
  const [notes, setNotes] = useState(record.notes)
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

    try {
      const res = await fetch(`/api/work-records/${record.id}`, {
        method: 'PUT',
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
        setError(data.error || '更新に失敗しました')
        setLoading(false)
        return
      }
      router.push(`/work-records/${record.id}`)
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
            <Link href="/work-records" className="farm-new-back">
              ← 作業記録一覧
            </Link>
            <h1 className="farms-title">作業記録を編集</h1>
            <p className="farms-subtitle">{record.taskType}</p>
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
                {!WORK_TASK_TYPES.includes(taskType as (typeof WORK_TASK_TYPES)[number]) && (
                  <option value={taskType}>{taskType}</option>
                )}
              </select>
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
              />
            </div>

            <div className="auth-field">
              <label htmlFor="work-notes" className="label">メモ</label>
              <textarea
                id="work-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input farm-new-textarea"
                rows={2}
              />
            </div>

            <div className="farm-new-actions">
              <button type="submit" disabled={loading} className="btn btn-primary farm-new-submit">
                {loading ? '更新中...' : '更新する'}
              </button>
              <Link href={`/work-records/${record.id}`} className="btn btn-outline">
                キャンセル
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
