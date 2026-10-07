import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import FaqHashRedirect from '@/components/FaqHashRedirect'
import { FAQ_GROUPS, faqEntry } from '@/lib/faq-index'

export default async function FAQPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <FaqHashRedirect />
      <main className="dashboard-main farms-page faq-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <h1 className="farms-title">よくある質問（Q&amp;A）</h1>
            <p className="farms-subtitle">
              質問を選ぶと、答えと出典を確認できます
            </p>
          </div>
        </div>

        <div className="calendar-page-content">
          {FAQ_GROUPS.map((group) => (
            <section key={group.heading} className="card gdd-crop-list">
              <h2 className="gdd-section-title">{group.heading}</h2>
              <ul className="gdd-crop-cards">
                {group.slugs.map((slug) => {
                  const entry = faqEntry(slug)
                  return (
                    <li key={slug} className="gdd-crop-card">
                      <div className="gdd-crop-card-main">
                        <Link href={`/faq/${slug}`} className="gdd-crop-card-name">
                          {entry.title}
                        </Link>
                        <span className="gdd-crop-card-meta">{entry.summary}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
