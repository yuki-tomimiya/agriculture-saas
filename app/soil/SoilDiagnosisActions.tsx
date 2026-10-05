'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SoilDiagnosisActions({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    if (!window.confirm('この土壌診断を削除しますか？')) return
    setBusy(true)
    const res = await fetch(`/api/soil-diagnoses/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setBusy(false)
      return
    }
    router.refresh()
  }

  return (
    <button type="button" className="btn btn-outline" onClick={remove} disabled={busy}>
      {busy ? '削除中…' : '削除'}
    </button>
  )
}
