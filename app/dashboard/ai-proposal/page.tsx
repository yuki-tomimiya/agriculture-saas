import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { loadTodayConfirmations } from '@/lib/proposals/presentation'
import { loadProposalRecordGuidance } from '@/lib/proposals/record-guidance'
import MorningProposals, { guidanceProposals } from './MorningProposals'

export default async function AiProposalPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const data = await loadTodayConfirmations(user.id)
  const guidance = await loadProposalRecordGuidance(user.id, guidanceProposals(data))
  return <MorningProposals data={data} guidance={guidance} />
}
