import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findPest } from '../lib/pests/catalog'
import { selectPestQuestion } from '../lib/pests/selection'
import { temporarySqlite } from './helpers/temporary-sqlite'

test('さといもの疫病は各県で順に聞き、農場の県の対策を先に出す', async t => {
  const pest = findPest('taro:phytophthora-blight')!
  assert.deepEqual(pest.seasons, [])
  assert.match(pest.appearance?.url ?? '', /pref\.chiba\.lg\.jp/)
  for (let i = 1; i <= 47; i++) {
    const q = selectPestQuestion({ cropKind: 'taro', farmId: 'f', growingSite: 'open', plantingDay: '2026-01-01', prefectureCode: String(i).padStart(2, '0') },
      '2026-09-01', [], [], new Set(['taro:common-cutworm', 'taro:dry-rot']))
    assert.equal(q?.pest.key, pest.key)
    assert.equal(q?.rank, 3)
  }
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const saved = runtime.prisma
  runtime.prisma = db
  t.after(() => { runtime.prisma = saved })
  const { loadPestAdvice } = await import('../lib/pests/service')
  for (const [code, expected] of [['12', ['12','45','46']], ['45', ['45','12','46']], ['38', ['38','12','45']], ['13', ['12','45','46']]] as const) {
    const advice = await loadPestAdvice('owner', { id: 'crop', name: 'さといも', variety: null, cropKind: 'taro', farmId: 'f', growingSite: 'open', status: 'growing', farm: { name: '畑', prefectureCode: code } }, pest.key)
    assert.deepEqual(advice?.measures.map(m => m.code), expected)
    for (const m of advice!.measures) {
      assert.equal(m.scope, 'prefecture')
      assert.match(m.text, /^(千葉|宮崎|鹿児島|愛媛)県/)
    }
  }
})
