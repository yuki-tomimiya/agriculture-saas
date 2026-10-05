'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  farmDeleteBlockMessage,
  farmDeleteConfirmMessage,
  type FarmDeleteCounts,
} from '@/lib/farms/delete-guard'

export default function FarmDeleteButton({
  farmId,
  counts,
}: {
  farmId: string
  counts: FarmDeleteCounts
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const blocked = farmDeleteBlockMessage(counts)

  const handleDelete = async () => {
    if (blocked) {
      window.alert(blocked)
      return
    }
    if (!window.confirm(farmDeleteConfirmMessage(counts))) return
    setLoading(true)
    try {
      const res = await fetch(`/api/farms/${farmId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        router.push('/farms')
        router.refresh()
        return
      }
      alert(data.error || '削除に失敗しました')
    } catch {
      alert('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="btn btn-outline text-red-600 border-red-200 hover:bg-red-50"
    >
      {loading ? '削除中...' : '削除'}
    </button>
  )
}
