import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { proposalRemindAfter } from '@/lib/proposals/dismissal'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('userId')?.value
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const body = await request.json()
    const trigger = typeof body.trigger === 'string' ? body.trigger.trim() : ''
    const singleId = typeof body.cropId === 'string' && body.cropId.trim() ? body.cropId.trim() : null
    const cropIds = Array.isArray(body.cropIds)
      ? body.cropIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0).map((id: string) => id.trim())
      : singleId
        ? [singleId]
        : []
    if (!trigger || trigger.length > 80) {
      return NextResponse.json({ error: '提案の種類が不正です' }, { status: 400 })
    }

    if (cropIds.length > 0) {
      const owned = await prisma.crop.findMany({
        where: { id: { in: cropIds }, OR: [{ userId }, { farm: { userId } }] },
        select: { id: true },
      })
      if (owned.length !== new Set(cropIds).size) {
        return NextResponse.json({ error: '指定した作物が見つかりません' }, { status: 400 })
      }
    }

    const remindAfter = proposalRemindAfter()
    const targets = cropIds.length > 0 ? cropIds : [null]
    for (const cropId of targets) {
      const existing = cropId
        ? await prisma.proposalDismissal.findFirst({ where: { userId, cropId } })
        : await prisma.proposalDismissal.findFirst({ where: { userId, trigger, cropId: null } })
      if (existing) {
        await prisma.proposalDismissal.update({
          where: { id: existing.id },
          data: { trigger, dismissedAt: new Date(), remindAfter },
        })
      } else {
        await prisma.proposalDismissal.create({
          data: { userId, trigger, cropId, remindAfter },
        })
      }
    }

    return NextResponse.json({ ok: true, remindAfter: remindAfter.toISOString() })
  } catch (error) {
    console.error('Proposal dismiss error:', error)
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
  }
}
