import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import WorkRecordNewForm from './WorkRecordNewForm'

export default async function NewWorkRecordPage({
  searchParams,
}: {
  searchParams?: { date?: string; cropId?: string; farmId?: string; taskType?: string; description?: string }
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const farms = await prisma.farm.findMany({
    where: { userId: user.id },
    include: {
      crops: { orderBy: { name: 'asc' } },
      tasks: {
        where: { status: { not: 'completed' } },
        orderBy: { dueDate: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  const farmsForForm = farms.map((farm) => ({
    id: farm.id,
    name: farm.name,
    crops: farm.crops.map((c) => ({ id: c.id, name: c.name, variety: c.variety })),
    tasks: farm.tasks.map((t) => ({ id: t.id, title: t.title })),
  }))

  return (
    <WorkRecordNewForm
      farms={farmsForForm}
      initialDate={searchParams?.date}
      initialCropId={searchParams?.cropId}
      initialFarmId={searchParams?.farmId}
      initialTaskType={searchParams?.taskType}
      initialDescription={searchParams?.description}
    />
  )
}
