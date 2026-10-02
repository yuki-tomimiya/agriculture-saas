import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import TaskNewForm from './TaskNewForm'

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams?: { cropId?: string; farmId?: string; title?: string; dueDate?: string }
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  const farms = await prisma.farm.findMany({
    where: { userId: user.id },
    include: {
      crops: { orderBy: { name: 'asc' } },
    },
    orderBy: { name: 'asc' },
  })

  const farmsWithCrops = farms.map((f) => ({
    id: f.id,
    name: f.name,
    crops: f.crops.map((c) => ({ id: c.id, name: c.name })),
  }))

  return (
    <TaskNewForm
      farms={farmsWithCrops}
      initialCropId={searchParams?.cropId}
      initialFarmId={searchParams?.farmId}
      initialTitle={searchParams?.title}
      initialDueDate={searchParams?.dueDate}
    />
  )
}
