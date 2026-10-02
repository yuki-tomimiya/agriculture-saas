import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCropWhere, getHarvestWhere, getPesticideWhere, getFertilizerWhere, getWorkRecordWhere } from '@/lib/queries'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

export default async function DashboardPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  const { where: cropWhere, whereFallback: cropWhereFallback } = getCropWhere(user.id)
  const { where: harvestWhere, whereFallback: harvestWhereFallback } = getHarvestWhere(user.id)
  const { where: pesticideWhere } = getPesticideWhere(user.id)
  const { where: fertilizerWhere } = getFertilizerWhere(user.id)
  const { where: workRecordWhere } = getWorkRecordWhere(user.id)

  const farms = await prisma.farm.count({
    where: { userId: user.id },
  })
  const tasks = await prisma.task.count({
    where: { farm: { userId: user.id }, status: { not: 'completed' } },
  })

  let crops = 0
  let harvests = 0
  let pesticides = 0
  let fertilizers = 0
  let workRecords = 0
  try {
    ;[crops, harvests] = await Promise.all([
      prisma.crop.count({ where: cropWhere }),
      prisma.harvest.count({ where: harvestWhere }),
    ])
  } catch {
    crops = await prisma.crop.count({ where: cropWhereFallback })
    harvests = await prisma.harvest.count({ where: harvestWhereFallback })
  }
  try {
    ;[pesticides, fertilizers, workRecords] = await Promise.all([
      prisma.pesticideRecord.count({ where: pesticideWhere }),
      prisma.fertilizerRecord.count({ where: fertilizerWhere }),
      prisma.workRecord.count({ where: workRecordWhere }),
    ])
  } catch {
    pesticides = 0
    fertilizers = 0
    workRecords = 0
  }

  let recentCrops = await prisma.crop.findMany({
    where: cropWhere,
    include: { farm: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  }).catch(() =>
    prisma.crop.findMany({
      where: cropWhereFallback,
      include: { farm: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
  )

  let recentHarvests = await prisma.harvest.findMany({
    where: harvestWhere,
    include: { crop: { include: { farm: true } } },
    orderBy: { date: 'desc' },
    take: 5,
  }).catch(() =>
    prisma.harvest.findMany({
      where: harvestWhereFallback,
      include: { crop: { include: { farm: true } } },
      orderBy: { date: 'desc' },
      take: 5,
    })
  )

  let totalSales = 0
  try {
    const saleModel = (prisma as { sale?: { aggregate: (args: unknown) => Promise<{ _sum: { amount: number | null } }> } }).sale
    if (saleModel?.aggregate) {
      const salesAggregate = await saleModel.aggregate({
        where: { userId: user.id },
        _sum: { amount: true },
      })
      totalSales = salesAggregate._sum.amount ?? 0
    }
  } catch {
    totalSales = 0
  }

  return (
    <div className="dashboard-page min-h-screen">
      <Sidebar />
      <main className="dashboard-main">
        <div className="farms-header dashboard-hub-header">
          <div className="farms-header-text">
            <h1 className="dashboard-title" style={{ marginBottom: 0 }}>
              ダッシュボード
            </h1>
            <p className="farms-subtitle">
              記録の入口です。今日の一手・振り返り・生育は下のリンクから
            </p>
          </div>
          <div className="insights-header-actions">
            <Link href="/dashboard/ai-proposal" className="btn btn-primary farms-add-button">
              今日の提案
            </Link>
            <Link href="/insights" className="btn btn-outline farms-add-button">
              分析・振り返り
            </Link>
            <Link href="/gdd" className="btn btn-outline farms-add-button">
              生育ナビ
            </Link>
          </div>
        </div>

        {/* クイック追加リンク */}
        <div className="farms-filter-bar" style={{ marginBottom: '1.5rem' }}>
          <Link href="/farms/new" className="farms-filter-link">＋ 農場を追加</Link>
          <Link href="/crops/new" className="farms-filter-link">＋ 作物を追加</Link>
          <Link href="/work-records/new" className="farms-filter-link">＋ 作業記録を追加</Link>
          <Link href="/fertilizers/new" className="farms-filter-link">＋ 施肥記録を追加</Link>
          <Link href="/pesticides/new" className="farms-filter-link">＋ 農薬記録を追加</Link>
          <Link href="/harvests/new" className="farms-filter-link">＋ 収穫を記録</Link>
          <Link href="/tasks/new" className="farms-filter-link">＋ タスクを追加</Link>
        </div>

        {/* 上部サマリー（農場・作物・タスク・収穫・農薬・肥料） */}
        <div className="dashboard-kpi-grid">
          <Link href="/farms" className="dashboard-kpi-card">
            <h3 className="dashboard-kpi-title">農場数</h3>
            <p className="dashboard-kpi-value dashboard-kpi-value--green">{farms}</p>
          </Link>
          <Link href="/crops" className="dashboard-kpi-card">
            <h3 className="dashboard-kpi-title">作物数</h3>
            <p className="dashboard-kpi-value dashboard-kpi-value--blue">{crops}</p>
          </Link>
          <Link href="/tasks" className="dashboard-kpi-card">
            <h3 className="dashboard-kpi-title">未完了タスク</h3>
            <p className="dashboard-kpi-value dashboard-kpi-value--orange">{tasks}</p>
          </Link>
          <Link href="/work-records" className="dashboard-kpi-card">
            <h3 className="dashboard-kpi-title">作業記録数</h3>
            <p className="dashboard-kpi-value dashboard-kpi-value--orange">{workRecords}</p>
          </Link>
          <Link href="/fertilizers" className="dashboard-kpi-card">
            <h3 className="dashboard-kpi-title">施肥記録数</h3>
            <p className="dashboard-kpi-value dashboard-kpi-value--blue">{fertilizers}</p>
          </Link>
          <Link href="/pesticides" className="dashboard-kpi-card">
            <h3 className="dashboard-kpi-title">農薬記録数</h3>
            <p className="dashboard-kpi-value dashboard-kpi-value--green">{pesticides}</p>
          </Link>
          <Link href="/harvests" className="dashboard-kpi-card">
            <h3 className="dashboard-kpi-title">収穫数</h3>
            <p className="dashboard-kpi-value dashboard-kpi-value--purple">{harvests}</p>
          </Link>
          <Link href="/sales" className="dashboard-kpi-card">
            <h3 className="dashboard-kpi-title">販売金額（累計）</h3>
            <p className="dashboard-kpi-value dashboard-kpi-value--green">
              {totalSales.toLocaleString()}<span className="dashboard-kpi-unit">円</span>
            </p>
          </Link>
        </div>

        {/* 中段：最近の作物 / 収穫 */}
        <div className="dashboard-section-grid">
          <section className="dashboard-section-card">
            <h2 className="dashboard-section-title">最近の作物</h2>
            {recentCrops.length === 0 ? (
              <div className="dashboard-empty">
                <p className="dashboard-empty-text">作物が登録されていません</p>
                <Link href="/crops" className="btn btn-primary">
                  作物を追加
                </Link>
              </div>
            ) : (
              <ul className="dashboard-list">
                {recentCrops.map((crop) => (
                  <li key={crop.id} className="dashboard-list-item">
                    <Link href={`/crops/${crop.id}`} className="dashboard-list-link">
                      <div className="dashboard-list-main">
                        <span className="dashboard-list-label">{crop.name}</span>
                        <span className="dashboard-list-meta">{crop.farm?.name ?? '-'}</span>
                      </div>
                      <span className="dashboard-list-sub">
                        {crop.status === 'growing'
                          ? '成長中'
                          : crop.status === 'harvested'
                          ? '収穫済み'
                          : '完了'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dashboard-section-card">
            <h2 className="dashboard-section-title">最近の収穫</h2>
            {recentHarvests.length === 0 ? (
              <div className="dashboard-empty">
                <p className="dashboard-empty-text">収穫がありません</p>
                <Link href="/harvests/new" className="btn btn-primary">
                  収穫を記録
                </Link>
              </div>
            ) : (
              <ul className="dashboard-list">
                {recentHarvests.map((harvest) => (
                  <li key={harvest.id} className="dashboard-list-item">
                    <Link href={`/harvests/${harvest.id}`} className="dashboard-list-link">
                      <div className="dashboard-list-main">
                        <span className="dashboard-list-label">{harvest.crop.name}</span>
                        <span className="dashboard-list-meta">
                          {new Date(harvest.date).toLocaleDateString('ja-JP', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                          })}
                        </span>
                      </div>
                      <span className="dashboard-list-sub">
                        {harvest.quantity} {harvest.unit}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

      </main>
    </div>
  )
}
