import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getTodayProposals } from '@/lib/ai-proposal'

type DayEvents = {
  proposalCount: number
  proposalTitles: string[]
  recordCount: number
  recordLabels: string[]
  lastYearCount: number
  lastYearLabels: string[]
}

type CalendarDay = null | { day: number; dateKey: string; events: DayEvents }

export type WorkCalendarVariant = 'upcoming' | 'history'

const emptyDayEvents = (): DayEvents => ({
  proposalCount: 0,
  proposalTitles: [],
  recordCount: 0,
  recordLabels: [],
  lastYearCount: 0,
  lastYearLabels: [],
})

function toYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function getMonthCalendarDays(
  year: number,
  month: number,
  eventsByDate: Map<string, DayEvents>
): CalendarDay[] {
  const first = new Date(year, month - 1, 1)
  const last = new Date(year, month, 0)
  const firstWeekday = first.getDay()
  const daysInMonth = last.getDate()

  const leadingBlanks = Array(firstWeekday).fill(null)
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1
    const dateKey = toYmd(new Date(year, month - 1, d))
    return {
      day: d,
      dateKey,
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
  const hasHighlight = hasProposals || hasRecords || hasLastYear

  const todayKey = toYmd(new Date())
  const isToday = item.dateKey === todayKey
  const visibleRecords = recordLabels.slice(0, 2)
  const extraRecords = recordLabels.length - visibleRecords.length

  return (
    <div
      className={`dashboard-calendar-cell${hasHighlight ? ' dashboard-calendar-cell--highlight' : ''}${isToday ? ' dashboard-calendar-cell--today' : ''}`}
    >
      <span className="dashboard-calendar-day">
        {item.day}
        {isToday ? <span className="dashboard-calendar-today-mark">今日</span> : null}
      </span>
      {hasProposals && (
        <Link
          href="/dashboard/ai-proposal"
          className="dashboard-calendar-badge dashboard-calendar-badge--proposal dashboard-calendar-badge--compact"
          title={proposalTitles.join('\n')}
        >
          提案{proposalCount > 1 ? ` ${proposalCount}件` : ''}
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
          title={`昨年同日:\n${lastYearLabels.join('\n')}`}
        >
          昨年{lastYearCount > 1 ? ` ${lastYearCount}件` : ''}
        </span>
      )}
    </div>
  )
}

function MonthBlock({
  year,
  month,
  calendarDays,
  title,
  showProposals,
  showLastYear,
}: {
  year: number
  month: number
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
}: {
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
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth() + 1
  const monthCount = months >= 6 ? 6 : months >= 3 ? 3 : 1
  const showProposals = variant !== 'history'
  const showLastYear = variant === 'upcoming'

  const anchorYear = startYear ?? todayYear
  const anchorMonth = startMonth ?? todayMonth
  // upcoming の3か月は「今月・来月・再来月」。history は指定月から3か月
  const startOffset = 0

  const firstMonth = shiftMonth(anchorYear, anchorMonth, startOffset)
  const lastMonth = shiftMonth(firstMonth.year, firstMonth.month, monthCount - 1)
  const rangeStart = new Date(firstMonth.year, firstMonth.month - 1, 1)
  const rangeEnd = new Date(lastMonth.year, lastMonth.month, 0, 23, 59, 59, 999)

  // 前年同月レンジ（表示月の「日」に重ねる）
  const lastYearRangeStart = new Date(firstMonth.year - 1, firstMonth.month - 1, 1)
  const lastYearRangeEnd = new Date(lastMonth.year - 1, lastMonth.month, 0, 23, 59, 59, 999)

  const [workRecords, fertilizerRecords, proposals, lastYearWorks, lastYearFertilizers] =
    await Promise.all([
      prisma.workRecord.findMany({
        where: { farm: { userId }, date: { gte: rangeStart, lte: rangeEnd } },
        include: { crop: true },
        orderBy: { date: 'asc' },
      }),
      prisma.fertilizerRecord.findMany({
        where: { userId, appliedAt: { gte: rangeStart, lte: rangeEnd } },
        orderBy: { appliedAt: 'asc' },
      }),
      showProposals ? getTodayProposals(userId) : Promise.resolve([]),
      showLastYear
        ? prisma.workRecord.findMany({
            where: {
              farm: { userId },
              date: { gte: lastYearRangeStart, lte: lastYearRangeEnd },
            },
            include: { crop: true },
            orderBy: { date: 'asc' },
          })
        : Promise.resolve([]),
      showLastYear
        ? prisma.fertilizerRecord.findMany({
            where: {
              userId,
              appliedAt: { gte: lastYearRangeStart, lte: lastYearRangeEnd },
            },
            orderBy: { appliedAt: 'asc' },
          })
        : Promise.resolve([]),
    ])

  const eventsByDate = new Map<string, DayEvents>()

  const getDay = (key: string) => {
    const existing = eventsByDate.get(key)
    if (existing) return existing
    const fresh = emptyDayEvents()
    eventsByDate.set(key, fresh)
    return fresh
  }

  for (const rec of workRecords) {
    const key = toYmd(rec.date)
    const day = getDay(key)
    const crop = rec.crop?.name ? `（${rec.crop.name}）` : ''
    const label = `${rec.taskType}${crop}`
    if (!day.recordLabels.includes(label)) {
      day.recordLabels.push(label)
      day.recordCount += 1
    }
  }
  for (const rec of fertilizerRecords) {
    const key = toYmd(rec.appliedAt)
    const day = getDay(key)
    const label = `施肥：${rec.productName}`
    if (!day.recordLabels.includes(label)) {
      day.recordLabels.push(label)
      day.recordCount += 1
    }
  }
  if (showProposals) {
    for (const p of proposals) {
      if (p.urgency === 'watch') continue
      const key = toYmd(p.suggestedDate ?? today)
      const day = getDay(key)
      if (!day.proposalTitles.includes(p.title)) {
        day.proposalTitles.push(p.title)
        day.proposalCount += 1
      }
    }
  }

  /** 昨年の記録を「今年の同じ月日」キーにマッピング */
  const mapLastYearToThisYear = (date: Date): string => {
    const thisYear = date.getFullYear() + 1
    const month = date.getMonth()
    const day = date.getDate()
    const probe = new Date(thisYear, month, day)
    if (probe.getMonth() !== month) return ''
    return toYmd(probe)
  }

  if (showLastYear) {
    for (const rec of lastYearWorks) {
      const key = mapLastYearToThisYear(rec.date)
      if (!key) continue
      const day = getDay(key)
      const crop = rec.crop?.name ? `（${rec.crop.name}）` : ''
      const label = `${rec.taskType}${crop}`
      if (!day.lastYearLabels.includes(label)) {
        day.lastYearLabels.push(label)
        day.lastYearCount += 1
      }
    }
    for (const rec of lastYearFertilizers) {
      const key = mapLastYearToThisYear(rec.appliedAt)
      if (!key) continue
      const day = getDay(key)
      const label = `施肥：${rec.productName}`
      if (!day.lastYearLabels.includes(label)) {
        day.lastYearLabels.push(label)
        day.lastYearCount += 1
      }
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
    const sectionTitle = variant === 'history' ? '過去の実績' : 'カレンダー'
    const sectionSub =
      variant === 'history'
        ? '過去の作業記録・施肥をカレンダーで確認できます。月を移動して期間を変えられます。'
        : '今月・来月・再来月の提案と実績です。薄い「昨年」は前年同日の作業・施肥です。もっと前は「過去の実績」から。'

    return (
      <section className="dashboard-card">
        <h2 className="dashboard-section-title">{sectionTitle}</h2>
        <p className="dashboard-section-sub">{sectionSub}</p>
        <div className={gridClass}>
          {monthConfigs.map(({ year, month }) => (
            <MonthBlock
              key={`${year}-${month}`}
              year={year}
              month={month}
              calendarDays={getMonthCalendarDays(year, month, eventsByDate)}
              title={`${year}年 ${monthNames[month - 1]}`}
              showProposals={showProposals}
              showLastYear={showLastYear}
            />
          ))}
        </div>
        <p className="dashboard-calendar-note">
          {variant === 'history'
            ? '※ 実績バッジにマウスを乗せると内容の概要を表示します。日付クリックで作業記録を登録できます。'
            : '※ 「昨年」は前年同日の実績です。提案・実績は件数バッジのみ。詳細は過去の実績ページでも確認できます。'}
        </p>
      </section>
    )
  }

  const calendarDays = getMonthCalendarDays(todayYear, todayMonth, eventsByDate)
  const proposalDays = calendarDays.filter((item) => item !== null && item.events.proposalCount > 0).length
  const recordDays = calendarDays.filter((item) => item !== null && item.events.recordCount > 0).length
  const lastYearDays = calendarDays.filter((item) => item !== null && item.events.lastYearCount > 0).length

  return (
    <section className="dashboard-card">
      <h2 className="dashboard-section-title">作業カレンダー（{todayMonth}月）</h2>
      <p className="dashboard-section-sub">
        提案（AI）と実績（作業・施肥）、昨年同日の記録を確認できます。日付を押しても記録画面には移りません。
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
            AI提案がある日は <span className="font-semibold">{proposalDays}日</span>、実績がある日は{' '}
            <span className="font-semibold">{recordDays}日</span>
            {lastYearDays > 0 && (
              <>
                、昨年同日に記録がある日は <span className="font-semibold">{lastYearDays}日</span>
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
