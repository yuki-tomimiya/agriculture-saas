'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MANUAL_SOIL_OPTIONS } from '@/lib/farm-soil/options'

export default function FarmSoilEditor({ farmId, initialKey, hasManual }: {
  farmId: string; initialKey: string; hasManual: boolean
}) {
  const router = useRouter()
  const [key, setKey] = useState(initialKey)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  async function save(action: 'set' | 'reset') {
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch(`/api/farms/${farmId}/soil`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'set' ? { action, soilKey: key } : { action }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '保存できませんでした。')
      setMessage(action === 'set' ? '土の種類を保存しました。' : '地図の目安に戻しました。')
      router.refresh()
    } catch (err) { setError(err instanceof Error ? err.message : '通信できませんでした。もう一度お試しください。') }
    finally { setBusy(false) }
  }
  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-green-700 underline">土の種類を直す</summary>
      <form className="mt-3 max-w-md space-y-3" onSubmit={event => { event.preventDefault(); void save('set') }}>
        <label className="block text-sm">
          土の種類
          <select className="mt-1 block w-full rounded border border-gray-300 p-2 bg-white" value={key}
            onChange={event => setKey(event.target.value)} disabled={busy}>
            {MANUAL_SOIL_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </label>
        <p className="text-sm text-gray-600">分からない場合は「分からない／一覧にない」を選べます。</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? '保存中…' : '保存する'}</button>
          {hasManual && <button className="btn btn-outline" type="button" disabled={busy} onClick={() => void save('reset')}>地図の目安に戻す</button>}
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="text-sm text-green-700">{message}</p>}
      </form>
    </details>
  )
}
