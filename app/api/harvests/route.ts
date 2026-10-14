import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { parseHarvestBody } from '@/lib/crops/harvest'

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
    const cropId = typeof body.cropId === 'string' ? body.cropId.trim() : ''
    const dateStr = body.date
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null
    const parsed = parseHarvestBody(body)
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    if (!cropId) {
      return NextResponse.json(
        { error: '作物を選択してください' },
        { status: 400 }
      )
    }

    const crop = await prisma.crop.findFirst({
      where: {
        id: cropId,
        OR: [
          { userId },
          { farm: { userId } },
        ],
      },
    })

    if (!crop) {
      return NextResponse.json(
        { error: '指定した作物が見つかりません' },
        { status: 400 }
      )
    }

    if (dateStr === undefined || dateStr === null || dateStr === '') {
      return NextResponse.json(
        { error: '日付は必須です' },
        { status: 400 }
      )
    }

    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json(
        { error: '日付が不正です' },
        { status: 400 }
      )
    }

    const harvest = await prisma.harvest.create({
      data: {
        cropId,
        date,
        quantity: parsed.value.quantityKg,
        unit: 'kg',
        countQuantity: parsed.value.countQuantity,
        countUnit: parsed.value.countUnit,
        notes,
      },
    })

    return NextResponse.json({ success: true, harvest: { id: harvest.id } })
  } catch (error) {
    console.error('Harvest create error:', error)
    return NextResponse.json(
      { error: '収穫の登録に失敗しました' },
      { status: 500 }
    )
  }
}
