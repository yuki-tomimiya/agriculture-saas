import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import WorkRecordEditForm from './WorkRecordEditForm'

export default async function WorkRecordEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const { id } = await params

  const record = await prisma.workRecord.findFirst({
    where: { id, farm: { userId: user.id } },
  })
  if (!record) notFound()

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

  const recordForForm = {
    id: record.id,
    date: record.date.toISOString().slice(0, 10),
    farmId: record.farmId,
    cropId: record.cropId ?? '',
    taskId: record.taskId ?? '',
    taskType: record.taskType,
    description: record.description ?? '',
    notes: record.notes ?? '',
  }

  return <WorkRecordEditForm record={recordForForm} farms={farmsForForm} />
}
