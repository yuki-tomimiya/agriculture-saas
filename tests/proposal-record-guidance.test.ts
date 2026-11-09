import assert from 'node:assert/strict'
import { test } from 'node:test'
import standards from '@/data/fertilizer-standards.json'
import { fertilizerStandard } from '@/lib/fertilizer-standards'
import { latestFertilizerDates, upcomingHarvestDate } from '@/lib/proposals/record-guidance'

test('作付けごとに最後の施肥日を日本時間で求める', () => {
  const latest = latestFertilizerDates([
    { cropId: 'a', appliedAt: new Date('2026-11-02T15:00:00Z') },
    { cropId: 'b', appliedAt: new Date('2026-11-06T00:00:00Z') },
    { cropId: 'a', appliedAt: new Date('2026-11-02T14:59:59Z') },
    { cropId: null, appliedAt: new Date('2026-11-08T00:00:00Z') },
  ])
  assert.deepEqual([...latest], [['a', '2026-11-03'], ['b', '2026-11-06']])
  assert.equal(latest.get('c'), undefined)
})

test('47都道府県のリンクを引き、案内先のない農場は国の一覧へ回す', () => {
  assert.equal(Object.keys(standards).length, 47)
  assert.equal(fertilizerStandard('12').fallback, false)
  assert.match(fertilizerStandard('12').url, /^https:\/\/www\.pref\.chiba\.lg\.jp\//)
  const fallback = fertilizerStandard(null)
  assert.equal(fallback.fallback, true)
  assert.match(fallback.url, /^https:\/\/www\.maff\.go\.jp\//)
  assert.deepEqual(fertilizerStandard('36'), fallback)
  assert.deepEqual(fertilizerStandard('23'), fallback)
  assert.deepEqual(fertilizerStandard('99'), fallback)
})

test('収穫できる日は今日より先の場合だけ添える', () => {
  const today = '2026-11-09'
  assert.equal(upcomingHarvestDate('2026-11-21', today), '2026-11-21')
  assert.equal(upcomingHarvestDate(today, today), undefined)
  assert.equal(upcomingHarvestDate('2026-11-08', today), undefined)
  assert.equal(upcomingHarvestDate(undefined, today), undefined)
})
