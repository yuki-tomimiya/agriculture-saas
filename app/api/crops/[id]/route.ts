import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { resolveBaseTemperature } from '@/lib/benchmarks/base-temperature'

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
    const name = typeof body.name === 'string' ? body.name.trim() : undefined
    const farmId = body.farmId === null || body.farmId === '' ? null : typeof body.farmId === 'string' ? body.farmId.trim() || null : undefined
    const variety = body.variety === null || body.variety === '' ? null : typeof body.variety === 'string' ? body.variety.trim() || null : undefined
    const plantingDateStr = body.plantingDate
    const harvestDateStr = body.harvestDate
    const fieldId = body.fieldId === null || body.fieldId === '' ? null : typeof body.fieldId === 'string' && body.fieldId.trim() ? body.fieldId.trim() : undefined
    const status = typeof body.status === 'string' && ['growing', 'harvested', 'completed'].includes(body.status) ? body.status : undefined

    if (name !== undefined && !name) {
      return NextResponse.json(
        { error: '作物名は必須です' },
        { status: 400 }
      )
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

    let validatedFieldId: string | null | undefined = undefined

    if (farmId !== undefined) {
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
        const rawFieldId = fieldId !== undefined ? fieldId : existing.fieldId
        if (rawFieldId) {
          const ok = farm.fields.some((f) => f.id === rawFieldId)
          if (!ok) {
            return NextResponse.json(
              { error: '指定した圃場がこの農場に属していません' },
              { status: 400 }
            )
          }
          validatedFieldId = rawFieldId
        } else {
          validatedFieldId = null
        }
      } else {
        validatedFieldId = null
      }
    } else if (fieldId !== undefined && existing.farmId) {
      const farm = await prisma.farm.findFirst({
        where: { id: existing.farmId, userId },
        include: { fields: true },
      })
      if (farm && (!fieldId || farm.fields.some((f) => f.id === fieldId))) {
        validatedFieldId = fieldId || null
      }
    }

    const updateData: Parameters<typeof prisma.crop.update>[0]['data'] = {}
    if (name !== undefined) updateData.name = name
    if (variety !== undefined) updateData.variety = variety
    if (plantingDate !== undefined) updateData.plantingDate = plantingDate
    if (harvestDate !== undefined) updateData.harvestDate = harvestDate
    if (status !== undefined) updateData.status = status
    if (farmId !== undefined) {
      updateData.farmId = farmId
      updateData.userId = farmId ? null : userId
    }
    if (validatedFieldId !== undefined) updateData.fieldId = validatedFieldId
    if ('baseTemperature' in body) {
      const baseTemperature = resolveBaseTemperature(
        body.baseTemperature,
        name ?? existing.name,
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
