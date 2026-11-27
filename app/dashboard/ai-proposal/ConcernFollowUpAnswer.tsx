'use client'

import { useState } from 'react'
import ConcernConsultation from '@/components/ConcernConsultation'
import { concernApiHref, concernFollowUpResults } from '@/lib/crops/field-concerns'
import type { PestForecastOffice } from '@/lib/pest-forecast'
import type { ConcernFollowUp } from '@/lib/proposals/presentation'

type SavedAnswer = { consultation?: { forecast: PestForecastOffice | null } }

export function ConcernFollowUpFeedback({ answer }: { answer: SavedAnswer }) {
  return <div className="min-w-0 space-y-2">
    <p role="status">記録しました。</p>
    {answer.consultation && <ConcernConsultation forecast={answer.consultation.forecast} />}
  </div>
}

export default function ConcernFollowUpAnswer({ concern }: { concern: ConcernFollowUp }) {
  const [answer, setAnswer] = useState<SavedAnswer | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function save(result: string) {
    if (pending || answer) return
    setPending(true)
    setError('')
    try {
      const response = await fetch(concernApiHref(concern.cropId, concern.id) + '/follow-up', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body) throw new Error(body?.error ?? '保存できませんでした。')
      setAnswer(body)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存できませんでした。')
    } finally {
      setPending(false)
    }
  }

  if (answer) return <ConcernFollowUpFeedback answer={answer} />
  return <div className="min-w-0 space-y-2">
    <div className="flex flex-wrap gap-2" role="group" aria-label={concern.title}>
      {Object.entries(concernFollowUpResults).map(([key, label]) =>
        <button key={key} className="ai-proposal-action max-w-full whitespace-normal" type="button"
          disabled={pending} onClick={() => save(key)}>{label}</button>)}
    </div>
    {error && <p role="alert">{error}</p>}
  </div>
}
