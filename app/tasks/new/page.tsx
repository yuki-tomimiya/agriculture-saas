import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCropOptionLabel } from '@/components/WorkManagementTabs'
import { redirect } from 'next/navigation'
import TaskNewForm from './TaskNewForm'

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams?: Promise<{ cropId?: string; farmId?: string; title?: string; dueDate?: string }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }
  const sp = await searchParams

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
    crops: f.crops.map((c) => ({ id: c.id, name: formatCropOptionLabel(c) })),
  }))

  return (
    <TaskNewForm
      farms={farmsWithCrops}
      initialCropId={sp?.cropId}
      initialFarmId={sp?.farmId}
      initialTitle={sp?.title}
      initialDueDate={sp?.dueDate}
    />
  )
}
