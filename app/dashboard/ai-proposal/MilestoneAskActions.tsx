'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PROPOSAL_DISMISS_DAYS } from '@/lib/proposals/constants'

function todayInputValue(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export default function MilestoneAskActions({
  cropId,
  milestoneKey,
  trigger,
  term,
  ifYes,
  sourceLabel,
  howTo,
  yesLabel,
  variant = 'card',
}: {
  cropId: string
  milestoneKey: string
  trigger: string
  term: string
  ifYes: string
  sourceLabel: string
  howTo: string[]
  yesLabel: string
  variant?: 'card' | 'row'
}) {
  const router = useRouter()
  const [pending, setPending] = useState<'yes' | 'later' | 'date' | null>(null)
  const [recordedOn, setRecordedOn] = useState<string | null>(null)
  const [date, setDate] = useState(todayInputValue)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const save = async (observedAt: string, pendingKind: 'yes' | 'date') => {
    setError('')
    setPending(pendingKind)
    try {
      const res = await fetch(`/api/crops/${cropId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: milestoneKey, observedAt, source: 'answered' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '保存に失敗しました')
        setPending(null)
        return false
      }
      setPending(null)
      return true
    } catch {
      setError('保存に失敗しました')
      setPending(null)
      return false
    }
  }

  const yes = async () => {
    const observedAt = todayInputValue()
    const ok = await save(observedAt, 'yes')
    if (!ok) return
    setDate(observedAt)
    setRecordedOn(observedAt)
    setNote('今日の日付で記録しました。違う日なら、ここで直せます。')
  }

  const saveDate = async () => {
    const ok = await save(date, 'date')
    if (!ok) return
    setNote('日付を直しました。')
    router.refresh()
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
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '保存に失敗しました')
        setPending(null)
        return
      }
      setNote(`${PROPOSAL_DISMISS_DAYS}日後にまた聞きます`)
      setPending(null)
      window.setTimeout(() => router.refresh(), 700)
    } catch {
      setError('保存に失敗しました')
      setPending(null)
    }
  }

  return (
    <div className={variant === 'row' ? 'ai-proposal-milestone-row' : 'ai-proposal-milestone'}>
      {variant === 'card' && (
        <>
          <p className="ai-proposal-milestone-term">（{term}）</p>
          <p className="ai-proposal-milestone-advice">{ifYes}</p>
          {howTo.length > 0 && (
            <ul className="ai-proposal-howto">
              {howTo.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          <p className="ai-proposal-milestone-source">出典: {sourceLabel}</p>
        </>
      )}
      {recordedOn ? (
        <div className="ai-proposal-actions">
          <label className="ai-proposal-milestone-date">
            日付を直す
            <input type="date" value={date} max={todayInputValue()} onChange={(event) => setDate(event.target.value)} />
          </label>
          <button type="button" className="ai-proposal-action ai-proposal-action--primary" onClick={saveDate} disabled={pending !== null}>
            {pending === 'date' ? '保存中...' : 'この日付にする'}
          </button>
          <button type="button" className="ai-proposal-action" onClick={() => router.refresh()} disabled={pending !== null}>
            今日のままで閉じる
          </button>
        </div>
      ) : (
        <div className="ai-proposal-actions">
          <button type="button" className="ai-proposal-action ai-proposal-action--primary" onClick={yes} disabled={pending !== null}>
            {pending === 'yes' ? '記録中...' : yesLabel}
          </button>
          <button type="button" className="ai-proposal-action" onClick={later} disabled={pending !== null}>
            {pending === 'later' ? '保存中...' : 'まだ'}
          </button>
        </div>
      )}
      <div className="ai-proposal-card-links">
        <Link href={`/crops/${cropId}`} className="ai-proposal-card-link">
          作付けで日付を直す →
        </Link>
      </div>
      {note && <p className="ai-proposal-dismiss-note">{note}</p>}
      {error && <p className="ai-proposal-dismiss-error">{error}</p>}
    </div>
  )
}
