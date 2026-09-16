import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import WorkCalendar from '@/components/WorkCalendar'

export default async function CalendarPage() {
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
              提案・実績と、前年同日の作業を重ねて確認できます
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/calendar/history" className="btn btn-outline farms-add-button">
              過去の実績
            </Link>
            <Link href="/dashboard/ai-proposal" className="btn btn-primary farms-add-button">
              今日の作業を提案
            </Link>
          </div>
        </div>

        <div className="calendar-page-content">
          <WorkCalendar months={3} userId={user.id} variant="upcoming" />
        </div>
      </main>
    </div>
  )
}
