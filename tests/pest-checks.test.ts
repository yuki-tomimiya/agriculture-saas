import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pests, pestGuide } from '@/lib/pests/catalog'
import { selectPestQuestion } from '@/lib/pests/selection'
import { groupPestQuestions, pestMeasuresForSite } from '@/lib/pests/presentation'
import { PROPOSAL_DISMISS_DAYS } from '@/lib/proposals/constants'

const crop = { cropKind: 'cucumber', farmId: 'farm', growingSite: 'house', plantingDay: '2026-10-01' }
const pestKey = 'cucumber:powdery-mildew'
const ask = (options: Partial<typeof crop> & { prefectureCode?: string } = {}, checks: Parameters<typeof selectPestQuestion>[2] = [],
  history: Parameters<typeof selectPestQuestion>[3] = [], deferred: ReadonlySet<string> = new Set()) =>
  selectPestQuestion({ ...crop, ...options }, '2026-11-10', checks, history, deferred)

test('前年の記録は前後14日。同じ農場が優先される', () => {
  const history = [
    { pestKey, observedDay: '2025-11-10', farmId: 'other' },
    { pestKey, observedDay: '2025-11-24', farmId: 'farm' },
  ]
  assert.equal(ask({}, [], history)?.previous?.farmId, 'farm')
  assert.equal(ask({}, [], [{ ...history[0], observedDay: '2025-10-27' }])?.previous?.gap, 14)
  assert.equal(ask({}, [], [{ ...history[0], observedDay: '2025-11-25' }])?.previous, undefined)
})

test('県と栽培場所が合うときだけ資料の時期を使う', () => {
  assert.equal(ask({ prefectureCode: '39' })?.season?.code, '39')
  assert.equal(ask({ prefectureCode: '39', plantingDay: '2026-11-09' })?.season?.code, '39')
  assert.equal(ask({ prefectureCode: '39', growingSite: 'open' })?.season, undefined)
  assert.equal(ask({ prefectureCode: '12' })?.season, undefined)
})

test('巡回は植付8日目から。記録だけの品目には聞かない', () => {
  assert.equal(ask({ plantingDay: '2026-11-03' }), null)
  assert.equal(ask({ plantingDay: '2026-11-02' })?.pest.key, pestKey)
  assert.equal(ask({ cropKind: 'strawberry-ever' }), null)
})

test('回答後の共通間隔と、組ごとの再質問、あとでを区別する', () => {
  const check = (answeredDay: string, present: boolean, key = pestKey) => ({ pestKey: key, answeredDay, observedDay: answeredDay, present })
  assert.equal(ask({}, [check('2026-11-04', true, 'other')]), null)
  assert.ok(ask({}, [check('2026-11-03', true, 'other')]))
  assert.equal(ask({}, [check('2026-10-28', true)]), null)
  assert.ok(ask({}, [check('2026-10-27', true)]))
  assert.equal(ask({}, [check('2026-10-14', false)]), null)
  assert.ok(ask({}, [check('2026-10-13', false)]))
  assert.equal(ask({}, [], [], new Set([pestKey])), null)
  assert.equal(PROPOSAL_DISMISS_DAYS, 7)
  const next = ask({ cropKind: 'pepper' }, [check('2026-11-03', false, 'pepper:aphids')])
  assert.equal(next?.pest.key, 'pepper:thrips')
})

test('24組に選択名・目印があり、採用した出典にURLがある', () => {
  assert.equal(pests.length, 24)
  assert.equal(new Set(pests.map(pest => pest.cropKind)).size, 17)
  for (const pest of pests) {
    assert.ok(pest.searchCrop && pest.searchPest && pest.marker)
    assert.doesNotMatch([pest.marker, pest.question, ...pest.measures.map(m => m.text)].join(' '), /無農薬/)
    for (const source of [...pest.measures.flatMap(m => m.sources), ...pest.seasons.map(s => s.source)]) {
      assert.match(source.url, /^https:\/\//)
      assert.ok(source.title && source.publisher && source.year && source.page)
    }
  }
  assert.deepEqual(pests.find(p => p.key === 'strawberry-june:powdery-mildew')?.measures, [])
  assert.equal(pests.find(p => p.key === 'broccoli:diamondback')?.appearance, null)
})

test('台帳指定の23都府県だけ県の指針がある', () => {
  const codes = '02 10 12 13 18 19 20 22 23 25 27 34 35 37 38 39 40 41 42 43 44 45 46'.split(' ')
  for (let i = 1; i <= 47; i++) {
    const code = String(i).padStart(2, '0')
    assert.equal(Boolean(pestGuide(code)), codes.includes(code), code)
  }
  assert.equal(pestGuide(null), null)
  assert.equal(pestGuide('40')?.title, '福岡県「病害虫・雑草防除の手引き」')
  assert.equal(pestGuide('13')?.title, '東京都病害虫防除指針')
})

test('同じ問いかけの作付けを1枚にまとめ、1件の問いも1枚にする', () => {
  const first = { cropId: 'a', pest: { key: 'tomato:yellow-leaf-curl' }, timing: '去年の記録' }
  const second = { ...first, cropId: 'b', timing: '県の時期' }
  const single = { cropId: 'c', pest: { key: 'pepper:aphids' }, timing: null }
  assert.deepEqual(groupPestQuestions([first, single, second]), [[first, second], [single]])
  assert.deepEqual(groupPestQuestions([single]), [[single]])
})

test('育て方が合わない場合と、対策自体がない場合の案内を分ける', () => {
  const tomato = pests.find(p => p.key === 'tomato:yellow-leaf-curl')!
  const strawberry = pests.find(p => p.key === 'strawberry-june:powdery-mildew')!
  const outdoors = pestMeasuresForSite(tomato.measures, 'open')
  assert.deepEqual(outdoors.matching, [])
  assert.match(outdoors.emptyMessage ?? '', /露地.*ハウス向け/)
  assert.deepEqual(pestMeasuresForSite(tomato.measures, null), outdoors)
  assert.equal(pestMeasuresForSite(tomato.measures, 'house').emptyMessage, null)
  assert.equal(pestMeasuresForSite(strawberry.measures, 'house').emptyMessage, '出典のある対策は見つかっていません。')
})
