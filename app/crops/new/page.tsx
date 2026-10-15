import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import CropNewForm from './CropNewForm'
import { springBriefsForFarms } from '@/lib/jma/frost-record'

export default async function NewCropPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  const farms = await prisma.farm.findMany({
    where: { userId: user.id },
    include: {
      fields: { orderBy: { name: 'asc' } },
    },
    orderBy: { name: 'asc' },
  })

  const farmsWithFields = farms.map((f) => ({
    id: f.id,
    name: f.name,
    fields: f.fields.map((field) => ({ id: field.id, name: field.name })),
  }))
  const springByFarm = await springBriefsForFarms(farms)

  return <CropNewForm farms={farmsWithFields} springByFarm={springByFarm} />
}
