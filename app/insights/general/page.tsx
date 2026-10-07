import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

export default async function InsightsGeneralPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <p className="gdd-breadcrumb">
              <Link href="/insights" className="gdd-breadcrumb-link">
                分析・振り返り
              </Link>
              <span className="gdd-breadcrumb-sep">/</span>
              <span>栽培暦の目安</span>
            </p>
            <h1 className="farms-title">栽培暦の目安（一般）</h1>
            <p className="farms-subtitle">
              出典の付いた栽培暦ができるまで、月ごとのヒントは出していません。
            </p>
          </div>
          <div className="insights-header-actions">
            <Link href="/dashboard/ai-proposal" className="btn btn-outline farms-add-button">
              今日の提案
            </Link>
            <Link href="/insights" className="btn btn-outline farms-add-button">
              入口へ戻る
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
