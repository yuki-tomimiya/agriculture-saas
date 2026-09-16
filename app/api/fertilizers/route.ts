import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getFertilizerWhere } from '@/lib/queries'

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
    const { where } = getFertilizerWhere(userId, { cropId, farmId })

    const records = await prisma.fertilizerRecord.findMany({
      where,
      include: {
        crop: { include: { farm: true } },
        farm: true,
      },
      orderBy: { appliedAt: 'desc' },
    })
    return NextResponse.json({ records })
  } catch (error) {
    console.error('Fertilizer list error:', error)
    return NextResponse.json(
      { error: '肥料記録の取得に失敗しました' },
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
    const appliedAtStr = body.appliedAt
    const productName = typeof body.productName === 'string' ? body.productName.trim() : ''
    const amount = body.amount != null ? Number(body.amount) : null
    const amountUnit = typeof body.amountUnit === 'string' ? (body.amountUnit.trim() || 'kg') : 'kg'
    const componentInfo = typeof body.componentInfo === 'string' ? body.componentInfo.trim() || null : null
    const cropId = typeof body.cropId === 'string' ? body.cropId.trim() || null : null
    const farmId = typeof body.farmId === 'string' ? body.farmId.trim() || null : null
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null

    if (!productName) {
      return NextResponse.json({ error: '肥料名を入力してください' }, { status: 400 })
    }
    if (!appliedAtStr) {
      return NextResponse.json({ error: '施肥日を入力してください' }, { status: 400 })
    }
    const appliedAt = new Date(appliedAtStr)
    if (Number.isNaN(appliedAt.getTime())) {
      return NextResponse.json({ error: '施肥日が不正です' }, { status: 400 })
    }
    if (amount == null || Number.isNaN(amount) || amount < 0) {
      return NextResponse.json({ error: '使用量は0以上の数値を入力してください' }, { status: 400 })
    }

    if (cropId) {
      const crop = await prisma.crop.findFirst({
        where: {
          id: cropId,
          OR: [{ userId }, { farm: { userId } }],
        },
      })
      if (!crop) {
        return NextResponse.json({ error: '指定した作物が見つかりません' }, { status: 400 })
      }
    }
    if (farmId) {
      const farm = await prisma.farm.findFirst({
        where: { id: farmId, userId },
      })
      if (!farm) {
        return NextResponse.json({ error: '指定した農場が見つかりません' }, { status: 400 })
      }
    }

    const record = await prisma.fertilizerRecord.create({
      data: {
        userId,
        appliedAt,
        productName,
        amount,
        amountUnit: amountUnit || 'kg',
        componentInfo: componentInfo ?? undefined,
        cropId: cropId ?? undefined,
        farmId: farmId ?? undefined,
        notes: notes ?? undefined,
      },
    })
    return NextResponse.json({ success: true, record: { id: record.id } })
  } catch (error) {
    console.error('Fertilizer create error:', error)
    return NextResponse.json(
      { error: '肥料記録の登録に失敗しました' },
      { status: 500 }
    )
  }
}
