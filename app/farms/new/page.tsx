import Link from 'next/link'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import NewFarmForm from '@/components/NewFarmForm'
import { getCurrentUser } from '@/lib/auth'

export default async function NewFarmPage() {
  if (!await getCurrentUser()) redirect('/auth/signin')
  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page form-column-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <Link href="/farms" className="farm-new-back">
              ← 農場一覧
            </Link>
            <h1 className="farms-title">新規農場を追加</h1>
          </div>
        </div>
        <div className="card farm-new-card !p-2 sm:!p-5">
          <NewFarmForm />
        </div>
      </main>
    </div>
  )
}
