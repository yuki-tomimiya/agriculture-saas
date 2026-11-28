import { calendarDate, offsetDay } from './dates'
import type { OutlookRow } from './outlook'

// カレンダーの1か月のマスと、選んだ日の欄（台帳 I28）。画面から使うので、データベースや外部の取得には触れない。

/** 自分の記録の3種類（今日より前の日は、これだけを点にする） */
export type RecordKind = 'work' | 'spray' | 'field'
export type CalendarKind = 'weather' | 'harvest' | 'mine' | 'lastYear' | 'season' | RecordKind
type DotKind = Exclude<CalendarKind, 'season'>
export const DOT_KINDS: readonly { kind: DotKind; label: string }[] = [
  { kind: 'weather', label: '霜・天気' },
  { kind: 'harvest', label: '収穫・聞き始め' },
  { kind: 'mine', label: 'あなたの記録から' },
  { kind: 'lastYear', label: '昨年' },
  { kind: 'work', label: '作業・施肥' },
  { kind: 'spray', label: '農薬・収穫' },
  { kind: 'field', label: '畑で見たこと' },
]
export const isRecordKind = (kind: CalendarKind): kind is RecordKind => kind === 'work' || kind === 'spray' || kind === 'field'
/** 開いたときの欄は今日からこの日数 */
export const PANEL_DAYS = 7

const weekdays = ['日', '月', '火', '水', '木', '金', '土']
export function monthDayLabel(day: string) {
  return Number(day.slice(5, 7)) + '月' + Number(day.slice(8, 10)) + '日'
}
const slashDay = (day: string) => Number(day.slice(5, 7)) + '/' + Number(day.slice(8, 10))
/** 今年でない日・月には年を添える */
const yearPrefix = (key: string, today?: string) => today && key.slice(0, 4) !== today.slice(0, 4) ? Number(key.slice(0, 4)) + '年' : ''
export function dayHeading(day: string, today?: string) {
  const [year, month, date] = day.split('-').map(Number)
  return yearPrefix(day, today) + monthDayLabel(day) + '（' + weekdays[new Date(Date.UTC(year, month - 1, date)).getUTCDay()] + '）'
}
export function monthSummaryHeading(month: string, today?: string) {
  return yearPrefix(month, today) + Number(month.slice(5, 7)) + '月のまとめ'
}

/** 点を打つ日。幅のあるもの（収穫の見込み・気になることのその後）は始まりと終わりの日だけ。昨年は前後2日の重ね（台帳 I7）のまま毎日。
 * today を渡すと、今日より前の日は記録の点だけにする */
export function dotDays(row: OutlookRow, today?: string): string[] {
  if (row.kind === 'season') return []
  let days = [row.start]
  if (row.start !== row.end && row.kind !== 'lastYear') days = [row.start, row.end]
  else if (row.start !== row.end) for (let day = offsetDay(row.start, 1); day <= row.end; day = offsetDay(day, 1)) days.push(day)
  return today && !isRecordKind(row.kind) ? days.filter(day => day >= today) : days
}

export type DayDots = Partial<Record<DotKind, number>>
export function dotsByDay(rows: OutlookRow[], today?: string) {
  const dots = new Map<string, DayDots>()
  for (const row of rows) {
    if (row.kind === 'season') continue
    for (const day of dotDays(row, today)) {
      const counts = dots.get(day) ?? {}
      counts[row.kind] = (counts[row.kind] ?? 0) + 1
      dots.set(day, counts)
    }
  }
  return dots
}

/** その月のマスに出ている種類（凡例はこれだけ） */
export function kindsInMonth(dots: Map<string, DayDots>, month: string) {
  const present = new Set<DotKind>()
  for (const [day, counts] of dots) if (day.slice(0, 7) === month) for (const kind of Object.keys(counts) as DotKind[]) present.add(kind)
  return DOT_KINDS.filter(({ kind }) => present.has(kind))
}

/** マスの読み上げの名前。例「12月2日、あなたの記録から1件、霜・天気1件」 */
export function cellLabel(day: string, dots: DayDots = {}, today?: string) {
  const parts = DOT_KINDS.filter(({ kind }) => dots[kind]).map(({ kind, label }) => label + dots[kind] + '件')
  return [monthDayLabel(day) + (day === today ? '（今日）' : ''), ...parts].join('、')
}

/** 選んだ日の行。幅の中に入っている日も出す。today を渡すと、今日より前の日は記録だけ */
export function rowsOnDay(rows: OutlookRow[], day: string, today?: string) {
  return rows.filter(row => row.kind !== 'season' && row.start <= day && day <= row.end
    && (!today || day >= today || isRecordKind(row.kind)))
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

export type MonthSummaryGroup = { key: string; title: string; href: string | null; line: string }
/** 今日より前の月のまとめ：作付けごと（作付けに結びつかない記録は農場ごと）に、その月の記録を短く日付順に。
 * 同じ名前の記録が2回以上あれば「収穫 10/20から5回」のようにまとめる */
export function monthSummary(rows: OutlookRow[], month: string, withFarmName: boolean): MonthSummaryGroup[] {
  const records = rows.filter(row => isRecordKind(row.kind) && row.start.slice(0, 7) === month)
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
  const groups = new Map<string, { title: string; href: string | null; terms: Map<string, { first: string; count: number }> }>()
  for (const row of records) {
    const key = row.cropId ? 'crop-' + row.cropId : row.farmId ? 'farm-' + row.farmId : 'none'
    if (!groups.has(key)) groups.set(key, {
      title: row.cropId
        ? (row.cropName ?? '作付け') + (withFarmName && row.farmName ? '・' + row.farmName : '')
        : row.farmName ?? '作付けと農場の無い記録',
      href: row.cropId ? '/crops/' + row.cropId : row.farmId ? '/farms/' + row.farmId : null,
      terms: new Map(),
    })
    const terms = groups.get(key)!.terms
    const term = row.term ?? row.title
    const seen = terms.get(term)
    if (seen) seen.count++
    else terms.set(term, { first: row.start, count: 1 })
  }
  return [...groups].map(([key, group]) => ({
    key, title: group.title, href: group.href,
    line: [...group.terms].map(([term, { first, count }]) => term + ' ' + slashDay(first) + (count > 1 ? 'から' + count + '回' : '')).join('・'),
  }))
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

/** URL の引数（month=2026-12・day=2026-12-02）を読む。送れる範囲は firstMonth（記録のある最も古い月。無ければ今月）〜見通しの範囲の終わりの月。
 * 最も古い月より前は最も古い月に、範囲の先は今月にする */
export function readCalendarView(params: { month?: string; day?: string }, today: string, lastMonth: string, firstMonth = today.slice(0, 7)): CalendarView {
  const thisMonth = today.slice(0, 7)
  const inRange = (month: string) => month >= firstMonth && month <= lastMonth
  const [dayYear, dayMonth, dayDate] = (params.day ?? '').split('-').map(Number)
  const day = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) && calendarDate(dayYear, dayMonth, dayDate) === params.day
    && inRange(params.day.slice(0, 7)) ? params.day : null
  const asked = params.month && /^\d{4}-\d{2}$/.test(params.month) && Number(params.month.slice(5, 7)) >= 1 && Number(params.month.slice(5, 7)) <= 12
    ? params.month : null
  const month = asked && inRange(asked) ? asked : asked && asked < firstMonth ? firstMonth : day?.slice(0, 7) ?? thisMonth
  return { month, day }
}

/** 月を送る。範囲の外なら null */
export function shiftView(view: CalendarView, delta: number, today: string, lastMonth: string, firstMonth = today.slice(0, 7)): CalendarView | null {
  const [year, month] = view.month.split('-').map(Number)
  const next = calendarDate(year, month + delta, 1).slice(0, 7)
  return next < firstMonth || next > lastMonth ? null : { ...view, month: next }
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

/** 前の「過去の実績」（/calendar/history?year=2026&month=8）のリンクを、カレンダーのその月へ */
export function historyRedirectHref(params: { year?: string; month?: string }) {
  const year = Number(params.year)
  const month = Number(params.month)
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) return '/calendar'
  return '/calendar?month=' + year + '-' + String(month).padStart(2, '0')
}

export function monthCells(month: string) {
  const [year, m] = month.split('-').map(Number)
  const blanks = new Date(Date.UTC(year, m - 1, 1)).getUTCDay()
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate()
  return [...Array<null>(blanks).fill(null), ...Array.from({ length: days }, (_, i) => calendarDate(year, m, i + 1))]
}

export function lastDayOfMonth(month: string) {
  const [year, m] = month.split('-').map(Number)
  return calendarDate(year, m + 1, 0)
}
