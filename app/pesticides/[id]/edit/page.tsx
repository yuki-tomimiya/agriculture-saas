import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import PesticideEditForm, { type RecordForForm } from './PesticideEditForm'

export default async function PesticideEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const { id } = await params

  const record = await prisma.pesticideRecord.findFirst({
    where: { id, userId: user.id },
    include: { crop: true, farm: true },
  })
  if (!record) notFound()

  const crops = await prisma.crop.findMany({
    where: {
      OR: [{ userId: user.id }, { farm: { userId: user.id } }],
    },
    include: { farm: true },
    orderBy: { name: 'asc' },
  }).catch(() =>
    prisma.crop.findMany({
      where: { farm: { userId: user.id } },
      include: { farm: true },
      orderBy: { name: 'asc' },
    })
  )
  const farms = await prisma.farm.findMany({
    where: { userId: user.id },
    orderBy: { name: 'asc' },
  })

  const recordForForm: RecordForForm = {
    id: record.id,
    appliedAt: record.appliedAt.toISOString().slice(0, 10),
    productName: record.productName,
    amount: record.amount == null ? '' : record.amount,
    amountUnit: record.amountUnit ?? 'mL',
    dilution: record.dilution ?? '',
    applicationCount: record.applicationCount == null ? '' : record.applicationCount,
    daysBeforeHarvest: record.daysBeforeHarvest == null ? '' : record.daysBeforeHarvest,
    cropId: record.cropId ?? '',
    farmId: record.farmId ?? '',
    notes: record.notes ?? '',
  }
  const cropsForSelect = crops.map((c) => ({
    id: c.id,
    name: c.name,
    farmName: c.farm?.name ?? null,
  }))
  const farmsForSelect = farms.map((f) => ({ id: f.id, name: f.name }))

  return (
    <PesticideEditForm
      record={recordForForm}
      crops={cropsForSelect}
      farms={farmsForSelect}
    />
  )
}
