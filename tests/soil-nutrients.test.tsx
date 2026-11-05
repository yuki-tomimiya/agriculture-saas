import './helpers/next-runtime'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { FarmSoil } from '@prisma/client'
import { classifyEffectiveSoil, soilClassificationForFarm, soilNutrientTrigger, type SoilGroup } from '../lib/farm-soil/classification'
import { soilNutrientHits } from '../lib/benchmarks/soil-nutrients'
import { MANUAL_SOIL_OPTIONS } from '../lib/farm-soil/options'
import { isProposalDismissed } from '../lib/proposals/dismissal'
import { prisma } from '../lib/prisma'
import { scoreGrowingCrops } from '../lib/proposals/scoring'
import SoilPage from '../app/soil/page'

const map = (group: string | null, subgroup = group, series = subgroup) => classifyEffectiveSoil({ source: 'map',
  groupCode: group, subgroupCode: subgroup, seriesCode: series, soilName: 'テストの土', mapScale: '50000', datasetId: 'test-v1' })
const context = (group: SoilGroup) => group === 'fallback' ? classifyEffectiveSoil({ source: 'unknown', reason: 'data_unavailable' })
  : map(group === 'black' ? 'D6' : group === 'ordinary' ? 'F2' : 'J2')
const hit = (value: number, key: 'ec' | 'phosphorus', group: SoilGroup) => soilNutrientHits({ [key]: value, timing: '作付け前' }, context(group)).find(h => h.key === key)

test('6地点のコードとD5/D4/J4/B1e1、矛盾・空・未知を当てはめる', () => {
  for (const [group, sub, series, expected] of [
    ['F2', 'F2a2', 'F2a2t1', 'ordinary'], ['F2', 'F2a1', 'F2a1t1', 'ordinary'],
    ['D6', 'D6h1', 'D6h1v3', 'black'], ['J2', 'J2', 'J2', 'sandy'], ['Z3', 'Z3', 'Z3', 'fallback'],
    ['D5', 'D5', 'D5', 'black'], ['D4', 'D4', 'D4', 'fallback'], ['J4', 'J4', 'J4', 'fallback'],
    ['B1', 'B1e1', 'B1e1t1', 'fallback'], ['B1', 'B1e2', 'B1e2t1', 'ordinary'],
    ['D6', 'I1z1', 'I1z1t3', 'fallback'], ['UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'fallback'],
    ['constructor', 'constructor', 'constructor', 'fallback'],
  ]) assert.equal(map(group, sub, series).group, expected)
  assert.equal(map(null).group, 'fallback'); assert.equal(map('D6', null, null).group, 'fallback')
  assert.equal(map('G_', 'G1a1', 'G1a1t1').group, 'ordinary')
  assert.equal(map('G', 'G2', 'G2').group, 'ordinary')
  assert.equal(map('G_', 'G1', 'G2').group, 'fallback')
  assert.equal(map('G_', 'G_', 'G_').group, 'fallback')
  const farm = farmFixture()
  Object.assign(farm.soil, { rawGroupCode: 'G_', rawSubgroupCode: 'G1a1', rawSeriesCode: 'G1a1t1', codeConflict: true })
  assert.equal(soilClassificationForFarm(farm).group, 'ordinary')
  farm.soil.rawSeriesCode = 'G2'
  assert.equal(soilClassificationForFarm(farm).group, 'fallback')
  assert.ok(map('D4').reason)
})
test('本人の13種類と明示的不明は指針の列へ当てはまる', () => {
  for (const option of MANUAL_SOIL_OPTIONS) {
    const c = classifyEffectiveSoil({ source: 'manual', ...option })
    const expected = ['andosol', 'wet-andosol'].includes(option.key) ? 'black'
      : ['lithosol', 'dune-regosol'].includes(option.key) ? 'sandy' : option.key === 'unknown' ? 'fallback' : 'ordinary'
    assert.equal(c.group, expected); assert.equal(c.source, 'manual'); assert.ok(c.mappingVersion)
  }
})
test('ECの境界値、普通畑と判断の出どころ、不明の従来文', () => {
  assert.equal(hit(.1, 'ec', 'sandy'), undefined); assert.ok(hit(.11, 'ec', 'sandy'))
  for (const group of ['black', 'ordinary', 'fallback'] as const) {
    assert.equal(hit(.3, 'ec', group), undefined); assert.ok(hit(.31, 'ec', group))
  }
  for (const group of ['black', 'ordinary', 'sandy'] as const) assert.match(hit(.31, 'ec', group)!.sentence, /普通畑の目安.*地図の目安/)
  assert.match(hit(.31, 'ec', 'fallback')!.sentence, /砂地（砂丘未熟土など）では 0.1 が目安/)
  assert.match(hit(.31, 'ec', 'fallback')!.sentence, /これまでの目安/)
  assert.doesNotMatch(hit(.11, 'ec', 'sandy')!.sentence, /砂地（砂丘未熟土など）では/)
})
test('リン酸の改善目標と100以上の目安を混同しない', () => {
  for (const group of ['ordinary', 'sandy'] as const) {
    assert.equal(hit(75, 'phosphorus', group), undefined)
    for (const value of [76, 99]) {
      assert.match(hit(value, 'phosphorus', group)!.sentence, /上限 75/)
      assert.doesNotMatch(hit(value, 'phosphorus', group)!.sentence, /施さなくてよい/)
    }
    const sentence = hit(100, 'phosphorus', group)!.sentence
    assert.match(sentence, /上限 75/); assert.match(sentence, /100 mg\/100g 以上/)
    assert.equal(sentence.split('施さなくてよい').length, 2)
  }
  assert.match(hit(100, 'phosphorus', 'black')!.sentence, /施さなくてよい/)
  assert.doesNotMatch(hit(100, 'phosphorus', 'black')!.sentence, /上限.*超え/)
  assert.match(hit(101, 'phosphorus', 'black')!.sentence, /上限 100.*超え/)
  assert.equal(hit(99, 'phosphorus', 'fallback'), undefined)
  assert.match(hit(100, 'phosphorus', 'fallback')!.sentence, /施さなくてよい/)
  assert.doesNotMatch(hit(100, 'phosphorus', 'fallback')!.sentence, /改善目標の上限/)
})
test('窒素と栽培中・未選択の扱いを維持する', () => {
  for (const group of ['black', 'ordinary', 'sandy', 'fallback'] as const) {
    assert.deepEqual(soilNutrientHits({ ec: 1, nitrogen: 20, phosphorus: 110, timing: '栽培中' }, context(group)), [])
    assert.equal(soilNutrientHits({ nitrogen: 10 }, context(group)).length, 0)
    const n = soilNutrientHits({ nitrogen: 11, timing: null }, context(group))[0]
    assert.equal(n.sentence, '硝酸態窒素が 10 mg/100g を超えています。そのぶん、次の作付けの元肥の窒素を減らせます。作付け前に測った値の目安です。')
    assert.deepEqual(soilNutrientHits({ ec: .4, timing: null }, context(group)), soilNutrientHits({ ec: .4, timing: '作付け前' }, context(group)))
  }
})
test('閉じたカードのキーは区分に連動し、今の基準は旧キーを継承', () => {
  const rows = [{ trigger: soilNutrientTrigger('farm', context('ordinary')), cropId: null }]
  assert.equal(isProposalDismissed(rows, soilNutrientTrigger('farm', context('ordinary'))), true)
  assert.equal(isProposalDismissed(rows, soilNutrientTrigger('farm', context('sandy'))), false)
  assert.equal(soilNutrientTrigger('farm', context('fallback')), 'soil-nutrient:farm')
})

function farmFixture() {
  const soil: FarmSoil = { farmId: 'farm', lookupStatus: 'matched', lookupToken: null, locationVersion: 0,
    mapScale: '50000', datasetId: 'test-v1', catalogVersion: 'v1', featureId: 'feature', latitude: 35, longitude: 140,
    lookedUpAt: new Date(), rawGroupCode: 'F2', rawSubgroupCode: 'F2a2', rawSeriesCode: 'F2a2t1', rawSoilName: 'グライ低地土', rawLandUse: '田',
    rawPropertiesJson: '{}', candidatesJson: null, codeConflict: false, lookupError: null, mappingVersion: null,
    coordinatePolicy: null, manualSoilKey: null, manualUpdatedAt: null, manualNote: null, manualStatus: 'none', createdAt: new Date(), updatedAt: new Date() }
  return { id: 'farm', name: 'テスト農場', latitude: 35, longitude: 140, locationVersion: 0, soil }
}
test('土壌画面と今日の提案が同じ現在の土を使い、区分変更でだけカードを出し直す', async () => {
  Object.assign(globalThis, { React })
  const farm = farmFixture()
  const diagnosis = { id: 'diagnosis', farmId: 'farm', farm, diagnosedAt: new Date(2026, 9, 1), ec: .2, nitrogen: 0, phosphorus: 76,
    potassium: null, ph: null, timing: '作付け前', notes: null, photoPath: null, field: null }
  const originals = { crop: prisma.crop.findMany, diagnosis: prisma.soilDiagnosis.findMany, farms: prisma.farm.findMany, count: prisma.farm.count, user: prisma.user.findUnique }
  prisma.crop.findMany = (async () => []) as any
  prisma.soilDiagnosis.findMany = (async () => [diagnosis]) as any
  prisma.farm.findMany = (async () => [farm]) as any
  prisma.farm.count = (async () => 0) as any
  prisma.user.findUnique = (async () => ({ id: 'user' })) as any
  const { requestAsyncStorage } = require('next/dist/client/components/request-async-storage.external')
  const { AppRouterContext } = require('next/dist/shared/lib/app-router-context.shared-runtime')
  const router = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} }
  const page = async () => requestAsyncStorage.run({ cookies: { get: () => ({ value: 'user' }) } }, async () => {
    const element = await SoilPage({})
    return renderToStaticMarkup(<AppRouterContext.Provider value={router}>{element}</AppRouterContext.Provider>)
  })
  try {
    let html = await page(); assert.match(html, /上限 75/); assert.match(html, /地図の目安/)
    const cards = await scoreGrowingCrops('user', new Date(2026, 10, 5))
    const original = cards.find(c => c.trigger?.startsWith('soil-nutrient:'))!
    assert.ok(original); assert.match(original.layers!.general!, /上限 75/)
    const dismissed = [{ trigger: original.trigger!, cropId: null }]
    assert.equal((await scoreGrowingCrops('user', new Date(), dismissed)).some(c => c.trigger?.startsWith('soil-nutrient:')), false)
    farm.soil.manualStatus = 'active'; farm.soil.manualSoilKey = 'gley'
    assert.equal((await scoreGrowingCrops('user', new Date(), dismissed)).some(c => c.trigger?.startsWith('soil-nutrient:')), false)
    farm.soil.manualSoilKey = 'dune-regosol'
    html = await page(); assert.match(html, /0.1 を超えています/); assert.match(html, /本人の選択/)
    const changed = (await scoreGrowingCrops('user', new Date(), dismissed)).find(c => c.trigger?.startsWith('soil-nutrient:'))!
    assert.ok(changed); assert.notEqual(changed.trigger, original.trigger); assert.match(changed.layers!.general!, /0.1 mS\/cm/)
    farm.soil.manualSoilKey = 'andosol'
    html = await page(); assert.doesNotMatch(html, /上限 75|超えています/)
    assert.equal((await scoreGrowingCrops('user', new Date())).some(c => c.trigger?.startsWith('soil-nutrient:')), false)
    farm.soil.manualSoilKey = 'unknown'; diagnosis.phosphorus = 100
    assert.equal(soilClassificationForFarm(farm).group, 'fallback')
    assert.match((await scoreGrowingCrops('user', new Date())).find(c => c.trigger?.startsWith('soil-nutrient:'))!.layers!.general!, /これまでの目安/)
    farm.soil.manualStatus = 'none'; farm.soil.manualSoilKey = null; farm.soil.lookupStatus = 'data_unavailable'
    farm.soil.rawGroupCode = null; diagnosis.ec = .31
    assert.match(await page(), /砂地（砂丘未熟土など）では 0.1 が目安/)
    assert.equal(soilClassificationForFarm(farm).group, 'fallback')
  } finally {
    prisma.crop.findMany = originals.crop; prisma.soilDiagnosis.findMany = originals.diagnosis
    prisma.farm.findMany = originals.farms; prisma.farm.count = originals.count; prisma.user.findUnique = originals.user
  }
})
