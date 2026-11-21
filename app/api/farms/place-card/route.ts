import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { readFarmCoordinates, isWithinJapanBounds, JAPAN_LOCATION_ERROR } from '@/lib/farms/coordinates'
import { buildFarmPlaceCard } from '@/lib/farms/place-card'

export async function POST(request: Request) {
  if (!await getCurrentUser()) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }
  const input: unknown = await request.json().catch(() => null)
  const point = input && typeof input === 'object' && 'latitude' in input && 'longitude' in input
    ? readFarmCoordinates(input.latitude, input.longitude)
    : null
  if (!point) return NextResponse.json({ error: '緯度・経度を正しく入力してください' }, { status: 400 })
  if (!isWithinJapanBounds(point)) return NextResponse.json({ error: JAPAN_LOCATION_ERROR }, { status: 400 })
  const retryWeather = typeof input === 'object' && input != null && 'retryWeather' in input && input.retryWeather === true
  const card = await buildFarmPlaceCard(point, { retryWeather })
  return NextResponse.json(card, { headers: { 'Cache-Control': 'private, no-store' } })
}
