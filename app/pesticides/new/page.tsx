import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import PesticideNewForm from './PesticideNewForm'

export default async function NewPesticidePage() {
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
    name: c.name,
    farmName: c.farm?.name ?? null,
  }))
  const farmsForSelect = farms.map((f) => ({ id: f.id, name: f.name }))

  return (
    <PesticideNewForm crops={cropsForSelect} farms={farmsForSelect} />
  )
}
