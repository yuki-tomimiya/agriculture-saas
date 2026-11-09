import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import HarvestNewForm from './HarvestNewForm'
import { harvestDatesByCrop, pesticideSafetySelect } from '@/lib/pesticide-safety'

export default async function NewHarvestPage({
  searchParams,
}: {
  searchParams?: Promise<{ cropId?: string; farmId?: string; date?: string; returnTo?: string }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  const crops = await prisma.crop.findMany({
    where: {
      OR: [
        { userId: user.id },
        { farm: { userId: user.id } },
      ],
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

  const sp = searchParams ? await searchParams : undefined
  const sprays = await prisma.pesticideRecord.findMany({
    where: { userId: user.id, cropId: { in: crops.map(crop => crop.id) } },
    select: pesticideSafetySelect,
  })
  const harvestDates = harvestDatesByCrop(sprays)
  const cropsForSelect = crops.map((c) => ({
    id: c.id,
    name: c.name, plantingDate: c.plantingDate, variety: c.variety,
    farmName: c.farm?.name ?? null,
    status: c.status,
    harvestFrom: harvestDates.get(c.id) ?? null,
  }))

  return (
    <HarvestNewForm
      crops={cropsForSelect}
      initialCropId={sp?.cropId}
      initialDate={sp?.date}
      returnTo={sp?.returnTo}
    />
  )
}
