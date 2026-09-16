import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getPesticideWhere } from '@/lib/queries'

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
    const { where } = getPesticideWhere(userId, { cropId, farmId })

    const records = await prisma.pesticideRecord.findMany({
      where,
      include: {
        crop: { include: { farm: true } },
        farm: true,
      },
      orderBy: { appliedAt: 'desc' },
    })
    return NextResponse.json({ records })
  } catch (error) {
    console.error('Pesticide list error:', error)
    return NextResponse.json(
      { error: '農薬記録の取得に失敗しました' },
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
    const amountUnit = typeof body.amountUnit === 'string' ? body.amountUnit.trim() || null : null
    const dilution = typeof body.dilution === 'string' ? body.dilution.trim() || null : null
    const applicationCount = body.applicationCount != null ? Number(body.applicationCount) : null
    const daysBeforeHarvest = body.daysBeforeHarvest != null ? Number(body.daysBeforeHarvest) : null
    const cropId = typeof body.cropId === 'string' ? body.cropId.trim() || null : null
    const farmId = typeof body.farmId === 'string' ? body.farmId.trim() || null : null
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null

    if (!productName) {
      return NextResponse.json({ error: '農薬名を入力してください' }, { status: 400 })
    }
    if (!appliedAtStr) {
      return NextResponse.json({ error: '散布日を入力してください' }, { status: 400 })
    }
    const appliedAt = new Date(appliedAtStr)
    if (Number.isNaN(appliedAt.getTime())) {
      return NextResponse.json({ error: '散布日が不正です' }, { status: 400 })
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

    const record = await prisma.pesticideRecord.create({
      data: {
        userId,
        appliedAt,
        productName,
        amount: amount ?? undefined,
        amountUnit: amountUnit ?? undefined,
        dilution: dilution ?? undefined,
        applicationCount: applicationCount ?? undefined,
        daysBeforeHarvest: daysBeforeHarvest ?? undefined,
        cropId: cropId ?? undefined,
        farmId: farmId ?? undefined,
        notes: notes ?? undefined,
      },
    })
    return NextResponse.json({ success: true, record: { id: record.id } })
  } catch (error) {
    console.error('Pesticide create error:', error)
    return NextResponse.json(
      { error: '農薬記録の登録に失敗しました' },
      { status: 500 }
    )
  }
}
