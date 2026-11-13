import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { ymdKey } from '@/lib/insights/harvest-date-window'
import type { ProposalWeather } from '@/lib/proposals/weather'
import type { LocationArchive } from '@/lib/weather-normals'
import { addProposalCheckData, proposalCheckData, proposalCheckScenarios } from '../scripts/proposal-check-scenarios'
import { temporarySqlite } from './helpers/temporary-sqlite'

// 本番と同じ暦日で、実行マシンのタイムゾーンに左右されず答えを比較する。
process.env.TZ = 'Asia/Tokyo'
const now = new Date(2026, 10, 13, 12)

function archiveFixture(): LocationArchive {
  const times: string[] = []
  for (let year = 2016; year < 2026; year++) {
    for (let day = new Date(year, 0, 1); day.getFullYear() === year; day.setDate(day.getDate() + 1)) {
      times.push(ymdKey(day))
    }
  }
  return {
    times, precip: times.map(() => 2), radiation: times.map(() => 10),
    tempMean: times.map(() => 8), tempMin: null, tempMax: null,
  }
}

function fixedWeather(scenario: string): ProposalWeather {
  const archive = archiveFixture()
  return {
    async forecast(point, date) {
      assert.equal(date, now)
      if (scenario === '3') return []
      if (scenario === '2') {
        return [{ date: '2026-11-15', dayLabel: '11月15日', weather: '晴れ', weatherCode: 0,
          maxTemp: 15, minTemp: 3, avgTemp: 9, precipitation: 10, wind: 2 }]
      }
      assert.equal(point?.latitude, 34.995)
      return [{ date: '2026-11-15', dayLabel: '11月15日', weather: '雨', weatherCode: 61,
        maxTemp: 16, minTemp: 6, avgTemp: 11, precipitation: 80, wind: 2 }]
    },
    async accumulatedGdd({ endDate, point }) {
      if (scenario === '3') return null
      return endDate.getFullYear() < now.getFullYear() ? 3407 : point?.latitude === 34.995 ? 2688 : 2500
    },
    async archive(_point, date) {
      assert.equal(date, now)
      return scenario === '3' ? null : archive
    },
    async frost(_point, date) {
      assert.equal(date, now)
      if (scenario !== '1') return null
      return { source: 'estimate', stationName: null, distanceKm: null, elevationDiffM: null, near: false,
        summary: { mean: { month: 11, day: 25 }, earliest: { month: 11, day: 18 }, years: 10 } }
    },
    async coolNight(_point, date) {
      assert.equal(date, now)
      return { date: null, source: 'estimate', stationName: null, distanceKm: null }
    },
    async precipitation({ startDate, endDate }) {
      if (scenario === '3') return []
      assert.equal(startDate.getMonth(), now.getMonth())
      const result = []
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        result.push({ date: new Date(date), precipitationMm: date.getFullYear() === now.getFullYear() ? 4 : 1 })
      }
      return result
    },
  }
}

test('固定した日付・天気・記録から出る今日の提案', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const original = runtime.prisma
  runtime.prisma = db
  const { getTodayProposals } = await import('../lib/ai-proposal')
  const { groupTodayProposals } = await import('../lib/proposals/presentation')
  assert.equal((await import('../lib/prisma')).prisma, db)
  runtime.prisma = original
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('答え合わせではネットに接続しない') })

  for (const scenario of proposalCheckScenarios) {
    await t.test(`形 ${scenario}`, async () => {
      const user = await db.user.create({ data: { email: `scenario-${scenario}@example.invalid`, password: 'unused' } })
      await db.$transaction(tx => addProposalCheckData(tx, proposalCheckData(scenario, user.id, now)))
      const proposals = await getTodayProposals(user.id, { now, weather: fixedWeather(scenario) })
      const { confirmItems } = groupTodayProposals(proposals, [])

      // 「確認したいこと」は元の急ぎの度合いと別に、現行の表示区分も記録する。
      const cards = proposals.map(proposal => ({
        title: proposal.title,
        trigger: proposal.trigger,
        urgency: proposal.urgency,
        group: confirmItems.includes(proposal) ? '確認したいこと' :
          { today: '今日やること', thisWeek: '今週中に', watch: '様子見' }[proposal.urgency],
        crop: proposal.relatedCropName,
        farm: proposal.relatedFarmName,
        lines: proposal.lines?.map(({ cropName, farmName, variety, daysSincePlanting, currentGDD, targetGDD, targetCaption, harvestOutlook }) =>
          ({ cropName, farmName, variety, daysSincePlanting, currentGDD, targetGDD, targetCaption, harvestOutlook })),
        layers: proposal.layers,
      }))
      if (scenario === '1') {
        assert.ok(cards.some(card => card.trigger === 'frost-season' && /3,407℃日/.test(card.title)))
      } else if (scenario === '2') {
        assert.ok(cards.some(card => card.lines?.length === 2))
      } else {
        assert.ok(cards.some(card => card.trigger === 'task-due' && card.title === '今日が期限のタスクがあります'))
        assert.ok(cards.some(card => card.trigger === 'place-missing'))
      }
      const expectedPath = path.join(__dirname, 'fixtures', 'today-proposals', `${scenario}.json`)
      const expected = await readFile(expectedPath, 'utf8')
      assert.equal(JSON.stringify(cards, null, 2) + '\n', expected.replace(/\r\n/g, '\n'))
    })
  }
  assert.equal(fetch.mock.callCount(), 0)
})
