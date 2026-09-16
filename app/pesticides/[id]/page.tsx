import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { formatDate } from '@/lib/utils'
import PesticideDetailActions from './PesticideDetailActions'

export default async function PesticideDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const { id } = await params

  const record = await prisma.pesticideRecord.findFirst({
    where: { id, userId: user.id },
    include: {
      crop: { include: { farm: true } },
      farm: true,
    },
  })

  if (!record) notFound()

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 ml-64 px-6 py-8">
        <div className="mb-6">
          <Link href="/pesticides" className="text-sm text-gray-500 hover:text-gray-700">
            ← 農薬管理一覧
          </Link>
        </div>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{record.productName}</h1>
            <p className="text-lg text-gray-600">
              {formatDate(record.appliedAt)}
              {record.amount != null && ` ・ ${record.amount} ${record.amountUnit ?? ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PesticideDetailActions recordId={record.id} />
            <Link href="/pesticides" className="btn btn-outline">
              一覧に戻る
            </Link>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-lg font-semibold mb-4">詳細</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-gray-500">散布日</dt>
              <dd className="text-gray-900">{formatDate(record.appliedAt)}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">農薬名</dt>
              <dd className="text-gray-900 font-semibold">{record.productName}</dd>
            </div>
            {record.amount != null && (
              <div>
                <dt className="text-sm text-gray-500">使用量</dt>
                <dd className="text-gray-900">
                  {record.amount} {record.amountUnit ?? ''}
                </dd>
              </div>
            )}
            {record.dilution && (
              <div>
                <dt className="text-sm text-gray-500">希釈倍率</dt>
                <dd className="text-gray-900">{record.dilution}</dd>
              </div>
            )}
            {record.applicationCount != null && (
              <div>
                <dt className="text-sm text-gray-500">使用回数</dt>
                <dd className="text-gray-900">{record.applicationCount}回目</dd>
              </div>
            )}
            {record.daysBeforeHarvest != null && (
              <div>
                <dt className="text-sm text-gray-500">収穫前日数</dt>
                <dd className="text-gray-900">収穫{record.daysBeforeHarvest}日前</dd>
              </div>
            )}
            {record.crop && (
              <div>
                <dt className="text-sm text-gray-500">作物</dt>
                <dd>
                  <Link href={`/crops/${record.crop.id}`} className="text-green-600 hover:underline">
                    {record.crop.name}
                  </Link>
                </dd>
              </div>
            )}
            {(record.farm || record.crop?.farm) && (
              <div>
                <dt className="text-sm text-gray-500">農場</dt>
                <dd>
                  {record.farm ? (
                    <Link href={`/farms/${record.farm.id}`} className="text-green-600 hover:underline">
                      {record.farm.name}
                    </Link>
                  ) : record.crop?.farm ? (
                    <Link href={`/farms/${record.crop.farm.id}`} className="text-green-600 hover:underline">
                      {record.crop.farm.name}
                    </Link>
                  ) : null}
                </dd>
              </div>
            )}
            {record.notes && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-gray-500">メモ</dt>
                <dd className="text-gray-700 mt-1">{record.notes}</dd>
              </div>
            )}
          </dl>
        </div>
      </main>
    </div>
  )
}
