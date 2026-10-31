import { prisma } from '@/lib/prisma'
import { weatherLocation } from '@/lib/open-meteo/archive'
import { openMeteoUrl } from '@/lib/open-meteo/url'

const inflight = new Map<string, Promise<number | null>>()
const retryAfter = new Map<string, number>()

/** 座標を変えるまで使える標高。失敗やnullはDBに保存しない。 */
export async function farmElevationM(lat: number, lon: number): Promise<number | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const location = weatherLocation({ latitude: lat, longitude: lon })
  const existing = inflight.get(location)
  if (existing) return existing
  const pending = (async () => {
    try {
      const saved = await prisma.openMeteoElevation.findUnique({ where: { location } })
      if (saved) return saved.metres
      if ((retryAfter.get(location) ?? 0) > Date.now()) return null
      const [latitude, longitude] = location.split(',')
      const res = await fetch(openMeteoUrl('elevation', new URLSearchParams({ latitude, longitude })))
      if (!res.ok) throw new Error('elevation unavailable')
      const json = await res.json() as { elevation?: number[] }
      const value = json.elevation?.[0]
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('elevation missing')
      await prisma.openMeteoElevation.upsert({ where: { location }, create: { location, metres: value }, update: { metres: value } })
      return value
    } catch {
      retryAfter.set(location, Date.now() + 60 * 60 * 1000)
      return null
    }
  })().finally(() => inflight.delete(location))
  inflight.set(location, pending)
  return pending
}
