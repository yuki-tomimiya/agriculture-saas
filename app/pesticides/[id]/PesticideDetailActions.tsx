'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function PesticideDetailActions({ recordId }: { recordId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm('この農薬記録を削除しますか？')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/pesticides/${recordId}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/pesticides')
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || '削除に失敗しました')
      }
    } catch {
      alert('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Link href={`/pesticides/${recordId}/edit`} className="btn btn-outline">
        編集
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className="btn btn-outline text-red-600 border-red-200 hover:bg-red-50"
      >
        {loading ? '削除中...' : '削除'}
      </button>
    </>
  )
}
