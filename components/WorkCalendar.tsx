import { loadTodayConfirmations } from '@/lib/proposals/presentation'
import { japanDateKey } from '@/lib/pesticide-safety'
import { calendarDate, offsetDay, shiftMonth } from '@/lib/calendar/dates'
import { calendarEntries, calendarRecords, loadOutlookMaterial, oldestRecordDay } from '@/lib/calendar/read'
import { outlookRows, recordRows } from '@/lib/calendar/outlook'
import { lastDayOfMonth, readCalendarView } from '@/lib/calendar/day-panel'
import { LAST_YEAR_SAME_DAY_WINDOW_DAYS } from '@/lib/proposals/constants'
import CalendarMonthView from './CalendarMonthView'
import { WeatherDataNotes } from './WeatherDataSource'

/** 見通しを並べる月数（台帳 I28） */
const OUTLOOK_MONTHS = 3

/** カレンダー：今月から見通しの範囲の終わりの月までは見通しと記録、今月より前は記録のある最も古い月まで記録だけ（台帳 I28） */
export default async function WorkCalendar({
  userId,
  farmId,
  month,
  day,
}: {
  userId: string
  farmId?: string
  /** 見る月 'YYYY-MM' と選んだ日 'YYYY-MM-DD'（URL の引数） */
  month?: string
  day?: string
}) {
  const today = new Date()
  const todayKey = japanDateKey(today)
  const [todayYear, todayMonth] = todayKey.split('-').map(Number)
  const thisMonth = todayKey.slice(0, 7)
  const lastMonth = shiftMonth(todayYear, todayMonth, OUTLOOK_MONTHS - 1)
  const rangeStart = calendarDate(todayYear, todayMonth, 1)
  const rangeEnd = calendarDate(lastMonth.year, lastMonth.month + 1, 0)
  const lastMonthKey = rangeEnd.slice(0, 7)

  const previousStart = offsetDay(calendarDate(todayYear - 1, todayMonth, 1), -LAST_YEAR_SAME_DAY_WINDOW_DAYS)
  const previousEnd = offsetDay(calendarDate(lastMonth.year - 1, lastMonth.month + 1, 0), LAST_YEAR_SAME_DAY_WINDOW_DAYS)
  const [previous, confirmations, material] = await Promise.all([
    calendarRecords(userId, previousStart, previousEnd),
    loadTodayConfirmations(userId, { now: today }),
    loadOutlookMaterial(userId, today),
  ])
  const activeFarm = material.farms.find(f => f.id === farmId)?.id
  const farmMatches = (record: { farmId: string | null }) => !activeFarm || record.farmId === activeFarm

  // 今月より前は、記録のある最も古い月まで送れる。見る月と選んだ日の月の記録だけを取る（ほかの月へは URL で読み直す）
  const oldest = await oldestRecordDay(userId, activeFarm)
  const firstMonth = oldest && oldest.slice(0, 7) < thisMonth ? oldest.slice(0, 7) : thisMonth
  const initialView = readCalendarView({ month, day }, todayKey, lastMonthKey, firstMonth)
  const pastMonths = [...new Set([initialView.month, initialView.day?.slice(0, 7)])]
    .filter((m): m is string => m != null && m < thisMonth).sort()
  const entries = (await Promise.all([
    calendarEntries(userId, rangeStart, rangeEnd),
    ...pastMonths.map(m => calendarEntries(userId, m + '-01', lastDayOfMonth(m))),
  ])).flat()

  const crops = material.crops.filter(farmMatches)
  const rows = [
    ...outlookRows(todayKey, rangeEnd, material.farms.filter(f => !activeFarm || f.id === activeFarm), crops, previous.filter(farmMatches)),
    ...recordRows(entries.filter(farmMatches)),
  ]

  const ids = new Set(crops.map(c => c.id))
  const deadlineCount = activeFarm
    ? confirmations.taskGroups.filter(group => group.some(t => t.relatedFarmId === activeFarm)).length
      + confirmations.deadlineGroups.filter(group => group.some(r => ids.has(r.crop.cropId))).length
    : confirmations.deadlineCount
  const confirmationCount = activeFarm
    ? confirmations.confirmationGroups.filter(group => group.some(r => ids.has(r.crop.cropId))).length
    : confirmations.confirmationGroups.length

  return (
    <section className="dashboard-card">
      <CalendarMonthView
        // URL で別の月を読み直したら、選んだ月と日も URL から始め直す
        key={pastMonths.join(',') + '|' + (activeFarm ?? '')}
        rows={rows}
        today={todayKey}
        firstMonth={firstMonth}
        lastMonth={lastMonthKey}
        loadedPastMonths={pastMonths}
        initialView={initialView}
        farms={material.farms.map(f => ({ id: f.id, name: f.name }))}
        farmId={activeFarm ?? null}
        proposalCount={deadlineCount + confirmationCount}
        hasCrops={crops.length > 0}
      />
      {rows.some(row => row.source && row.source !== 'station') && <WeatherDataNotes archive forecast />}
    </section>
  )
}
