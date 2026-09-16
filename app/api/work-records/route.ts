import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getWorkRecordWhere } from '@/lib/queries'
import { isWorkTaskType } from '@/lib/work-records'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('userId')?.value
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const cropId = searchParams.get('cropId') ?? undefined
    const farmId = searchParams.get('farmId') ?? undefined
    const { where } = getWorkRecordWhere(userId, { cropId, farmId })

    const records = await prisma.workRecord.findMany({
      where,
      include: {
        crop: true,
        farm: true,
        task: true,
      },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json({ records })
  } catch (error) {
    console.error('Work record list error:', error)
    return NextResponse.json(
      { error: '作業記録の取得に失敗しました' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('userId')?.value
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const body = await request.json()
    const dateStr = body.date
    const farmId = typeof body.farmId === 'string' ? body.farmId.trim() : ''
    const taskType = typeof body.taskType === 'string' ? body.taskType.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() || null : null
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null
    const cropId = typeof body.cropId === 'string' ? body.cropId.trim() || null : null
    const taskId = typeof body.taskId === 'string' ? body.taskId.trim() || null : null

    if (!farmId) {
      return NextResponse.json({ error: '農場を選択してください' }, { status: 400 })
    }
    if (!taskType || !isWorkTaskType(taskType)) {
      return NextResponse.json({ error: '作業種別を選択してください' }, { status: 400 })
    }
    if (!dateStr) {
      return NextResponse.json({ error: '作業日を入力してください' }, { status: 400 })
    }
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: '作業日が不正です' }, { status: 400 })
    }

    const farm = await prisma.farm.findFirst({
      where: { id: farmId, userId },
      include: { crops: true },
    })
    if (!farm) {
      return NextResponse.json({ error: '指定した農場が見つかりません' }, { status: 400 })
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

    if (taskId) {
      const task = await prisma.task.findFirst({
        where: { id: taskId, farmId, farm: { userId } },
      })
      if (!task) {
        return NextResponse.json({ error: '指定したタスクが見つかりません' }, { status: 400 })
      }
    }

    const record = await prisma.workRecord.create({
      data: {
        farmId,
        cropId: cropId ?? undefined,
        taskId: taskId ?? undefined,
        date,
        taskType,
        description: description ?? undefined,
        notes: notes ?? undefined,
      },
    })
    return NextResponse.json({ success: true, record: { id: record.id } })
  } catch (error) {
    console.error('Work record create error:', error)
    return NextResponse.json(
      { error: '作業記録の登録に失敗しました' },
      { status: 500 }
    )
  }
}
