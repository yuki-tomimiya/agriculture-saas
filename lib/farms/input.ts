import type { Farm } from '@prisma/client'
import { parseFarmPlace } from '../places/catalog'
type Data = Pick<Farm, 'name' | 'description' | 'latitude' | 'longitude' | 'prefectureCode' | 'municipalityCode'>

/** PATCHで省略された座標や説明を、空欄と取り違えない。 */
export function parseFarmInput(body: Record<string, unknown>, existing?: Data): Partial<Data> | { error: string } {
  const data: Partial<Data> = {}
  if (!existing || Object.hasOwn(body, 'name')) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return { error: '農場名は必須です' }
    data.name = name
  }
  if (!existing || Object.hasOwn(body, 'description')) data.description = typeof body.description === 'string' ? body.description.trim() || null : null
  for (const key of ['latitude', 'longitude'] as const) {
    if (existing && !Object.hasOwn(body, key)) continue
    const raw = body[key]
    if (raw == null || raw === '') { data[key] = null; continue }
    if (typeof raw !== 'number' && typeof raw !== 'string') return { error: '緯度・経度を数値で入力してください' }
    const number = Number(raw)
    if (!Number.isFinite(number) || Math.abs(number) > (key === 'latitude' ? 90 : 180)) return { error: '緯度・経度が範囲外です' }
    data[key] = number
  }
  if (!existing || Object.hasOwn(body, 'prefectureCode') || Object.hasOwn(body, 'municipalityCode')) {
    const place = parseFarmPlace({ prefectureCode: existing?.prefectureCode, municipalityCode: existing?.municipalityCode, ...body })
    if ('error' in place) return place
    Object.assign(data, place)
  }
  return data
}
