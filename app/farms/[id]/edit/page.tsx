import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import FarmEditForm from './FarmEditForm'

export default async function FarmEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const { id } = await params
  const farm = await prisma.farm.findFirst({
    where: { id, userId: user.id },
  })

  if (!farm) notFound()

  const initial = {
    id: farm.id,
    name: farm.name,
    description: farm.description ?? '',
    latitude: farm.latitude != null ? String(farm.latitude) : '',
    longitude: farm.longitude != null ? String(farm.longitude) : '',
  }

  return <FarmEditForm farmId={id} initial={initial} />
}

