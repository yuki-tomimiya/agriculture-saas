import { renderWithRouter, withRequestCookies } from './helpers/next-runtime'
import { testSession } from './helpers/session'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cropKindByKey, adviceNames, RECORD_ONLY_NOTE } from '../lib/crops/conditions'
import { findCropBenchmark } from '../lib/benchmarks/crops'
import { cropPoints } from '../lib/benchmarks/crop-points'
import { gddAvailability, harvestJudgment } from '../lib/benchmarks/gdd-methods'
import { plantingConditionForKind } from '../lib/benchmarks/planting-conditions'
import { matchedSoilPh } from '../lib/benchmarks/soil-ph'
import { nationalYieldCopy } from '../lib/benchmarks/national-yield'
import { askSeasonFinish, cropHarvestKind } from '../lib/proposals/crop-kind'
import { eligibleMilestoneAsks, milestoneFormItems } from '../lib/proposals/milestones'
import { pests } from '../lib/pests/catalog'
import CropForm, { emptyCropForm } from '../components/CropForm'
import { temporarySqlite } from './helpers/temporary-sqlite'
import type { ForecastDay } from '@/lib/weather-forecast'
import type { ProposalWeather } from '@/lib/proposals/weather'

const keysOn = (cropName: string, daysSincePlanting: number, plantingMethod: string, hasHarvest = false) =>
  [...eligibleMilestoneAsks({ cropName, plantingMethod, daysSincePlanting, hasHarvest, records: [] })].map(ask => ask.key)

test('さやいんげん（つるなし）と小かぶは助言の対象、つるあり・中大かぶは記録だけ', () => {
  assert.equal(cropKindByKey('bean-bush')?.recordOnly, false)
  assert.equal(cropKindByKey('turnip-small')?.recordOnly, false)
  assert.equal(cropKindByKey('bean-pole')?.recordOnly, true)
  assert.equal(cropKindByKey('turnip-large')?.recordOnly, true)
  // 名前に「いんげん」「かぶ」が入っても、記録だけの品目には何も当てない
  for (const [cropKind, name] of [['bean-pole', 'さやいんげん（つるあり）'], ['turnip-large', 'かぶ（中・大）'], ['bean-pole', 'いんげん'], ['turnip-large', '小かぶ']] as const) {
    const advice = adviceNames({ cropKind, name })
    assert.deepEqual([advice.recordOnly, advice.name], [true, ''])
    assert.equal(plantingConditionForKind(cropKind, 'direct', 'open'), null)
    assert.deepEqual(cropPoints(advice.name), [])
    assert.equal(matchedSoilPh(advice.name), null)
    assert.equal(nationalYieldCopy(advice.name, null, { qty: 0, unit: 'kg', areaM2: null }), null)
    assert.deepEqual(milestoneFormItems(advice.name, null, []), [])
    for (const day of [30, 45, 60]) assert.deepEqual(keysOn(advice.name, day, 'direct'), [])
    assert.deepEqual(pests.filter(p => p.cropKind === cropKind), [])
  }
  for (const [key, name, cue] of [['bean-bush', 'さやいんげん', '莢の長さ'], ['turnip-small', '小かぶ', '根の太さ']] as const) {
    const view = gddAvailability({ cropKind: key, name })
    assert.equal(view.status, 'none')
    if (view.status === 'none') assert.ok(view.message.includes(cue))
    assert.equal(harvestJudgment({ cropKind: key, name }), cue)
    const benchmark = findCropBenchmark(name)!
    assert.deepEqual([benchmark.displayName, benchmark.monthlyWorkHints, benchmark.generalTips, benchmark.yieldKgRange], [name, {}, [], undefined])
  }
})

test('さやいんげんの開花は30〜50日、収穫の始まりは40〜75日。苗でも同じ日数。答えたら水と秋田県の追肥', () => {
  for (const method of ['direct', 'transplant']) {
    assert.deepEqual(keysOn('さやいんげん', 29, method), [])
    assert.deepEqual(keysOn('さやいんげん', 30, method), ['bean-flower'])
    assert.deepEqual(keysOn('さやいんげん', 39, method), ['bean-flower'])
    assert.deepEqual(keysOn('さやいんげん', 40, method), ['bean-flower', 'bean-harvest-start'])
    assert.deepEqual(keysOn('さやいんげん', 50, method), ['bean-flower', 'bean-harvest-start'])
    assert.deepEqual(keysOn('さやいんげん', 51, method), ['bean-harvest-start'])
    assert.deepEqual(keysOn('さやいんげん', 75, method), ['bean-harvest-start'])
    assert.deepEqual(keysOn('さやいんげん', 76, method), [])
    assert.deepEqual(keysOn('さやいんげん', 45, method, true), ['bean-flower'])
  }
  const [flower, harvest] = [...eligibleMilestoneAsks({ cropName: 'さやいんげん', daysSincePlanting: 45, records: [] })]
  assert.equal(flower.question, '花が咲き始めましたか？')
  assert.match(flower.ifYes, /水を切らさない.*秋田県の資料では、開花の始めに追肥します。/)
  assert.doesNotMatch(flower.ifYes, /\d+\s*(kg|g|ｇ)/)
  assert.equal(harvest.question, '若い莢が13〜14cmほどになりましたか？')
  assert.match(harvest.ifYes, /種がふくらむ前の若い莢.*秋田県の資料では、収穫は毎日.*朝夕の涼しい時間/)
  assert.match(flower.windowNote, /まいた日から30〜50日.*苗で植えても同じ日数/)
})

test('小かぶの収穫の始まりは30〜60日、間引きは聞かない。型は連続収穫型と一斉収穫型', () => {
  for (const method of ['direct', 'transplant']) {
    assert.deepEqual(keysOn('小かぶ', 29, method), [])
    assert.deepEqual(keysOn('小かぶ', 30, method), ['turnip-harvest-start'])
    assert.deepEqual(keysOn('小かぶ', 60, method), ['turnip-harvest-start'])
    assert.deepEqual(keysOn('小かぶ', 61, method), [])
    assert.deepEqual(keysOn('小かぶ', 40, method, true), [])
  }
  assert.deepEqual(milestoneFormItems('小かぶ', null, []).map(item => item.key), ['turnip-harvest-start'])
  const [ask] = [...eligibleMilestoneAsks({ cropName: '小かぶ', daysSincePlanting: 40, records: [] })]
  assert.equal(ask.question, '根の直径が5cmほどになりましたか？')
  assert.match(ask.ifYes, /^収穫の時期です。秋田県の資料では、太ったものから2〜3回に分けて抜きます。適期は5〜10日と短く、遅れるとス入りや割れが増えます。$/)
  assert.equal(cropHarvestKind('さやいんげん'), 'continuous')
  assert.equal(askSeasonFinish({ kind: cropHarvestKind('さやいんげん'), hasHarvest: true, harvestDatePast: true, overTarget: true }), false)
  assert.equal(cropHarvestKind('小かぶ'), 'once')
  assert.equal(askSeasonFinish({ kind: cropHarvestKind('小かぶ'), hasHarvest: true, harvestDatePast: false, overTarget: false }), true)
})

test('植える条件・pH・収量・ポイント', () => {
  for (const method of ['direct', 'transplant', null]) {
    const bean = plantingConditionForKind('bean-bush', method, 'open')
    assert.match(bean?.text ?? '', /^霜に弱く、軽い霜でも枯れます。秋田県の資料では、晩霜のおそれがなくなってからまきます（秋田では4月下旬〜5月上旬）。鹿児島県の資料では、発芽の適温は23〜25℃で、10〜12℃以下では発芽しません。$/)
    assert.match(bean?.scopeLabel ?? '', /^一般/)
    assert.equal(bean?.lateFrostAdvice, true)
    const turnip = plantingConditionForKind('turnip-small', method, 'open')
    assert.match(turnip?.text ?? '', /^秋田県の資料では、発芽は地温15〜20℃がよく、30℃以上で大きく下がります（夏まきは稲わらなどで覆います）。鹿児島県の資料では、春まきは低温（0〜13℃）で花芽ができ、とう立ちしやすくなります。$/)
    assert.ok(!turnip?.lateFrostAdvice)
  }
  for (const name of ['さやいんげん', 'インゲン']) assert.deepEqual([matchedSoilPh(name)?.min, matchedSoilPh(name)?.max], [6.0, 6.5])
  for (const name of ['小かぶ', 'コカブ']) assert.deepEqual([matchedSoilPh(name)?.min, matchedSoilPh(name)?.max], [5.5, 6.5])
  const own = { qty: 0, unit: 'kg', areaM2: null }
  assert.match(nationalYieldCopy('さやいんげん', null, own)?.text ?? '', /さやいんげん 691 kg\/10a/)
  assert.match(nationalYieldCopy('小かぶ', null, own)?.text ?? '', /かぶ 2,560 kg\/10a/)
  assert.equal(cropPoints('さやいんげん').length, 2)
  assert.equal(cropPoints('小かぶ').length, 3)
  assert.match(cropPoints('さやいんげん').map(p => p.text).join(''), /^秋田県の資料では.*50cm.*秋田県の資料では.*2〜3年の輪作/)
  assert.match(cropPoints('小かぶ').map(p => p.text).join(''), /^土を乾かしすぎないようにします。秋田県の資料では.*割れ.*秋田県の資料では、間引きは2回（本葉1〜2枚と3〜4枚）/)
})

test('病害虫は月で言わず、さやいんげん2組・小かぶ2組。根こぶ病に酸度の数字を出さない', () => {
  assert.deepEqual(pests.filter(p => p.cropKind === 'bean-bush').map(p => p.name), ['炭疽病', 'かさ枯病'])
  assert.deepEqual(pests.filter(p => p.cropKind === 'turnip-small').map(p => p.name), ['根こぶ病', 'キスジノミハムシ'])
  for (const pest of pests.filter(p => p.cropKind === 'bean-bush' || p.cropKind === 'turnip-small')) {
    assert.deepEqual(pest.seasons, [])
    assert.equal(pest.appearance?.publisher ?? null, pest.key === 'turnip-small:flea-beetle' ? '岐阜県' : null)
  }
  const find = (key: string) => pests.find(p => p.key === key)!
  assert.deepEqual(find('bean-bush:halo-blight').measures, [])
  assert.match(find('bean-bush:halo-blight').marker, /^秋田県の資料では/)
  assert.equal(find('turnip-small:flea-beetle').marker, find('daikon:flea-beetle').marker)
  const clubroot = find('turnip-small:clubroot')
  assert.match(clubroot.marker, /^島根県の資料では、根に大小のこぶ/)
  assert.doesNotMatch([clubroot.marker, ...clubroot.measures.map(m => m.text)].join(''), /pH|ｐＨ|酸度|6以上|7\.2/)
  assert.deepEqual([...new Set(pests.filter(p => p.cropKind === 'bean-bush').map(p => p.searchCrop))], ['さやいんげん'])
  assert.deepEqual([...new Set(pests.filter(p => p.cropKind === 'turnip-small').map(p => p.searchCrop))], ['かぶ'])
})

test('登録で4つを選べ、記録だけと分かる。詳細のポイント、遅霜のカード、対策の並びを地域ごとに', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const saved = runtime.prisma
  runtime.prisma = db
  t.after(() => { runtime.prisma = saved })
  const { default: CropDetail } = await import('../app/crops/[id]/page')
  const { scoreCrops } = await import('@/lib/proposals/scoring')
  const { loadPestAdvice } = await import('@/lib/pests/service')
  const { loadProposalRecordGuidance } = await import('@/lib/proposals/record-guidance')
  const { fertilizerStandard } = await import('@/lib/fertilizer-standards')
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('外部へ接続しない') })

  const farms = [{ id: 'f', name: '東京の農場', prefectureCode: '13' }]
  const form = (cropKind: string) => renderWithRouter(<CropForm mode="new" initial={{ ...emptyCropForm(), cropKind }} farms={farms.map(f => ({ ...f, fields: [] }))} />)
  const html = form('')
  for (const [value, label] of [['bean-bush', 'さやいんげん（つるなし）'], ['bean-pole', 'さやいんげん（つるあり）'], ['turnip-small', '小かぶ'], ['turnip-large', 'かぶ（中・大）']]) {
    assert.match(html, new RegExp(`value="${value}">${label.replace(/[（）]/g, m => '\\' + m)}`))
  }
  assert.ok(form('bean-pole').includes(RECORD_ONLY_NOTE))
  assert.ok(form('turnip-large').includes(RECORD_ONLY_NOTE))
  assert.ok(!form('bean-bush').includes(RECORD_ONLY_NOTE))

  await db.user.create({ data: { id: 'owner', email: 'bean-turnip@example.invalid', password: 'unused' } })
  await db.farm.create({ data: { id: 'f', userId: 'owner', name: '東京の農場', prefectureCode: '13' } })
  const session = await testSession(db, 'owner')
  const detail = async (id: string) => withRequestCookies(session, async () => renderWithRouter(await CropDetail({ params: Promise.resolve({ id }) })))
  for (const [id, cropKind, name, count] of [['bb', 'bean-bush', 'さやいんげん', 2], ['ts', 'turnip-small', '小かぶ', 3]] as const) {
    await db.crop.create({ data: { id, name, cropKind, farmId: 'f', growingSite: 'open', plantingMethod: 'direct' } })
    const points = (await detail(id)).match(/<h2[^>]*>この品目のポイント<\/h2>[\s\S]*?<\/ul>/)?.[0] ?? ''
    assert.equal((points.match(/<li>/g) ?? []).length, count)
  }
  for (const [id, cropKind, name] of [['bp', 'bean-pole', 'さやいんげん（つるあり）'], ['tl', 'turnip-large', 'かぶ（中・大）']] as const) {
    await db.crop.create({ data: { id, name, cropKind, farmId: 'f', growingSite: 'open', plantingMethod: 'direct' } })
    const page = await detail(id)
    assert.ok(page.includes(RECORD_ONLY_NOTE))
    const points = page.match(/<h2[^>]*>この品目のポイント<\/h2>[\s\S]*?<\/(ul|p)>/)?.[0] ?? ''
    assert.equal((points.match(/<li>/g) ?? []).length, 0)
    assert.equal(page.match(/.{0,40}(691 kg|2,560 kg|6\.0〜6\.5|5\.5〜6\.5|炭疽病|根こぶ病|花が咲き始め|根の直径|支柱|間引き).{0,40}/)?.[0], undefined)
  }

  // 遅霜：今年4月にまいた露地のさやいんげんに、14日先の4℃以下の日で出す。小かぶ・つるありには出さない
  await db.farm.create({ data: { id: 'u', userId: 'owner', name: '宇都宮', latitude: 36.5551, longitude: 139.8828, prefectureCode: '09' } })
  const planted = { farmId: 'u', growingSite: 'open', plantingMethod: 'direct', plantingDate: new Date(2026, 3, 10, 12) }
  await db.crop.createMany({ data: [
    { ...planted, id: 'spring-bean', name: 'さやいんげん', cropKind: 'bean-bush' },
    { ...planted, id: 'spring-turnip', name: '小かぶ', cropKind: 'turnip-small' },
    { ...planted, id: 'spring-pole', name: 'さやいんげん（つるあり）', cropKind: 'bean-pole' },
  ] })
  const cold: ForecastDay = { date: '2026-05-08', dayLabel: '5月8日', weather: '晴れ', weatherCode: 0, maxTemp: 15, minTemp: 3, avgTemp: 9, precipitation: null, wind: null }
  const weather: ProposalWeather = {
    async forecast() { return [cold] },
    async accumulatedGdd() { return null },
    async archive() { return null },
    async frost() { return null },
    async coolNight() { return { date: null, source: 'estimate', stationName: null, distanceKm: null } },
    async precipitation() { return [] },
  }
  const now = new Date(2026, 3, 24, 12)
  const result = await scoreCrops('owner', now, [], { now, weather, confirmations: true })
  assert.deepEqual(result.cards.filter(card => card.trigger === 'spring-frost').map(card => card.cropId), ['spring-bean'])

  // 開花のカードには、最後の施肥の日と県の施肥基準（肥料の助言の形）
  await db.fertilizerRecord.create({ data: { userId: 'owner', farmId: 'u', cropId: 'spring-bean', productName: '化成肥料', amount: 1, appliedAt: new Date('2026-04-20T03:00:00Z') } })
  const proposal = { id: 'p', trigger: 'milestone:bean-flower', relatedCropId: 'spring-bean', relatedFarmId: 'u', milestone: { key: 'bean-flower' } }
  const guidance = (await loadProposalRecordGuidance('owner', [proposal as never], now)).get('p')
  assert.equal(guidance?.byCrop.get('spring-bean')?.fertilizer?.last, '2026-04-20')
  assert.deepEqual(guidance?.standards.map(s => s.url), [fertilizerStandard('09').url])

  // 対策の並び：千葉は根こぶ病の1つ目が千葉、宇都宮と秋田は香川。炭疽病は一般が先
  const advice = async (prefectureCode: string, key: string) => (await loadPestAdvice('owner',
    { id: 'ts', name: '小かぶ', farmId: 'f', growingSite: 'open', farm: { name: '農場', prefectureCode } } as never, key))!.measures.map(m => m.text.slice(0, 4))
  assert.deepEqual(await advice('12', 'turnip-small:clubroot'), ['千葉県の', '香川県の'])
  for (const code of ['09', '05']) assert.deepEqual(await advice(code, 'turnip-small:clubroot'), ['香川県の', '千葉県の'])
  for (const code of ['12', '09', '05']) {
    assert.deepEqual(await advice(code, 'bean-bush:anthracnose'), ['病気の無', '佐賀県の'])
    assert.deepEqual(await advice(code, 'turnip-small:flea-beetle'), ['香川県の'])
    assert.deepEqual(await advice(code, 'bean-bush:halo-blight'), [])
  }
})
