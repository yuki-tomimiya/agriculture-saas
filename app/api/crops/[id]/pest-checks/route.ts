import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { japanDateKey } from '@/lib/pesticide-safety'
import { findPest } from '@/lib/pests/catalog'
import { loadPestAdvice, ownedPestCrop } from '@/lib/pests/service'

type Context = { params: Promise<{ id: string }> }
const error = (message: string, status: number) => NextResponse.json({ error: message }, { status })

function observedDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(value + 'T00:00:00+09:00')
  return Number.isFinite(+date) && japanDateKey(date) === value && value <= japanDateKey(new Date()) ? date : null
}

async function access({ params }: Context) {
  const user = await getCurrentUser()
  if (!user) return { failure: error('ログインが必要です', 401) }
  const crop = await ownedPestCrop(user.id, (await params).id)
  if (!crop) return { failure: error('作付けが見つかりません', 404) }
  return { user, crop }
}

export async function POST(request: NextRequest, context: Context) {
  const { failure, user, crop } = await access(context)
  if (failure) return failure
  const body = await request.json().catch(() => null)
  const pest = typeof body?.key === 'string' ? findPest(body.key) : undefined
  const observedAt = observedDate(body?.observedDay)
  if (!pest || pest.cropKind !== crop.cropKind || typeof body?.present !== 'boolean' || !observedAt ||
    (body.source === 'field' && crop.status !== 'growing')) {
    return error('病害虫・回答・見た日を確かめてください', 400)
  }
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) || null : null
  const advice = body.present ? await loadPestAdvice(user.id, crop, pest.key) : null
  const row = await prisma.pestCheck.create({
    data: { cropId: crop.id, pestKey: pest.key, present: body.present, observedAt, notes },
  })
  return NextResponse.json({ id: row.id, advice }, { status: 201 })
}

export async function GET(request: NextRequest, context: Context) {
  const { failure, user, crop } = await access(context)
  if (failure) return failure
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return error('記録を指定してください', 400)
  const row = await prisma.pestCheck.findFirst({ where: { id, cropId: crop.id, present: true } })
  if (!row) return error('記録が見つかりません', 404)
  return NextResponse.json({ advice: await loadPestAdvice(user.id, crop, row.pestKey) })
}

export async function PATCH(request: NextRequest, context: Context) {
  const { failure, crop } = await access(context)
  if (failure) return failure
  const body = await request.json().catch(() => null)
  const observedAt = observedDate(body?.observedDay)
  if (typeof body?.id !== 'string' || !observedAt) return error('見た日を確かめてください', 400)
  const result = await prisma.pestCheck.updateMany({ where: { id: body.id, cropId: crop.id }, data: { observedAt } })
  return result.count ? NextResponse.json({ ok: true }) : error('記録が見つかりません', 404)
}

export async function DELETE(request: NextRequest, context: Context) {
  const { failure, crop } = await access(context)
  if (failure) return failure
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return error('記録を指定してください', 400)
  const result = await prisma.pestCheck.deleteMany({ where: { id, cropId: crop.id } })
  return result.count ? NextResponse.json({ ok: true }) : error('記録が見つかりません', 404)
}
