import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

const ENTRY_CARDS = [
  {
    href: '/insights/compare',
    layer: 'あなた',
    title: '作付け比較',
    description: '前回の同じ作付けとの収量・売上を並べて振り返ります',
  },
  {
    href: '/insights/regional',
    layer: '地域',
    title: 'この地域の気象',
    description: '今月と昨年同時期の降水量を比べ、地域のコンディションを確認します',
  },
  {
    href: '/insights/general',
    layer: '一般',
    title: '栽培暦の目安',
    description: '品目ごとの教科書的な目安・今月の栽培暦ヒントを確認します',
  },
  {
    href: '/plan',
    layer: '計画',
    title: '来年の計画',
    description: '終わった作付けから、来年同じ植付日にしたときの収穫見込みを見ます',
  },
] as const

export default async function InsightsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <h1 className="farms-title">振り返りと計画</h1>
            <p className="farms-subtitle">
              比較・地域・一般と、来年の計画の入口です。過去の生育グラフは生育ナビの「過去の生育データ」へ
            </p>
          </div>
          <div className="insights-header-actions">
            <Link href="/dashboard/ai-proposal" className="btn btn-primary farms-add-button">
              今日の提案へ
            </Link>
            <Link href="/gdd" className="btn btn-outline farms-add-button">
              生育ナビ
            </Link>
            <Link href="/gdd/past" className="btn btn-outline farms-add-button">
              過去の生育データ
            </Link>
          </div>
        </div>

        <section className="card insights-intro">
          <p className="insights-intro-text">
            <span className="insights-layer-tag">あなた</span>
            前回の同じ作付けとの比較　
            <span className="insights-layer-tag">一般</span>
            品目ごとの教科書的な目安　
            <span className="insights-layer-tag">地域</span>
            農場周辺の降水量（今月 vs 昨年同時期）
          </p>
        </section>

        <section className="insights-entry-grid">
          {ENTRY_CARDS.map((card) => (
            <Link key={card.href} href={card.href} className="card insights-entry-card">
              <span className="insights-layer-tag">{card.layer}</span>
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
