'use client'

import { useState, type FormEvent } from 'react'
import PestAdvice, { type PestAdviceData } from '@/components/PestAdvice'
import ConcernConsultation from '@/components/ConcernConsultation'
import {
  concernApiHref, concernExtents, concernLocations, concernNotesLimit, concernPhotoLimit, concernPhotoTypes, concernSymptoms,
} from '@/lib/crops/field-concerns'
import type { PestForecastOffice } from '@/lib/pest-forecast'
import type { fieldObservationPests } from '@/lib/pests/field-observations'

type SaveResult = {
  id: string
  candidates: ReturnType<typeof fieldObservationPests>
  forecast: PestForecastOffice | null
}

const control = 'block min-h-11 w-full min-w-0 max-w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base'

export default function FieldConcernForm({ cropId, today, pending, setPending }: {
  cropId: string
  today: string
  pending: boolean
  setPending: (pending: boolean) => void
}) {
  const [result, setResult] = useState<SaveResult | null>(null)
  const [chosenKey, setChosenKey] = useState<string | null>(null)
  const [advice, setAdvice] = useState<PestAdviceData | null>(null)
  const [error, setError] = useState('')

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || result) return
    const body = new FormData(event.currentTarget)
    const photo = body.get('photo')
    if (photo instanceof File && !photo.name) body.delete('photo')
    else if (photo instanceof File && photo.size > concernPhotoLimit) {
      setError('写真は4MBまでです。')
      return
    }
    setPending(true)
    setError('')
    try {
      const response = await fetch(concernApiHref(cropId), { method: 'POST', body })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data) throw new Error(data?.error ?? '保存できませんでした。')
      setResult(data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存できませんでした。')
    } finally {
      setPending(false)
    }
  }

  async function choose(key: string) {
    if (!result || pending || chosenKey) return
    setPending(true)
    setError('')
    try {
      const response = await fetch(concernApiHref(cropId, result.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data) throw new Error(data?.error ?? '選んだ内容を保存できませんでした。')
      setChosenKey(key)
      setAdvice(data.advice)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '選んだ内容を保存できませんでした。')
    } finally {
      setPending(false)
    }
  }

  return result ? <FieldConcernResult result={result} chosenKey={chosenKey} advice={advice}
    pending={pending} error={error} choose={choose} /> : (
    <form onSubmit={save} className="space-y-4 [overflow-wrap:anywhere]">
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        <label className="block space-y-1">
          <span className="font-medium">見た日</span>
          <input type="date" name="observedDay" className={control} required max={today} defaultValue={today} />
        </label>
        <p className="text-sm">場所か様子を1つ以上選んでください。</p>
        <ChoiceGroup label="場所" name="locations" choices={concernLocations} />
        <ChoiceGroup label="様子" name="symptoms" choices={concernSymptoms} />
        <label className="block space-y-1">
          <span className="font-medium">広さ（任意）</span>
          <select name="extent" className={control} defaultValue="">
            <option value="">広さを選ぶ</option>
            {Object.entries(concernExtents).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="font-medium">メモ（任意）</span>
          <textarea name="notes" className={control} rows={2} maxLength={concernNotesLimit} />
        </label>
        <label className="block min-w-0 space-y-1">
          <span className="font-medium">写真（任意・1枚）</span>
          <input type="file" name="photo" className={control} accept={Object.values(concernPhotoTypes).join(',')} />
          <span className="text-sm">JPEG・PNG・WebP、4MBまで</span>
        </label>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <button type="submit" className="btn btn-primary min-h-11 w-full" disabled={pending}>{pending ? '保存中…' : '保存'}</button>
      </fieldset>
    </form>
  )
}

function ChoiceGroup({ label, name, choices }: { label: string; name: string; choices: Record<string, string> }) {
  return <fieldset className="min-w-0">
    <legend className="font-medium">{label}（複数可）</legend>
    <div className="flex flex-wrap gap-x-3">
      {Object.entries(choices).map(([key, text]) => <label key={key} className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name={name} value={key} className="h-4 w-4 shrink-0" />{text}
      </label>)}
    </div>
  </fieldset>
}

export function FieldConcernResult({ result, chosenKey, advice, pending, error, choose }: {
  result: SaveResult
  chosenKey: string | null
  advice: PestAdviceData | null
  pending: boolean
  error: string
  choose: (key: string) => void
}) {
  return <section className="min-w-0 space-y-4 rounded-md border p-3 [overflow-wrap:anywhere]">
    <p role="status">畑で見たことを記録しました。</p>
    {result.candidates.length > 0 && <section className="space-y-2">
      <h2 className="font-semibold">この中に近いものがあれば選んでください</h2>
      <ul className="space-y-3">
        {result.candidates.map(candidate => <li key={candidate.key} className="space-y-1">
          <p className="font-medium">{candidate.name}{chosenKey === candidate.key && '（選択済み）'}</p>
          <p>{candidate.marker}{candidate.appearanceUrl && <> <a className="underline" href={candidate.appearanceUrl}>見た目の資料</a></>}</p>
          {!chosenKey && <button type="button" className="btn btn-outline min-h-11 max-w-full whitespace-normal"
            disabled={pending} onClick={() => choose(candidate.key)}>{candidate.name}を選ぶ</button>}
        </li>)}
      </ul>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {advice && <PestAdvice advice={advice} />}
    </section>}
    <ConcernConsultation forecast={result.forecast} />
    <p>数日あとにもう一度見て、広がっていれば記録すると、相談のときに役立ちます。</p>
  </section>
}
