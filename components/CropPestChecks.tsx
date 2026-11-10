'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PestAdvice, { type PestAdviceData } from '@/components/PestAdvice'

type Row = { id: string; name: string; observedDay: string; present: boolean; notes: string | null }

function PestCheckRow({ cropId, row, today }: { cropId: string; row: Row; today: string }) {
  const router = useRouter()
  const [date, setDate] = useState(row.observedDay)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [advice, setAdvice] = useState<PestAdviceData | null>(null)

  async function request(method: 'PATCH' | 'DELETE' | 'GET') {
    if (method === 'DELETE' && !window.confirm('この見回り記録を削除しますか？')) return
    if (method === 'GET' && advice) {
      setAdvice(null)
      return
    }
    setPending(true)
    setError('')
    try {
      const url = `/api/crops/${cropId}/pest-checks`
      const response = await fetch(method === 'PATCH' ? url : url + '?' + new URLSearchParams({ id: row.id }), {
        method,
        ...(method === 'PATCH' && {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: row.id, observedDay: date }),
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error ?? '操作に失敗しました。')
      if (method === 'GET') setAdvice(result.advice)
      else router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作に失敗しました。')
    } finally {
      setPending(false)
    }
  }

  return <li className="border-b py-2 space-y-2">
    <p>{row.name} · {row.present ? 'いた' : 'いなかった'}</p>
    {row.notes && <p className="whitespace-pre-wrap">{row.notes}</p>}
    <div className="flex flex-wrap items-center gap-2">
      <label>見た日 <input type="date" max={today} value={date} onChange={e => setDate(e.target.value)} /></label>
      <button className="ai-proposal-action" type="button" disabled={pending || !date || date === row.observedDay} onClick={() => request('PATCH')}>日付を更新</button>
      {row.present && <button className="ai-proposal-action" type="button" disabled={pending} onClick={() => request('GET')}>{advice ? '助言を閉じる' : '助言を見る'}</button>}
      <button className="ai-proposal-action" type="button" disabled={pending} onClick={() => request('DELETE')}>削除</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {advice && <PestAdvice advice={advice} />}
  </li>
}

export default function CropPestChecks({ cropId, rows, today }: { cropId: string; rows: Row[]; today: string }) {
  return <section className="bg-white rounded-lg p-4 mb-4">
    <h2 className="font-semibold">病害虫の見回り記録</h2>
    {rows.length ? <ul>{rows.map(row => <PestCheckRow key={row.id + row.observedDay} cropId={cropId} row={row} today={today} />)}</ul>
      : <p className="text-sm">見回りの記録はまだありません。</p>}
  </section>
}
