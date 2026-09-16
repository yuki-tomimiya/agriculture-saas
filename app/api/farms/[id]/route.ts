import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

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
    const existing = await prisma.farm.findFirst({
      where: { id, userId },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: '農場が見つかりません' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const description =
      body.description == null
        ? null
        : typeof body.description === 'string'
          ? body.description.trim() || null
          : null
    const latitude = body.latitude != null && body.latitude !== '' ? Number(body.latitude) : null
    const longitude = body.longitude != null && body.longitude !== '' ? Number(body.longitude) : null

    if (!name) {
      return NextResponse.json(
        { error: '農場名は必須です' },
        { status: 400 }
      )
    }

    const farm = await prisma.farm.update({
      where: { id },
      data: {
        name,
        description,
        latitude: latitude != null && !Number.isNaN(latitude) ? latitude : null,
        longitude: longitude != null && !Number.isNaN(longitude) ? longitude : null,
      },
    })

    return NextResponse.json({
      success: true,
      farm: { id: farm.id, name: farm.name },
    })
  } catch (error) {
    console.error('Farm update error:', error)
    return NextResponse.json(
      { error: '農場の更新に失敗しました' },
      { status: 500 }
    )
  }
}

