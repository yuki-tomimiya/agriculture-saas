import { NextRequest, NextResponse } from 'next/server'
import { concernChoiceLabel, concernFollowUpResults } from '@/lib/crops/field-concerns'
import { concernError, fieldConcernAccess } from '@/lib/crops/field-concern-service'
import { forecastOffice } from '@/lib/pest-forecast'
import { prisma } from '@/lib/prisma'
import { concernFollowUpWindow } from '@/lib/proposals/concern-follow-up'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; concernId: string }> }) {
  const { id, concernId } = await params
  const { failure, userId, crop } = await fieldConcernAccess(id)
  if (failure) return failure
  const input = await request.json().catch(() => null)
  const result = input?.result
  if (typeof result !== 'string' || !concernChoiceLabel(concernFollowUpResults, result)) {
    return concernError('その後の様子を選んでください。', 400)
  }

  const now = new Date()
  const where = { id: concernId, cropId: crop.id, crop: { OR: [{ userId }, { farm: { userId } }] } }
  const updated = await prisma.fieldConcern.updateMany({
    where: { ...where, crop: { ...where.crop, status: 'growing' }, followUpResult: null, observedAt: concernFollowUpWindow(now) },
    data: { followUpResult: result, followedUpAt: now },
  })
  if (!updated.count) {
    const concern = await prisma.fieldConcern.findFirst({ where, select: { followUpResult: true } })
    if (!concern) return concernError('記録が見つかりません。', 404)
    return concernError(concern.followUpResult ? 'その後の様子は回答済みです。' : 'この記録は現在回答できません。', 409)
  }

  return NextResponse.json(result === 'spread'
    ? { consultation: { forecast: forecastOffice(crop.farm?.prefectureCode) } }
    : {})
}
