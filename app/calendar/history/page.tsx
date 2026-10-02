import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import WorkCalendar from '@/components/WorkCalendar'

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function parseYearMonth(
  yearParam: string | undefined,
  monthParam: string | undefined,
  fallback: { year: number; month: number }
): { year: number; month: number } {
  const y = yearParam ? Number(yearParam) : NaN
  const m = monthParam ? Number(monthParam) : NaN
  if (!Number.isInteger(y) || y < 2000 || y > 2100) return fallback
  if (!Number.isInteger(m) || m < 1 || m > 12) return fallback
  return { year: y, month: m }
}

export default async function CalendarHistoryPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string }
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const today = new Date()
  // デフォルト: 「先月を含む過去3か月」の先頭（3か月前）
  const defaultStart = shiftMonth(today.getFullYear(), today.getMonth() + 1, -3)
  const start = parseYearMonth(searchParams.year, searchParams.month, defaultStart)
  const prev = shiftMonth(start.year, start.month, -1)
  const next = shiftMonth(start.year, start.month, 1)
  const end = shiftMonth(start.year, start.month, 2)

  // 表示期間が「今月」に食い込まないよう、次へは制限（任意だが分かりやすい）
  const currentMonthStart = { year: today.getFullYear(), month: today.getMonth() + 1 }
  const nextWouldOverlapCurrent =
    end.year > currentMonthStart.year ||
    (end.year === currentMonthStart.year && end.month >= currentMonthStart.month)

  const monthLabel = (y: number, m: number) => `${y}年${m}月`

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <p className="gdd-breadcrumb">
              <Link href="/calendar" className="gdd-breadcrumb-link">
                カレンダー
              </Link>
              <span className="gdd-breadcrumb-sep">/</span>
              <span>過去の実績</span>
            </p>
            <h1 className="farms-title">過去の実績</h1>
            <p className="farms-subtitle">
              {monthLabel(start.year, start.month)}〜{monthLabel(end.year, end.month)}の作業・施肥履歴
            </p>
          </div>
          <div className="insights-header-actions">
            <Link href="/calendar" className="btn btn-primary farms-add-button">
              カレンダーへ戻る
            </Link>
          </div>
        </div>

        <div className="calendar-history-nav">
          <Link
            href={`/calendar/history?year=${prev.year}&month=${prev.month}`}
            className="btn btn-outline"
          >
            ← 1か月前へ
          </Link>
          <span className="calendar-history-nav-label">
            {monthLabel(start.year, start.month)} から3か月
          </span>
          {nextWouldOverlapCurrent ? (
            <span className="btn btn-outline opacity-40 pointer-events-none" aria-disabled>
              1か月先へ →
            </span>
          ) : (
            <Link
              href={`/calendar/history?year=${next.year}&month=${next.month}`}
              className="btn btn-outline"
            >
              1か月先へ →
            </Link>
          )}
        </div>

        <div className="calendar-page-content">
          <WorkCalendar
            months={3}
            userId={user.id}
            variant="history"
            startYear={start.year}
            startMonth={start.month}
          />
        </div>
      </main>
    </div>
  )
}
