import Link from 'next/link'
import { loadTodayConfirmations } from '@/lib/proposals/presentation'
import { japanDateKey } from '@/lib/pesticide-safety'
import { calendarDate, offsetDay, shiftMonth } from '@/lib/calendar/dates'
import { calendarRecords, loadOutlookMaterial } from '@/lib/calendar/read'
import { outlookRows, recordRows } from '@/lib/calendar/outlook'
import { readCalendarView } from '@/lib/calendar/day-panel'
import { LAST_YEAR_SAME_DAY_WINDOW_DAYS } from '@/lib/proposals/constants'
import CalendarMonthView from './CalendarMonthView'
import { WeatherDataNotes } from './WeatherDataSource'

type DayEvents = { recordCount: number; recordLabels: string[] }
type CalendarDay = null | { day: number; dateKey: string; events: DayEvents }

export type WorkCalendarVariant = 'upcoming' | 'history'

function getMonthCalendarDays(year: number, month: number, eventsByDate: Map<string, DayEvents>): CalendarDay[] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const dateKey = calendarDate(year, month, i + 1)
    return { day: i + 1, dateKey, events: eventsByDate.get(dateKey) ?? { recordCount: 0, recordLabels: [] } }
  })
  return [...Array<null>(firstWeekday).fill(null), ...days]
}

/** 過去の実績のマス（作業・施肥） */
function HistoryDayCell({ item }: { item: Exclude<CalendarDay, null> }) {
  const { recordCount, recordLabels } = item.events
  const visibleRecords = recordLabels.slice(0, 2)
  const extraRecords = recordLabels.length - visibleRecords.length
  return (
    <div className={`dashboard-calendar-cell${recordCount > 0 ? ' dashboard-calendar-cell--highlight' : ''}`}>
      <span className="dashboard-calendar-day">{item.day}</span>
      {recordCount > 0 && (
        <Link href="/work-records" className="dashboard-calendar-badge dashboard-calendar-badge--record dashboard-calendar-badge--compact" title={recordLabels.join('\n')}>
          実績{recordCount > 1 ? ` ${recordCount}件` : ''}
        </Link>
      )}
      {visibleRecords.map((label, index) => (
        <span key={`${label}-${index}`} className="dashboard-calendar-label" title={label}>{label}</span>
      ))}
      {extraRecords > 0 && <span className="dashboard-calendar-label">ほか{extraRecords}件</span>}
    </div>
  )
}

function HistoryMonth({ year, month, calendarDays }: { year: number; month: number; calendarDays: CalendarDay[] }) {
  return (
    <div className="dashboard-calendar-frame">
      <div className="dashboard-calendar-header">
        <div className="dashboard-calendar-title">{year}年 {month}月</div>
        <div className="dashboard-calendar-legend">
          <span className="dashboard-calendar-dot dashboard-calendar-dot--record"></span>実績
        </div>
      </div>
      <div className="dashboard-calendar-weekdays">
        {['日', '月', '火', '水', '木', '金', '土'].map((name, i) => (
          <div key={name} className={`dashboard-calendar-weekday${i === 0 ? ' dashboard-calendar-weekday--sun' : i === 6 ? ' dashboard-calendar-weekday--sat' : ''}`}>{name}</div>
        ))}
      </div>
      <div className="dashboard-calendar-grid">
        {calendarDays.map((item, idx) => item === null
          ? <div key={idx} className="dashboard-calendar-cell dashboard-calendar-cell--empty"></div>
          : <HistoryDayCell key={idx} item={item} />)}
      </div>
    </div>
  )
}

export default async function WorkCalendar({
  months = 3,
  userId,
  startYear,
  startMonth,
  variant = 'upcoming',
  farmId,
  month,
  day,
}: {
  farmId?: string
  /** upcoming で見る月 'YYYY-MM' と選んだ日 'YYYY-MM-DD'（URL の引数） */
  month?: string
  day?: string
  months?: number
  userId: string
  /** 表示開始の年（未指定なら今日の月を起点） */
  startYear?: number
  /** 表示開始の月 1–12 */
  startMonth?: number
  /** upcoming: 今月からの見通しと選んだ日の欄 / history: 過去実績の閲覧 */
  variant?: WorkCalendarVariant
}) {
  const today = new Date()
  const todayKey = japanDateKey(today)
  const [todayYear, todayMonth] = todayKey.split('-').map(Number)
  const monthCount = months >= 6 ? 6 : months >= 3 ? 3 : 1

  const firstMonth = { year: startYear ?? todayYear, month: startMonth ?? todayMonth }
  const lastMonth = shiftMonth(firstMonth.year, firstMonth.month, monthCount - 1)
  const rangeStart = calendarDate(firstMonth.year, firstMonth.month, 1)
  const rangeEnd = calendarDate(lastMonth.year, lastMonth.month + 1, 0)

  if (variant === 'history') {
    const records = await calendarRecords(userId, rangeStart, rangeEnd)
    const eventsByDate = new Map<string, DayEvents>()
    for (const record of records) {
      const events = eventsByDate.get(record.date) ?? { recordCount: 0, recordLabels: [] }
      if (!events.recordLabels.includes(record.label)) {
        events.recordLabels.push(record.label)
        events.recordCount++
      }
      eventsByDate.set(record.date, events)
    }
    const configs = Array.from({ length: monthCount }, (_, i) => shiftMonth(firstMonth.year, firstMonth.month, i))
    return (
      <section className="dashboard-card">
        <div className={monthCount === 6 ? 'work-calendar-six-months' : 'work-calendar-three-months'}>
          {configs.map(({ year, month }) => (
            <HistoryMonth key={`${year}-${month}`} year={year} month={month} calendarDays={getMonthCalendarDays(year, month, eventsByDate)} />
          ))}
        </div>
      </section>
    )
  }

  const previousStart = offsetDay(calendarDate(firstMonth.year - 1, firstMonth.month, 1), -LAST_YEAR_SAME_DAY_WINDOW_DAYS)
  const previousEnd = offsetDay(calendarDate(lastMonth.year - 1, lastMonth.month + 1, 0), LAST_YEAR_SAME_DAY_WINDOW_DAYS)
  const [records, previous, confirmations, material] = await Promise.all([
    calendarRecords(userId, rangeStart, rangeEnd),
    calendarRecords(userId, previousStart, previousEnd),
    loadTodayConfirmations(userId, { now: today }),
    loadOutlookMaterial(userId, today),
  ])
  const activeFarm = material.farms.find(f => f.id === farmId)?.id
  const farmMatches = (record: { farmId: string | null }) => !activeFarm || record.farmId === activeFarm
  const crops = material.crops.filter(farmMatches)
  const rows = [
    ...outlookRows(todayKey, rangeEnd, material.farms.filter(f => !activeFarm || f.id === activeFarm), crops, previous.filter(farmMatches)),
    ...recordRows(records.filter(farmMatches)),
  ]

  const ids = new Set(crops.map(c => c.id))
  const deadlineCount = activeFarm
    ? confirmations.taskGroups.filter(group => group.some(t => t.relatedFarmId === activeFarm)).length
      + confirmations.deadlineGroups.filter(group => group.some(r => ids.has(r.crop.cropId))).length
    : confirmations.deadlineCount
  const confirmationCount = activeFarm
    ? confirmations.confirmationGroups.filter(group => group.some(r => ids.has(r.crop.cropId))).length
    : confirmations.confirmationGroups.length

  const lastMonthKey = rangeEnd.slice(0, 7)
  return (
    <section className="dashboard-card">
      <CalendarMonthView
        rows={rows}
        today={todayKey}
        lastMonth={lastMonthKey}
        initialView={readCalendarView({ month, day }, todayKey, lastMonthKey)}
        farms={material.farms.map(f => ({ id: f.id, name: f.name }))}
        farmId={activeFarm ?? null}
        proposalCount={deadlineCount + confirmationCount}
        hasCrops={crops.length > 0}
      />
      {rows.some(row => row.source && row.source !== 'station') && <WeatherDataNotes archive forecast />}
    </section>
  )
}
