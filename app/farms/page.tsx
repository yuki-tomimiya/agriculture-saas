import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { cookies } from 'next/headers'
import ManagementList from '@/components/ManagementList'

export default async function FarmsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  const farms = await prisma.farm.findMany({
    where: { userId: user.id },
    include: {
      _count: {
        select: {
          crops: true,
          tasks: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const cookieName = 'tilltol-view-farms'
  const initialView = (await cookies()).get(cookieName)?.value

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <h1 className="farms-title">農場管理</h1>
            <p className="farms-subtitle">農場の一覧と管理</p>
          </div>
          <div className="farms-header-actions">
            <Link href="/soil" className="btn btn-outline farms-add-button">
              土壌診断
            </Link>
            <Link href="/farms/new" className="btn btn-primary farms-add-button">
              新規農場を追加
            </Link>
          </div>
        </div>

        <ManagementList
          cookieName={cookieName}
          initialView={initialView}
          columns={["名前", "説明", "作物", "タスク", "位置"]}
          rows={farms.map(farm => ({
            id: farm.id,
            cells: [
              { text: farm.name, href: `/farms/${farm.id}` },
              farm.description ? { text: farm.description } : null,
              { text: String(farm._count.crops), value: farm._count.crops },
              { text: String(farm._count.tasks), value: farm._count.tasks },
              farm.latitude != null && farm.longitude != null
                ? { text: `${farm.latitude.toFixed(4)}, ${farm.longitude.toFixed(4)}`, value: 1 }
                : { text: '—', value: 0 },
            ],
            action: { href: `/crops?farmId=${farm.id}`, text: '作物を見る' },
          }))}
          empty={
            <div className="card farms-empty-card">
              <div className="farms-empty-icon">🌾</div>
              <h3 className="farms-empty-title">農場が登録されていません</h3>
              <p className="farms-empty-text">
                最初の農場を登録して、農業管理を始めましょう
              </p>
              <Link href="/farms/new" className="btn btn-primary farms-add-button">
                新規農場を追加
              </Link>
            </div>
          }
          tiles={
            <div className="farms-grid">
              {farms.map((farm) => (
                <article key={farm.id} className="card farms-card">
                  <h3 className="farms-card-title">
                    <Link href={`/farms/${farm.id}`} className="farms-card-title-link">
                      {farm.name}
                    </Link>
                  </h3>

                  {farm.description && (
                    <p className="farms-card-desc">
                      {farm.description}
                    </p>
                  )}

                  <div className="farms-card-meta">
                    <span>🌱 {farm._count.crops} 作物</span>
                    <span>📋 {farm._count.tasks} タスク</span>
                  </div>

                  {farm.latitude && farm.longitude && (
                    <div className="farms-card-location">
                      📍 {farm.latitude.toFixed(4)}, {farm.longitude.toFixed(4)}
                    </div>
                  )}

                  <div className="farms-card-actions">
                    <Link
                      href={`/farms/${farm.id}`}
                      className="btn btn-outline farms-card-button"
                    >
                      詳細
                    </Link>
                    <Link
                      href={`/farms/${farm.id}/edit`}
                      className="btn btn-outline farms-card-button"
                    >
                      編集
                    </Link>
                    <Link
                      href={`/crops?farmId=${farm.id}`}
                      className="btn btn-secondary farms-card-button"
                    >
                      作物を見る
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          }
        />
      </main>
    </div>
  )
}
