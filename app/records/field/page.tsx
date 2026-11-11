import { getCurrentUser } from '@/lib/auth'
import { fieldObservationOptions } from '@/lib/crops/field-observations'
import { japanDateKey } from '@/lib/pesticide-safety'
import { prisma } from '@/lib/prisma'
import { formatCropOptionLabel } from '@/components/WorkManagementTabs'
import Sidebar from '@/components/Sidebar'
import { redirect } from 'next/navigation'
import FieldObservationForm from './FieldObservationForm'

export default async function FieldObservationPage({ searchParams }: {
  searchParams: Promise<{ cropId?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const { cropId } = await searchParams
  const crops = await prisma.crop.findMany({
    where: { status: 'growing', OR: [{ userId: user.id }, { farm: { userId: user.id } }] },
    select: {
      id: true, name: true, variety: true, cropKind: true, plantingDate: true,
      farm: { select: { name: true } },
      milestones: { select: { key: true, observedAt: true } },
    },
    orderBy: [{ name: 'asc' }, { plantingDate: 'desc' }],
  })
  const options = crops.map(crop => ({
    id: crop.id,
    label: formatCropOptionLabel({ ...crop, farmName: crop.farm?.name }),
    ...fieldObservationOptions(crop),
  }))

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="form-column-page mx-auto w-full max-w-lg">
          <h1 className="farms-title mb-4 break-words">畑で見たことを記録する</h1>
          <FieldObservationForm crops={options} initialCropId={cropId} today={japanDateKey(new Date())} />
        </div>
      </main>
    </div>
  )
}
