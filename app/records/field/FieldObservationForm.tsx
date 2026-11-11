'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import PestAdvice, { type PestAdviceData } from '@/components/PestAdvice'
import { FertilizerStandards, RecordGuidance } from '@/components/ProposalRecordGuidance'
import type { fieldObservationOptions } from '@/lib/crops/field-observations'
import type { CropRecordGuidance, ProposalRecordGuidance } from '@/lib/proposals/record-guidance'

type CropOption = { id: string; label: string } & ReturnType<typeof fieldObservationOptions>
type SaveResult = {
  advice?: PestAdviceData | null
  fertilizer?: CropRecordGuidance['fertilizer']
  standards?: ProposalRecordGuidance['standards']
}
const control = 'min-h-11 w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-base'

export default function FieldObservationForm({ crops, initialCropId, today }: {
  crops: CropOption[]
  initialCropId?: string
  today: string
}) {
  const [cropId, setCropId] = useState(crops.some(item => item.id === initialCropId) ? initialCropId : '')
  const [pending, setPending] = useState(false)
  const [savedDates, setSavedDates] = useState<Record<string, Record<string, string>>>({})
  const crop = crops.find(item => item.id === cropId)

  if (!crops.length) return <p>栽培中の作付けはありません。 <Link href="/crops" className="underline">作物一覧へ</Link></p>

  return (
    <div className="space-y-4 rounded-lg bg-white p-3 sm:p-5">
      <label className="block space-y-1">
        <span className="block font-medium">作付け</span>
        <select className={control} value={cropId} disabled={pending} onChange={event => setCropId(event.target.value)}>
          <option value="">作付けを選ぶ</option>
          {crops.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      {crop && <ObservationFields key={crop.id} crop={crop} today={today} pending={pending} setPending={setPending}
        savedDates={savedDates[crop.id]} rememberDate={(key, date) => setSavedDates(previous => ({
          ...previous, [crop.id]: { ...previous[crop.id], [key]: date },
        }))} />}
    </div>
  )
}

function ObservationFields({ crop, today, pending, setPending, savedDates, rememberDate }: {
  crop: CropOption
  today: string
  pending: boolean
  setPending: (pending: boolean) => void
  savedDates?: Record<string, string>
  rememberDate: (key: string, date: string) => void
}) {
  const [selected, setSelected] = useState('')
  const milestone = crop.milestones.find(item => item.key === selected)
  const pest = crop.pests.find(item => item.key === selected)

  if (!crop.milestones.length && !crop.pests.length) return (
    <p>この作付けで選べる節目や病害虫はありません。 <Link href="/records" className="underline">作業・農薬などの記録へ</Link></p>
  )

  return <>
    <label className="block space-y-1">
      <span className="block font-medium">見たもの</span>
      <select className={control} value={selected} disabled={pending} onChange={event => setSelected(event.target.value)}>
        <option value="">見たものを選ぶ</option>
        {!!crop.milestones.length && <optgroup label="生育の節目">
          {crop.milestones.map(item => {
            const date = savedDates?.[item.key] ?? item.observedAt
            return <option key={item.key} value={item.key}>{item.label}{date ? `（記録済み ${date}）` : ''}</option>
          })}
        </optgroup>}
        {!!crop.pests.length && <optgroup label="病害虫">
          {crop.pests.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}
        </optgroup>}
      </select>
    </label>
    {(milestone || pest) && <ObservationSaveForm key={selected} cropId={crop.id} today={today}
      milestone={milestone} pest={pest} pending={pending} setPending={setPending}
      savedDate={savedDates?.[selected] ?? milestone?.observedAt} rememberDate={rememberDate} />}
  </>
}

function ObservationSaveForm({ cropId, today, milestone, pest, pending, setPending, savedDate, rememberDate }: {
  cropId: string
  today: string
  milestone?: CropOption['milestones'][number]
  pest?: CropOption['pests'][number]
  pending: boolean
  setPending: (pending: boolean) => void
  savedDate?: string | null
  rememberDate: (key: string, date: string) => void
}) {
  const [date, setDate] = useState(savedDate ?? today)
  const [present, setPresent] = useState<boolean | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<SaveResult | null>(null)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || result || (pest && present === null)) return
    setPending(true)
    setError('')
    try {
      const response = await fetch(`/api/crops/${encodeURIComponent(cropId)}/${milestone ? 'milestones' : 'pest-checks'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(milestone
          ? { key: milestone.key, observedAt: date, source: 'field', notes: notes.trim() || undefined }
          : { key: pest?.key, observedDay: date, present, notes, source: 'field' }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data) throw new Error(data?.error ?? '保存できませんでした。')
      if (milestone) rememberDate(milestone.key, date)
      setResult(data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存できませんでした。')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {pest && <p className="text-sm">
        {pest.marker}{pest.appearanceUrl && <> <a className="underline" href={pest.appearanceUrl}>見た目の資料</a></>}
      </p>}
      {result ? (
        <section className="space-y-2 rounded-md border p-3">
          <p role="status">{date}の記録を保存しました。</p>
          {milestone && <>
            <p>{milestone.reportedAdvice}</p>
            {!!milestone.howTo.length && <ul className="list-disc pl-5">{milestone.howTo.map(line => <li key={line}>{line}</li>)}</ul>}
            <p className="text-sm">出典　{milestone.sourceLabel}</p>
            {result.fertilizer && <RecordGuidance entry={{ fertilizer: result.fertilizer }} />}
            <FertilizerStandards standards={result.standards} />
            <button type="button" className="btn btn-outline min-h-11 max-w-full whitespace-normal" onClick={() => setResult(null)}>日付を直す</button>
          </>}
          {result.advice && <PestAdvice advice={result.advice} />}
        </section>
      ) : (
        <fieldset disabled={pending} className="min-w-0 space-y-4">
          {pest && <div role="group" aria-label="見回りの結果" className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={present === true} className={`btn min-h-11 max-w-full whitespace-normal ${present === true ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setPresent(true)}>いた</button>
            <button type="button" aria-pressed={present === false} className={`btn min-h-11 max-w-full whitespace-normal ${present === false ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setPresent(false)}>見回りしたがいなかった</button>
          </div>}
          {milestone && savedDate && <p className="text-sm">記録済み　{savedDate}。見た日を直せます。</p>}
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 basis-40 space-y-1">
              <span className="block font-medium">見た日</span>
              <input type="date" className={control} required max={today} value={date} onChange={event => setDate(event.target.value)} />
            </label>
            <button type="button" className="btn btn-outline min-h-11" onClick={() => setDate(today)}>今日</button>
          </div>
          <label className="block space-y-1">
            <span className="block font-medium">メモ（任意）</span>
            <textarea className={control} rows={2} maxLength={500} value={notes} onChange={event => setNotes(event.target.value)} />
          </label>
          {error && <p role="alert" className="text-red-700">{error}</p>}
          <button type="submit" className="btn btn-primary min-h-11 w-full" disabled={pending || !date || (!!pest && present === null)}>
            {pending ? '保存中…' : '保存'}
          </button>
        </fieldset>
      )}
    </form>
  )
}
