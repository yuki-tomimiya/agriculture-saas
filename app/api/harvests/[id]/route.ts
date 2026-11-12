import { NextRequest, NextResponse } from 'next/server'
import { readUserIdCookie } from '@/lib/user-id-cookie'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await readUserIdCookie()
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }
    const { id } = await params
    const existing = await prisma.harvest.findFirst({
      where: {
        id,
        crop: { OR: [{ userId }, { farm: { userId } }] },
      },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: '収穫記録が見つかりません' }, { status: 404 })
    }
    await prisma.harvest.delete({ where: { id: existing.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Harvest delete error:', error)
    return NextResponse.json({ error: '収穫記録の削除に失敗しました' }, { status: 500 })
  }
}
