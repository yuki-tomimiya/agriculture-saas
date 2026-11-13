import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Proposal } from '@/lib/ai-proposal'
import { organizeConfirmations } from '@/lib/proposals/presentation'
import type { ConfirmationCrop, ProposalSignal } from '@/lib/proposals/scoring'

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
  assert.equal(result.deadlineCount, 2)
  assert.deepEqual(result.deadlineGroups.map(group => group.map(row => row.selected.reason)), [['3℃', '2℃']])
})
