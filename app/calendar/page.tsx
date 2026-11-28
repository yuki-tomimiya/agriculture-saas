import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import WorkCalendar from '@/components/WorkCalendar'

export default async function CalendarPage({ searchParams }: { searchParams?: Promise<{ farm?: string }> }) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <h1 className="farms-title">カレンダー</h1>
            <p className="farms-subtitle">
              この先3か月の見通しと、畑の記録を確認できます
            </p>
          </div>
          <div className="insights-header-actions">
            <Link href="/calendar/history" className="btn btn-outline farms-add-button">
              過去の実績
            </Link>
            <Link href="/dashboard/ai-proposal" className="btn btn-primary farms-add-button">
              今日の作業を提案
            </Link>
          </div>
        </div>

        <div className="calendar-page-content">
          <WorkCalendar months={3} userId={user.id} variant="upcoming" farmId={(await searchParams)?.farm} />
        </div>
      </main>
    </div>
  )
}
