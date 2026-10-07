import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCropWhere } from '@/lib/queries'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import GDDCropList from '@/components/GDDCropList'

export default async function GDDPage({
  searchParams,
}: {
  searchParams?: Promise<{ cropId?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const sp = searchParams ? await searchParams : undefined
  if (sp?.cropId) redirect(`/gdd/${sp.cropId}`)

  const { where: cropWhere, whereFallback: cropWhereFallback } = getCropWhere(user.id)
  let crops = await prisma.crop.findMany({
    where: cropWhere,
    include: { farm: true },
    orderBy: { name: 'asc' },
  }).catch(() =>
    prisma.crop.findMany({
      where: cropWhereFallback,
      include: { farm: true },
      orderBy: { name: 'asc' },
    })
  )

  const growing = crops.filter((c) => c.status === 'growing')
  const growingWithPlanting = growing.filter((c) => c.plantingDate != null)
  if (growing.length === 1 && growingWithPlanting.length === 1) redirect(`/gdd/${growingWithPlanting[0].id}`)

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page gdd-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <h1 className="farms-title">生育ナビ</h1>
            <p className="farms-subtitle">
              栽培中の作付けを選ぶと、積算温度（GDD）・雨量・日射の進捗を確認できます
            </p>
          </div>
          <div className="insights-header-actions">
            <Link href="/dashboard/ai-proposal" className="btn btn-primary farms-add-button">
              今日の提案
            </Link>
            <Link href="/insights" className="btn btn-outline farms-add-button">
              分析・振り返り
            </Link>
            <Link href="/gdd/past" className="btn btn-outline farms-add-button">
              過去の生育データ
            </Link>
            <Link href="/crops" className="btn btn-outline farms-add-button">
              作物一覧
            </Link>
          </div>
        </div>

        <div className="calendar-page-content">
          <GDDCropList
            crops={crops.map((c) => ({
              id: c.id,
              name: c.name,
              variety: c.variety,
              plantingDate: c.plantingDate,
              harvestDate: c.harvestDate,
              status: c.status,
              baseTemperature: c.baseTemperature,
              farm: c.farm ? { name: c.farm.name } : null,
            }))}
          />
        </div>
      </main>
    </div>
  )
}
