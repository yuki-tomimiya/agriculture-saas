import { withRequestCookies } from './helpers/next-runtime'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { temporarySqlite } from './helpers/temporary-sqlite'
import { isWithinJapanBounds, JAPAN_LOCATION_ERROR } from '@/lib/farms/coordinates'
import { parseFarmInput } from '@/lib/farms/input'

test('農場の保存と土地カードは日本の外を拒否し、部分更新でも既存の座標を合わせる', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const saved = runtime.prisma
  runtime.prisma = db
  t.after(() => { runtime.prisma = saved })
  const { POST: createFarm } = await import('@/app/api/farms/route')
  const { PATCH: updateFarm } = await import('@/app/api/farms/[id]/route')
  const { POST: placeCard } = await import('@/app/api/farms/place-card/route')
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('範囲外の地点で天気を取りに行かない') })
  await db.user.create({ data: { id: 'owner', email: 'bounds@example.invalid', password: 'unused' } })
  const farm = await db.farm.create({ data: { id: 'farm', userId: 'owner', name: '本人の農場', latitude: 34.99, longitude: 139.87 } })
  const point = { latitude: 35, longitude: 39.9 }
  const invoke = (handler: (request: NextRequest) => Promise<Response>, method: string, body: object) => {
    const request = new NextRequest('http://localhost/api/farms', { method,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return withRequestCookies({ get: () => ({ value: 'owner' }) }, () => handler(request))
  }
  for (const response of [
    await invoke(createFarm, 'POST', { name: '範囲外', ...point }),
    await invoke(placeCard, 'POST', point),
    await invoke(request => updateFarm(request, { params: Promise.resolve({ id: farm.id }) }), 'PATCH', { longitude: 39.9 }),
  ]) {
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: JAPAN_LOCATION_ERROR })
  }
  assert.equal(await db.farm.count(), 1)
  assert.equal((await db.farm.findUniqueOrThrow({ where: { id: farm.id } })).longitude, 139.87)
  assert.equal(isWithinJapanBounds({ latitude: 34.99, longitude: 139.87 }), true)
  assert.ok(!('error' in parseFarmInput({ name: '館山', latitude: 34.99, longitude: 139.87,
    prefectureCode: '12', municipalityCode: '122050' })))
  assert.ok(!('error' in parseFarmInput({ name: '名前だけの編集' }, farm)))
  assert.equal(isWithinJapanBounds({ latitude: 24.3395, longitude: 123.004496 }), true)
  assert.equal(isWithinJapanBounds({ latitude: 45.415675, longitude: 145.582903 }), true)
})
