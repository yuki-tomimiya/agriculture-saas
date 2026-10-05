import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

const ENTRY_CARDS = [
  {
    href: '/work-records',
    title: '作業記録',
    description: '植え付け・除草・整地・土づくりなど。施肥記録はこの中のタブです',
  },
  {
    href: '/pesticides',
    title: '農薬',
    description: '散布した農薬の記録',
  },
  {
    href: '/harvests',
    title: '収穫',
    description: '収穫量の記録',
  },
  {
    href: '/sales',
    title: '販売',
    description: '販売先と売上の記録',
  },
] as const

export default async function RecordsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <h1 className="farms-title">記録</h1>
            <p className="farms-subtitle">作業・農薬・収穫・販売の入口です。施肥は作業記録の中にあります</p>
          </div>
        </div>

        <section className="insights-entry-grid">
          {ENTRY_CARDS.map((card) => (
            <Link key={card.href} href={card.href} className="card insights-entry-card">
              <h2 className="insights-entry-card-title">{card.title}</h2>
              <p className="insights-entry-card-desc">{card.description}</p>
              <span className="insights-entry-card-cta">開く →</span>
            </Link>
          ))}
        </section>
      </main>
    </div>
  )
}
