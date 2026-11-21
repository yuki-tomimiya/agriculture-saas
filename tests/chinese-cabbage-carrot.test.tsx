import { renderWithRouter, withRequestCookies } from './helpers/next-runtime'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cropKindByKey, adviceNames } from '@/lib/crops/conditions'
import CropForm, { emptyCropForm } from '@/components/CropForm'
import { findCropBenchmark } from '@/lib/benchmarks/crops'
import { cropPoints } from '@/lib/benchmarks/crop-points'
import { gddAvailability } from '@/lib/benchmarks/gdd-methods'
import { plantingConditionForKind } from '@/lib/benchmarks/planting-conditions'
import { matchedSoilPh } from '@/lib/benchmarks/soil-ph'
import { nationalYieldCopy } from '@/lib/benchmarks/national-yield'
import { eligibleMilestoneAsks, milestoneGeneralAdvice } from '@/lib/proposals/milestones'
import { pests, findPest } from '@/lib/pests/catalog'
import { selectPestQuestion } from '@/lib/pests/selection'
import { temporarySqlite } from './helpers/temporary-sqlite'

test('はくさいとにんじんを選べ、積算・根拠の無い従来目安を出さず、その他は移さない', () => {
  for (const [key, name, cue, min, kg] of [
    ['chinese-cabbage', 'はくさい', '球の固さ', 6.0, '5,410'],
    ['carrot', 'にんじん', '根の太り', 5.5, '3,320'],
  ] as const) {
    assert.equal(cropKindByKey(key)?.recordOnly, false)
    const view = gddAvailability({ cropKind: key, name })
    assert.equal(view.status, 'none')
    if (view.status === 'none') assert.ok(view.message.includes(cue))
    const ph = matchedSoilPh(name)
    assert.equal(ph?.min, min)
    assert.equal(ph?.max, 6.5)
    const benchmark = findCropBenchmark(name)
    assert.deepEqual(benchmark?.monthlyWorkHints, {})
    assert.deepEqual(benchmark?.generalTips, [])
    assert.equal(benchmark?.yieldKgRange, undefined)
    assert.ok(nationalYieldCopy(name, null, { qty: 0, unit: 'kg', areaM2: null })?.text.includes(`${kg} kg/10a`))
    assert.equal(adviceNames({ cropKind: 'other', name }).recordOnly, true)
  }
})

test('収穫の問いは窓の両端を含み、収穫を記録したら聞かない', () => {
  for (const [cropName, key, from, to] of [
    ['はくさい', 'chinese-cabbage-firm', 40, 150], ['にんじん', 'carrot-root', 90, 190],
  ] as const) {
    for (const plantingMethod of ['direct', 'transplant']) {
      const asks = (daysSincePlanting: number, hasHarvest = false) => [...eligibleMilestoneAsks({
        cropName, plantingMethod, daysSincePlanting, hasHarvest, records: [],
      })].map(item => item.key)
      assert.deepEqual(asks(from - 1), [])
      assert.deepEqual(asks(from), [key])
      assert.deepEqual(asks(to), [key])
      assert.deepEqual(asks(to + 1), [])
      assert.deepEqual(asks(from, true), [])
    }
  }
  const carrot = milestoneGeneralAdvice({ cropName: 'にんじん', daysSincePlanting: 90, records: [] })
  assert.match(carrot?.text ?? '', /裂根.*秋田県.*鹿児島県.*150〜200g/)
})

test('植える条件と3つのポイントは県名のある目安を保つ', () => {
  const seedling = plantingConditionForKind('chinese-cabbage', 'transplant', 'open')?.text ?? ''
  assert.match(seedling, /鹿児島県.*本葉3〜4枚.*20〜25日.*まくのが遅れると/)
  const direct = plantingConditionForKind('chinese-cabbage', 'direct', 'open')?.text ?? ''
  assert.match(direct, /鹿児島県.*まくのが遅れると/)
  assert.doesNotMatch(direct, /本葉|20〜25/)
  assert.match(plantingConditionForKind('carrot', 'direct', 'open')?.text ?? '', /土に水分.*乾いていれば水/)
  assert.equal(plantingConditionForKind('carrot', 'transplant', 'open'), null)
  const cabbage = cropPoints('白菜').map(point => point.text)
  const carrot = cropPoints('人参').map(point => point.text)
  assert.equal(cabbage.length, 3)
  assert.equal(carrot.length, 3)
  assert.match(cabbage.join(''), /秋田県.*結球.*鹿児島県.*20℃.*10℃/)
  assert.match(carrot.join(''), /本葉2〜3枚.*秋田県.*4〜5枚.*鹿児島県.*5〜6枚/)
})

test('茨城のコナガは5・6・9月だけ、それ以外の県とにんじんは巡回で聞く', () => {
  assert.equal(pests.filter(pest => pest.cropKind === 'chinese-cabbage').length, 3)
  assert.deepEqual(pests.filter(pest => pest.cropKind === 'carrot').map(pest => pest.name), ['黒葉枯病'])
  const crop = { cropKind: 'chinese-cabbage', farmId: 'farm', growingSite: 'open', plantingDay: '2025-01-01' }
  const onlyDiamondback = new Set(['chinese-cabbage:cabbageworm', 'chinese-cabbage:soft-rot'])
  for (let month = 1; month <= 12; month++) {
    const day = `2026-${String(month).padStart(2, '0')}-15`
    const question = selectPestQuestion({ ...crop, prefectureCode: '08' }, day, [], [], onlyDiamondback)
    assert.equal(question?.pest.key, [5, 6, 9].includes(month) ? 'chinese-cabbage:diamondback' : undefined)
    for (const prefectureCode of ['09', '13', '12']) {
      const other = selectPestQuestion({ ...crop, prefectureCode }, day, [], [], onlyDiamondback)
      assert.equal(other?.rank, 3)
      assert.equal(other.season, undefined)
    }
  }
  assert.equal(selectPestQuestion({ ...crop, cropKind: 'carrot' }, '2026-11-21', [], [], new Set())?.pest.key,
    'carrot:black-leaf-blight')
  assert.equal(findPest('chinese-cabbage:diamondback')?.measures.length, 0)
  assert.equal(findPest('chinese-cabbage:cabbageworm')?.measures[0].code, '26')
  assert.equal(findPest('carrot:black-leaf-blight')?.searchCrop, 'にんじん')
})

test('登録の選択肢と作付けの詳細に3つのポイントを描く', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const savedPrisma = runtime.prisma
  runtime.prisma = db
  t.after(() => { runtime.prisma = savedPrisma })
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('外部には接続しない') })
  const { default: CropDetail } = await import('@/app/crops/[id]/page')
  await db.user.create({ data: { id: 'owner', email: 'two-crops@example.invalid', password: 'unused' } })
  const farms = [{ id: 'farm', name: '東京の農場', fields: [] }]
  const form = renderWithRouter(<CropForm mode="new" initial={emptyCropForm()} farms={farms} />)
  assert.match(form, /value="chinese-cabbage">はくさい/)
  assert.match(form, /value="carrot">にんじん/)
  await db.farm.create({ data: { id: 'farm', userId: 'owner', name: '東京の農場' } })
  for (const [id, name] of [['chinese-cabbage', 'はくさい'], ['carrot', 'にんじん']]) {
    await db.crop.create({ data: { id, name, cropKind: id, farmId: 'farm', growingSite: 'open', plantingMethod: 'direct' } })
    const html = await withRequestCookies({ get: name => name === 'userId' ? { value: 'owner' } : undefined }, async () =>
      renderWithRouter(await CropDetail({ params: Promise.resolve({ id }) })))
    assert.match(html, /品目のポイント/)
    const points = html.match(/<h2[^>]*>この品目のポイント<\/h2>[\s\S]*?<\/ul>/)?.[0] ?? ''
    assert.equal((points.match(/<li>/g) ?? []).length, 3)
    assert.match(points, name === 'はくさい' ? /秋田県.*結球.*鹿児島県.*20℃.*10℃/ : /本葉2〜3枚.*4〜5枚.*5〜6枚/)
  }
})
