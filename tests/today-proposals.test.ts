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
  const { loadTodayConfirmations } = await import('../lib/proposals/presentation')
  assert.equal((await import('../lib/prisma')).prisma, db)
  runtime.prisma = original
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('答え合わせではネットに接続しない') })

  for (const scenario of proposalCheckScenarios) {
    await t.test(`形 ${scenario}`, async () => {
      const user = await db.user.create({ data: { email: `scenario-${scenario}@example.invalid`, password: 'unused' } })
      await db.$transaction(tx => addProposalCheckData(tx, proposalCheckData(scenario, user.id, now)))
      const weather = fixedWeather(scenario)
      const legacy = await getTodayProposals(user.id, { now, weather })
      const result = await loadTodayConfirmations(user.id, { now, weather })
      const answer = readableAnswer(result)
      if (scenario === '1') {
        assert.equal(answer.confirmations[0].selected.trigger, 'frost-season')
        assert.ok(answer.confirmations[0].others.some(card => card.trigger === 'milestone:test-dig'))
        assert.ok(legacy.some(card => card.trigger === 'frost-season' && /3,407℃日/.test(card.title)))
        assert.deepEqual(legacy.map(card => card.trigger), ['result-missing', 'milestone:test-dig', 'frost-season', 'neglected-crop'])
      } else if (scenario === '2') {
        assert.deepEqual(result.deadlineGroups.map(group => group.length), [2])
        assert.ok(result.milestoneGroups.some(group => group[0].milestone?.key === 'flower-1st' && group.length === 2))
        assert.ok(legacy.some(card => card.trigger === 'frost-forecast' && card.lines?.length === 2))
      } else {
        assert.equal(result.taskGroups.flat().length, 1)
        assert.equal(answer.confirmations[0].selected.trigger, 'milestone:flower-1st')
        assert.ok(answer.organization.items.some(card => card.trigger === 'place-missing'))
      }
      const expectedPath = path.join(__dirname, 'fixtures', 'today-proposals', `${scenario}.json`)
      const actual = JSON.stringify(answer, null, 2) + '\n'
      const expected = await readFile(expectedPath, 'utf8')
      assert.equal(actual, expected.replace(/\r\n/g, '\n'))
    })
  }

  await t.test('全締切、位置なしで使える節目、確認事項がない4つの理由', async () => {
    const user = await db.user.create({ data: { email: 'no-confirmations@example.invalid', password: 'unused' } })
    const place = await db.farm.create({ data: { userId: user.id, name: '位置あり', latitude: 35, longitude: 139 } })
    const noPlace = await db.farm.create({ data: { userId: user.id, name: '位置なし' } })
    const planted = new Date(2026, 9, 30)
    const crops = [
      { name: '位置なし', cropKind: 'sweet-potato', farmId: noPlace.id, plantingDate: new Date(2026, 10, 11) },
      { name: '気象データなし', cropKind: 'sweet-potato', farmId: place.id, plantingDate: new Date(2026, 10, 11) },
      { name: '記録だけ', cropKind: 'other', farmId: noPlace.id, plantingDate: planted },
      { name: '今は聞くことがない', cropKind: 'tomato', farmId: place.id },
      { name: '絹糸の記録あり', cropKind: 'sweet-corn', farmId: noPlace.id, plantingDate: new Date(2026, 7, 20) },
    ]
    await db.crop.createMany({ data: crops })
    const corn = await db.crop.findFirstOrThrow({ where: { name: '絹糸の記録あり', farmId: noPlace.id } })
    await db.cropMilestone.create({ data: { cropId: corn.id, key: 'silk', source: 'manual', observedAt: new Date(2026, 9, 22) } })
    await db.task.createMany({ data: [
      { farmId: noPlace.id, title: '誘引', dueDate: new Date(2026, 10, 13) },
      { farmId: place.id, title: '誘引', dueDate: new Date(2026, 10, 13) },
      { farmId: place.id, title: '片づけ', dueDate: new Date(2026, 10, 12) },
      { farmId: place.id, title: '明日', dueDate: new Date(2026, 10, 14) },
    ] })
    const weather = fixedWeather('3')
    const result = await loadTodayConfirmations(user.id, {
      now, weather: { ...weather, async forecast(point, date) {
        assert.equal(point?.latitude, 35)
        return weather.forecast(point, date)
      } },
    })
    assert.deepEqual(result.taskGroups.map(group => group.length), [1, 2])
    assert.equal(result.deadlineCount, 3)
    assert.equal(result.count, 4)
    assert.equal(result.confirmations[0].selected.stage, 'reached')
    assert.deepEqual(Object.fromEntries(Object.entries(result.noConfirmations).map(([reason, crops]) => [reason, crops.map(crop => crop.cropName)])), {
      'no-location': ['位置なし'], 'no-weather': ['気象データなし'],
      'record-only': ['記録だけ'], 'no-question': ['今は聞くことがない'],
    })
  })
  await t.test('トマトの例年の冷え込みは、整理ではなく季節の確認事項', async () => {
    const user = await db.user.create({ data: { email: 'cool-night@example.invalid', password: 'unused' } })
    await db.$transaction(tx => addProposalCheckData(tx, proposalCheckData('2', user.id, now)))
    const result = await loadTodayConfirmations(user.id, { now, weather: {
      ...fixedWeather('2'),
      async coolNight() {
        return { date: { month: 11, day: 1 }, source: 'estimate', stationName: null, distanceKm: null }
      },
    } })
    assert.equal(result.confirmations.length, 2)
    for (const row of result.confirmations) {
      assert.equal(row.selected.stage, 'season')
      assert.equal(row.selected.trigger, 'season-finish')
      assert.match(row.selected.reason, /13℃/)
      assert.deepEqual(row.others.map(item => item.trigger), ['milestone:flower-1st', 'pest:tomato:yellow-leaf-curl'])
    }
    assert.ok(result.organization.every(proposal => proposal.trigger !== 'season-finish'))
  })
  assert.equal(fetch.mock.callCount(), 0)
})

type Result = Awaited<ReturnType<typeof import('../lib/proposals/presentation').loadTodayConfirmations>>
type CropRow = Result['confirmations'][number]
type Confirmation = CropRow['selected']
type Proposal = import('../lib/ai-proposal').Proposal

function proposalAnswer(proposal: Proposal) {
  return { trigger: proposal.trigger, title: proposal.title, layers: proposal.layers }
}

function confirmationAnswer(item: Confirmation) {
  return {
    stage: item.stage, reason: item.reason,
    ...(item.kind === 'proposal' ? proposalAnswer(item.proposal) : {
      trigger: item.trigger, title: item.question.pest.question, timingSource: item.question.timingSource,
    }),
  }
}

function cropAnswer(row: CropRow) {
  return {
    crop: row.crop.cropName, farm: row.crop.farmName,
    selected: confirmationAnswer(row.selected), others: row.others.map(confirmationAnswer),
  }
}

function readableAnswer(result: Result) {
  return {
    count: result.count,
    taskGroups: result.taskGroups.map(group => group.map(proposal => ({
      crop: proposal.relatedCropName, farm: proposal.relatedFarmName, reason: proposal.signal?.reason,
      ...proposalAnswer(proposal),
    }))),
    deadlineGroups: result.deadlineGroups.map(group => group.map(cropAnswer)),
    confirmations: result.confirmations.map(cropAnswer),
    noConfirmations: Object.fromEntries(Object.entries(result.noConfirmations).map(([reason, crops]) => [
      reason, crops.map(crop => ({ crop: crop.cropName, farm: crop.farmName })),
    ])),
    organization: { count: result.organization.length, items: result.organization.map(proposal => ({
      crop: proposal.relatedCropName, ...proposalAnswer(proposal),
    })) },
    supplemental: result.supplemental.map(proposalAnswer),
    milestoneGroups: result.milestoneGroups.map(group => ({
      question: group[0].title, crops: group.map(item => item.relatedCropName),
    })),
    pestGroups: result.pestGroups.map(group => ({
      question: group[0].pest.question, crops: group.map(item => item.cropName),
    })),
  }
}
