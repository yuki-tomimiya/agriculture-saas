import { NextRequest, NextResponse } from 'next/server'
import { removeFieldConcernPhoto } from '@/lib/crops/field-concern-photos'
import { concernError, fieldConcernAccess } from '@/lib/crops/field-concern-service'
import { fieldObservationPests } from '@/lib/pests/field-observations'
import { loadPestAdvice } from '@/lib/pests/service'
import { prisma } from '@/lib/prisma'

type Context = { params: Promise<{ id: string; concernId: string }> }

export async function PATCH(request: NextRequest, { params }: Context) {
  const { id, concernId } = await params
  const { failure, userId, crop } = await fieldConcernAccess(id)
  if (failure) return failure
  const input = await request.json().catch(() => null)
  const candidate = fieldObservationPests(crop).find(item => item.key === input?.key)
  if (!candidate) return concernError('この作付けの候補から選んでください。', 400)

  const where = { id: concernId, cropId: crop.id }
  const result = await prisma.$transaction(async tx => {
    const claimed = await tx.fieldConcern.updateMany({
      where: { ...where, selectedPestKey: null },
      data: { selectedPestKey: candidate.key },
    })
    const concern = await tx.fieldConcern.findFirst({ where, select: { observedAt: true, selectedPestKey: true } })
    if (!concern) return 'missing'
    if (concern.selectedPestKey !== candidate.key) return 'already-selected'
    if (claimed.count) await tx.pestCheck.create({
      data: { cropId: crop.id, pestKey: candidate.key, observedAt: concern.observedAt, present: true },
    })
    return 'saved'
  })
  if (result === 'missing') return concernError('記録が見つかりません。', 404)
  if (result === 'already-selected') return concernError('近いものは選択済みです。', 409)
  return NextResponse.json({ advice: await loadPestAdvice(userId, crop, candidate.key) })
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { id, concernId } = await params
  const { failure, crop } = await fieldConcernAccess(id)
  if (failure) return failure
  const concern = await prisma.$transaction(async tx => {
    const row = await tx.fieldConcern.findFirst({ where: { id: concernId, cropId: crop.id }, select: { photoName: true } })
    if (row) await tx.fieldConcern.delete({ where: { id: concernId } })
    return row
  })
  if (!concern) return concernError('記録が見つかりません。', 404)
  await removeFieldConcernPhoto(concern.photoName)
  return NextResponse.json({ ok: true })
}
