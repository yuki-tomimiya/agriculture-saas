import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import SoilNewForm from './SoilNewForm'

export default async function NewSoilDiagnosisPage({
  searchParams,
}: {
  searchParams?: Promise<{ farmId?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const params = await searchParams
  const farms = await prisma.farm.findMany({
    where: { userId: user.id },
    orderBy: { name: 'asc' },
    include: { fields: { orderBy: { name: 'asc' } } },
  })

  return (
    <SoilNewForm
      farms={farms.map((farm) => ({
        id: farm.id,
        name: farm.name,
        fields: farm.fields.map((field) => ({ id: field.id, name: field.name })),
      }))}
      initialFarmId={params?.farmId ?? ''}
    />
  )
}
