import { renderWithRouter, withRequestCookies } from './helpers/next-runtime'
import { testSession } from './helpers/session'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { temporarySqlite } from './helpers/temporary-sqlite'
import { cropSaveHref } from '@/lib/crops/navigation'
import FarmPlaceCard from '@/components/FarmPlaceCard'
import type { PlaceCard } from '@/lib/farms/place-card'
import type { ProposalWeather } from '@/lib/proposals/weather'

test('作付けの新規保存は詳細へ、編集は栽培を終えるときだけ振り返りへ進む', () => {
  const saved = { cropId: 'saved-id', initialStatus: 'growing', status: 'growing' }
  assert.equal(cropSaveHref({ ...saved, mode: 'new' }), '/crops/saved-id')
  assert.equal(cropSaveHref({ ...saved, mode: 'edit' }), '/crops/saved-id')
  for (const status of ['harvested', 'completed']) {
    assert.equal(cropSaveHref({ ...saved, status, mode: 'edit' }), '/crops/saved-id/retrospective?from=status')
    assert.equal(cropSaveHref({ ...saved, status, initialStatus: 'completed', mode: 'edit' }), '/crops/saved-id')
  }
})

test('推計の霜の断りは霜の区画に置き、未取得の項目と分ける', () => {
  const card: PlaceCard = {
    suggestion: null, normal: null, soil: { status: 'data_unavailable' },
    frost: { autumn: { text: '秋の霜の目安', source: 'estimate' }, spring: null,
      stationLine: null, usesElevation: false },
    missing: ['estimated_frost', 'soil'],
  }
  const render = (value: PlaceCard) => renderWithRouter(<FarmPlaceCard card={value} onRetryWeather={() => {}} retryDisabled={false} />)
  const html = render(card)
  const unavailable = html.match(/<strong>この場所でまだ出ないもの<\/strong>[\s\S]*?<\/p>/)?.[0] ?? ''
  assert.match(unavailable, /土の種類/)
  assert.doesNotMatch(unavailable, /霜|推計/)
  assert.match(html, /<h3[^>]*>霜<\/h3>[\s\S]*?観測所の記録が使えない時期の霜は推計です/)
  assert.doesNotMatch(render({ ...card, soil: { status: 'matched', name: '黒ボク土', column: null, scale: '50000' },
    missing: ['estimated_frost'] }), /この場所でまだ出ないもの/)
})

test('農場0件のダッシュボードと、未入力1件・複数件の編集の入口と、植える日が先の理由', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const savedPrisma = runtime.prisma
  runtime.prisma = db
  t.after(() => { runtime.prisma = savedPrisma })
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('外部には接続しない') })
  const { default: Dashboard } = await import('@/app/dashboard/page')
  const { default: MorningProposals } = await import('@/app/dashboard/ai-proposal/MorningProposals')
  const { loadTodayConfirmations } = await import('@/lib/proposals/presentation')
  await db.user.create({ data: { id: 'owner', email: 'onboarding@example.invalid', password: 'unused' } })
  const cookies = await testSession(db, 'owner')
  const dashboard = () => withRequestCookies(cookies, async () => renderWithRouter(await Dashboard()))
  assert.match(await dashboard(), /農場を登録すると、この土地の霜と気温が見られます/)
  assert.match(await dashboard(), />農場を登録する<\/a>/)
  await db.farm.create({ data: { id: 'farm', userId: 'owner', name: '千葉の農場', prefectureCode: '12' } })
  assert.doesNotMatch(await dashboard(), />農場を登録する<\/a>/)
  await db.crop.create({ data: { id: 'one', farmId: 'farm', name: 'トマト', cropKind: 'tomato' } })
  const now = new Date(2026, 8, 1, 12)
  const weather: ProposalWeather = {
    forecast: async () => [], accumulatedGdd: async () => null, archive: async () => null,
    frost: async () => null, coolNight: async () => ({ date: null, source: 'estimate', stationName: null, distanceKm: null }),
    precipitation: async () => [],
  }
  const load = () => loadTodayConfirmations('owner', { now, weather })
  const render = async () => renderWithRouter(<MorningProposals data={await load()} guidance={new Map()} />)
  let data = await load()
  assert.equal(data.organization.find(p => p.trigger === 'conditions-missing')?.relatedCropId, 'one')
  assert.match(await render(), /href="\/crops\/one\/edit"[^>]*>育て方を入れる/)
  await db.crop.create({ data: { id: 'two', farmId: 'farm', name: 'ナス', cropKind: 'eggplant' } })
  data = await load()
  assert.equal(data.organization.find(p => p.trigger === 'conditions-missing')?.relatedCropId, undefined)
  assert.match(await render(), /href="\/crops"[^>]*>作物一覧/)
  await db.crop.update({ where: { id: 'one' }, data: { plantingDate: new Date(2026, 8, 2) } })
  data = await load()
  assert.deepEqual(data.noConfirmations['planting-later']?.map(crop => crop.cropId), ['one'])
  assert.equal(data.noConfirmations['planting-later']?.[0].plantingDate, '9月2日')
  assert.ok(data.noConfirmations['no-planting-date']?.some(crop => crop.cropId === 'two'))
  assert.ok(!data.confirmationGroups.flat().some(row => row.crop.cropId === 'one'))
  assert.ok(!data.remainingPestGroups.flat().some(row => row.cropId === 'one'))
  assert.match(await render(), /植える日がまだ先[\s\S]*9月2日から/)
  await db.farm.update({ where: { id: 'farm' }, data: { latitude: 35, longitude: 139 } })
  assert.equal((await load()).noConfirmations['planting-later']?.[0].cropId, 'one')
})
