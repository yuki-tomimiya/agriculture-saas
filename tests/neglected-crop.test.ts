import assert from 'node:assert/strict'
import { test } from 'node:test'
import { temporarySqlite } from './helpers/temporary-sqlite'

test('記録の停滞は植付日と登録日の遅いほうから数え、本人の経過日数を重ねない', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const saved = runtime.prisma
  runtime.prisma = db
  t.after(() => { runtime.prisma = saved })
  const { scoreGrowingCrops } = await import('@/lib/proposals/scoring')
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('このテストでは外部に接続しない') })
  const today = new Date(2026, 10, 21)
  const ago = (days: number) => new Date(2026, 10, 21 - days)
  await db.user.create({ data: { id: 'owner', email: 'neglected@example.invalid', password: 'unused' } })
  await db.farm.create({ data: { id: 'farm', userId: 'owner', name: '本人の農場' } })
  for (const [id, plantingAge, registrationAge] of [
    ['new', 173, 0], ['watch', 173, 100], ['severe', 200, 150],
    ['before', 200, 89], ['boundary', 200, 90], ['not-severe', 200, 139], ['severe-boundary', 200, 140],
    ['recent-planting', 10, 150],
  ] as const) {
    await db.crop.create({ data: { id, farmId: 'farm', name: id, cropKind: 'carrot',
      plantingDate: ago(plantingAge), createdAt: ago(registrationAge),
      growingSite: 'open', plantingMethod: 'sow', plantCount: 1 } })
  }
  const cards = await scoreGrowingCrops('owner', today)
  const neglected = new Map(cards.filter(card => card.trigger === 'neglected-crop').map(card => [card.cropId, card]))
  for (const id of ['new', 'before', 'recent-planting']) assert.equal(neglected.has(id), false)
  for (const id of ['watch', 'boundary', 'not-severe']) assert.equal(neglected.get(id)?.urgency, 'watch')
  for (const id of ['severe', 'severe-boundary']) assert.equal(neglected.get(id)?.urgency, 'thisWeek')
  for (const card of neglected.values()) {
    assert.equal(card.layers.personal?.match(/植え付けから|植付から/g)?.length, 1)
  }
})
