'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

type FarmWithCrops = { id: string; name: string; crops: { id: string; name: string }[] }

export default function TaskNewForm({ farms }: { farms: FarmWithCrops[] }) {
  const router = useRouter()
  const [farmId, setFarmId] = useState(farms[0]?.id ?? '')
  const [cropId, setCropId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('medium')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedFarm = farms.find((f) => f.id === farmId)
  const crops = selectedFarm?.crops ?? []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmId,
          cropId: cropId || null,
          title: title.trim(),
          description: description.trim() || null,
          dueDate: dueDate || null,
          priority,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'タスクの登録に失敗しました')
        setLoading(false)
        return
      }

      router.push('/tasks')
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
              先に農場を登録してください。タスクは農場に紐づけて登録します。
            </p>
            <Link href="/farms/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              農場を追加する
            </Link>
            <Link href="/tasks" className="btn btn-outline" style={{ marginTop: '0.5rem' }}>
              タスク一覧に戻る
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
            <Link href="/tasks" className="farm-new-back">
              ← タスク一覧
            </Link>
            <h1 className="farms-title">新規タスクを追加</h1>
            <p className="farms-subtitle">
              農場・タイトルを入力し、任意で作物・期限・優先度を設定します
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
              <label htmlFor="task-farm" className="label">
                農場 <span className="farm-new-required">必須</span>
              </label>
              <select
                id="task-farm"
                value={farmId}
                onChange={(e) => {
                  setFarmId(e.target.value)
                  setCropId('')
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

            <div className="auth-field">
              <label htmlFor="task-title" className="label">
                タイトル <span className="farm-new-required">必須</span>
              </label>
              <input
                id="task-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="input"
                placeholder="例：トマトの追肥"
                maxLength={200}
              />
            </div>

            {crops.length > 0 && (
              <div className="auth-field">
                <label htmlFor="task-crop" className="label">
                  作物（任意）
                </label>
                <select
                  id="task-crop"
                  value={cropId}
                  onChange={(e) => setCropId(e.target.value)}
                  className="input"
                >
                  <option value="">指定しない</option>
                  {crops.map((crop) => (
                    <option key={crop.id} value={crop.id}>
                      {crop.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="task-description" className="label">
                説明
              </label>
              <textarea
                id="task-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input farm-new-textarea"
                placeholder="例：第1果房の収穫後、液肥を施用"
                rows={3}
              />
            </div>

            <div className="farm-new-row">
              <div className="auth-field farm-new-half">
                <label htmlFor="task-due" className="label">
                  期限
                </label>
                <input
                  id="task-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="input"
                />
              </div>
              <div className="auth-field farm-new-half">
                <label htmlFor="task-priority" className="label">
                  優先度
                </label>
                <select
                  id="task-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="input"
                >
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                </select>
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
              <Link href="/tasks" className="btn btn-outline">
                キャンセル
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
