import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateHarvestWindow, formatHarvestWindow, projectTwoStageHarvestWindow, type HarvestDateWindow } from '@/lib/insights/harvest-date-window'
import { annualPeriodTotals, tenYearClass } from '@/lib/insights/ten-year-classes'
import type { LocationArchive } from '@/lib/weather-normals'

function archiveFromDays(times: string[], values: Array<number | null>): LocationArchive {
  return { times, tempMean: values, precip: values, radiation: [], tempMin: null, tempMax: null }
}

function decemberArchive(start: number, temperatures: Array<Array<number | null>>): LocationArchive {
  const times = temperatures.flatMap((year, index) =>
    year.map((_, day) => `${2016 + index}-12-${start + day}`))
  return archiveFromDays(times, temperatures.flat())
}

function windowFor(early: number, late: number, years: number, reached: number, inside: number): HarvestDateWindow {
  return {
    early: new Date(2026, 11, early, 12), late: new Date(2026, 11, late, 12),
    years, reached, inside,
  }
}

test('H1 収穫の見込みは4年から両端を除き、到達年の数を別に表示する', () => {
  const temperatures = [
    [20, 0, 0, 0, 0], [10, 10, 0, 0, 0], [0, 10, 10, 0, 0], [0, 0, 10, 10, 0], [3, 3, 3, 3, 3],
  ]
  const args = {
    today: new Date(2026, 11, 26, 12), currentGdd: 2380, targetGdd: 2400,
    count: 'simple' as const, baseTemp: 0, archive: decemberArchive(27, temperatures),
  }
  const projected = calculateHarvestWindow(args)
  assert.deepEqual(projected, { status: 'projected', window: windowFor(28, 29, 5, 4, 2) })
  assert.ok(projected.status === 'projected')
  assert.match(formatHarvestWindow(projected.window), /^12月28日〜12月29日.*5年中4年だけ年内に届き、極端な年を除いた2年がこの間/)
  assert.deepEqual(calculateHarvestWindow({ ...args, archive: decemberArchive(27, temperatures.slice(0, 3)) }), {
    status: 'projected', window: windowFor(27, 29, 3, 3, 3),
  })
  assert.deepEqual(calculateHarvestWindow({ ...args, archive: decemberArchive(27, [temperatures[4]]) }),
    { status: 'unreachable' })
  const reached = calculateHarvestWindow({ ...args, currentGdd: 2400 })
  assert.deepEqual(reached, { status: 'projected', window: windowFor(26, 26, 5, 5, 3) })
  assert.ok(reached.status === 'projected')
  assert.match(formatHarvestWindow(reached.window, { provisional: true }),
    /^12月26日（.*5年中3年がこの日）。目安が暫定/)
})

test('H2 ブロッコリーは出蕾の翌日から収穫までの積算を始める', () => {
  const args = {
    plantingDate: new Date(2026, 11, 15), milestoneGdd: 40, harvestGdd: 192,
    count: 'effective' as const, baseTemp: 5,
    archive: decemberArchive(15, [
      [20, 20, 4, ...Array<number>(12).fill(21), 5, 5],
      [20, null, 20, ...Array<number>(14).fill(5)],
    ]),
  }
  assert.deepEqual(projectTwoStageHarvestWindow(args), {
    milestone: windowFor(16, 17, 2, 2, 2),
    harvest: windowFor(29, 29, 2, 1, 1),
  })
  for (const zero of [{ milestoneGdd: 0 }, { harvestGdd: 0 }]) {
    assert.deepEqual(projectTwoStageHarvestWindow({ ...args, ...zero }), { milestone: null, harvest: null })
  }
})

test('Q2 10年の階級は境界ちょうどを中央にし、境界や年数が足りないと判定しない', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 16, 12) })
  const years = Array.from({ length: 10 }, (_, i) => 2016 + i)
  const amounts = years.map((_, i) => (i + 1) * 10)
  const day = new Date(2026, 8, 1, 12)
  const args = { start: day, end: day, measure: 'rain' as const }
  const dates = years.map(year => `${year}-09-01`)
  const totals = annualPeriodTotals({ ...args, archive: archiveFromDays(dates, amounts) })
  assert.deepEqual(totals, amounts)
  assert.deepEqual([34, 35, 75, 76].map(value => tenYearClass(value, totals)), ['low', 'middle', 'middle', 'high'])
  const tied = [10, 20, 30, 30, 50, 60, 70, 80, 90, 100]
  assert.equal(tenYearClass(35, tied), null)
  const missing = annualPeriodTotals({ ...args, archive: archiveFromDays(dates, [null, ...amounts.slice(1)]) })
  assert.equal(missing.length, 9)
  assert.equal(tenYearClass(35, missing), null)

  const crossYear = annualPeriodTotals({
    start: new Date(2026, 11, 31, 12), end: new Date(2027, 0, 1, 12), measure: 'rain',
    archive: archiveFromDays(years.flatMap(year => [`${year}-01-01`, `${year}-12-31`]), Array<number>(20).fill(1)),
  })
  assert.deepEqual(crossYear, Array<number>(9).fill(2))
  assert.equal(tenYearClass(2, crossYear), null)
})
