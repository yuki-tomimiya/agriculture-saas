import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderWithRouter } from './helpers/next-runtime'

test('農場の新規フォームはサーバーでLeafletを読み込まず描画できる', async () => {
  assert.equal(typeof window, 'undefined')
  const { default: NewFarmForm } = await import('@/components/NewFarmForm')
  const html = renderWithRouter(<NewFarmForm />)
  assert.match(html, /地図で選ぶ/)
  assert.match(html, /現在地を使う/)
  assert.doesNotMatch(html, /農場の場所を選ぶ地図|leaflet-container/)
})
