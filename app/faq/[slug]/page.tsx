import { getCurrentUser } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import FaqAnswer from '@/app/faq/articles'
import { faqEntry, isFaqSlug } from '@/lib/faq-index'

export default async function FaqDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const { slug } = await params
  if (!isFaqSlug(slug)) notFound()
  const entry = faqEntry(slug)

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page faq-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <p className="gdd-breadcrumb">
              <Link href="/faq" className="gdd-breadcrumb-link">
                よくある質問
              </Link>
              <span className="gdd-breadcrumb-sep">/</span>
              <span>{entry.title}</span>
            </p>
            <h1 className="farms-title">{entry.title}</h1>
          </div>
        </div>

        <div className="faq-content card">
          <FaqAnswer slug={slug} />
        </div>

        {entry.related.length > 0 && (
          <p className="gdd-crop-past-link">
            関係する質問：
            {entry.related.map((related, index) => (
              <span key={related}>
                {index > 0 ? '、' : ''}
                <Link href={`/faq/${related}`} className="gdd-crop-past-link-a">
                  {faqEntry(related).title}
                </Link>
              </span>
            ))}
          </p>
        )}
      </main>
    </div>
  )
}
