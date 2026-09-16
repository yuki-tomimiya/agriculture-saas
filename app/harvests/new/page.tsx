import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import HarvestNewForm from './HarvestNewForm'

export default async function NewHarvestPage() {
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

  const cropsForSelect = crops.map((c) => ({
    id: c.id,
    name: c.name,
    farmName: c.farm?.name ?? null,
  }))

  return <HarvestNewForm crops={cropsForSelect} />
}
