import { LAST_YEAR_SAME_DAY_WINDOW_DAYS } from '@/lib/proposals/constants'

export function calendarDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)
}

export function offsetDay(key: string, days: number) {
  const [year, month, day] = key.split('-').map(Number)
  return calendarDate(year, month, day + days)
}

export function lastYearOverlay(recordDay: string) {
  const keys: string[] = []
  for (let i = -LAST_YEAR_SAME_DAY_WINDOW_DAYS; i <= LAST_YEAR_SAME_DAY_WINDOW_DAYS; i++) {
    const [year, month, day] = offsetDay(recordDay, i).split('-').map(Number)
    const key = calendarDate(year + 1, month, day)
    if (Number(key.slice(5, 7)) === month) keys.push(key)
  }
  return keys
}

export function shiftMonth(year: number, month: number, delta: number) {
  const [y, m] = calendarDate(year, month + delta, 1).split('-').map(Number)
  return { year: y, month: m }
}
