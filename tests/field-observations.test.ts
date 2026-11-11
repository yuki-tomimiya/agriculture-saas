import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fieldObservationOptions } from '@/lib/crops/field-observations'
import { CROP_KINDS } from '@/lib/crops/conditions'

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

test('報告で確認できた条件を省き、数字と問いかけ用の助言を維持する', () => {
  const milestones = CROP_KINDS.flatMap(({ key: cropKind, label: name }) =>
    fieldObservationOptions({ cropKind, name, variety: null, milestones: [] }).milestones)
  const thirdFlower = milestones.find(item => item.key === 'flower-3rd')
  assert.match(thirdFlower?.ifYes ?? '', /^咲いていれば、/)
  assert.match(thirdFlower?.reportedAdvice ?? '', /^追肥（穴肥）を始める時期です。/)
  const mainStem = milestones.find(item => item.key === 'main-stem')
  assert.match(mainStem?.reportedAdvice ?? '', /支柱の高さ（20節前後）まで伸びたので、主枝を摘心/)
  for (const item of milestones) {
    if (item.key === 'test-dig' || item.key === 'lettuce-outer-leaves') continue
    assert.doesNotMatch(item.reportedAdvice, /^[^。]*?(?:ていれば|たら)(?:、|収穫へ)/, item.key)
  }
})

test('試し掘りの結果と玉レタスの球重に応じた条件は残す', () => {
  const options = (cropKind: string) =>
    fieldObservationOptions({ cropKind, name: cropKind, variety: null, milestones: [] }).milestones
  const dig = options('sweet-potato').find(item => item.key === 'test-dig')
  assert.match(dig?.reportedAdvice ?? '', /^太っていれば収穫へ。細ければ、もう少し置きます。/)
  assert.equal(dig?.reportedAdvice, dig?.ifYes)
  assert.match(options('lettuce-head')[0].reportedAdvice, /^球の重さが400〜500g前後になったら収穫の目安です。/)
})
