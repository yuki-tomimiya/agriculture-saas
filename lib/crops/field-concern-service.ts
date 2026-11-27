import { NextResponse } from 'next/server'
import { ownedPestCrop } from '@/lib/pests/service'
import { readUserIdCookie } from '@/lib/user-id-cookie'

export const concernError = (message: string, status: number) => NextResponse.json({ error: message }, { status })

export async function fieldConcernAccess(cropId: string) {
  const userId = await readUserIdCookie()
  if (!userId) return { failure: concernError('ログインが必要です', 401) }
  const crop = await ownedPestCrop(userId, cropId)
  if (!crop) return { failure: concernError('作付けが見つかりません', 404) }
  return { userId, crop }
}
