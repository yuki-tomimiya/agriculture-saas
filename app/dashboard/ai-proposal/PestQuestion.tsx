'use client'

import { useState } from 'react'
import Link from 'next/link'
import { concernFormHref } from '@/lib/crops/field-concerns'
import { pestTrigger } from '@/lib/pests/catalog'
import type { PestQuestion as Question } from '@/lib/proposals/presentation'
import PestAdvice, { type PestAdviceData } from '@/components/PestAdvice'

export function PestQuestionRow({ question, inline = false }: { question: Question; inline?: boolean }) {
  const { cropId, cropName, farmName, pest, timing, timingSource, today } = question
  const [date, setDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [pending, setPending] = useState(false)
  const [answer, setAnswer] = useState<boolean | 'later' | null>(null)
  const [advice, setAdvice] = useState<PestAdviceData | null>(null)
  const [error, setError] = useState('')

  async function submit(present: boolean | null) {
    setPending(true)
    setError('')
    try {
      const res = await fetch(present === null ? '/api/proposals/dismiss' : `/api/crops/${cropId}/pest-checks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(present === null ? { cropId, trigger: pestTrigger(pest.key) }
          : { key: pest.key, observedDay: date, present, notes }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? '保存できませんでした。')
      if (present === null) setAnswer('later')
      else {
        const data = await res.json()
        setAnswer(present)
        setAdvice(data.advice)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存できませんでした。')
    } finally {
      setPending(false)
    }
  }

  const inputWidth = 'block w-full min-w-0 max-w-full'
  const notesInput = <textarea className={inputWidth} aria-label="見回りのメモ" maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} />

  return <div className="min-w-0 space-y-2 border-t py-2 [overflow-wrap:anywhere]">
    {!inline && <p className="ai-proposal-card-meta">{cropName}{farmName && ` · ${farmName}`}</p>}
    {!inline && timing && <p className="text-sm">{timing} {timingSource && <a className="underline" href={timingSource}>時期の出典</a>}</p>}
    {answer === null ? <>
      <label className="block text-sm">見た日 <input className={inputWidth} type="date" value={date} max={today}
        onChange={e => setDate(e.target.value)} /></label>
      {inline ? <label className="block text-sm">メモ（任意）{notesInput}</label> : <details className="text-sm">
        <summary>メモを添える</summary>
        {notesInput}
      </details>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="ai-proposal-action ai-proposal-action--primary" disabled={pending || !date} onClick={() => submit(true)}>いた</button>
        <button type="button" className="ai-proposal-action" disabled={pending || !date} onClick={() => submit(false)}>いなかった</button>
        <button type="button" className="ai-proposal-action" disabled={pending} onClick={() => submit(null)}>あとで</button>
      </div>
    </> : <p role="status">{answer === 'later' ? 'あとで確認するようにしました。' : `${answer ? '「いた」' : '「いなかった」'}を記録しました。`}</p>}
    {error && <p role="alert">{error}</p>}
    {advice && <PestAdvice advice={advice} />}
    <Link className="inline-block underline" href={concernFormHref(cropId)}>ほかに気になることがある</Link>
  </div>
}

export default function PestQuestion({ id, questions }: { id: string; questions: Question[] }) {
  const { pest } = questions[0]
  return <li>
    <details id={id} className="morning-disclosure morning-question">
      <summary>{pest.question}（{questions.length}件）</summary>
      <div className="ai-proposal-card-body">
        <div className="ai-proposal-card-action-column space-y-2">
          <ul>{questions.map(question => <li key={question.cropId}><PestQuestionRow question={question} /></li>)}</ul>
        </div>
        <div className="ai-proposal-evidence space-y-2">
          <p>{pest.marker} {pest.appearance && <a className="underline" href={pest.appearance.url}>見た目の資料</a>}</p>
        </div>
      </div>
    </details>
  </li>
}
