import './helpers/next-runtime'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CropsPage from '../app/crops/page'
import CropsArchivePage from '../app/crops/archive/page'
import FarmsPage from '../app/farms/page'
import { sortListRows } from '../components/ManagementList'
import { prisma } from '../lib/prisma'

Object.assign(globalThis, { React })
const { requestAsyncStorage } = require('next/dist/client/components/request-async-storage.external')
const { AppRouterContext } = require('next/dist/shared/lib/app-router-context.shared-runtime')
const router = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} }

test('3画面の初期表示、画面別Cookie、農場での絞り込みと0件時の案内', async () => {
  const farm = {
    id: 'farm-a', name: '農場A', description: '南の畑', latitude: 35, longitude: 140,
    _count: { crops: 2, tasks: 1 },
  }
  const crop = {
    id: 'crop-a', name: '作付けA', variety: '品種A', status: 'growing', farm,
    field: { name: '圃場A' }, plantingDate: new Date(2025, 3, 1), harvestDate: null,
    _count: { harvests: 2, tasks: 1, workRecords: 10 },
  }
  let empty = false
  const originals = { user: prisma.user.findUnique, farm: prisma.farm.findMany, crop: prisma.crop.findMany }
  prisma.user.findUnique = (async () => ({ id: 'user' })) as unknown as typeof prisma.user.findUnique
  prisma.farm.findMany = (async () => empty ? [] : [farm]) as unknown as typeof prisma.farm.findMany
  prisma.crop.findMany = (async (args: { where: { AND: [{ AND: { farmId?: string }[] }, { status: unknown }] }; orderBy: unknown }) => {
    const [scope, status] = args.where.AND
    assert.equal(scope.AND[0].farmId, 'farm-a')
    assert.deepEqual(args.orderBy, { plantingDate: 'desc' })
    return empty ? [] : [{ ...crop, status: status.status === 'growing' ? 'growing' : 'harvested' }]
  }) as unknown as typeof prisma.crop.findMany

  const searchParams = Promise.resolve({ farmId: 'farm-a' })
  const render = (page: () => Promise<React.ReactElement>, cookieName?: string) =>
    requestAsyncStorage.run({ cookies: { get: (name: string) =>
      name === 'userId' ? { value: 'user' } : name === cookieName ? { value: 'tiles' } : undefined,
    } }, async () => renderToStaticMarkup(
      <AppRouterContext.Provider value={router}>{await page()}</AppRouterContext.Provider>,
    ))

  try {
    for (const [page, key, otherKey, emptyText, action] of [
      [() => CropsPage({ searchParams }), 'growing-crops', 'archived-crops', '栽培中の作物はありません', '生育ナビ'],
      [() => CropsArchivePage({ searchParams }), 'archived-crops', 'farms', '過去の作付けはまだありません', '振り返り'],
      [FarmsPage, 'farms', 'growing-crops', '農場が登録されていません', '作物を見る'],
    ] as const) {
      empty = false
      const list = await render(page)
      assert.match(list, /<table class="management-list-table"/)
      assert.match(list, /aria-pressed="true"[^>]*>リスト/)
      assert.ok(list.includes(action))
      assert.match(await render(page, `tilltol-view-${otherKey}`), /management-list-table/)
      const tiles = await render(page, `tilltol-view-${key}`)
      assert.match(tiles, /farms-grid/)
      assert.match(tiles, /aria-pressed="true"[^>]*>タイル/)
      assert.doesNotMatch(tiles, /management-list-table/)
      empty = true
      for (const cookieName of [undefined, `tilltol-view-${key}`]) {
        const html = await render(page, cookieName)
        assert.ok(html.includes(emptyText))
        assert.doesNotMatch(html, /management-list-table|farms-grid/)
      }
    }
  } finally {
    prisma.user.findUnique = originals.user
    prisma.farm.findMany = originals.farm
    prisma.crop.findMany = originals.crop
  }
})

test('表示文字列ではなく数値・日付で並べ、同値と空欄の順を保つ', () => {
  const rows = [
    { id: 'ten', cells: [{ text: '10件', value: 10 }, { text: '2025/12/1', value: Date.UTC(2025, 11, 1) }] },
    { id: 'two', cells: [{ text: '2件', value: 2 }, { text: '2026/1/1', value: Date.UTC(2026, 0, 1) }] },
    { id: 'none', cells: [null, null] },
    { id: 'two-again', cells: [{ text: '2件', value: 2 }, null] },
  ]
  assert.deepEqual(sortListRows(rows, { column: 0, direction: 'ascending' }).map(row => row.id), ['two', 'two-again', 'ten', 'none'])
  assert.deepEqual(sortListRows(rows, { column: 0, direction: 'descending' }).map(row => row.id), ['ten', 'two', 'two-again', 'none'])
  assert.deepEqual(sortListRows(rows, { column: 1, direction: 'descending' }).map(row => row.id), ['two', 'ten', 'none', 'two-again'])
  assert.equal(rows[0].id, 'ten')
})
