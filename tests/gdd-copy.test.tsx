import { renderWithRouter, withRequestCookies } from './helpers/next-runtime'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { temporarySqlite } from './helpers/temporary-sqlite'

Object.assign(globalThis, { React })
process.env.TZ = 'Asia/Tokyo'

function datesBetween(start: string, end: string): string[] {
  const dates: string[] = []
  for (let day = Date.parse(start); day <= Date.parse(end); day += 86_400_000) {
    dates.push(new Date(day).toISOString().slice(0, 10))
  }
  return dates
}

test('生育ナビの単位と到達の文の位置をそろえ、ダッシュボードは0件の専用表示にする', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const savedPrisma = runtime.prisma
  runtime.prisma = db
  t.after(() => { runtime.prisma = savedPrisma })
  const { default: GddCropPage } = await import('../app/gdd/[cropId]/page')
  const { default: DashboardPage } = await import('../app/dashboard/page')
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 17, 12) })

  await db.user.createMany({ data: [
    { id: 'owner', email: 'owner@example.invalid', password: 'unused' },
    { id: 'empty', email: 'empty@example.invalid', password: 'unused' },
  ] })
  await db.farm.create({ data: { id: 'farm', userId: 'owner', name: '宇都宮', latitude: 36.5551, longitude: 139.8828 } })
  const sweetPotato = { cropKind: 'sweet-potato', name: 'さつまいも', farmId: 'farm', variety: 'べにはるか' }
  const harvestDate = new Date(2025, 9, 31)
  await db.crop.createMany({ data: [
    { ...sweetPotato, id: 'active', plantingDate: new Date(2026, 7, 2) },
    { ...sweetPotato, id: 'ended', plantingDate: new Date(2025, 6, 1), harvestDate, status: 'harvested' },
    { id: 'tomato', cropKind: 'tomato', name: 'ミニトマト', variety: 'ミニトマト', farmId: 'farm',
      plantingDate: new Date(2026, 9, 20) },
  ] })
  await db.harvest.create({ data: { cropId: 'ended', date: harvestDate, quantity: 2 } })
  await db.cropMilestone.create({
    data: { cropId: 'tomato', key: 'flower-1st', observedAt: new Date(2026, 10, 15), source: 'manual' },
  })
  const location = '36.5551,139.8828'
  const writeDays = (start: string, end: string, tempMean: number) =>
    db.openMeteoDaily.createMany({ data: datesBetween(start, end).map(date =>
      ({ location, date, tempMean, precip: 1, radiation: 10 })) })
  await writeDays('2025-07-01', '2025-10-31', 28)
  await writeDays('2026-08-02', '2026-11-17', 25.004)
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/forecast')) return new Response(JSON.stringify({ daily: { time: [] } }))
    assert.ok(url.pathname.endsWith('/archive'))
    const time = datesBetween(url.searchParams.get('start_date')!, url.searchParams.get('end_date')!)
    const zeros = time.map(() => 0)
    return new Response(JSON.stringify({ daily: {
      time, temperature_2m_mean: zeros, temperature_2m_max: zeros, temperature_2m_min: zeros,
      precipitation_sum: zeros, shortwave_radiation_sum: zeros, sunshine_duration: zeros,
    } }))
  })
  const render = (userId: string, page: () => Promise<React.ReactElement>) =>
    withRequestCookies({ get: name => name === 'userId' ? { value: userId } : undefined },
      async () => renderWithRouter(await page()))
  const renderCrop = (cropId: string) => render('owner', () => GddCropPage({ params: Promise.resolve({ cropId }) }))
  const range = /目安は2,400〜3,000℃日（宮城・北海道）。/
  const gddCopy = (html: string) => html.slice(html.indexOf('目安は2,400〜3,000℃日'))

  const active = await renderCrop('active')
  assert.match(active, /現在：2,700 ℃日/)
  assert.match(active, new RegExp(range.source + '前回のあなたは3,444℃日で収穫しました。'))
  assert.match(gddCopy(active), /資料の目安（2,400℃日）は超えましたが、今季は前回あなたが収穫した時点（3,444℃日）には届かない見込みです。.*出典：/s)

  await db.openMeteoDaily.updateMany({
    where: { location, date: { gte: '2026-08-02' } }, data: { tempMean: 35 },
  })
  const reached = await renderCrop('active')
  const reachedText = '前回あなたが収穫した時点（3,444℃日）も超えています。'
  assert.equal(reached.split(reachedText).length, 2)
  assert.match(gddCopy(reached), /3,444℃日）も超えています。.*出典：/s)

  const ended = await renderCrop('ended')
  assert.match(ended, range)
  assert.match(ended, /終了時点：3,444 ℃日/)
  assert.doesNotMatch(ended, /今季は.*届かない|にはすでに届いています|も超えています/)

  const tomato = await renderCrop('tomato')
  assert.match(tomato, /第1花房の開花（11月15日）から、日平均気温をそのまま足す。目安はミニ 850℃日/)
  assert.match(tomato, /現在：105 ℃日/)

  const dashboard = await render('empty', DashboardPage)
  assert.match(dashboard, /<h3 class="dashboard-kpi-title">今日の提案<\/h3><p[^>]*>0<\/p><span class="dashboard-kpi-note">表示する締切・確認事項はありません<\/span>/)
})
