const japanDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function japanDateKey(date: Date): string {
  return japanDate.format(date)
}

export function harvestAvailableDate(appliedAt: Date, daysBeforeHarvest: number | null): string | null {
  if (daysBeforeHarvest == null || !Number.isInteger(daysBeforeHarvest) || daysBeforeHarvest < 0) return null
  const date = new Date(japanDateKey(appliedAt) + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + daysBeforeHarvest)
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null
}

export function harvestDatesByCrop(records: {
  cropId: string | null; appliedAt: Date; daysBeforeHarvest: number | null
}[]) {
  const dates = new Map<string, string>()
  for (const record of records) {
    if (!record.cropId) continue
    const date = harvestAvailableDate(record.appliedAt, record.daysBeforeHarvest)
    if (date && date > (dates.get(record.cropId) ?? '')) dates.set(record.cropId, date)
  }
  return dates
}

export const pesticideCountSelect = {
  id: true, cropId: true, productName: true, appliedAt: true, createdAt: true, applicationLimit: true,
} as const
export const pesticideSafetySelect = { ...pesticideCountSelect, daysBeforeHarvest: true } as const
export type PesticideCountRecord = {
  id: string; cropId: string | null; productName: string
  appliedAt: Date; createdAt: Date; applicationLimit: number | null
}

function orderedRecords(records: PesticideCountRecord[]) {
  return records.map(record => ({ record, day: japanDateKey(record.appliedAt) })).sort((a, b) =>
    a.day.localeCompare(b.day) ||
    a.record.createdAt.getTime() - b.record.createdAt.getTime() ||
    a.record.id.localeCompare(b.record.id),
  )
}

export function pesticideCounts(records: PesticideCountRecord[]) {
  const counts = new Map<string, number>()
  const byRecord = new Map<string, number>()
  for (const { record } of orderedRecords(records)) {
    if (!record.cropId) continue
    const key = JSON.stringify([record.cropId, record.productName.trim()])
    const count = (counts.get(key) ?? 0) + 1
    counts.set(key, count)
    byRecord.set(record.id, count)
  }
  return (id: string) => byRecord.get(id) ?? 0
}

export function pesticideDraftUsage(records: PesticideCountRecord[], cropId: string, product: string, day: string, editId?: string) {
  const name = product.trim()
  if (!cropId || !name || !day) return { count: 0, limit: null }
  const editing = records.find(record => record.id === editId)
  let count = 1
  let limit: number | null = null
  for (const { record, day: recordDay } of orderedRecords(records)) {
    if (record.id === editId || record.cropId !== cropId || record.productName.trim() !== name) continue
    if (recordDay > day) break
    if (recordDay === day && editing &&
      (record.createdAt > editing.createdAt ||
        (+record.createdAt === +editing.createdAt && record.id.localeCompare(editing.id) > 0))) continue
    count += 1
    if (record.applicationLimit != null) limit = record.applicationLimit
  }
  return { count, limit }
}

export function pesticideUsage(recordCount: number, enteredCount: number | null, limit: number | null) {
  const count = Math.max(recordCount, enteredCount ?? 0)
  return { count, limit, state: limit == null ? null : count > limit ? 'over' : count === limit ? 'at' : null }
}

export function harvestDateLabel(date: string) {
  const [year, month, day] = date.split('-')
  return `${year}年${Number(month)}月${Number(day)}日`
}

export const PESTICIDE_COUNT_NOTE = '同じ成分を含むほかの農薬の回数は数えていません。ラベルの「◯◯を含む農薬の総使用回数」は、ほかの農薬と合わせて確かめてください。'
