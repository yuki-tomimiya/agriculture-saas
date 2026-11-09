import assert from 'node:assert/strict'
import test from 'node:test'
import { harvestAvailableDate, harvestDatesByCrop, pesticideCounts, pesticideDraftUsage, pesticideUsage } from '../lib/pesticide-safety'

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

test('散布日、同日なら登録順で、記録ごとの回数と上限到達を示す', () => {
  const first = { id: '1', cropId: 'a', productName: 'A', appliedAt: new Date('2026-11-03'),
    createdAt: new Date('2026-11-08'), applicationLimit: 3 }
  const second = { ...first, id: '3', appliedAt: new Date('2026-11-07T10:00:00Z'), createdAt: new Date('2026-11-07'), applicationLimit: null }
  const third = { ...second, id: '2', appliedAt: new Date('2026-11-07'), createdAt: new Date('2026-11-09') }
  const records = [
    third, first, second,
    { ...first, id: '4', productName: 'B' },
    { ...first, id: '5', cropId: 'b' },
    { ...first, id: '6', cropId: null },
  ]
  const count = pesticideCounts(records)
  assert.equal(count(first.id), 1)
  assert.equal(count(second.id), 2)
  assert.equal(count(third.id), 3)
  assert.equal(count('4'), 1)
  assert.equal(count('5'), 1)
  assert.equal(count('6'), 0)
  assert.deepEqual([first, second, third].map(row => pesticideUsage(count(row.id), null, 3).state), [null, null, 'at'])
  assert.equal(pesticideUsage(count(second.id), 4, 3).count, 4)
  assert.deepEqual(pesticideDraftUsage(records, 'a', ' A ', '2026-11-07', second.id), { count: 2, limit: 3 })
  assert.deepEqual(pesticideDraftUsage(records, 'a', 'A', '2026-11-07'), { count: 4, limit: 3 })
  assert.deepEqual(pesticideDraftUsage(records, 'a', 'A', '2026-11-02'), { count: 1, limit: null })
})

test('記録数と本人の値の多いほうを表示し、上限到達と超過を区別する', () => {
  assert.deepEqual(pesticideUsage(2, 1, 3), { count: 2, limit: 3, state: null })
  assert.deepEqual(pesticideUsage(2, 3, 3), { count: 3, limit: 3, state: 'at' })
  assert.deepEqual(pesticideUsage(4, 3, 3), { count: 4, limit: 3, state: 'over' })
  assert.deepEqual(pesticideUsage(2, null, null), { count: 2, limit: null, state: null })
})
