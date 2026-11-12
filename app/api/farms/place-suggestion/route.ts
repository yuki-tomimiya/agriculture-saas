import { NextRequest, NextResponse } from 'next/server'
import { readUserIdCookie } from '@/lib/user-id-cookie'
import { suggestPrefecture } from '@/lib/places/suggest'

export async function GET(request: NextRequest) {
  const userId = await readUserIdCookie()
  if (!userId) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }
  const latitude = Number(request.nextUrl.searchParams.get('latitude'))
  const longitude = Number(request.nextUrl.searchParams.get('longitude'))
  const suggestion = suggestPrefecture(latitude, longitude)
  return NextResponse.json({ suggestion })
}
