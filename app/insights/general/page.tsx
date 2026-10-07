import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

/** 月次ヒントは出典が付くまで出さない。ブックマークは振り返りの入口へ戻す。 */
export default async function InsightsGeneralPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')
  redirect('/insights')
}
