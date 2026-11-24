import { renderWithRouter, withRequestCookies } from './helpers/next-runtime'
import { testSession } from './helpers/session'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cropKindByKey, adviceNames } from '../lib/crops/conditions'
import { findCropBenchmark } from '../lib/benchmarks/crops'
import { cropPoints } from '../lib/benchmarks/crop-points'
import { gddAvailability, harvestJudgment } from '../lib/benchmarks/gdd-methods'
import { plantingConditionForKind } from '../lib/benchmarks/planting-conditions'
import { matchedSoilPh } from '../lib/benchmarks/soil-ph'
import { nationalYieldCopy } from '../lib/benchmarks/national-yield'
import { eligibleMilestoneAsks } from '../lib/proposals/milestones'
import { pests, findPest } from '../lib/pests/catalog'
import { selectPestQuestion } from '../lib/pests/selection'
import CropForm, { emptyCropForm } from '../components/CropForm'
import { temporarySqlite } from './helpers/temporary-sqlite'

test('かぼちゃとさといもは助言の対象で積算は使わず、さといもを別のいもに当てない', () => {
  for (const [key, name, cue, kg] of [['pumpkin', 'かぼちゃ', 'なり首のひび', '1,210'], ['taro', 'さといも', 'いもの太り', '1,280']] as const) {
    assert.equal(cropKindByKey(key)?.recordOnly, false)
    const view = gddAvailability({ cropKind: key, name })
    assert.equal(view.status, 'none')
    if (view.status === 'none') assert.ok(view.message.includes(cue))
    assert.equal(harvestJudgment({ cropKind: key, name }), cue)
    const benchmark = findCropBenchmark(name)!
    assert.equal(benchmark.displayName, name)
    assert.deepEqual(benchmark.monthlyWorkHints, {})
    assert.deepEqual(benchmark.generalTips, [])
    assert.equal(benchmark.yieldKgRange, undefined)
    assert.ok(nationalYieldCopy(name, null, { qty: 0, unit: 'kg', areaM2: null })?.text.includes(`${kg} kg/10a`))
    assert.equal(adviceNames({ cropKind: 'other', name }).recordOnly, true)
  }
  for (const name of ['さといも', 'サトイモ', '里芋']) {
    assert.equal(matchedSoilPh(name), null)
    const text = nationalYieldCopy(name, null, { qty: 0, unit: 'kg', areaM2: null })?.text ?? ''
    assert.match(text, /1,280/)
    assert.doesNotMatch(text, /2,250|かんしょ|さつまいも/)
    for (const day of [0, 59, 60, 100, 150, 151, 200, 365]) {
      assert.deepEqual([...eligibleMilestoneAsks({ cropName: name, daysSincePlanting: day, records: [], hasHarvest: false })], [])
    }
  }
})

test('かぼちゃの窓の両端と収穫後の除外、植える条件とpHは指示どおり', () => {
  for (const plantingMethod of ['transplant', 'direct']) {
    const asks = (daysSincePlanting: number, hasHarvest = false) => [...eligibleMilestoneAsks({
      cropName: 'かぼちゃ', plantingMethod, daysSincePlanting, hasHarvest, records: [],
    })]
    assert.equal(asks(59).length, 0)
    assert.equal(asks(60)[0]?.key, 'pumpkin-stalk-cracks')
    assert.equal(asks(150)[0]?.key, 'pumpkin-stalk-cracks')
    assert.equal(asks(151).length, 0)
    assert.equal(asks(60, true).length, 0)
    const ask = asks(60)[0]
    assert.match(ask.question, /なり首.*コルク.*ひび/)
    assert.match(ask.howTo.join(''), /秋田県.*5〜6本.*試し切り.*鹿児島県.*50日前後.*55日前後/)
  }
  assert.match(plantingConditionForKind('pumpkin', 'transplant', 'open')?.text ?? '', /本葉3〜4枚.*鹿児島県.*35日/)
  assert.equal(plantingConditionForKind('pumpkin', 'direct', 'open'), null)
  for (const method of ['direct', 'transplant']) assert.match(plantingConditionForKind('taro', method, 'open')?.text ?? '', /秋田県.*晩霜/)
  assert.deepEqual([matchedSoilPh('かぼちゃ')?.min, matchedSoilPh('南瓜')?.max], [6.0, 6.5])
  assert.equal(cropPoints('カボチャ').length, 3)
  assert.equal(cropPoints('里芋').length, 4)
  assert.match(cropPoints('かぼちゃ').map(p => p.text).join(''), /秋田県.*15〜20日.*鹿児島県.*10〜15日前/)
  assert.match(cropPoints('さといも').map(p => p.text).join(''), /秋田県.*6枚目.*8月始め.*35〜40cm.*秋田県.*霜/)
})

test('秋田のハスモンヨトウだけ8・9月に聞き、ほかの県は順に聞く', () => {
  const crop = { cropKind: 'taro', farmId: 'farm', growingSite: 'open', plantingDay: '2025-01-01' }
  const skipDryRot = new Set(['taro:dry-rot'])
  for (let month = 1; month <= 12; month++) {
    const today = `2026-${String(month).padStart(2, '0')}-15`
    const local = selectPestQuestion({ ...crop, prefectureCode: '05' }, today, [], [], skipDryRot)
    assert.equal(local?.pest.key, [8, 9].includes(month) ? 'taro:common-cutworm' : undefined)
    if (local) assert.match(local.season?.label ?? '', /秋田県.*8月から9月/)
    for (const prefectureCode of ['09', '13', '12']) {
      const other = selectPestQuestion({ ...crop, prefectureCode }, today, [], [], skipDryRot)
      assert.equal(other?.rank, 3)
      assert.equal(other.season, undefined)
    }
  }
  assert.deepEqual(pests.filter(p => p.cropKind === 'pumpkin').map(p => p.name), ['うどんこ病', '疫病'])
  assert.deepEqual(pests.filter(p => p.cropKind === 'taro').map(p => p.name), ['ハスモンヨトウ', '乾腐病'])
  for (const pest of pests.filter(p => p.cropKind === 'pumpkin' || p.cropKind === 'taro')) assert.equal(pest.appearance, null)
  for (const pest of pests.filter(p => p.cropKind === 'pumpkin')) assert.deepEqual(pest.seasons, [])
  assert.equal(findPest('pumpkin:powdery-mildew')?.measures[0].code, '05')
  assert.equal(findPest('taro:common-cutworm')?.measures[0].code, '46')
})

test('登録で選べ、作付けの詳細にはかぼちゃ3・さといも4のポイントを描く', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const saved = runtime.prisma
  runtime.prisma = db
  t.after(() => { runtime.prisma = saved })
  const { default: CropDetail } = await import('../app/crops/[id]/page')
  const { isSweetPotatoCrop } = await import('../lib/proposals/frost')
  for (const name of ['さといも', 'サトイモ', '里芋']) assert.equal(isSweetPotatoCrop(name), false)
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('外部へ接続しない') })
  await db.user.create({ data: { id: 'owner', email: 'pumpkin-taro@example.invalid', password: 'unused' } })
  await db.farm.create({ data: { id: 'farm', userId: 'owner', name: '東京の農場' } })
  const session = await testSession(db, 'owner')
  const html = renderWithRouter(<CropForm mode="new" initial={emptyCropForm()} farms={[{ id: 'farm', name: '東京の農場', fields: [] }]} />)
  assert.match(html, /value="pumpkin">かぼちゃ/)
  assert.match(html, /value="taro">さといも/)
  for (const [id, name, count] of [['pumpkin', 'かぼちゃ', 3], ['taro', 'さといも', 4]] as const) {
    await db.crop.create({ data: { id, name, cropKind: id, farmId: 'farm', growingSite: 'open', plantingMethod: 'direct' } })
    const page = await withRequestCookies(session, async () => renderWithRouter(await CropDetail({ params: Promise.resolve({ id }) })))
    const points = page.match(/<h2[^>]*>この品目のポイント<\/h2>[\s\S]*?<\/ul>/)?.[0] ?? ''
    assert.equal((points.match(/<li>/g) ?? []).length, count)
  }
})
