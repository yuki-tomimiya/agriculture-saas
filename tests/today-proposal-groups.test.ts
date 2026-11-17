import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Proposal } from '@/lib/ai-proposal'
import { assessSweetPotatoFrost } from '@/lib/proposals/frost'
import { pickMilestoneAsk } from '@/lib/proposals/milestones'
import { organizeConfirmations } from '@/lib/proposals/presentation'
import type { ConfirmationCrop, ProposalSignal } from '@/lib/proposals/scoring'

test('玉ねぎの倒伏は苗と植え方未入力の作付けにだけ聞く', () => {
  const onion = { cropName: '玉ねぎ', daysSincePlanting: 160, records: [] }
  assert.equal(pickMilestoneAsk({ ...onion, plantingMethod: 'direct' }), null)
  assert.equal(pickMilestoneAsk({ ...onion, plantingMethod: 'transplant' })?.key, 'onion-lodging')
  assert.equal(pickMilestoneAsk(onion)?.key, 'onion-lodging')
})

function candidate(cropId: string, trigger: string, stage: ProposalSignal['stage'], deadline?: string, reason = trigger): Proposal {
  return {
    id: `${cropId}-${trigger}`, relatedCropId: cropId, trigger,
    type: 'schedule', title: trigger, description: '', priority: 'low', urgency: 'watch',
    layers: { personal: null, regional: null, general: null, conclusion: '霜の前に掘り上げましょう。' },
    signal: { stage, reason, deadline },
  }
}

test('締切・例年の時期・到達・窓の順で、点数や入力順によらず1作付けに1つ選ぶ', () => {
  const crop: ConfirmationCrop = { cropId: 'A', cropName: 'さつまいも', reason: 'no-question' }
  const late = candidate('A', 'frost-forecast', 'deadline', '2026-11-16')
  const early = candidate('A', 'spring-frost', 'deadline', '2026-11-15')
  const candidates = [
    candidate('A', 'milestone:later', 'window'),
    candidate('A', 'harvest-window', 'reached'),
    late,
    candidate('A', 'neglected-crop', 'organize'),
    candidate('A', 'frost-season', 'season'),
    early,
    candidate('A', 'milestone:earlier', 'window'),
  ]
  for (const input of [candidates, [...candidates].reverse()]) {
    const result = organizeConfirmations(input, [crop], [])
    const row = result.deadlineGroups[0][0]
    assert.equal(result.count, 1)
    assert.equal(row.selected.trigger, 'spring-frost')
    assert.deepEqual(row.others.map(item => item.trigger), [
      'frost-forecast', 'frost-season', 'harvest-window', 'milestone:earlier', 'milestone:later',
    ])
    assert.deepEqual(result.organization.map(item => item.trigger), ['neglected-crop'])
  }
})

test('同じ日と行動の霜は一緒に並べ、農場ごとの気温と締切の件数を保つ', () => {
  const crops: ConfirmationCrop[] = [
    { cropId: 'A', cropName: 'さつまいもA', farmName: '館山', reason: 'no-question' },
    { cropId: 'B', cropName: 'さつまいもB', farmName: '宇都宮', reason: 'no-question' },
  ]
  const result = organizeConfirmations([
    candidate('A', 'frost-forecast', 'deadline', '2026-11-15', '3℃'),
    candidate('B', 'frost-forecast', 'deadline', '2026-11-15', '2℃'),
  ], crops, [])
  assert.equal(result.deadlineCount, 1)
  assert.deepEqual(result.deadlineGroups.map(group => group.map(row => row.selected.reason)), [['3℃', '2℃']])
})

test('同じきっかけと理由を1枚にまとめ、異なる理由の作付けを別のカードに残す', () => {
  const crops: ConfirmationCrop[] = ['A', 'B', 'C', 'D', 'E'].map(cropId =>
    ({ cropId, cropName: cropId, reason: 'no-question' }))
  const result = organizeConfirmations([
    ...['A', 'B', 'C'].map(id => candidate(id, 'frost-season', 'season', undefined, 'あと3日')),
    candidate('D', 'frost-season', 'season', undefined, 'あす'),
    candidate('E', 'season-finish', 'season', undefined, 'あと3日'),
    candidate('B', 'harvest-window', 'reached'),
  ], crops, [])
  assert.deepEqual(result.confirmationGroups.map(rows => rows.map(row => row.crop.cropId)),
    [['A', 'B', 'C'], ['D'], ['E']])
  assert.equal(result.count, 3)
  assert.deepEqual(result.confirmationGroups[0][1].others.map(item => item.trigger), ['harvest-window'])
})

test('例年の霜の理由は作付けの見込みを先に置き、最早日までの日数を添える', () => {
  for (const [day, expected] of [[17, '今年はもう過ぎています'], [14, '今日にあたります'], [13, 'あすです'], [11, 'あと3日です']] as const) {
    const frost = assessSweetPotatoFrost({
      today: new Date(2026, 10, day, 12), forecast: [], currentGdd: 3000, targetGdd: 3398,
      reference: { sampleCount: 1, method: { low: 2400, count: 'simple' } },
      firstFrost: {
        summary: { earliest: { month: 11, day: 14 }, mean: { month: 11, day: 20 }, years: 10 },
        source: 'station', stationName: '宇都宮', elevationDiffM: 18, distanceKm: 2, near: true,
      },
      hasSeenRoots: false, harvestWindow: null, harvestWindowReady: true,
    })
    assert.ok(frost)
    assert.match(frost.confirmationReason, /^前回あなたが収穫した時点（3,398℃日）には今季届かない見込みです。/)
    assert.ok(frost.confirmationReason.endsWith(`11月14日（観測）で、${expected}。`))
    assert.match(frost.confirmationLayers.regional, /宇都宮観測所/)
    assert.doesNotMatch(frost.confirmationLayers.general, /観測所|3,398/)
  }
})
