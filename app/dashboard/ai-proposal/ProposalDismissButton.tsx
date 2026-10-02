'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ProposalDismissButton({
  trigger,
  cropId,
  cropIds,
}: {
  trigger: string
  cropId?: string
  cropIds?: string[]
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const ids = cropIds && cropIds.length > 0 ? cropIds : cropId ? [cropId] : []
  const label = ids.length > 1 ? 'これらの作付けは今はしない' : ids.length === 1 ? 'この作付けは今はしない' : '今はしない'

  const onClick = async () => {
    setError('')
    setPending(true)
    try {
      const res = await fetch('/api/proposals/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger,
          cropId: ids.length === 1 ? ids[0] : null,
          cropIds: ids.length > 1 ? ids : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : '保存に失敗しました')
        setPending(false)
        return
      }
      setNote('7日後にまた出ます')
      setPending(false)
      window.setTimeout(() => router.refresh(), 900)
    } catch {
      setError('保存に失敗しました')
      setPending(false)
    }
  }

  return (
    <span className="ai-proposal-dismiss">
      <button type="button" className="ai-proposal-action" onClick={onClick} disabled={pending}>
        {pending ? '保存中...' : label}
      </button>
      {note && <span className="ai-proposal-dismiss-note">{note}</span>}
      {error && <span className="ai-proposal-dismiss-error">{error}</span>}
    </span>
  )
}
