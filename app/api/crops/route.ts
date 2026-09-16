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
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const farmId = typeof body.farmId === 'string' ? body.farmId.trim() || null : null
    const variety = typeof body.variety === 'string' ? body.variety.trim() || null : null
    const plantingDateStr = body.plantingDate
    const harvestDateStr = body.harvestDate
    const fieldId = typeof body.fieldId === 'string' && body.fieldId.trim() ? body.fieldId.trim() : null

    if (!name) {
      return NextResponse.json(
        { error: '作物名は必須です' },
        { status: 400 }
      )
    }

    let plantingDate: Date | null = null
    let harvestDate: Date | null = null
    if (plantingDateStr && typeof plantingDateStr === 'string') {
      const d = new Date(plantingDateStr)
      if (!Number.isNaN(d.getTime())) plantingDate = d
    }
    if (harvestDateStr && typeof harvestDateStr === 'string') {
      const d = new Date(harvestDateStr)
      if (!Number.isNaN(d.getTime())) harvestDate = d
    }

    let validatedFieldId: string | null = null
    if (farmId) {
      const farm = await prisma.farm.findFirst({
        where: { id: farmId, userId },
        include: { fields: true },
      })
      if (!farm) {
        return NextResponse.json(
          { error: '指定した農場が見つかりません' },
          { status: 400 }
        )
      }
      if (fieldId) {
        const fieldBelongsToFarm = farm.fields.some((f) => f.id === fieldId)
        if (!fieldBelongsToFarm) {
          return NextResponse.json(
            { error: '指定した圃場がこの農場に属していません' },
            { status: 400 }
          )
        }
        validatedFieldId = fieldId
      }
    }

    const crop = await prisma.crop.create({
      data: {
        name,
        ...(farmId ? { farmId } : { userId }),
        variety,
        plantingDate,
        harvestDate,
        fieldId: validatedFieldId,
        status: 'growing',
      },
    })

    return NextResponse.json({ success: true, crop: { id: crop.id, name: crop.name } })
  } catch (error) {
    console.error('Crop create error:', error)
    return NextResponse.json(
      { error: '作物の登録に失敗しました' },
      { status: 500 }
    )
  }
}
