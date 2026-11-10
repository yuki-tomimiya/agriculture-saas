import { getCurrentUser } from '@/lib/auth'
import { japanDateKey } from '@/lib/pesticide-safety'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import FertilizerNewForm from './FertilizerNewForm'

export default async function NewFertilizerPage({ searchParams }: { searchParams: Promise<{ cropId?: string; date?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

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

  const cropsForSelect = crops.map((c) => ({
    id: c.id,
    name: c.name, plantingDate: c.plantingDate,
    variety: c.variety,
    farmName: c.farm?.name ?? null,
  }))
  const farmsForSelect = farms.map((f) => ({ id: f.id, name: f.name }))

  const { cropId, date } = await searchParams
  const parsedDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(date + 'T00:00:00Z') : null
  const initialDate = parsedDate && Number.isFinite(+parsedDate) && japanDateKey(parsedDate) === date
    ? date : japanDateKey(new Date())
  const initialCrop = crops.find(crop => crop.id === cropId)
  const initialFarmId = farmsForSelect.find(farm => farm.id === initialCrop?.farmId)?.id
  return <FertilizerNewForm crops={cropsForSelect} farms={farmsForSelect} initialDate={initialDate} initialCropId={initialCrop?.id} initialFarmId={initialFarmId} />
}
