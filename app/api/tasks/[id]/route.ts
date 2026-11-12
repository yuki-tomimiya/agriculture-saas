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
    const existing = await prisma.task.findFirst({
      where: { id, farm: { userId } },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'タスクが見つかりません' }, { status: 404 })
    }
    await prisma.task.delete({ where: { id: existing.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Task delete error:', error)
    return NextResponse.json({ error: 'タスクの削除に失敗しました' }, { status: 500 })
  }
}
