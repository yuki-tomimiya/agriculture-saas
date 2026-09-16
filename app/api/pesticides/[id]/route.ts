import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

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

    const record = await prisma.pesticideRecord.findFirst({
      where: { id, userId },
      include: {
        crop: { include: { farm: true } },
        farm: true,
      },
    })
    if (!record) {
      return NextResponse.json({ error: '記録が見つかりません' }, { status: 404 })
    }
    return NextResponse.json({ record })
  } catch (error) {
    console.error('Pesticide get error:', error)
    return NextResponse.json(
      { error: '農薬記録の取得に失敗しました' },
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

    const existing = await prisma.pesticideRecord.findFirst({
      where: { id, userId },
    })
    if (!existing) {
      return NextResponse.json({ error: '記録が見つかりません' }, { status: 404 })
    }

    const body = await request.json()
    const appliedAtStr = body.appliedAt
    const productName = typeof body.productName === 'string' ? body.productName.trim() : undefined
    const amount = body.amount != null ? Number(body.amount) : undefined
    const amountUnit = typeof body.amountUnit === 'string' ? body.amountUnit.trim() || null : undefined
    const dilution = typeof body.dilution === 'string' ? body.dilution.trim() || null : undefined
    const applicationCount = body.applicationCount != null ? Number(body.applicationCount) : undefined
    const daysBeforeHarvest = body.daysBeforeHarvest != null ? Number(body.daysBeforeHarvest) : undefined
    const cropId = typeof body.cropId === 'string' ? body.cropId.trim() || null : undefined
    const farmId = typeof body.farmId === 'string' ? body.farmId.trim() || null : undefined
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : undefined

    if (productName !== undefined && !productName) {
      return NextResponse.json({ error: '農薬名を入力してください' }, { status: 400 })
    }
    let appliedAt: Date | undefined
    if (appliedAtStr !== undefined) {
      if (!appliedAtStr) {
        return NextResponse.json({ error: '散布日を入力してください' }, { status: 400 })
      }
      appliedAt = new Date(appliedAtStr)
      if (Number.isNaN(appliedAt.getTime())) {
        return NextResponse.json({ error: '散布日が不正です' }, { status: 400 })
      }
    }

    const record = await prisma.pesticideRecord.update({
      where: { id },
      data: {
        ...(appliedAt && { appliedAt }),
        ...(productName !== undefined && { productName: productName || existing.productName }),
        ...(amount !== undefined && { amount }),
        ...(amountUnit !== undefined && { amountUnit }),
        ...(dilution !== undefined && { dilution }),
        ...(applicationCount !== undefined && { applicationCount }),
        ...(daysBeforeHarvest !== undefined && { daysBeforeHarvest }),
        ...(cropId !== undefined && { cropId }),
        ...(farmId !== undefined && { farmId }),
        ...(notes !== undefined && { notes }),
      },
    })
    return NextResponse.json({ success: true, record: { id: record.id } })
  } catch (error) {
    console.error('Pesticide update error:', error)
    return NextResponse.json(
      { error: '農薬記録の更新に失敗しました' },
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

    const existing = await prisma.pesticideRecord.findFirst({
      where: { id, userId },
    })
    if (!existing) {
      return NextResponse.json({ error: '記録が見つかりません' }, { status: 404 })
    }

    await prisma.pesticideRecord.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Pesticide delete error:', error)
    return NextResponse.json(
      { error: '農薬記録の削除に失敗しました' },
      { status: 500 }
    )
  }
}
