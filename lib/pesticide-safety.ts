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

export const pesticideCountSelect = { id: true, cropId: true, productName: true } as const
export const pesticideSafetySelect = { ...pesticideCountSelect, appliedAt: true, daysBeforeHarvest: true } as const
export type PesticideCountRecord = { id: string; cropId: string | null; productName: string }

export function pesticideCounts(records: PesticideCountRecord[], excludeId?: string) {
  const counts = new Map<string, number>()
  for (const record of records) {
    if (!record.cropId || record.id === excludeId) continue
    const key = JSON.stringify([record.cropId, record.productName.trim()])
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return (cropId: string | null, name: string) => counts.get(JSON.stringify([cropId, name.trim()])) ?? 0
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
