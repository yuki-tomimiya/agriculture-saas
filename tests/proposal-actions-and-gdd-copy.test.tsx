import { renderWithRouter } from './helpers/next-runtime'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import GDDChart from '../components/GDDChart'
import MorningProposals from '../app/dashboard/ai-proposal/MorningProposals'
import { organizeConfirmations } from '../lib/proposals/presentation'
import type { Proposal } from '../lib/ai-proposal'

Object.assign(globalThis, { React })

test('積算温度の割合に比較対象を添え、収穫の見分けの言葉を既存の一覧から出す', () => {
  const render = (sampleCount: number, name = 'キャベツ', showHarvestTarget = true) => renderWithRouter(<GDDChart
    crop={{ id: 'crop', name, variety: null, plantingDate: new Date(2026, 10, 1), baseTemperature: 0 }}
    currentGDD={832} targetGDD={1000} showHarvestTarget={showHarvestTarget} harvestReference={{ sampleCount, method: { low: 1000, count: 'simple' } }}
    dailyProjections={[{ date: new Date(2026, 10, 25), cumulativeGDD: 900 }]} />)
  const once = render(1)
  assert.match(once, /現在の積算温度は、前回あなたが収穫した時点の <span[^>]*>83.2%/)
  assert.match(once, /数値予報モデルの計算の積算温度は、前回あなたが収穫した時点の <span[^>]*>90.0%/)
  assert.match(render(2), /過去2作の収穫時点の平均の <span[^>]*>83.2%/)
  assert.match(render(0), /資料の目安の <span[^>]*>83.2%/)
  assert.match(once, /収穫は球の固さを見て決めます。/)
  assert.match(render(0, 'キャベツ', false), /収穫は球の固さを見て決めます。/)
  assert.doesNotMatch(render(1, '見分けが未登録の品目'), /収穫は.*を見て決めます/)
  assert.doesNotMatch(once, /基準までの進捗|進捗（現在）/)
})

test('選ばれた提案の行動は表に、ほかの確認の行動は奥に残す', () => {
  const proposal = (id: string, trigger: string, stage: 'deadline' | 'window'): Proposal => ({
    id: trigger + id, relatedCropId: id, relatedCropName: id, trigger,
    type: 'schedule', title: trigger, description: '', priority: 'low', urgency: 'watch',
    action: { kind: 'work', taskType: stage === 'deadline' ? '収穫' : '追肥' },
    layers: { personal: null, regional: null, general: null, conclusion: '見て決めます。' },
    signal: { stage, reason: '同じ理由', ...(stage === 'deadline' ? { deadline: '2026-11-25' } : {}) },
  })
  const selected = proposal('A', 'frost-forecast', 'deadline')
  const other = proposal('A', 'other-check', 'window')
  const crop = (id: string) => ({ cropId: id, cropName: id, reason: 'no-question' as const })
  const data = organizeConfirmations([selected, other], [crop('A')], [])
  const html = renderWithRouter(<MorningProposals data={data} guidance={new Map()} />)
  const card = html.match(/<article\b[^>]*>.*?<\/article>/s)![0]
  const front = card.slice(0, card.indexOf('<details class="morning-disclosure">'))
  const detail = card.slice(front.length)
  assert.match(front, />記録する<\/a>/)
  assert.match(front, />タスクにする<\/a>/)
  assert.doesNotMatch(front, /taskType=.*追肥/)
  assert.equal((detail.match(/>記録する<\/a>/g) ?? []).length, 1)
  assert.equal((detail.match(/>タスクにする<\/a>/g) ?? []).length, 1)

  const sharedTask = [selected, { ...proposal('B', 'frost-forecast', 'deadline') }]
    .map(row => ({ ...row, relatedTaskId: 'shared-task' }))
  const grouped = renderWithRouter(<MorningProposals data={organizeConfirmations(sharedTask, [crop('A'), crop('B')], [])} guidance={new Map()} />)
  assert.equal((grouped.match(/href="\/tasks\/shared-task"/g) ?? []).length, 1)
})
