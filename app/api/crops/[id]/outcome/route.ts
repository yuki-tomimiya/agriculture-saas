import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { parseCropOutcome } from '@/lib/crops/outcome'

async function ownedCrop(id: string, userId: string) {
  return prisma.crop.findFirst({
    where: { id, OR: [{ userId }, { farm: { userId } }] },
  })
}

export async function PUT(
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
    const crop = await ownedCrop(id, userId)
    if (!crop) {
      return NextResponse.json({ error: '作物が見つかりません' }, { status: 404 })
    }
    const body = await request.json()
    const parsed = parseCropOutcome(body)
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const outcome = await prisma.cropOutcome.upsert({
      where: { cropId: id },
      create: { cropId: id, ...parsed.value },
      update: parsed.value,
    })
    return NextResponse.json({ success: true, outcome: { id: outcome.id } })
  } catch (error) {
    console.error('Crop outcome save error:', error)
    return NextResponse.json({ error: '結果の保存に失敗しました' }, { status: 500 })
  }
}
