import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import CropNewForm from './CropNewForm'

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

  return <CropNewForm farms={farmsWithFields} />
}
