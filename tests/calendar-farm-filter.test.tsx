import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderWithRouter } from './helpers/next-runtime'
import { temporarySqlite } from './helpers/temporary-sqlite'

test('農場の絞り込みが、マスの点・選んだ日の欄・実績・昨年の重ねにそろって効き、選んだ日と月を保つ', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const saved = runtime.prisma
  runtime.prisma = db
  t.after(() => { runtime.prisma = saved })
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-27T15:30:00Z') })
  const { default: WorkCalendar } = await import('@/components/WorkCalendar')
  const { loadConcernFollowUps } = await import('@/lib/proposals/concern-follow-up')
  await db.user.create({ data: { id: 'owner', email: 'calendar@example.invalid', password: 'unused' } })
  for (const id of ['a','b']) {
    await db.farm.create({ data: { id, name: '農場' + id, userId: 'owner' } })
    await db.crop.create({ data: { id, farmId: id, name: '作付け' + id, cropKind: 'cabbage', plantingDate: new Date('2026-11-08') } })
    for (const year of [2025,2026]) await db.workRecord.create({ data: { farmId: id, cropId: id, taskType: '手入れ' + id, date: new Date(year + '-11-29') } })
  }
  // 場所・様子の言葉が無い気になることの記録
  await db.fieldConcern.create({ data: { cropId: 'a', observedAt: new Date('2026-11-24T00:00:00+09:00'), locations: '', symptoms: '' } })
  const render = async (props: { farmId?: string; month?: string; day?: string } = {}) =>
    renderWithRouter(await WorkCalendar({ userId: 'owner', ...props }))
  const panelOf = (html: string) => html.slice(html.indexOf('calendar-day-panel'))

  const all = await render()
  assert.match(all, /aria-pressed="false" aria-label="11月28日（今日）[^"]*" class="calendar-cell calendar-cell--today"/)
  assert.match(panelOf(all), /<h2 class="calendar-panel-heading"[^>]*>今日から7日<\/h2>/)
  assert.match(panelOf(all), /作付けaの気になること（11\/24）のその後を聞く期間/)
  assert.match(panelOf(all), /手入れa[\s\S]*手入れb/)
  assert.doesNotMatch(all, /異変|月のマスを開く|outlook-/)

  const firmDay = (count: number) => new RegExp('aria-label="12月\\d+日、収穫・聞き始め' + count + '件"')
  assert.match(await render({ month: '2026-12' }), firmDay(2))

  const filtered = await render({ farmId: 'a', month: '2026-12', day: '2026-11-29' })
  assert.match(filtered, firmDay(1))
  assert.doesNotMatch(filtered, firmDay(2))
  const panel = panelOf(filtered)
  assert.match(panel, /<h2 class="calendar-panel-heading"[^>]*>11月29日（日）<\/h2>/)
  assert.match(panel, /手入れa（作付けa）/)
  assert.match(panel, /昨年の記録：手入れa（作付けa）/)
  assert.doesNotMatch(filtered, /手入れb|作付けb/)
  assert.match(filtered, /<option value="a" selected/)
  assert.match(filtered, /<input type="hidden" name="month" value="2026-12"\/>/)
  assert.match(filtered, /<input type="hidden" name="day" value="2026-11-29"\/>/)
  assert.match(filtered, /2026年12月/)

  const [followUp] = await loadConcernFollowUps('owner', new Date())
  assert.equal(followUp.title, '11月24日に記録した気になることは、広がっていますか？')
})
