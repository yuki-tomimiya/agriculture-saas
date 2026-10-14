import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { resolveBaseTemperature } from '@/lib/benchmarks/base-temperature'
import { cropKindByKey, parseCropConditions } from '@/lib/crops/conditions'

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
    const farmId = typeof body.farmId === 'string' ? body.farmId.trim() || null : null
    if (!farmId) {
      return NextResponse.json({ error: '農場を選んでください' }, { status: 400 })
    }
    const variety = typeof body.variety === 'string' ? body.variety.trim() || null : null
    const plantingDateStr = body.plantingDate
    const harvestDateStr = body.harvestDate

    let farmHasFields = false
    let farmFields: { id: string }[] = []
    if (farmId) {
      const farm = await prisma.farm.findFirst({
        where: { id: farmId, userId },
        include: { fields: true },
      })
      if (!farm) {
        return NextResponse.json({ error: '指定した農場が見つかりません' }, { status: 400 })
      }
      farmHasFields = farm.fields.length > 0
      farmFields = farm.fields
    }

    const parsed = parseCropConditions(body, { farmHasFields })
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const conditions = parsed.value
    if (conditions.fieldId && !farmFields.some((field) => field.id === conditions.fieldId)) {
      return NextResponse.json({ error: '指定した圃場がこの農場に属していません' }, { status: 400 })
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

    const kind = cropKindByKey(conditions.cropKind)
    const baseTemperature = resolveBaseTemperature(
      body.baseTemperature,
      kind?.benchmarkName ?? conditions.name,
      variety
    )
    if (typeof baseTemperature === 'object') {
      return NextResponse.json({ error: baseTemperature.error }, { status: 400 })
    }

    const crop = await prisma.crop.create({
      data: {
        name: conditions.name,
        cropKind: conditions.cropKind,
        growingSite: conditions.growingSite,
        covers: conditions.covers,
        heating: conditions.heating,
        plantingMethod: conditions.plantingMethod,
        plantCount: conditions.plantCount,
        areaM2: conditions.areaM2,
        fieldUndivided: conditions.fieldUndivided,
        ...(farmId ? { farmId } : { userId }),
        variety,
        plantingDate,
        harvestDate,
        fieldId: conditions.fieldId,
        baseTemperature,
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
