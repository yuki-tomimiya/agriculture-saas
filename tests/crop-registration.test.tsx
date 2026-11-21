import { renderWithRouter, withRequestCookies } from './helpers/next-runtime'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { temporarySqlite } from './helpers/temporary-sqlite'
import CropForm, { emptyCropForm } from '@/components/CropForm'
import { conditionsMissing, CONDITIONS_PROMPT, parseCropConditions } from '@/lib/crops/conditions'
import type { ProposalWeather } from '@/lib/proposals/weather'

const minimum = { cropKind: 'tomato', growingSite: 'open', plantingMethod: 'transplant' }

test('作付けは必須の条件だけで登録でき、入力した任意の値は引き続き確かめる', () => {
  const parsed = parseCropConditions(minimum)
  assert.ok('value' in parsed)
  assert.deepEqual(parsed.value, {
    ...minimum, name: 'トマト', covers: null, heating: null, plantCount: null, areaM2: null,
    fieldId: null, fieldUndivided: false,
  })
  const house = parseCropConditions({ ...minimum, growingSite: 'house' })
  assert.ok('value' in house)
  assert.equal(house.value.heating, null)
  for (const [change, error] of [
    [{ growingSite: '' }, '場所を選んでください'],
    [{ plantingMethod: '' }, '植え方を選んでください'],
    [{ cropKind: 'other', name: '' }, '呼び名（作物名）を入力してください'],
    [{ plantCount: 0 }, '株数は1以上の整数にしてください'],
    [{ plantCount: 1.5 }, '株数は1以上の整数にしてください'],
    [{ areaM2: 0 }, '栽培面積は0より大きい数にしてください'],
    [{ growingSite: 'house', heating: 'invalid' }, 'ハウスの暖房を選んでください'],
  ] as const) {
    assert.deepEqual(parseCropConditions({ ...minimum, ...change }), { error })
  }
})

test('圃場の未入力は農場に圃場があるときだけ数え、古い作付けも引き続き数える', () => {
  const crop = {
    growingSite: 'open', plantingMethod: 'transplant', covers: 'none', plantCount: 120,
    fieldId: null, fieldUndivided: false,
  }
  assert.equal(conditionsMissing(crop), false)
  assert.equal(conditionsMissing(crop, true), true)
  assert.equal(conditionsMissing({ ...crop, fieldUndivided: true }, true), false)
  assert.equal(conditionsMissing({ ...crop, fieldId: 'field' }, true), false)
  assert.equal(conditionsMissing({ ...crop, covers: null }), true)
  assert.equal(conditionsMissing({ ...crop, plantingMethod: null }), true)
  assert.equal(conditionsMissing({ ...crop, growingSite: null }), true)
})

test('登録では任意の欄を畳み、編集では開き、日付が空の間は保存前の注意が見える', () => {
  const farms = [{ id: 'farm', name: '東京の農場', fields: [{ id: 'field', name: '南の圃場' }] }]
  const initial = { ...emptyCropForm(), ...minimum, farmId: 'farm' }
  const create = renderWithRouter(<CropForm mode="new" initial={initial} farms={farms} />)
  assert.match(create, /<details class="min-w-0">/)
  assert.match(create, /あとで入れてもよい/)
  assert.match(create, /植えた日が無いと、今日の提案と生育ナビは出ません/)
  assert.match(create, /定植日（苗を植えた日）/)
  assert.doesNotMatch(create.match(/<input[^>]*id="crop-planting"[^>]*>/)?.[0] ?? '', /required/)
  const edit = renderWithRouter(<CropForm mode="edit" cropId="crop" initial={initial} farms={farms} />)
  assert.match(edit, /<details open="" class="min-w-0">/)
  const dated = renderWithRouter(<CropForm mode="new" initial={{ ...initial, plantingDate: '2026-11-20' }} farms={farms} />)
  assert.doesNotMatch(dated, /植えた日が無いと/)
})

test('農場の指定・任意の条件の保存・後からの案内を一時DBで確認する', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const savedPrisma = runtime.prisma
  runtime.prisma = db
  t.after(() => { runtime.prisma = savedPrisma })
  const { default: NewCropPage } = await import('@/app/crops/new/page')
  const { default: FarmDetailPage } = await import('@/app/farms/[id]/page')
  const { default: CropDetailPage } = await import('@/app/crops/[id]/page')
  const { POST } = await import('@/app/api/crops/route')
  const { PATCH } = await import('@/app/api/crops/[id]/route')
  const { loadTodayConfirmations } = await import('@/lib/proposals/presentation')
  await db.user.createMany({ data: [
    { id: 'owner', email: 'owner@example.invalid', password: 'unused' },
    { id: 'other', email: 'other@example.invalid', password: 'unused' },
  ] })
  await db.farm.createMany({ data: [
    { id: 'tateyama', userId: 'owner', name: '館山の農場' },
    { id: 'utsunomiya', userId: 'owner', name: '宇都宮の農場' },
    { id: 'tokyo', userId: 'owner', name: '東京の農場' },
    { id: 'other-farm', userId: 'other', name: '他の人の農場' },
  ] })
  await db.field.createMany({ data: [
    { id: 'tokyo-field', farmId: 'tokyo', name: '東京の圃場' },
    { id: 'other-field', farmId: 'other-farm', name: '他の人の圃場' },
  ] })
  const cookies = (userId = 'owner') => ({ get: (name: string) => name === 'userId' ? { value: userId } : undefined })
  const page = (farmId: string, userId = 'owner') => withRequestCookies(cookies(userId), async () =>
    renderWithRouter(await NewCropPage({ searchParams: Promise.resolve({ farmId }) })))
  const request = (url: string, method: string, body: object) => new NextRequest(url, {
    method, headers: { cookie: 'userId=owner', 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  const create = (body: object) => {
    const req = request('http://localhost/api/crops', 'POST', body)
    return withRequestCookies(req.cookies, () => POST(req))
  }
  const patch = (id: string, body: object) => {
    const req = request(`http://localhost/api/crops/${id}`, 'PATCH', body)
    return withRequestCookies(req.cookies, () => PATCH(req, { params: Promise.resolve({ id }) }))
  }

  await t.test('本人の農場が初期選択され、不正な指定から他の利用者の名前・圃場が出ない', async () => {
    for (const id of ['tateyama', 'utsunomiya', 'tokyo']) {
      const farm = await withRequestCookies(cookies(), async () =>
        renderWithRouter(await FarmDetailPage({ params: Promise.resolve({ id }) })))
      assert.ok(farm.includes(`href="/crops/new?farmId=${id}"`))
      const html = await page(id)
      assert.equal(html.split(`href="/farms/${id}"`).length - 1, 2, '戻るとキャンセルは来た農場へ')
      const select = html.match(/<select[^>]*id="crop-farm"[\s\S]*?<\/select>/)?.[0] ?? ''
      assert.ok(select.includes(`<option value="${id}" selected="">`))
      assert.equal(html.includes('東京の圃場'), id === 'tokyo')
    }
    for (const id of ['other-farm', 'missing']) {
      const html = await page(id)
      const select = html.match(/<select[^>]*id="crop-farm"[\s\S]*?<\/select>/)?.[0] ?? ''
      assert.match(select, /<option value="" selected="">/)
      assert.doesNotMatch(html, /他の人の農場|他の人の圃場/)
      assert.ok(html.includes('href="/crops"'))
    }
    const singleFarm = await page('tateyama', 'other')
    assert.match(singleFarm.match(/<select[^>]*id="crop-farm"[\s\S]*?<\/select>/)?.[0] ?? '',
      /<option value="" selected="">/)
  })

  await t.test('登録・編集とも任意の条件が空でも通り、圃場の未入力と分けていないを区別する', async () => {
    for (const farmId of ['tateyama', 'utsunomiya', 'tokyo']) {
      const response = await create({ ...minimum, farmId })
      assert.equal(response.status, 200)
      const { crop } = await response.json() as { crop: { id: string } }
      const saved = await db.crop.findUniqueOrThrow({ where: { id: crop.id } })
      assert.equal(saved.plantingDate, null)
      assert.equal(saved.covers, null)
      assert.equal(saved.plantCount, null)
      assert.equal(saved.areaM2, null)
      assert.equal(saved.fieldId, null)
      assert.equal(saved.fieldUndivided, false)
      assert.equal((await patch(crop.id, { ...minimum, farmId })).status, 200)
      assert.equal((await patch(crop.id, { ...minimum, farmId, plantCount: 0 })).status, 400)
      assert.equal((await patch(crop.id, { ...minimum, farmId, fieldId: 'other-field' })).status, 400)
      if (farmId === 'tokyo') {
        assert.equal((await patch(crop.id, { ...minimum, farmId, fieldUndivided: true })).status, 200)
        assert.equal((await db.crop.findUniqueOrThrow({ where: { id: crop.id } })).fieldUndivided, true)
      }
    }
  })

  await t.test('条件が圃場だけ未入力の作付けも今日の提案で案内し、記録したら消える', async () => {
    await db.crop.updateMany({ where: { farm: { userId: 'owner' } }, data: {
      covers: 'none', plantCount: 120, fieldUndivided: true,
    } })
    const crop = await db.crop.findFirstOrThrow({ where: { farmId: 'tokyo' } })
    await db.crop.update({ where: { id: crop.id }, data: { fieldUndivided: false } })
    const weather: ProposalWeather = {
      forecast: async () => [], accumulatedGdd: async () => null, archive: async () => null,
      frost: async () => null, coolNight: async () => ({ date: null, source: 'estimate', stationName: null, distanceKm: null }),
      precipitation: async () => [],
    }
    const options = { now: new Date(2026, 10, 20, 12), weather }
    const before = await loadTodayConfirmations('owner', options)
    const beforeDetail = await withRequestCookies(cookies(), async () =>
      renderWithRouter(await CropDetailPage({ params: Promise.resolve({ id: crop.id }) })))
    assert.ok(beforeDetail.includes(CONDITIONS_PROMPT))
    const missing = before.organization.find(card => card.trigger === 'conditions-missing')
    assert.ok(missing)
    assert.match(missing.title, /^1件/)
    assert.equal(missing.layers.conclusion, CONDITIONS_PROMPT)
    await db.crop.update({ where: { id: crop.id }, data: { fieldId: 'tokyo-field' } })
    const after = await loadTodayConfirmations('owner', options)
    assert.equal(after.organization.some(card => card.trigger === 'conditions-missing'), false)
    const afterDetail = await withRequestCookies(cookies(), async () =>
      renderWithRouter(await CropDetailPage({ params: Promise.resolve({ id: crop.id }) })))
    assert.ok(!afterDetail.includes(CONDITIONS_PROMPT))
  })
})
