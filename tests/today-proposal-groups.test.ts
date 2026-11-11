import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Proposal } from '@/lib/ai-proposal'
import { isProposalDismissed } from '@/lib/proposals/dismissal'
import { groupTodayProposals } from '@/lib/proposals/presentation'

test('表示するカードを今日・今週・確認に分け、病害虫の問いかけはカード単位で数える', () => {
  const candidates: (Pick<Proposal, 'id' | 'urgency' | 'trigger'> & { cropId?: string })[] = [
    { id: 'due-task', urgency: 'today', trigger: 'task-due' },
    { id: 'frost', urgency: 'thisWeek', trigger: 'frost-season' },
    { id: 'finish', urgency: 'today', trigger: 'season-finish' },
    { id: 'conditions', urgency: 'today', trigger: 'conditions-missing' },
    { id: 'result', urgency: 'today', trigger: 'result-missing' },
    { id: 'place', urgency: 'today', trigger: 'place-missing' },
    { id: 'milestone', urgency: 'thisWeek', trigger: 'milestone:test-dig' },
    { id: 'watch', urgency: 'watch', trigger: 'neglected-crop' },
    { id: 'closed', urgency: 'today', trigger: 'harvest-window', cropId: 'closed-crop' },
  ]
  const dismissals = [{ trigger: 'harvest-window', cropId: 'closed-crop' }]
  const visible = candidates.filter(card => !isProposalDismissed(dismissals, card.trigger, card.cropId))
  const pestQuestions = [
    { cropId: 'A', pest: { key: 'aphid' } },
    { cropId: 'B', pest: { key: 'aphid' } },
    { cropId: 'C', pest: { key: 'mite' } },
  ]

  const { todayItems, weekItems, confirmItems, pestGroups, watchCount } = groupTodayProposals(visible, pestQuestions)

  assert.deepEqual(todayItems.map(card => card.id), ['due-task'])
  assert.deepEqual(weekItems.map(card => card.id), ['frost'])
  assert.deepEqual(confirmItems.map(card => card.id), ['finish', 'conditions', 'result', 'place', 'milestone'])
  assert.deepEqual(pestGroups.map(cards => cards.map(card => card.cropId)), [['A', 'B'], ['C']])
  assert.equal(watchCount, 1)
})
