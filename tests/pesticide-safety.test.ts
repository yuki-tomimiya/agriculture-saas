import assert from 'node:assert/strict'
import test from 'node:test'
import { harvestAvailableDate, harvestDatesByCrop, pesticideCounts, pesticideUsage } from '../lib/pesticide-safety'

test('散布した日本の日付に収穫前日数を加える', () => {
  assert.equal(harvestAvailableDate(new Date('2026-11-06T15:00:00Z'), 14), '2026-11-21')
  assert.equal(harvestAvailableDate(new Date('2026-12-31T23:00:00+09:00'), 1), '2027-01-01')
  assert.equal(harvestAvailableDate(new Date('2026-11-07'), 0), '2026-11-07')
  assert.equal(harvestAvailableDate(new Date('2026-11-07'), null), null)
})

test('作付けごとの最も遅い開始日を選び、農場だけの記録は数えない', () => {
  const dates = harvestDatesByCrop([
    { cropId: 'a', appliedAt: new Date('2026-11-07'), daysBeforeHarvest: 14 },
    { cropId: 'a', appliedAt: new Date('2026-11-03'), daysBeforeHarvest: 14 },
    { cropId: 'a', appliedAt: new Date('2026-11-08'), daysBeforeHarvest: 0 },
    { cropId: 'b', appliedAt: new Date('2026-10-20'), daysBeforeHarvest: 7 },
    { cropId: null, appliedAt: new Date('2026-11-08'), daysBeforeHarvest: 30 },
  ])
  assert.deepEqual([...dates], [['a', '2026-11-21'], ['b', '2026-10-27']])
})

test('同じ作付けと農薬名の記録数を使い、編集する記録を二重に数えない', () => {
  const records = [
    { id: '1', cropId: 'a', productName: 'A' },
    { id: '2', cropId: 'a', productName: 'A' },
    { id: '3', cropId: 'a', productName: 'B' },
    { id: '4', cropId: 'b', productName: 'A' },
    { id: '5', cropId: null, productName: 'A' },
  ]
  const count = pesticideCounts(records)
  assert.equal(count('a', ' A '), 2)
  assert.equal(count('b', 'A'), 1)
  assert.equal(count(null, 'A'), 0)
  assert.equal(pesticideCounts(records, '2')('a', 'A') + 1, 2)
})

test('記録数と本人の値の多いほうを表示し、上限到達と超過を区別する', () => {
  assert.deepEqual(pesticideUsage(2, 1, 3), { count: 2, limit: 3, state: null })
  assert.deepEqual(pesticideUsage(2, 3, 3), { count: 3, limit: 3, state: 'at' })
  assert.deepEqual(pesticideUsage(4, 3, 3), { count: 4, limit: 3, state: 'over' })
  assert.deepEqual(pesticideUsage(2, null, null), { count: 2, limit: null, state: null })
})
