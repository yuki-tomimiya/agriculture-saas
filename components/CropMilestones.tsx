'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MilestoneFormItem } from '@/lib/proposals/milestones'

function todayInputValue(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export default function CropMilestones({
  cropId,
  items,
}: {
  cropId: string
  items: MilestoneFormItem[]
}) {
  const router = useRouter()
  const [dates, setDates] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const item of items) initial[item.key] = item.observedAt ?? todayInputValue()
    return initial
  })
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')

  if (items.length === 0) return null

  const save = async (key: string) => {
    setError('')
    setPending(key)
    try {
      const res = await fetch(`/api/crops/${cropId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, observedAt: dates[key], source: 'manual' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '保存に失敗しました')
        setPending(null)
        return
      }
      setPending(null)
      router.refresh()
    } catch {
      setError('保存に失敗しました')
      setPending(null)
    }
  }

  const remove = async (key: string) => {
    setError('')
    setPending(`delete:${key}`)
    try {
      const res = await fetch(`/api/crops/${cropId}/milestones?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '削除に失敗しました')
        setPending(null)
        return
      }
      setDates((current) => ({ ...current, [key]: todayInputValue() }))
      setPending(null)
      router.refresh()
    } catch {
      setError('削除に失敗しました')
      setPending(null)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow mb-8">
      <h2 className="text-xl font-semibold mb-2">生育の節目</h2>
      <p className="text-sm text-gray-500 mb-4">
        畑で見た日を残すと、今日の提案の言い方が変わります。聞かれる前でも記録できます。
      </p>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.key} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
            <p className="font-medium text-gray-900">{item.term}</p>
            <p className="text-sm text-gray-600 mt-1">{item.question}</p>
            <p className="text-xs text-gray-400 mt-1">出典: {item.sourceLabel}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <input
                type="date"
                className="border border-gray-300 rounded px-2 py-1 text-sm"
                value={dates[item.key] ?? todayInputValue()}
                max={todayInputValue()}
                onChange={(event) => setDates((current) => ({ ...current, [item.key]: event.target.value }))}
              />
              <button type="button" className="btn btn-primary" onClick={() => save(item.key)} disabled={pending !== null}>
                {pending === item.key ? '保存中...' : item.observedAt ? '日付を保存' : '記録する'}
              </button>
              {item.observedAt && (
                <button type="button" className="btn btn-outline" onClick={() => remove(item.key)} disabled={pending !== null}>
                  {pending === `delete:${item.key}` ? '削除中...' : '記録を消す'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  )
}
