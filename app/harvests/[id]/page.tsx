import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { formatDateShort, formatDate } from '@/lib/utils'

export default async function HarvestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const { id } = await params

  let harvest = await prisma.harvest.findFirst({
    where: {
      id,
      crop: {
        OR: [
          { userId: user.id },
          { farm: { userId: user.id } },
        ],
      },
    },
    include: {
      crop: { include: { farm: true } },
    },
  }).catch(() => null)

  if (!harvest) {
    harvest = await prisma.harvest.findFirst({
      where: { id, crop: { farm: { userId: user.id } } },
      include: { crop: { include: { farm: true } } },
    })
  }

  if (!harvest) notFound()

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 ml-64 px-6 py-8">
        <div className="mb-6">
          <Link href="/harvests" className="text-sm text-gray-500 hover:text-gray-700">
            ← 収穫管理
          </Link>
        </div>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              収穫: {harvest.crop.name}
            </h1>
            <p className="text-lg text-gray-600">
              {formatDate(harvest.date)} ・ {harvest.quantity} {harvest.unit}
            </p>
          </div>
          <Link href="/harvests" className="btn btn-outline">
            一覧に戻る
          </Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-lg font-semibold mb-4">詳細</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-gray-500">日付</dt>
              <dd className="text-gray-900">{formatDate(harvest.date)}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">収穫量</dt>
              <dd className="text-gray-900 font-semibold">
                {harvest.quantity} {harvest.unit}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">作物</dt>
              <dd>
                <Link href={`/crops/${harvest.crop.id}`} className="text-green-600 hover:underline">
                  {harvest.crop.name}
                </Link>
              </dd>
            </div>
            {harvest.crop.farm && (
              <div>
                <dt className="text-sm text-gray-500">農場</dt>
                <dd>
                  <Link href={`/farms/${harvest.crop.farm.id}`} className="text-green-600 hover:underline">
                    {harvest.crop.farm.name}
                  </Link>
                </dd>
              </div>
            )}
            {harvest.notes && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-gray-500">メモ</dt>
                <dd className="text-gray-700 mt-1">{harvest.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        <Link href={`/crops/${harvest.crop.id}`} className="text-sm text-green-600 hover:underline">
          「{harvest.crop.name}」の栽培詳細を見る →
        </Link>
      </main>
    </div>
  )
}
