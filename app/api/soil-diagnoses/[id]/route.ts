import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { readFile } from 'fs/promises'
import { prisma } from '@/lib/prisma'
import { removeSoilPhoto, soilPhotoAbsolutePath, soilPhotoContentType } from '@/lib/soil-diagnosis'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const cookieStore = await cookies()
  const userId = cookieStore.get('userId')?.value
  if (!userId) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }
  const { id } = await context.params
  const record = await prisma.soilDiagnosis.findFirst({ where: { id, userId } })
  if (!record?.photoPath) {
    return NextResponse.json({ error: '写真がありません' }, { status: 404 })
  }
  const file = soilPhotoAbsolutePath(record.photoPath)
  if (!file) {
    return NextResponse.json({ error: '写真がありません' }, { status: 404 })
  }
  try {
    const bytes = await readFile(file)
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': soilPhotoContentType(record.photoPath),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: '写真を読めませんでした' }, { status: 404 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const cookieStore = await cookies()
  const userId = cookieStore.get('userId')?.value
  if (!userId) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }
  const { id } = await context.params
  const record = await prisma.soilDiagnosis.findFirst({ where: { id, userId } })
  if (!record) {
    return NextResponse.json({ error: '記録が見つかりません' }, { status: 404 })
  }
  await prisma.soilDiagnosis.delete({ where: { id: record.id } })
  await removeSoilPhoto(record.photoPath)
  return NextResponse.json({ ok: true })
}
