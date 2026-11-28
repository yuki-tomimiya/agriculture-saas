import { calendarDate, offsetDay } from './dates'
import type { OutlookRow } from './outlook'

// カレンダーの1か月のマスと、選んだ日の欄（台帳 I28）。画面から使うので、データベースや外部の取得には触れない。

export type CalendarKind = 'weather' | 'harvest' | 'mine' | 'lastYear' | 'season'
type DotKind = Exclude<CalendarKind, 'season'>
export const DOT_KINDS: readonly { kind: DotKind; label: string }[] = [
  { kind: 'weather', label: '霜・天気' },
  { kind: 'harvest', label: '収穫・聞き始め' },
  { kind: 'mine', label: 'あなたの記録から' },
  { kind: 'lastYear', label: '昨年' },
]
/** 開いたときの欄は今日からこの日数 */
export const PANEL_DAYS = 7

const weekdays = ['日', '月', '火', '水', '木', '金', '土']
export function monthDayLabel(day: string) {
  return Number(day.slice(5, 7)) + '月' + Number(day.slice(8, 10)) + '日'
}
export function dayHeading(day: string) {
  const [year, month, date] = day.split('-').map(Number)
  return monthDayLabel(day) + '（' + weekdays[new Date(Date.UTC(year, month - 1, date)).getUTCDay()] + '）'
}

/** 点を打つ日。幅のあるもの（収穫の見込み・気になることのその後）は始まりと終わりの日だけ。昨年は前後2日の重ね（台帳 I7）のまま毎日 */
export function dotDays(row: OutlookRow): string[] {
  if (row.kind === 'season') return []
  if (row.start === row.end) return [row.start]
  if (row.kind !== 'lastYear') return [row.start, row.end]
  const days: string[] = []
  for (let day = row.start; day <= row.end; day = offsetDay(day, 1)) days.push(day)
  return days
}

export type DayDots = Partial<Record<DotKind, number>>
export function dotsByDay(rows: OutlookRow[]) {
  const dots = new Map<string, DayDots>()
  for (const row of rows) {
    if (row.kind === 'season') continue
    for (const day of dotDays(row)) {
      const counts = dots.get(day) ?? {}
      counts[row.kind] = (counts[row.kind] ?? 0) + 1
      dots.set(day, counts)
    }
  }
  return dots
}

/** マスの読み上げの名前。例「12月2日、あなたの記録から1件、霜・天気1件」 */
export function cellLabel(day: string, dots: DayDots = {}, today?: string) {
  const parts = DOT_KINDS.filter(({ kind }) => dots[kind]).map(({ kind, label }) => label + dots[kind] + '件')
  return [monthDayLabel(day) + (day === today ? '（今日）' : ''), ...parts].join('、')
}

/** 選んだ日の行。幅の中に入っている日も出す */
export function rowsOnDay(rows: OutlookRow[], day: string) {
  return rows.filter(row => row.kind !== 'season' && row.start <= day && day <= row.end)
}

/** 開いたときの欄：今日から7日を日付ごとに。今日より前に始まって続いているものは今日に置く */
export function panelWeek(rows: OutlookRow[], today: string) {
  const last = offsetDay(today, PANEL_DAYS - 1)
  const groups: { day: string; rows: OutlookRow[] }[] = []
  for (const row of rows) {
    if (row.kind === 'season' || row.end < today) continue
    const day = row.start > today ? row.start : today
    if (day > last) continue
    const group = groups.find(g => g.day === day)
    if (group) group.rows.push(row)
    else groups.push({ day, rows: [row] })
  }
  return groups.sort((a, b) => a.day.localeCompare(b.day))
}

export function seasonLines(rows: OutlookRow[], month: string) {
  return rows.filter(row => row.kind === 'season' && row.start.slice(0, 7) === month)
}

/** 欄に天気の行があるときだけ、出典の短い1行をそれぞれ1回 */
export function panelSources(rows: OutlookRow[]) {
  return {
    openMeteo: rows.some(row => row.source != null && row.source !== 'station'),
    jma: rows.some(row => row.source === 'station'),
  }
}

export type CalendarView = { month: string; day: string | null }

/** URL の引数（month=2026-12・day=2026-12-02）を、今月〜見通しの範囲の終わりの月に収めて読む */
export function readCalendarView(params: { month?: string; day?: string }, today: string, lastMonth: string): CalendarView {
  const thisMonth = today.slice(0, 7)
  const inRange = (month: string) => month >= thisMonth && month <= lastMonth
  const [dayYear, dayMonth, dayDate] = (params.day ?? '').split('-').map(Number)
  const day = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) && calendarDate(dayYear, dayMonth, dayDate) === params.day
    && inRange(params.day.slice(0, 7)) ? params.day : null
  const month = params.month && /^\d{4}-\d{2}$/.test(params.month) && inRange(params.month) ? params.month : day?.slice(0, 7) ?? thisMonth
  return { month, day }
}

/** 月を送る。範囲の外なら null（今月より前は過去の実績のページへ） */
export function shiftView(view: CalendarView, delta: number, today: string, lastMonth: string): CalendarView | null {
  const [year, month] = view.month.split('-').map(Number)
  const next = calendarDate(year, month + delta, 1).slice(0, 7)
  return next < today.slice(0, 7) || next > lastMonth ? null : { ...view, month: next }
}

/** 選んだ日・月を残した URL。農場の絞り込みと一緒に使える */
export function calendarHref(view: CalendarView, today: string, farm?: string | null) {
  const params = new URLSearchParams()
  if (farm) params.set('farm', farm)
  if (view.month !== today.slice(0, 7)) params.set('month', view.month)
  if (view.day) params.set('day', view.day)
  const query = params.toString()
  return '/calendar' + (query ? '?' + query : '')
}

export function monthCells(month: string) {
  const [year, m] = month.split('-').map(Number)
  const blanks = new Date(Date.UTC(year, m - 1, 1)).getUTCDay()
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate()
  return [...Array<null>(blanks).fill(null), ...Array.from({ length: days }, (_, i) => calendarDate(year, m, i + 1))]
}
