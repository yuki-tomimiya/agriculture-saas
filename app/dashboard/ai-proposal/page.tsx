import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { loadTodayConfirmations } from '@/lib/proposals/presentation'
import { loadProposalRecordGuidance } from '@/lib/proposals/record-guidance'
import MorningProposals, { guidanceProposals } from './MorningProposals'

export default async function AiProposalPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const [data, farms, growingCount] = await Promise.all([
    loadTodayConfirmations(user.id),
    prisma.farm.findMany({ where: { userId: user.id }, select: { id: true }, take: 2 }),
    prisma.crop.count({ where: { OR: [{ userId: user.id }, { farm: { userId: user.id } }], status: 'growing' } }),
  ])
  const guidance = await loadProposalRecordGuidance(user.id, guidanceProposals(data))
  return <MorningProposals data={data} guidance={guidance} emptyState={{ farms, hasGrowingCrops: growingCount > 0 }} />
}
