'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  END_REASONS,
  GRADE_A_DEFINITION,
  GRADE_A_REASONS,
  GRADE_A_SHARES,
  needsGradeAReason,
} from '@/lib/crops/outcome'

export type CropOutcomeInitial = {
  endReason: string
  noHarvest: boolean
  gradeAShare: number | null
  gradeAReason: string
  note: string
}

export default function CropOutcomeForm({
  cropId,
  initial,
}: {
  cropId: string
  initial: CropOutcomeInitial | null
}) {
  const router = useRouter()
  const [endReason, setEndReason] = useState(initial?.endReason ?? '')
  const [share, setShare] = useState(initial ? (initial.noHarvest ? 'none' : String(initial.gradeAShare ?? '')) : '')
  const [reason, setReason] = useState(initial?.gradeAReason ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const noHarvest = share === 'none'
  const shareNumber = noHarvest || share === '' ? null : Number(share)
  const askReason = needsGradeAReason(shareNumber, noHarvest)

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/crops/${cropId}/outcome`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endReason,
          noHarvest,
          gradeAShare: noHarvest ? 'none' : shareNumber,
          gradeAReason: askReason ? reason : '',
          note,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '保存できませんでした')
        setLoading(false)
        return
      }
      router.refresh()
      setLoading(false)
    } catch {
      setError('保存できませんでした')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={save} className="card" style={{ marginBottom: '1.25rem' }}>
      <h2 className="insights-section-title">結果の記録</h2>
      {!initial && <p className="text-gray-800" style={{ marginBottom: '0.75rem' }}>結果を記録してください</p>}
      {error && (
        <div className="auth-error" role="alert" style={{ marginBottom: '0.75rem' }}>
          {error}
        </div>
      )}
      <div className="auth-field">
        <label htmlFor="end-reason" className="label">
          終わった理由 <span className="farm-new-required">必須</span>
        </label>
        <select id="end-reason" className="input" value={endReason} onChange={(e) => setEndReason(e.target.value)} required>
          <option value="">選んでください</option>
          {END_REASONS.map((item) => (
            <option key={item.key} value={item.key}>{item.label}</option>
          ))}
        </select>
      </div>
      <div className="auth-field">
        <label htmlFor="grade-a-share" className="label">
          A品の割合 <span className="farm-new-required">必須</span>
        </label>
        <select id="grade-a-share" className="input" value={share} onChange={(e) => setShare(e.target.value)} required>
          <option value="">選んでください</option>
          <option value="none">収穫なし</option>
          {GRADE_A_SHARES.map((value) => (
            <option key={value} value={String(value)}>{value}%</option>
          ))}
        </select>
        <p className="text-sm text-gray-500" style={{ marginTop: '0.35rem' }}>{GRADE_A_DEFINITION}</p>
      </div>
      {askReason && (
        <div className="auth-field">
          <label htmlFor="grade-a-reason" className="label">A品にならなかった主な理由（任意）</label>
          <select id="grade-a-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">選ばない</option>
            {GRADE_A_REASONS.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
        </div>
      )}
      <div className="auth-field">
        <label htmlFor="outcome-note" className="label">一言（任意）</label>
        <textarea
          id="outcome-note"
          className="input farm-new-textarea"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? '保存中...' : initial ? '結果を直す' : '結果を記録する'}
      </button>
    </form>
  )
}
