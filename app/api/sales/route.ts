import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('userId')?.value

    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const body = await request.json()
    const dateStr = body.date
    const cropId = typeof body.cropId === 'string' ? body.cropId.trim() || null : null
    const farmId = typeof body.farmId === 'string' ? body.farmId.trim() || null : null
    const quantity = body.quantity != null ? Number(body.quantity) : NaN
    const unit = typeof body.unit === 'string' ? body.unit.trim() || 'kg' : 'kg'
    const unitPrice = body.unitPrice != null ? Number(body.unitPrice) : NaN
    const amount =
      body.amount != null && !Number.isNaN(Number(body.amount))
        ? Number(body.amount)
        : !Number.isNaN(quantity) && !Number.isNaN(unitPrice)
        ? Math.round(quantity * unitPrice)
        : NaN
    const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : ''
    const channel = typeof body.channel === 'string' ? body.channel.trim() || null : null
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null

    if (!dateStr) {
      return NextResponse.json({ error: '日付は必須です' }, { status: 400 })
    }
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: '日付が不正です' }, { status: 400 })
    }

    if (Number.isNaN(quantity) || quantity < 0) {
      return NextResponse.json({ error: '数量は0以上の数値を入力してください' }, { status: 400 })
    }
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      return NextResponse.json({ error: '単価は0以上の数値を入力してください' }, { status: 400 })
    }
    if (Number.isNaN(amount) || amount < 0) {
      return NextResponse.json({ error: '売上金額が計算できませんでした' }, { status: 400 })
    }
    if (!customerName) {
      return NextResponse.json({ error: '販売先を入力してください' }, { status: 400 })
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

    const sale = await prisma.sale.create({
      data: {
        userId,
        date,
        cropId: cropId ?? undefined,
        farmId: farmId ?? undefined,
        quantity,
        unit,
        unitPrice,
        amount,
        customerName,
        channel: channel ?? undefined,
        notes: notes ?? undefined,
      },
    })

    return NextResponse.json({ success: true, sale: { id: sale.id } })
  } catch (error) {
    console.error('Sale create error:', error)
    return NextResponse.json({ error: '売上の登録に失敗しました' }, { status: 500 })
  }
}

