import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { isKnownMilestoneKey, parseMilestoneDate } from '@/lib/proposals/milestones'

async function ownedCrop(userId: string, id: string) {
  return prisma.crop.findFirst({
    where: { id, OR: [{ userId }, { farm: { userId } }] },
    select: { id: true, name: true, variety: true },
  })
}

function todayInputValue(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('userId')?.value
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const { id } = await params
    const crop = await ownedCrop(userId, id)
    if (!crop) {
      return NextResponse.json({ error: '作物が見つかりません' }, { status: 404 })
    }

    const body = await request.json()
    const key = typeof body.key === 'string' ? body.key.trim() : ''
    if (!isKnownMilestoneKey(crop.name, crop.variety, key)) {
      return NextResponse.json({ error: 'この作付けには、その節目はありません' }, { status: 400 })
    }
    const source = body.source === 'answered' ? 'answered' : body.source === 'manual' ? 'manual' : null
    if (!source) {
      return NextResponse.json({ error: '記録の出どころが不正です' }, { status: 400 })
    }

    const rawDate = typeof body.observedAt === 'string' && body.observedAt.trim() ? body.observedAt.trim() : todayInputValue()
    const observedAt = parseMilestoneDate(rawDate)
    if (!observedAt) {
      return NextResponse.json({ error: '日付が不正です' }, { status: 400 })
    }
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)
    if (observedAt.getTime() > endOfToday.getTime()) {
      return NextResponse.json({ error: '今日より先の日付は記録できません' }, { status: 400 })
    }

    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) : null
    const saved = await prisma.cropMilestone.upsert({
      where: { cropId_key: { cropId: crop.id, key } },
      create: { cropId: crop.id, key, observedAt, source, notes: notes || null },
      update: { observedAt, source, notes: notes || null },
    })

    return NextResponse.json({ ok: true, id: saved.id, observedAt: saved.observedAt.toISOString() })
  } catch (error) {
    console.error('Milestone save error:', error)
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('userId')?.value
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const { id } = await params
    const crop = await ownedCrop(userId, id)
    if (!crop) {
      return NextResponse.json({ error: '作物が見つかりません' }, { status: 404 })
    }

    const key = request.nextUrl.searchParams.get('key')?.trim() ?? ''
    if (!key) {
      return NextResponse.json({ error: '節目が指定されていません' }, { status: 400 })
    }

    await prisma.cropMilestone.deleteMany({ where: { cropId: crop.id, key } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Milestone delete error:', error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
