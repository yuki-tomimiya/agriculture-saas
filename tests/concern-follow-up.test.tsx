import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderWithRouter, withRequestCookies } from './helpers/next-runtime'
import { NextRequest } from 'next/server'
import { testSession } from './helpers/session'
import { temporarySqlite } from './helpers/temporary-sqlite'
import { forecastOffice } from '@/lib/pest-forecast'

test('栽培中の異変を見た日から3〜7日目に聞き、本人の回答と答えた日を一度だけ保存する', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const oldPrisma = runtime.prisma
  runtime.prisma = db
  t.after(() => { runtime.prisma = oldPrisma })
  const { loadTodayConfirmations } = await import('@/lib/proposals/presentation')
  const { PATCH } = await import('@/app/api/crops/[id]/field-concerns/[concernId]/follow-up/route')
  const { default: MorningProposals } = await import('@/app/dashboard/ai-proposal/MorningProposals')
  const { ConcernFollowUpFeedback } = await import('@/app/dashboard/ai-proposal/ConcernFollowUpAnswer')
  const { default: CropDetailPage } = await import('@/app/crops/[id]/page')

  await db.user.createMany({ data: ['owner', 'stranger'].map(id => ({ id, email: id + '@example.test', password: 'unused' })) })
  const owner = await testSession(db, 'owner')
  const stranger = await testSession(db, 'stranger')
  const farms = [
    { id: 'chiba', name: '館山', prefectureCode: '12' },
    { id: 'tochigi', name: '宇都宮', prefectureCode: '09' },
    { id: 'tokyo', name: '東京', prefectureCode: '13' },
  ]
  await db.farm.createMany({ data: farms.map(farm => ({ ...farm, userId: 'owner' })) })
  await db.crop.createMany({ data: [
    ...farms.map(farm => ({ id: farm.id, name: 'キャベツ', cropKind: 'cabbage', farmId: farm.id })),
    { id: 'farmless', name: 'その他', cropKind: 'other', userId: 'owner' },
    { id: 'harvested', name: '収穫済み', status: 'harvested', userId: 'owner' },
    { id: 'completed', name: '完了', status: 'completed', userId: 'owner' },
    { id: 'stranger-crop', name: '別の作付け', userId: 'stranger' },
  ] })
  const at = (day: string) => new Date(day + 'T00:00:00+09:00')
  const add = (id: string, cropId: string, day = '2026-11-27') => db.fieldConcern.create({ data: {
    id, cropId, observedAt: at(day), locations: 'leaf', symptoms: 'eaten',
  } })
  await add('chiba-new', 'chiba')
  await add('farmless-concern', 'farmless')
  await add('harvested-concern', 'harvested')
  await add('completed-concern', 'completed')
  await add('stranger-concern', 'stranger-crop')

  const today = (now: Date) => loadTodayConfirmations('owner', { now })
  const selectedIds = (data: Awaited<ReturnType<typeof today>>) => data.confirmationGroups.flatMap(group =>
    group.flatMap(({ selected }) => selected.kind === 'concern' ? [selected.concern.id] : []))
  const shows = async (now: Date) => selectedIds(await today(now)).sort()
  assert.deepEqual(await shows(new Date(+at('2026-11-30') - 1)), [])
  for (const day of ['2026-11-30', '2026-12-04']) {
    assert.deepEqual(await shows(at(day)), ['chiba-new', 'farmless-concern'])
  }
  assert.deepEqual(await shows(at('2026-12-05')), [])

  await add('chiba-old', 'chiba', '2026-11-26')
  const answeredAt = at('2026-12-01')
  const grouped = await today(answeredAt)
  const concernCards = grouped.confirmationGroups.filter(group => group[0].selected.kind === 'concern')
  assert.equal(concernCards.length, 2)
  assert.ok(concernCards.every(group => group.length === 1))
  const oldest = concernCards.find(group => group[0].crop.cropId === 'chiba')?.[0]
  assert.ok(oldest?.selected.kind === 'concern')
  assert.equal(oldest.selected.concern.id, 'chiba-old')
  assert.ok(oldest.others.some(item => item.kind === 'concern' && item.concern.id === 'chiba-new'))
  const proposalMarkup = renderWithRouter(<MorningProposals data={grouped} guidance={new Map()} />)
  assert.match(proposalMarkup, /<h3>11月26日に記録した（葉・穴があく・かじられた）は、広がっていますか？<\/h3>/)
  assert.match(proposalMarkup, /<summary>11月27日に記録した（葉・穴があく・かじられた）は、広がっていますか？<\/summary>/)
  assert.match(proposalMarkup, /広がった.*変わらない.*おさまった/)

  t.mock.timers.enable({ apis: ['Date'], now: answeredAt })
  function answer(cropId: string, concernId: string, result: string, session = owner) {
    const url = `http://localhost/api/crops/${cropId}/field-concerns/${concernId}/follow-up`
    return withRequestCookies(session, () => PATCH(new NextRequest(url, {
      method: 'PATCH', body: JSON.stringify({ result }),
    }), { params: Promise.resolve({ id: cropId, concernId }) }))
  }
  const read = (id: string) => db.fieldConcern.findUniqueOrThrow({ where: { id } })
  const before = await read('chiba-old')
  assert.equal((await answer('chiba', 'chiba-old', 'spread', stranger)).status, 404)
  assert.equal((await answer('chiba', 'stranger-concern', 'spread')).status, 404)
  assert.equal((await answer('chiba', 'chiba-old', 'constructor')).status, 400)
  assert.deepEqual(await read('chiba-old'), before)
  assert.equal((await read('stranger-concern')).followUpResult, null)

  const response = await answer('chiba', 'chiba-old', 'spread')
  assert.equal(response.status, 200)
  const spreadFeedback = await response.json()
  const stored = await read('chiba-old')
  assert.equal(stored.followUpResult, 'spread')
  assert.deepEqual(stored.followedUpAt, answeredAt)
  assert.equal((await answer('chiba', 'chiba-old', 'improved')).status, 409)
  assert.deepEqual(await read('chiba-old'), stored)
  assert.ok(!(await shows(answeredAt)).includes('chiba-old'))

  const markup = (body: Parameters<typeof ConcernFollowUpFeedback>[0]['answer']) =>
    renderWithRouter(<ConcernFollowUpFeedback answer={body} />)
  const chiba = forecastOffice('12')!
  assert.equal(spreadFeedback.consultation.forecast.url, chiba.url)
  const spreadMarkup = markup(spreadFeedback)
  assert.ok(spreadMarkup.includes(chiba.officeName))
  assert.match(spreadMarkup, /普及指導センターや JA/)
  const farmLess = await (await answer('farmless', 'farmless-concern', 'spread')).json()
  assert.equal(farmLess.consultation.forecast, null)
  assert.match(markup(farmLess), /普及指導センターや JA/)
  assert.doesNotMatch(markup(farmLess), /href=/)

  for (const farm of farms.slice(1)) {
    await add(farm.id + '-spread', farm.id)
    const local = await (await answer(farm.id, farm.id + '-spread', 'spread')).json()
    assert.equal(local.consultation.forecast.url, forecastOffice(farm.prefectureCode)?.url)
  }
  for (const value of ['unchanged', 'improved']) {
    await add(value, 'chiba')
    const other = await answer('chiba', value, value)
    assert.equal(other.status, 200)
    const html = markup(await other.json())
    assert.match(html, /記録しました/)
    assert.doesNotMatch(html, /相談先|普及指導センター/)
    assert.equal((await read(value)).followUpResult, value)
  }

  const detail = renderWithRouter(await withRequestCookies(owner, () => CropDetailPage({
    params: Promise.resolve({ id: 'chiba' }),
  })))
  assert.match(detail, /その後：広がった（<time dateTime="2026-12-01">12月1日<\/time>）/)
})
