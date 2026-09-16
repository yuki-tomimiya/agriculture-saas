import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { isWorkTaskType } from '@/lib/work-records'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('userId')?.value
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }
    const { id } = await params

    const record = await prisma.workRecord.findFirst({
      where: { id, farm: { userId } },
      include: {
        crop: true,
        farm: true,
        task: true,
      },
    })
    if (!record) {
      return NextResponse.json({ error: '記録が見つかりません' }, { status: 404 })
    }
    return NextResponse.json({ record })
  } catch (error) {
    console.error('Work record get error:', error)
    return NextResponse.json(
      { error: '作業記録の取得に失敗しました' },
      { status: 500 }
    )
  }
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

    const existing = await prisma.workRecord.findFirst({
      where: { id, farm: { userId } },
    })
    if (!existing) {
      return NextResponse.json({ error: '記録が見つかりません' }, { status: 404 })
    }

    const body = await request.json()
    const dateStr = body.date
    const farmId = typeof body.farmId === 'string' ? body.farmId.trim() : undefined
    const taskType = typeof body.taskType === 'string' ? body.taskType.trim() : undefined
    const description =
      typeof body.description === 'string' ? body.description.trim() || null : undefined
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : undefined
    const cropId = typeof body.cropId === 'string' ? body.cropId.trim() || null : undefined
    const taskId = typeof body.taskId === 'string' ? body.taskId.trim() || null : undefined

    if (taskType !== undefined && (!taskType || !isWorkTaskType(taskType))) {
      return NextResponse.json({ error: '作業種別を選択してください' }, { status: 400 })
    }

    let date: Date | undefined
    if (dateStr !== undefined) {
      if (!dateStr) {
        return NextResponse.json({ error: '作業日を入力してください' }, { status: 400 })
      }
      date = new Date(dateStr)
      if (Number.isNaN(date.getTime())) {
        return NextResponse.json({ error: '作業日が不正です' }, { status: 400 })
      }
    }

    const targetFarmId = farmId ?? existing.farmId
    const farm = await prisma.farm.findFirst({
      where: { id: targetFarmId, userId },
      include: { crops: true },
    })
    if (!farm) {
      return NextResponse.json({ error: '指定した農場が見つかりません' }, { status: 400 })
    }

    if (cropId !== undefined && cropId) {
      const cropBelongsToFarm = farm.crops.some((c) => c.id === cropId)
      if (!cropBelongsToFarm) {
        return NextResponse.json(
          { error: '指定した作物がこの農場に属していません' },
          { status: 400 }
        )
      }
    }

    if (taskId !== undefined && taskId) {
      const task = await prisma.task.findFirst({
        where: { id: taskId, farmId: targetFarmId, farm: { userId } },
      })
      if (!task) {
        return NextResponse.json({ error: '指定したタスクが見つかりません' }, { status: 400 })
      }
    }

    const record = await prisma.workRecord.update({
      where: { id },
      data: {
        ...(date && { date }),
        ...(farmId !== undefined && { farmId }),
        ...(taskType !== undefined && { taskType }),
        ...(description !== undefined && { description }),
        ...(notes !== undefined && { notes }),
        ...(cropId !== undefined && { cropId }),
        ...(taskId !== undefined && { taskId }),
      },
    })
    return NextResponse.json({ success: true, record: { id: record.id } })
  } catch (error) {
    console.error('Work record update error:', error)
    return NextResponse.json(
      { error: '作業記録の更新に失敗しました' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('userId')?.value
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }
    const { id } = await params

    const existing = await prisma.workRecord.findFirst({
      where: { id, farm: { userId } },
    })
    if (!existing) {
      return NextResponse.json({ error: '記録が見つかりません' }, { status: 404 })
    }

    await prisma.workRecord.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Work record delete error:', error)
    return NextResponse.json(
      { error: '作業記録の削除に失敗しました' },
      { status: 500 }
    )
  }
}
