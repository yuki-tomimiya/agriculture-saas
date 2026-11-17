import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderWithRouter } from './helpers/next-runtime'
import municipalities from '@/data/municipalities.json'
import pointData from '@/data/municipality-points.json'
import { municipalityMapCenter, prefectureMapCenter } from '@/lib/places/map-center'

test('農場の新規フォームはサーバーでLeafletを読み込まず描画できる', async () => {
  assert.equal(typeof window, 'undefined')
  const { default: NewFarmForm } = await import('@/components/NewFarmForm')
  const html = renderWithRouter(<NewFarmForm />)
  assert.match(html, /地図で選ぶ/)
  assert.match(html, /現在地を使う/)
  assert.doesNotMatch(html, /農場の場所を選ぶ地図|leaflet-container/)
})

test('市区町村の代表点は現行の自治体すべてに対応し、日本の範囲にある', () => {
  assert.equal(Object.keys(pointData.points).length, 1741)
  assert.deepEqual(Object.keys(pointData.points).sort(), municipalities.municipalities.map(item => item.code).sort())
  for (const [latitude, longitude] of Object.values(pointData.points)) {
    assert.ok(latitude >= 20 && latitude <= 46)
    assert.ok(longitude >= 122 && longitude <= 154)
  }
  const [latitude, longitude] = pointData.points['122050']
  assert.deepEqual(municipalityMapCenter('122050'), { latitude, longitude })
  assert.ok(latitude > 34.9 && latitude < 35 && longitude > 139.8 && longitude < 140)
  assert.equal(municipalityMapCenter('999999'), null)
  assert.equal(prefectureMapCenter('99'), null)
  assert.ok(prefectureMapCenter('12'))
})
