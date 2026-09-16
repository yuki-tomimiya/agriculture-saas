import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('userId')?.value

    if (!userId) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const farmId = typeof body.farmId === 'string' ? body.farmId.trim() : ''
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const cropId = typeof body.cropId === 'string' && body.cropId.trim() ? body.cropId.trim() : null
    const description = typeof body.description === 'string' ? body.description.trim() || null : null
    const dueDateStr = body.dueDate
    const priority = ['low', 'medium', 'high'].includes(body.priority) ? body.priority : 'medium'

    if (!farmId || !title) {
      return NextResponse.json(
        { error: '農場とタイトルは必須です' },
        { status: 400 }
      )
    }

    const farm = await prisma.farm.findFirst({
      where: { id: farmId, userId },
      include: { crops: true },
    })

    if (!farm) {
      return NextResponse.json(
        { error: '指定した農場が見つかりません' },
        { status: 400 }
      )
    }

    if (cropId) {
      const cropBelongsToFarm = farm.crops.some((c) => c.id === cropId)
      if (!cropBelongsToFarm) {
        return NextResponse.json(
          { error: '指定した作物がこの農場に属していません' },
          { status: 400 }
        )
      }
    }

    let dueDate: Date | null = null
    if (dueDateStr && typeof dueDateStr === 'string') {
      const d = new Date(dueDateStr)
      if (!Number.isNaN(d.getTime())) dueDate = d
    }

    const task = await prisma.task.create({
      data: {
        farmId,
        title,
        cropId,
        description,
        dueDate,
        priority,
        status: 'pending',
      },
    })

    return NextResponse.json({ success: true, task: { id: task.id, title: task.title } })
  } catch (error) {
    console.error('Task create error:', error)
    return NextResponse.json(
      { error: 'タスクの登録に失敗しました' },
      { status: 500 }
    )
  }
}
