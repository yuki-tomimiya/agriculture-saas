import { renderWithRouter } from './helpers/next-runtime'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import MorningProposals from '@/app/dashboard/ai-proposal/MorningProposals'
import type { Proposal } from '@/lib/ai-proposal'
import type { ConfirmationCrop, ProposalSignal } from '@/lib/proposals/scoring'
import { organizeConfirmations } from '@/lib/proposals/presentation'
import { findPest } from '@/lib/pests/catalog'

Object.assign(globalThis, { React })

const crop = (id: string): ConfirmationCrop => ({ cropId: id, cropName: `作付け${id}`, reason: 'no-question' })
function proposal(cropId: string, trigger: string, signal: ProposalSignal): Proposal {
  return {
    id: `${trigger}-${cropId}`, relatedCropId: cropId, relatedCropName: crop(cropId).cropName, trigger,
    type: 'schedule', title: trigger, description: '', priority: 'low', urgency: 'watch',
    layers: { personal: null, regional: null, general: null, conclusion: '作付けを確認してください。' },
    signal,
  }
}

test('観測だけのカードは気象庁、推計・予報は近くに短い出典、長い説明はページに一度', () => {
  const data = organizeConfirmations([
    proposal('A', 'frost-season', { stage: 'season', reason: '11月14日（観測）', stationSource: true }),
    proposal('B', 'frost-season', { stage: 'season', reason: '11月14日（推計）', weatherSource: 'archive' }),
    proposal('C', 'frost-forecast', { stage: 'deadline', reason: '11月20日（あと3日）', deadline: '2026-11-20', weatherSource: 'forecast' }),
  ], ['A', 'B', 'C'].map(crop), [])
  const html = renderWithRouter(<MorningProposals data={data} guidance={new Map()} />)
  const cards = html.match(/<article\b[^>]*>.*?<\/article>/gs) ?? []
  const observed = cards.find(card => card.includes('11月14日（観測）'))
  assert.ok(observed)
  assert.match(observed, /出典：気象庁ホームページ.*日別値を加工して作成/)
  assert.doesNotMatch(observed, /Open-Meteo|出典・免責の原文|>あなた</)
  for (const card of cards.filter(card => card !== observed)) {
    assert.match(card, /Open-Meteo.com.*CC BY 4.0.*Tilltolで加工/)
    assert.doesNotMatch(card, /ERA5|先の値は数値予報モデル|出典・免責の原文/)
  }
  assert.equal((html.match(/出典・免責の原文/g) ?? []).length, 1)
  assert.equal((html.match(/先の値は数値予報モデルの計算結果です/g) ?? []).length, 1)
})

test('選んだ節目・病害虫にはカードで答え、奥から選ばれなかった問いに進める', () => {
  const pest = findPest('tomato:yellow-leaf-curl')
  assert.ok(pest)
  const pestQuestion = (id: string) => ({
    cropId: id, cropName: crop(id).cropName, farmName: '農場', pest,
    timing: null, timingSource: undefined, today: '2026-11-17',
  })
  const milestone = {
    key: 'flower-1st', trigger: 'milestone:flower-1st', question: '花が咲きましたか？',
    term: '第1花房', ifYes: '観察結果を記録します。', sourceLabel: '資料',
    howTo: [], yesLabel: '咲いた', windowNote: '見回りの時期です。', reason: '花を見てください。',
  }
  const selected = {
    ...proposal('A', milestone.trigger, { stage: 'window', reason: milestone.reason }),
    milestone,
  }
  const render = (data: ReturnType<typeof organizeConfirmations>) =>
    renderWithRouter(<MorningProposals data={data} guidance={new Map()} />)
  const data = organizeConfirmations([selected], ['A', 'B', 'C'].map(crop),
    ['A', 'B', 'C'].map(pestQuestion))
  const html = render(data)
  const cards = html.match(/<article\b[^>]*>.*?<\/article>/gs) ?? []
  assert.equal(cards.length, 2)
  assert.match(cards[0], />咲いた<.*<summary>根拠・ほかの確認<\/summary>/s)
  assert.match(cards[0], /href="#question-pest-tomato-yellow-leaf-curl"/)
  assert.match(cards[1], /作付けB.*作付けC/s)
  assert.equal((cards[1].match(/>いなかった</g) ?? []).length, 2)
  assert.equal((cards[1].match(/<summary>/g) ?? []).length, 1)
  const remaining = html.slice(html.indexOf('id="morning-answers"'))
  assert.match(remaining, /作付けA/)
  assert.doesNotMatch(remaining, /作付けB|作付けC|>咲いた</)
  assert.doesNotMatch(render(organizeConfirmations([selected], [crop('A')], [])), /id="morning-answers"/)
})
