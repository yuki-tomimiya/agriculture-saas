import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { suggestPrefecture } from '@/lib/places/suggest'

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const userId = cookieStore.get('userId')?.value
  if (!userId) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }
  const latitude = Number(request.nextUrl.searchParams.get('latitude'))
  const longitude = Number(request.nextUrl.searchParams.get('longitude'))
  const suggestion = suggestPrefecture(latitude, longitude)
  return NextResponse.json({ suggestion })
}
