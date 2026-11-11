import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeGDDProjection, formatHarvestGddOutlook, formatHarvestGddTarget } from '@/lib/gdd'
import { pickHarvestBasis, type HarvestSample } from '@/lib/insights/harvest-gdd-basis'
import { assessSweetPotatoFrost, FROST_SEASON_TRIGGER } from '@/lib/proposals/frost'

const crop = { name: 'さつまいも', cropKind: 'sweet-potato', variety: '紅はるか', growingSite: 'open' }
const plantingDate = new Date(2025, 4, 1)
const endDate = new Date(2025, 9, 1)

function sample(cropId: string, gdd: number, variety = crop.variety): HarvestSample {
  return {
    cropId, name: crop.name, variety, varietyLabel: variety, cropKey: 'kind:sweet-potato',
    subjectLabel: crop.name, growingSite: crop.growingSite, gdd, dayCount: null, days: 153,
    seasonLabel: '2025年作', plantingTime: +plantingDate, plantingDate, countStart: plantingDate,
    endDate, count: 'simple', baseTemp: 0, latitude: null, longitude: null,
  }
}

function heatTarget(samples: HarvestSample[]) {
  const basis = pickHarvestBasis(samples, crop)
  if (basis.view.status !== 'active' || basis.gdd == null) assert.fail('積算温度の目安が必要')
  return { targetGdd: basis.gdd, reference: { sampleCount: basis.sampleCount, method: basis.view } }
}

test('資料の目安を超えても前回の収穫時点には届かないときは、両方の物差しを示す', () => {
  const target = heatTarget([sample('last', 3407)])
  assert.equal(formatHarvestGddOutlook({ ...target, currentGdd: 2688, windowText: null }),
    '資料の目安（2,400℃）は超えましたが、今季は前回のあなたが収穫した時点（3,407℃日）には届かない見込みです。')
  assert.equal(formatHarvestGddOutlook({ ...target, currentGdd: 2400, windowText: null }),
    '今季は前回のあなたが収穫した時点（3,407℃日）には届かない見込みです。')
})

test('同じ品種の実績がなくても、1作の記録を使う場合は平均とは表示しない', () => {
  const samples = [sample('other-variety', 3407, 'ベニアズマ')]
  const target = heatTarget(samples)
  assert.equal(pickHarvestBasis(samples, crop).source, 'crop')
  assert.match(pickHarvestBasis(samples, crop).summary, /前回のあなたは/)
  assert.equal(formatHarvestGddTarget(target.targetGdd, target.reference),
    '前回のあなたが収穫した時点（3,407℃日）')
})

test('複数の実績では作数と平均を示し、実績がなければ資料の目安と明記する', () => {
  const personal = heatTarget([sample('first', 3200), sample('second', 3400)])
  assert.equal(formatHarvestGddOutlook({ ...personal, currentGdd: 2100, windowText: '11月25日ごろ' }),
    '過去2作の収穫時点の平均（3,300℃日）に届くのは11月25日ごろ。')
  const method = heatTarget([])
  assert.equal(formatHarvestGddOutlook({ ...method, currentGdd: 2100, windowText: null }),
    '今季は資料の目安（2,400℃）には届かない見込みです。')
})

test('数値予報モデルによる計算と、到達の文の物差しを確認する', () => {
  const { targetGdd, reference } = heatTarget([sample('last', 3407)])
  const forecast = [{ date: new Date(2026, 10, 12), avgTemp: 10 }]
  const { endCumulativeGDD, targetReachDate, suggestions } = computeGDDProjection(
    3407, 'simple', 0, forecast, targetGdd, { reference },
  )
  assert.equal(endCumulativeGDD, 3417)
  assert.equal(targetReachDate, forecast[0].date)
  assert.deepEqual(suggestions, [
    '資料の目安（2,400℃）は超えました。前回のあなたが収穫した時点（3,407℃日）にはすでに届いています。',
  ])
})

test('霜のカードでも両方の物差しを示し、試し掘りの助言は残す', () => {
  const frost = assessSweetPotatoFrost({
    ...heatTarget([sample('last', 3407)]),
    today: new Date(2026, 10, 11),
    forecast: [],
    firstFrost: {
      source: 'estimate', stationName: null, distanceKm: null, elevationDiffM: null, near: false,
      summary: { mean: { month: 11, day: 25 }, earliest: { month: 11, day: 17 }, years: 10 },
    },
    currentGdd: 2688,
    hasSeenRoots: false,
    harvestWindow: null,
    harvestWindowReady: true,
  })

  assert.equal(frost?.trigger, FROST_SEASON_TRIGGER)
  assert.match(frost.harvestOutlook?.text ?? '', /資料の目安（2,400℃）.*前回のあなたが収穫した時点（3,407℃日）/)
  assert.match(frost.conclusion, /試し掘りで太りを確かめて、霜の前に掘り上げましょう/)
})
