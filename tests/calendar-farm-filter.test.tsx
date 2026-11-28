import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderWithRouter } from './helpers/next-runtime'
import { temporarySqlite } from './helpers/temporary-sqlite'

test('農場の絞り込みが一覧、日付からのリンク、実績、昨年の重ねにそろって効く', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const saved = runtime.prisma
  runtime.prisma = db
  t.after(() => { runtime.prisma = saved })
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-27T15:30:00Z') })
  const { default: WorkCalendar } = await import('@/components/WorkCalendar')
  await db.user.create({ data: { id: 'owner', email: 'calendar@example.invalid', password: 'unused' } })
  for (const id of ['a','b']) {
    await db.farm.create({ data: { id, name: '農場' + id, userId: 'owner' } })
    await db.crop.create({ data: { id, farmId: id, name: '作付け' + id, cropKind: 'cabbage', plantingDate: new Date('2026-11-08') } })
    for (const year of [2025,2026]) await db.workRecord.create({ data: { farmId: id, cropId: id, taskType: '手入れ' + id, date: new Date(year + '-11-29') } })
  }
  const render = async (farmId?: string) => renderWithRouter(await WorkCalendar({ userId: 'owner', months: 3, farmId }))
  const all = await render()
  assert.match(await render('b'), /href="#outlook-bcabbage-firm"/)
  assert.match(all, /id="outlook-bcabbage-firm"/)
  const filtered = await render('a')
  assert.match(filtered, /href="#outlook-acabbage-firm"/)
  assert.match(filtered, /id="outlook-acabbage-firm"/)
  assert.match(filtered, /手入れa/)
  assert.doesNotMatch(filtered, /bcabbage-firm|手入れb|作付けb/)
  assert.match(filtered, /<option value="a" selected/)
  assert.match(filtered, /28(?:<\/a>)?<span class="dashboard-calendar-today-mark">今日/)
  assert.match(filtered, /aria-expanded="false"/)
})
