import { japanDateKey } from '@/lib/pesticide-safety'

export function observedDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(value + 'T00:00:00+09:00')
  return Number.isFinite(+date) && japanDateKey(date) === value && value <= japanDateKey(new Date()) ? date : null
}
