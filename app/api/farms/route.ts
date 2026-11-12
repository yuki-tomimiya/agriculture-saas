import { NextRequest, NextResponse } from 'next/server'
import { readUserIdCookie } from '@/lib/user-id-cookie'
import type { Farm } from '@prisma/client'
import { parseFarmInput } from '@/lib/farms/input'
import { farmSoilService } from '@/lib/farm-soil'

export async function POST(request: NextRequest) {
  try {
    const userId = await readUserIdCookie()

    if (!userId) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      )
    }

    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: '入力が不正です' }, { status: 400 })
    const data = parseFarmInput(body)
    if ('error' in data) return NextResponse.json({ error: data.error }, { status: 400 })
    const farm = await farmSoilService.create(userId, data as Pick<Farm, 'name' | 'description' | 'latitude' | 'longitude' | 'prefectureCode' | 'municipalityCode'>)

    return NextResponse.json({ success: true, farm: { id: farm.id, name: farm.name } })
  } catch (error) {
    console.error('Farm create error:', error)
    return NextResponse.json(
      { error: '農場の登録に失敗しました' },
      { status: 500 }
    )
  }
}
