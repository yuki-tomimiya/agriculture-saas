import { prisma } from '@/lib/prisma'

/** 「今はしない」のあと、この日数を過ぎた朝から再表示する */
export const PROPOSAL_DISMISS_DAYS = 7

export function proposalRemindAfter(from = new Date()): Date {
  const remind = new Date(from)
  remind.setHours(0, 0, 0, 0)
  remind.setDate(remind.getDate() + PROPOSAL_DISMISS_DAYS)
  return remind
}

export async function listActiveDismissals(userId: string, now = new Date()) {
  return prisma.proposalDismissal.findMany({
    where: { userId, remindAfter: { gt: now } },
    select: { trigger: true, cropId: true },
  })
}

export function isProposalDismissed(
  rows: { trigger: string; cropId: string | null }[],
  trigger: string | undefined,
  cropId?: string
): boolean {
  if (cropId) return rows.some((row) => row.cropId === cropId)
  if (!trigger) return false
  return rows.some((row) => row.trigger === trigger && (row.cropId ?? null) === null)
}
