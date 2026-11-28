import Link from 'next/link'
import { loadTodayConfirmations } from '@/lib/proposals/presentation'
import { japanDateKey } from '@/lib/pesticide-safety'
import { calendarDate, offsetDay, lastYearOverlay, shiftMonth } from '@/lib/calendar/dates'
import { calendarRecords, loadOutlookMaterial } from '@/lib/calendar/read'
import CalendarGridDisclosure from './CalendarGridDisclosure'
import { outlookRows, type OutlookRow } from '@/lib/calendar/outlook'
import CalendarOutlook from './CalendarOutlook'
import { LAST_YEAR_SAME_DAY_WINDOW_DAYS } from '@/lib/proposals/constants'

type DayEvents = {
  marks: OutlookRow[]
  proposalCount: number
  proposalTitles: string[]
  recordCount: number
  recordLabels: string[]
  lastYearCount: number
  lastYearLabels: string[]
}

type CalendarDay = null | { day: number; dateKey: string; isToday: boolean; events: DayEvents }

export type WorkCalendarVariant = 'upcoming' | 'history'

const emptyDayEvents = (): DayEvents => ({
  marks: [],
  proposalCount: 0,
  proposalTitles: [],
  recordCount: 0,
  recordLabels: [],
  lastYearCount: 0,
  lastYearLabels: [],
})

function getMonthCalendarDays(
  year: number,
  month: number,
  eventsByDate: Map<string, DayEvents>,
  todayKey: string,
): CalendarDay[] {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const last = new Date(Date.UTC(year, month, 0))
  const firstWeekday = first.getUTCDay()
  const daysInMonth = last.getUTCDate()

  const leadingBlanks = Array(firstWeekday).fill(null)
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1
    const dateKey = calendarDate(year, month, d)
    return {
      day: d,
      dateKey,
      isToday: dateKey === todayKey,
      events: eventsByDate.get(dateKey) ?? emptyDayEvents(),
    }
  })
  return [...leadingBlanks, ...days]
}

function CalendarDayCell({
  item,
  showProposals,
  showLastYear,
}: {
  item: Exclude<CalendarDay, null>
  showProposals: boolean
  showLastYear: boolean
}) {
  const {
    proposalCount,
    proposalTitles,
    recordCount,
    recordLabels,
    lastYearCount,
    lastYearLabels,
  } = item.events
  const hasProposals = showProposals && proposalCount > 0
  const hasRecords = recordCount > 0
  const hasLastYear = showLastYear && lastYearCount > 0
  const marks = item.events.marks
  const hasHighlight = hasProposals || hasRecords || hasLastYear || marks.length > 0

  const isToday = item.isToday
  const visibleRecords = recordLabels.slice(0, 2)
  const extraRecords = recordLabels.length - visibleRecords.length

  return (
    <div
      className={`dashboard-calendar-cell${hasHighlight ? ' dashboard-calendar-cell--highlight' : ''}${isToday ? ' dashboard-calendar-cell--today' : ''}`}
    >
      <span className="dashboard-calendar-day">
        {marks.length ? <a className="calendar-day-link" href={'#outlook-' + marks[0].id} aria-label={item.dateKey + 'の見通し'}>{item.day}</a> : item.day}
        {isToday ? <span className="dashboard-calendar-today-mark">今日</span> : null}
      </span>
      {marks.filter((row, index) => row.mark !== '昨年' && marks.findIndex(r => r.mark === row.mark) === index).map(row =>
        <a key={row.id} href={'#outlook-' + row.id} className={row.mark === '収穫の見込み' ? 'calendar-harvest-band' : 'calendar-short-mark'} title={row.text}>{row.mark}</a>)}
      {hasProposals && (
        <Link
          href="/dashboard/ai-proposal"
          className="dashboard-calendar-badge dashboard-calendar-badge--proposal dashboard-calendar-badge--compact"
          title={proposalTitles.join('\n')}
        >
          今日の提案 {proposalCount}件
        </Link>
      )}
      {hasRecords && (
        <Link
          href="/work-records"
          className="dashboard-calendar-badge dashboard-calendar-badge--record dashboard-calendar-badge--compact"
          title={recordLabels.join('\n')}
        >
          実績{recordCount > 1 ? ` ${recordCount}件` : ''}
        </Link>
      )}
      {visibleRecords.map((label, index) => (
        <span key={`${label}-${index}`} className="dashboard-calendar-label" title={label}>
          {label}
        </span>
      ))}
      {extraRecords > 0 && (
        <span className="dashboard-calendar-label">ほか{extraRecords}件</span>
      )}
      {hasLastYear && (
        <span
          className="dashboard-calendar-badge dashboard-calendar-badge--lastyear dashboard-calendar-badge--compact"
          title={`昨年の前後${LAST_YEAR_SAME_DAY_WINDOW_DAYS}日:\n${lastYearLabels.join('\n')}`}
        >
          昨年{lastYearCount > 1 ? ` ${lastYearCount}件` : ''}
        </span>
      )}
    </div>
  )
}

function MonthBlock({
  monthly = [],
  year,
  month,
  calendarDays,
  title,
  showProposals,
  showLastYear,
}: {
  year: number
  month: number
  monthly?: OutlookRow[]
  calendarDays: CalendarDay[]
  title?: string
  showProposals: boolean
  showLastYear: boolean
}) {
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  return (
    <div className="dashboard-calendar-frame">
      <div className="dashboard-calendar-header">
        <div className="dashboard-calendar-title">
          {title ?? `${year}年 ${monthNames[month - 1]}`}
        </div>
        <div className="dashboard-calendar-legend">
          {showProposals && (
            <>
              <span className="dashboard-calendar-dot dashboard-calendar-dot--proposal"></span>提案
            </>
          )}
          <span className="dashboard-calendar-dot dashboard-calendar-dot--record"></span>実績
          {showLastYear && (
            <>
              <span className="dashboard-calendar-dot dashboard-calendar-dot--lastyear"></span>昨年
            </>
          )}
        </div>
      </div>
      {monthly.map(row => <a className="calendar-season-link" key={row.id} href={'#outlook-' + row.id}>{row.text}</a>)}
      <div className="dashboard-calendar-weekdays">
        <div className="dashboard-calendar-weekday dashboard-calendar-weekday--sun">日</div>
        <div className="dashboard-calendar-weekday">月</div>
        <div className="dashboard-calendar-weekday">火</div>
        <div className="dashboard-calendar-weekday">水</div>
        <div className="dashboard-calendar-weekday">木</div>
        <div className="dashboard-calendar-weekday">金</div>
        <div className="dashboard-calendar-weekday dashboard-calendar-weekday--sat">土</div>
      </div>
      <div className="dashboard-calendar-grid">
        {calendarDays.map((item, idx) => {
          if (item === null) {
            return <div key={idx} className="dashboard-calendar-cell dashboard-calendar-cell--empty"></div>
          }
          return (
            <CalendarDayCell
              key={idx}
              item={item}
              showProposals={showProposals}
              showLastYear={showLastYear}
            />
          )
        })}
      </div>
    </div>
  )
}

export default async function WorkCalendar({
  months = 1,
  userId,
  startYear,
  startMonth,
  variant = 'upcoming',
  farmId,
}: {
  farmId?: string
  months?: number
  userId: string
  /** 表示開始の年（未指定なら今日の月を起点） */
  startYear?: number
  /** 表示開始の月 1–12 */
  startMonth?: number
  /** upcoming: 今月起点の予定寄り / history: 過去実績の閲覧 */
  variant?: WorkCalendarVariant
}) {
  const today = new Date()
  const todayKey = japanDateKey(today)
  const [todayYear, todayMonth] = todayKey.split('-').map(Number)
  const monthCount = months >= 6 ? 6 : months >= 3 ? 3 : 1
  const showProposals = variant !== 'history'
  const showLastYear = variant === 'upcoming'

  const anchorYear = startYear ?? todayYear
  const anchorMonth = startMonth ?? todayMonth
  // upcoming の3か月は「今月・来月・再来月」。history は指定月から3か月
  const startOffset = 0

  const firstMonth = shiftMonth(anchorYear, anchorMonth, startOffset)
  const lastMonth = shiftMonth(firstMonth.year, firstMonth.month, monthCount - 1)
  const rangeStart = calendarDate(firstMonth.year, firstMonth.month, 1)
  const rangeEnd = calendarDate(lastMonth.year, lastMonth.month + 1, 0)
  const previousStart = offsetDay(calendarDate(firstMonth.year - 1, firstMonth.month, 1), -LAST_YEAR_SAME_DAY_WINDOW_DAYS)
  const previousEnd = offsetDay(calendarDate(lastMonth.year - 1, lastMonth.month + 1, 0), LAST_YEAR_SAME_DAY_WINDOW_DAYS)
  const [records, previous, confirmations, material] = await Promise.all([
    calendarRecords(userId, rangeStart, rangeEnd),
    showLastYear ? calendarRecords(userId, previousStart, previousEnd) : [],
    showProposals ? loadTodayConfirmations(userId, { now: today }) : null,
    showProposals ? loadOutlookMaterial(userId, today) : null,
  ])
  const activeFarm = material?.farms.find(f => f.id === farmId)?.id
  const farmMatches = (record: { farmId: string | null }) => !activeFarm || record.farmId === activeFarm
  const crops = material?.crops.filter(farmMatches) ?? []
  const rows = material ? outlookRows(todayKey, rangeEnd, material.farms.filter(f => !activeFarm || f.id === activeFarm), crops, previous.filter(farmMatches)) : []

  const eventsByDate = new Map<string, DayEvents>()

  const getDay = (key: string) => {
    const existing = eventsByDate.get(key)
    if (existing) return existing
    const fresh = emptyDayEvents()
    eventsByDate.set(key, fresh)
    return fresh
  }

  for (const record of records.filter(farmMatches)) {
    const day = getDay(record.date)
    if (!day.recordLabels.includes(record.label)) {
      day.recordLabels.push(record.label)
      day.recordCount++
    }
  }
  for (const record of previous.filter(farmMatches)) {
    for (const key of lastYearOverlay(record.date)) {
      const day = getDay(key)
      if (!day.lastYearLabels.includes(record.label)) {
        day.lastYearLabels.push(record.label)
        day.lastYearCount++
      }
    }
  }
  if (confirmations) {
    const day = getDay(todayKey)
    const ids = new Set(crops.map(c => c.id))
    const deadlineCount = activeFarm
      ? confirmations.taskGroups.filter(group => group.some(t => t.relatedFarmId === activeFarm)).length
        + confirmations.deadlineGroups.filter(group => group.some(r => ids.has(r.crop.cropId))).length
      : confirmations.deadlineCount
    const confirmationCount = activeFarm
      ? confirmations.confirmationGroups.filter(group => group.some(r => ids.has(r.crop.cropId))).length
      : confirmations.confirmationGroups.length
    day.proposalCount = deadlineCount + confirmationCount
    day.proposalTitles = ['締切 ' + deadlineCount + '件・作付けごとの確認 ' + confirmationCount + '件']
  }
  for (const row of rows) {
    if (row.mark === '県の月') continue
    for (let day = row.start > todayKey ? row.start : todayKey; day <= row.end && day <= rangeEnd; day = offsetDay(day, 1)) {
      getDay(day).marks.push(row)
    }
  }

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

  if (months >= 3) {
    const count = months >= 6 ? 6 : 3
    const monthConfigs: { year: number; month: number }[] = []
    for (let i = 0; i < count; i++) {
      monthConfigs.push(shiftMonth(firstMonth.year, firstMonth.month, i))
    }

    const gridClass = count === 6 ? 'work-calendar-six-months' : 'work-calendar-three-months'
    const grid = (
        <div className={gridClass}>
          {monthConfigs.map(({ year, month }) => (
            <MonthBlock
              key={`${year}-${month}`}
              year={year}
              month={month}
              monthly={rows.filter(row => row.mark === '県の月' && row.start === calendarDate(year, month, 1))}
              calendarDays={getMonthCalendarDays(year, month, eventsByDate, todayKey)}
              title={`${year}年 ${monthNames[month - 1]}`}
              showProposals={showProposals}
              showLastYear={showLastYear}
            />
          ))}
        </div>
    )
    return (
      <section className="dashboard-card">
        {variant === 'history' ? grid : <>
          {material && material.farms.length > 1 && <form action="/calendar" method="get" className="calendar-farm-filter">
            <label>農場 <select name="farm" defaultValue={activeFarm ?? ''}>
              <option value="">すべての農場</option>
              {material.farms.map(f => <option value={f.id} key={f.id}>{f.name}</option>)}
            </select></label>
            <button type="submit" className="btn btn-outline">絞り込む</button>
          </form>}
          <div className="calendar-outlook-layout">
            <CalendarOutlook rows={rows} hasCrops={crops.length > 0} />
            <CalendarGridDisclosure>{grid}<p className="dashboard-calendar-note">昨年の印は、前年の同じ日の前後2日の作業・施肥です。</p></CalendarGridDisclosure>
          </div>
        </>}
      </section>
    )
  }

  const calendarDays = getMonthCalendarDays(todayYear, todayMonth, eventsByDate, todayKey)
  const proposalDays = calendarDays.filter((item) => item !== null && item.events.proposalCount > 0).length
  const recordDays = calendarDays.filter((item) => item !== null && item.events.recordCount > 0).length
  const lastYearDays = calendarDays.filter((item) => item !== null && item.events.lastYearCount > 0).length

  return (
    <section className="dashboard-card">
      <h2 className="dashboard-section-title">作業カレンダー（{todayMonth}月）</h2>
      <p className="dashboard-section-sub">
        提案と実績（作業・施肥）、昨年の前後2日の記録を確認できます。日付を押しても記録画面には移りません。
      </p>
      <div className="dashboard-calendar-frame">
        <div className="dashboard-calendar-header">
          <div className="dashboard-calendar-title">
            {todayYear}年 {monthNames[todayMonth - 1]}
          </div>
          <div className="dashboard-calendar-legend">
            <span className="dashboard-calendar-dot dashboard-calendar-dot--proposal"></span>提案
            <span className="dashboard-calendar-dot dashboard-calendar-dot--record"></span>実績
            <span className="dashboard-calendar-dot dashboard-calendar-dot--lastyear"></span>昨年
          </div>
        </div>
        <div className="dashboard-calendar-weekdays">
          <div className="dashboard-calendar-weekday dashboard-calendar-weekday--sun">日</div>
          <div className="dashboard-calendar-weekday">月</div>
          <div className="dashboard-calendar-weekday">火</div>
          <div className="dashboard-calendar-weekday">水</div>
          <div className="dashboard-calendar-weekday">木</div>
          <div className="dashboard-calendar-weekday">金</div>
          <div className="dashboard-calendar-weekday dashboard-calendar-weekday--sat">土</div>
        </div>
        <div className="dashboard-calendar-grid">
          {calendarDays.map((item, idx) => {
            if (item === null) {
              return <div key={idx} className="dashboard-calendar-cell dashboard-calendar-cell--empty"></div>
            }
            return (
              <CalendarDayCell key={idx} item={item} showProposals showLastYear />
            )
          })}
        </div>
      </div>
      <div className="dashboard-calendar-review">
        <p className="dashboard-calendar-review-title">今月の状況サマリー</p>
        <ul className="dashboard-calendar-review-list">
          <li>
            提案がある日は <span className="font-semibold">{proposalDays}日</span>、実績がある日は{' '}
            <span className="font-semibold">{recordDays}日</span>
            {lastYearDays > 0 && (
              <>
                、昨年の前後2日に記録がある日は <span className="font-semibold">{lastYearDays}日</span>
              </>
            )}{' '}
            です。
          </li>
          <li>
            作付け単位の比較は{' '}
            <Link href="/insights" className="text-green-600 hover:underline">
              分析・振り返り
            </Link>
            、詳細な過去履歴は{' '}
            <Link href="/calendar/history" className="text-green-600 hover:underline">
              過去の実績
            </Link>
            から確認できます。
          </li>
        </ul>
      </div>
    </section>
  )
}
