'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RecordDeleteButton({
  url,
  confirmMessage,
  redirectTo,
  label = '削除',
}: {
  url: string
  confirmMessage: string
  redirectTo: string
  label?: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!window.confirm(confirmMessage)) return
    setLoading(true)
    try {
      const res = await fetch(url, { method: 'DELETE' })
      if (res.ok) {
        router.push(redirectTo)
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
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="btn btn-outline text-red-600 border-red-200 hover:bg-red-50"
    >
      {loading ? '削除中...' : label}
    </button>
  )
}
