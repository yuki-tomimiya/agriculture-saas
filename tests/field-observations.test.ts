import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fieldObservationOptions } from '@/lib/crops/field-observations'

test('品目の節目と病害虫を表示し、日付を直せる', () => {
  const tomato = fieldObservationOptions({
    cropKind: 'tomato', name: '区画Aの作付け', variety: null,
    milestones: [{ key: 'flower-3rd', observedAt: new Date(2026, 10, 10, 12) }],
  })
  assert.deepEqual(tomato.milestones.map(item => item.key), ['flower-1st', 'flower-3rd'])
  const recorded = tomato.milestones[1]
  assert.equal(recorded.observedAt, '2026-11-10')
  assert.match(recorded.label, /3段目の花のかたまりが咲いた/)
  assert.ok(recorded.ifYes && recorded.sourceLabel)
  assert.deepEqual(tomato.pests.map(item => item.name), ['黄化葉巻病'])
  assert.ok(tomato.pests[0].marker)
  assert.match(tomato.pests[0].appearanceUrl ?? '', /^https:\/\//)
  const onion = fieldObservationOptions({ cropKind: 'onion', name: '玉ねぎ', variety: null, milestones: [] })
  assert.deepEqual(onion.milestones.map(item => item.key), ['onion-lodging'])
  assert.deepEqual(onion.pests.map(item => item.name), ['べと病'])
})

test('記録だけの品目には節目も病害虫も出さない', () => {
  for (const cropKind of ['strawberry-ever', 'lettuce-leaf', 'negi-leaf', 'other']) {
    assert.deepEqual(fieldObservationOptions({ cropKind, name: 'トマト', variety: null, milestones: [] }), {
      milestones: [], pests: [],
    })
  }
})
