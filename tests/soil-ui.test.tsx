import './helpers/next-runtime'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { FarmSoil as SavedSoil } from '@prisma/client'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import FarmSoil, { SoilDiagnosisBasis } from '../components/FarmSoil'
import { createSoilLookup } from '../lib/soil-map/lookup'
import { farmSoilPresentation, type SoilFarm } from '../lib/farm-soil/presentation'

Object.assign(globalThis, { React })
const { AppRouterContext } = require('next/dist/shared/lib/app-router-context.shared-runtime')
const router = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} }
function fixture(overrides: Partial<SavedSoil> = {}): SoilFarm {
  return { id: 'farm', latitude: 35, longitude: 140, locationVersion: 0, soil: {
    farmId: 'farm', lookupStatus: 'matched', lookupToken: null, locationVersion: 0,
    mapScale: '50000', datasetId: 'test', catalogVersion: 'test', featureId: 'f', latitude: 35, longitude: 140,
    lookedUpAt: new Date(), rawGroupCode: 'F2', rawSubgroupCode: 'F2a2', rawSeriesCode: 'F2a2t1',
    rawSoilName: '細粒質斑鉄型グライ低地土', rawLandUse: '田', rawPropertiesJson: '{}', candidatesJson: null,
    codeConflict: false, lookupError: null, mappingVersion: null, coordinatePolicy: null, manualSoilKey: null,
    manualUpdatedAt: null, manualNote: null, manualStatus: 'none', createdAt: new Date(), updatedAt: new Date(), ...overrides,
  } }
}
function render(farm: SoilFarm, diagnosis = false) {
  return renderToStaticMarkup(<AppRouterContext.Provider value={router}>
    {diagnosis ? <SoilDiagnosisBasis farm={farm} /> : <FarmSoil farm={farm} />}
  </AppRouterContext.Provider>)
}
test('地図の名前・基準の列・実際の図の出典を分け、地目とコードを出さない', () => {
  for (const scale of ['50000', '200000']) {
    const html = render(fixture({ mapScale: scale }))
    assert.match(html, /細粒質斑鉄型グライ低地土/)
    assert.match(html, /普通畑の「その他の土（黒ボク土・多湿黒ボク土・砂丘未熟土・岩屑土以外）/)
    assert.match(html, scale === '50000' ? /download5.html/ : /download20.html/)
    assert.doesNotMatch(html, scale === '50000' ? /download20.html/ : /download5.html/)
    assert.match(html, /農研機構、日本土壌インベントリー/)
    assert.match(html, /deed.ja/); assert.match(html, /加工しています/)
    assert.doesNotMatch(html, /F2a2|>田<|調査日/)
    assert.equal((html.match(/<option /g) ?? []).length, 14)
  }
})
test('本人の直しと明示的不明・地図への復帰を表示する', () => {
  const farm = fixture({ manualStatus: 'active', manualSoilKey: 'andosol' })
  let html = render(farm)
  assert.match(html, /本人が選択：黒ボク土/); assert.match(html, /地図の推定：細粒質/)
  assert.match(html, /地図の目安に戻す/); assert.match(html, /黒ボク土・多湿黒ボク土/)
  farm.soil!.manualSoilKey = 'unknown'
  html = render(farm); assert.match(html, /本人が選択：分からない／一覧にない/)
  assert.match(html, /これまでの目安を使っています/)
  farm.soil!.manualStatus = 'none'; farm.soil!.manualSoilKey = null
  assert.match(render(farm), /この場所の土は/)
})
test('位置変更後は確認を求め、古い地図を現在の推定として出さない', () => {
  const farm = fixture({ manualStatus: 'needs_review', manualSoilKey: 'andosol' })
  farm.locationVersion = 1
  const html = render(farm)
  assert.match(html, /位置が変わりました/); assert.match(html, /もう一度確認/)
  assert.doesNotMatch(html, /細粒質斑鉄型|本人が選択：黒ボク土|download5.html/)
  assert.match(html, /地図の目安に戻す/)
})
test('Z・図なし・データ破損・位置なし・保留・非対応をそれぞれ説明する', () => {
  for (const soil of [fixture({ rawGroupCode: 'Z3', rawSubgroupCode: 'Z3', rawSeriesCode: 'Z3', rawSoilName: '市街地' }),
    fixture({ lookupStatus: 'no_polygon', rawSoilName: null })]) {
    assert.match(render(soil), /地図から土の種類を推定できませんでした/)
    assert.doesNotMatch(render(soil), /市街地|Z3/)
  }
  assert.match(render(fixture({ lookupStatus: 'data_unavailable', lookupError: '壊れたファイル' })), /土壌図のデータを読み取れない/)
  const noLocation = fixture({ lookupStatus: 'no_location', latitude: null, longitude: null })
  noLocation.latitude = null; noLocation.longitude = null
  assert.match(render(noLocation), /農場の位置を登録すると/)
  for (const group of ['D4', 'J4']) assert.match(render(fixture({ rawGroupCode: group, rawSubgroupCode: group, rawSeriesCode: group })), /この土の基準は確認中/)
  assert.match(render(fixture({ rawGroupCode: 'F1', rawSubgroupCode: 'F1', rawSeriesCode: 'F1' })), /基準表との対応が確認できていない/)
})
test('診断は現在の土を一度だけ表示し、農場の訂正と出典に誘導する', () => {
  const farm = fixture()
  let html = render(farm, true)
  assert.equal((html.match(/地図の目安/g) ?? []).length, 1)
  assert.match(html, /\/farms\/farm#soil-type/); assert.match(html, /現在の土の種類で説明/)
  farm.soil!.manualStatus = 'active'; farm.soil!.manualSoilKey = 'unknown'
  html = render(farm, true)
  assert.match(html, /本人が選択：分からない／一覧にない/)
  assert.equal((html.match(/これまでの目安を使っています/g) ?? []).length, 1)
})
test('千葉県外ではデータ未配備でも訂正の選択肢を使える', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tilltol-soil-ui-'))
  const result = await createSoilLookup(root)({ latitude: 43.06, longitude: 141.35, prefectureCode: '01' })
  await rm(root, { recursive: true, force: true })
  assert.equal(result.status, 'data_unavailable')
  const farm = fixture({ lookupStatus: result.status, rawSoilName: null })
  const html = render(farm)
  assert.match(html, /土壌図のデータを読み取れないため/)
  assert.match(html, /土の種類を直す/); assert.equal((html.match(/<option /g) ?? []).length, 14)
  assert.equal(farmSoilPresentation(farm).soil.group, 'fallback')
})
