'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PestAdvice, { type PestAdviceData } from '@/components/PestAdvice'
import { concernApiHref, concernChoiceLabel, concernExtents, concernLabel, concernLocations, concernSymptoms } from '@/lib/crops/field-concerns'

type Observation = { id: string; observedDay: string; createdAt: number; notes: string | null }
type Row = Observation & { name: string; present: boolean }
type Concern = Observation & {
  locations: string
  symptoms: string
  extent: string | null
  hasPhoto: boolean
  selectedPestName: string | null
}

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
      <label className="min-w-0 max-w-full">見た日 <input className="max-w-full" type="date" max={today} value={date} onChange={e => setDate(e.target.value)} /></label>
      <button className="ai-proposal-action" type="button" disabled={pending || !date || date === row.observedDay} onClick={() => request('PATCH')}>日付を更新</button>
      {row.present && <button className="ai-proposal-action" type="button" disabled={pending} onClick={() => request('GET')}>{advice ? '助言を閉じる' : '助言を見る'}</button>}
      <button className="ai-proposal-action" type="button" disabled={pending} onClick={() => request('DELETE')}>削除</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {advice && <PestAdvice advice={advice} />}
  </li>
}

function ConcernRow({ cropId, row }: { cropId: string; row: Concern }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const url = concernApiHref(cropId, row.id)
  const photo = url + '/photo'
  const locations = row.locations.split(',').map(key => concernChoiceLabel(concernLocations, key)).filter(Boolean).join('、')
  const symptoms = row.symptoms.split(',').map(key => concernChoiceLabel(concernSymptoms, key)).filter(Boolean).join('、')
  const extent = row.extent && concernChoiceLabel(concernExtents, row.extent)

  async function remove() {
    if (!window.confirm('この記録を削除しますか？')) return
    setPending(true)
    setError('')
    try {
      const response = await fetch(url, { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? '削除できませんでした。')
      }
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '削除できませんでした。')
    } finally {
      setPending(false)
    }
  }

  return <li className="space-y-2 border-b py-2">
    <p><time dateTime={row.observedDay}>{row.observedDay}</time> · {concernLabel}</p>
    {locations && <p>場所　{locations}</p>}
    {symptoms && <p>様子　{symptoms}</p>}
    {extent && <p>広さ　{extent}</p>}
    {row.notes && <p className="whitespace-pre-wrap">{row.notes}</p>}
    {row.hasPhoto && <a className="inline-block max-w-full" href={photo}>
      {/* 非公開の写真を最適化サーバーに渡さず、本人のセッションで取得する。 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="h-24 w-auto max-w-full rounded object-contain" src={photo} alt="記録した写真を開く" loading="lazy" />
    </a>}
    {row.selectedPestName && <p>近いものとして選んだ病害虫　{row.selectedPestName}</p>}
    <div><button className="ai-proposal-action" type="button" disabled={pending} onClick={remove}>削除</button></div>
    {error && <p role="alert">{error}</p>}
  </li>
}

export default function CropPestChecks({ cropId, rows, concerns, today }: {
  cropId: string; rows: Row[]; concerns: Concern[]; today: string
}) {
  const observations = [...rows, ...concerns].sort(
    (a, b) => b.observedDay.localeCompare(a.observedDay) || b.createdAt - a.createdAt,
  )
  return <section className="bg-white rounded-lg p-4 mb-4">
    <h2 className="font-semibold">畑で見たこと</h2>
    {observations.length ? <ul>{observations.map(row => 'present' in row
      ? <PestCheckRow key={row.id + row.observedDay} cropId={cropId} row={row} today={today} />
      : <ConcernRow key={row.id} cropId={cropId} row={row} />)}</ul>
      : <p className="text-sm">畑で見たことの記録はまだありません。</p>}
  </section>
}
