'use client'

import { useState } from 'react'
import { pestTrigger } from '@/lib/pests/catalog'
import type { loadPestQuestions } from '@/lib/pests/service'
import PestAdvice, { type PestAdviceData } from '@/components/PestAdvice'

type Question = Awaited<ReturnType<typeof loadPestQuestions>>[number]

function PestQuestionRow({ question }: { question: Question }) {
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

  return <li className="space-y-2 border-t py-2">
    <p className="ai-proposal-card-meta">{cropName}{farmName && ` · ${farmName}`}</p>
    {timing && <p className="text-sm">{timing} {timingSource && <a className="underline" href={timingSource}>時期の出典</a>}</p>}
    {answer === null ? <>
      <label className="text-sm">見た日 <input type="date" value={date} max={today}
        onChange={e => setDate(e.target.value)} /></label>
      <details className="text-sm">
        <summary>メモを添える</summary>
        <textarea aria-label="見回りのメモ" maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} />
      </details>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="ai-proposal-action ai-proposal-action--primary" disabled={pending || !date} onClick={() => submit(true)}>いた</button>
        <button type="button" className="ai-proposal-action" disabled={pending || !date} onClick={() => submit(false)}>いなかった</button>
        <button type="button" className="ai-proposal-action" disabled={pending} onClick={() => submit(null)}>あとで</button>
      </div>
    </> : <p role="status">{answer === 'later' ? 'あとで確認するようにしました。' : `${answer ? '「いた」' : '「いなかった」'}を記録しました。`}</p>}
    {error && <p role="alert">{error}</p>}
    {advice && <PestAdvice advice={advice} />}
  </li>
}

export default function PestQuestion({ questions }: { questions: Question[] }) {
  const { pest } = questions[0]
  return <li className="ai-proposal-card ai-proposal-card--low">
    <div className="ai-proposal-card-inner">
      <div className="ai-proposal-card-body">
        <div className="ai-proposal-card-action-column space-y-2">
          <span className="ai-proposal-card-type">病害虫の見回り</span>
          <h3 className="ai-proposal-card-title">{pest.question}</h3>
          <ul>{questions.map(question => <PestQuestionRow key={question.cropId} question={question} />)}</ul>
        </div>
        <div className="ai-proposal-evidence space-y-2">
          <p>{pest.marker} {pest.appearance && <a className="underline" href={pest.appearance.url}>見た目の資料</a>}</p>
        </div>
      </div>
    </div>
  </li>
}
