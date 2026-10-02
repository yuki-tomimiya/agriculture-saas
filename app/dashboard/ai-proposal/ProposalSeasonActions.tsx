'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SEASON_FINISH_DISMISS_DAYS } from '@/lib/proposals/constants'
import { harvestHref } from '@/lib/proposals/links'

export default function ProposalSeasonActions({
  cropId,
  farmId,
  trigger,
}: {
  cropId: string
  farmId?: string
  trigger: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState<'finish' | 'later' | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const retrospective = `/crops/${cropId}/retrospective`

  const finish = async () => {
    setError('')
    setPending('finish')
    try {
      const res = await fetch(`/api/crops/${cropId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'harvested' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : '状態の更新に失敗しました')
        setPending(null)
        return
      }
      setNote('収穫済みにしました。振り返りを開いています…')
      router.push(`${retrospective}?from=status`)
      router.refresh()
    } catch {
      setError('状態の更新に失敗しました')
      setPending(null)
    }
  }

  const later = async () => {
    setError('')
    setPending('later')
    try {
      const res = await fetch('/api/proposals/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger, cropId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : '保存に失敗しました')
        setPending(null)
        return
      }
      setNote(`${SEASON_FINISH_DISMISS_DAYS}日後にまた確認します`)
      setPending(null)
      window.setTimeout(() => router.refresh(), 900)
    } catch {
      setError('保存に失敗しました')
      setPending(null)
    }
  }

  return (
    <span className="ai-proposal-line-actions">
      <button
        type="button"
        className="ai-proposal-action ai-proposal-action--primary"
        onClick={finish}
        disabled={pending !== null}
      >
        {pending === 'finish' ? '振り返りを開いています…' : '終了する'}
      </button>
      <button type="button" className="ai-proposal-action" onClick={later} disabled={pending !== null}>
        {pending === 'later' ? '保存中...' : 'まだ続く'}
      </button>
      <Link
        href={harvestHref({
          cropId,
          farmId,
          returnTo: retrospective,
        })}
        className="ai-proposal-action"
      >
        収穫を記録する
      </Link>
      {note && <span className="ai-proposal-dismiss-note">{note}</span>}
      {error && <span className="ai-proposal-dismiss-error">{error}</span>}
    </span>
  )
}
