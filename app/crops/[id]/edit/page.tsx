import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import CropEditForm from './CropEditForm'

function toDateInputValue(d: Date | null): string {
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default async function CropEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const { id } = await params

  let crop = await prisma.crop.findFirst({
    where: {
      id,
      OR: [
        { userId: user.id },
        { farm: { userId: user.id } },
      ],
    },
    include: { farm: true, field: true },
  }).catch(() => null)

  if (!crop) {
    crop = await prisma.crop.findFirst({
      where: { id, farm: { userId: user.id } },
      include: { farm: true, field: true },
    })
  }

  if (!crop) notFound()

  const farms = await prisma.farm.findMany({
    where: { userId: user.id },
    include: {
      fields: { orderBy: { name: 'asc' } },
    },
    orderBy: { name: 'asc' },
  })

  const initial = {
    id: crop.id,
    name: crop.name,
    variety: crop.variety ?? '',
    farmId: crop.farmId ?? '',
    fieldId: crop.fieldId ?? '',
    plantingDate: toDateInputValue(crop.plantingDate),
    harvestDate: toDateInputValue(crop.harvestDate),
    status: crop.status,
    baseTemperature: crop.baseTemperature == null ? '' : String(crop.baseTemperature),
  }

  const farmsWithFields = farms.map((f) => ({
    id: f.id,
    name: f.name,
    fields: f.fields.map((field) => ({ id: field.id, name: field.name })),
  }))

  return <CropEditForm cropId={id} initial={initial} farms={farmsWithFields} />
}
