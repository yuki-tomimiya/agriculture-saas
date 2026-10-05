'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  cropDeleteConfirmMessage,
  type CropDeleteCounts,
} from '@/lib/crops/delete-message'

export default function CropDeleteButton({
  cropId,
  counts,
  suggestComplete,
}: {
  cropId: string
  counts: CropDeleteCounts
  suggestComplete: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    const message = cropDeleteConfirmMessage(counts, { suggestComplete })
    if (!window.confirm(message)) return
    setLoading(true)
    try {
      const res = await fetch(`/api/crops/${cropId}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/crops')
        router.refresh()
        return
      }
      const data = await res.json().catch(() => ({}))
      alert(data.error || '削除に失敗しました')
    } catch {
      alert('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className="btn btn-outline text-red-600 border-red-200 hover:bg-red-50"
      >
        {loading ? '削除中...' : '削除'}
      </button>
      {suggestComplete && (
        <p className="text-xs text-gray-500 max-w-xs text-right">
          誤登録でなければ、編集から完了にすると過去の作付けへ移ります。
        </p>
      )}
    </div>
  )
}
