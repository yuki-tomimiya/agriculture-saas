import { renderWithRouter, withRequestCookies } from './helpers/next-runtime'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { temporarySqlite } from './helpers/temporary-sqlite'

test('今日の提案のページは本人の農場と栽培中の作付けだけで0件時の入口を選ぶ', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const savedPrisma = runtime.prisma
  runtime.prisma = db
  t.after(() => { runtime.prisma = savedPrisma })
  const { default: AiProposalPage } = await import('@/app/dashboard/ai-proposal/page')
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('このテストでは外部に接続しない') })
  await db.user.createMany({ data: [
    { id: 'owner', email: 'owner@example.invalid', password: 'unused' },
    { id: 'other', email: 'other@example.invalid', password: 'unused' },
  ] })
  await db.farm.create({ data: { id: 'other-farm', userId: 'other', name: '他の人の農場' } })
  await db.crop.create({ data: { farmId: 'other-farm', name: '他の人の作付け', status: 'growing' } })
  const render = () => withRequestCookies({
    get: name => name === 'userId' ? { value: 'owner' } : undefined,
  }, async () => renderWithRouter(await AiProposalPage()))

  const noFarm = await render()
  assert.match(noFarm, /農場を登録すると、この土地の霜と気温が見られます/)
  assert.match(noFarm, /href="\/farms\/new"/)
  assert.doesNotMatch(noFarm, /href="\/crops\/new|他の人の農場|他の人の作付け/)

  await db.farm.create({ data: { id: 'own-farm', userId: 'owner', name: '本人の農場' } })
  const oneFarm = await render()
  assert.match(oneFarm, /href="\/crops\/new\?farmId=own-farm"/)
  assert.match(oneFarm, /href="\/farms\/own-farm"/)
  assert.match(oneFarm, /この土地のカード（霜・地域区分・土）は農場の詳細で見られます/)

  await db.farm.create({ data: { id: 'own-farm-2', userId: 'owner', name: '本人の別の農場' } })
  const twoFarms = await render()
  assert.match(twoFarms, /href="\/crops\/new"/)
  assert.match(twoFarms, /農場一覧を見る/)
  assert.doesNotMatch(twoFarms, /href="\/crops\/new\?farmId=/)

  const crop = await db.crop.create({ data: {
    farmId: 'own-farm', name: '植えた日が空のトマト', cropKind: 'tomato', status: 'completed',
  } })
  assert.match(await render(), /育てているものを登録すると、ここに毎朝の確認が出ます/)
  await db.crop.update({ where: { id: crop.id }, data: { status: 'growing' } })
  const undated = await render()
  assert.match(undated, /今表示する締切・確認事項はありません。/)
  assert.match(undated, /植えた日が未入力（1件）/)
  assert.ok(undated.includes(`href="/crops/${crop.id}/edit"`))
  assert.doesNotMatch(undated, /育てているものを登録すると|位置が未登録/)
})
