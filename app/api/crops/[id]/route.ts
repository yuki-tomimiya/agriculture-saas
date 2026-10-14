import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { resolveBaseTemperature } from '@/lib/benchmarks/base-temperature'
import { cropKindByKey, parseCropConditions } from '@/lib/crops/conditions'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('userId')?.value

    if (!userId) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      )
    }

    const { id } = await params
    const existing = await prisma.crop.findFirst({
      where: {
        id,
        OR: [
          { userId },
          { farm: { userId } },
        ],
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: '作物が見つかりません' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const farmId = body.farmId === null || body.farmId === '' ? null : typeof body.farmId === 'string' ? body.farmId.trim() || null : undefined
    const variety = body.variety === null || body.variety === '' ? null : typeof body.variety === 'string' ? body.variety.trim() || null : undefined
    const plantingDateStr = body.plantingDate
    const harvestDateStr = body.harvestDate
    const status = typeof body.status === 'string' && ['growing', 'harvested', 'completed'].includes(body.status) ? body.status : undefined
    const nextFarmId = farmId === undefined ? existing.farmId : farmId
    const editingConditions = typeof body.cropKind === 'string'

    let farmHasFields = false
    let farmFields: { id: string }[] = []
    if (editingConditions && nextFarmId) {
      const farm = await prisma.farm.findFirst({
        where: { id: nextFarmId, userId },
        include: { fields: true },
      })
      if (!farm) {
        return NextResponse.json({ error: '指定した農場が見つかりません' }, { status: 400 })
      }
      farmHasFields = farm.fields.length > 0
      farmFields = farm.fields
    }

    const parsed = editingConditions ? parseCropConditions(body, { farmHasFields }) : null
    if (parsed && 'error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const conditions = parsed && 'value' in parsed ? parsed.value : null
    if (conditions?.fieldId && !farmFields.some((field) => field.id === conditions.fieldId)) {
      return NextResponse.json({ error: '指定した圃場がこの農場に属していません' }, { status: 400 })
    }

    let plantingDate: Date | null | undefined = undefined
    let harvestDate: Date | null | undefined = undefined
    if (plantingDateStr !== undefined) {
      if (plantingDateStr === null || plantingDateStr === '') plantingDate = null
      else if (typeof plantingDateStr === 'string') {
        const d = new Date(plantingDateStr)
        plantingDate = Number.isNaN(d.getTime()) ? null : d
      }
    }
    if (harvestDateStr !== undefined) {
      if (harvestDateStr === null || harvestDateStr === '') harvestDate = null
      else if (typeof harvestDateStr === 'string') {
        const d = new Date(harvestDateStr)
        harvestDate = Number.isNaN(d.getTime()) ? null : d
      }
    }

    const updateData: Parameters<typeof prisma.crop.update>[0]['data'] = {}
    if (conditions) {
      updateData.name = conditions.name
      updateData.cropKind = conditions.cropKind
      updateData.growingSite = conditions.growingSite
      updateData.covers = conditions.covers
      updateData.heating = conditions.heating
      updateData.plantingMethod = conditions.plantingMethod
      updateData.plantCount = conditions.plantCount
      updateData.areaM2 = conditions.areaM2
      updateData.fieldId = conditions.fieldId
      updateData.fieldUndivided = conditions.fieldUndivided
    } else if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (!name) {
        return NextResponse.json({ error: '作物名は必須です' }, { status: 400 })
      }
      updateData.name = name
    }
    if (variety !== undefined) updateData.variety = variety
    if (plantingDate !== undefined) updateData.plantingDate = plantingDate
    if (harvestDate !== undefined) updateData.harvestDate = harvestDate
    if (status !== undefined) updateData.status = status
    if (farmId !== undefined) {
      updateData.farmId = farmId
      updateData.userId = farmId ? null : userId
    }
    if ('baseTemperature' in body) {
      const kind = cropKindByKey(conditions?.cropKind ?? existing.cropKind)
      const baseTemperature = resolveBaseTemperature(
        body.baseTemperature,
        kind?.benchmarkName ?? conditions?.name ?? existing.name,
        variety === undefined ? existing.variety : variety
      )
      if (typeof baseTemperature === 'object') {
        return NextResponse.json({ error: baseTemperature.error }, { status: 400 })
      }
      updateData.baseTemperature = baseTemperature
    }

    const crop = await prisma.crop.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, crop: { id: crop.id, name: crop.name } })
  } catch (error) {
    console.error('Crop update error:', error)
    return NextResponse.json(
      { error: '作物の更新に失敗しました' },
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
    const existing = await prisma.crop.findFirst({
      where: {
        id,
        OR: [{ userId }, { farm: { userId } }],
      },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: '作物が見つかりません' }, { status: 404 })
    }
    await prisma.crop.delete({ where: { id: existing.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Crop delete error:', error)
    return NextResponse.json({ error: '作物の削除に失敗しました' }, { status: 500 })
  }
}
