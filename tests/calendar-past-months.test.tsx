import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderWithRouter } from './helpers/next-runtime'
import { temporarySqlite } from './helpers/temporary-sqlite'
import type { FarmOutlook } from '@/lib/calendar/outlook'

// アプリの部品は、仮のデータベースに差し替えたあとで読み込む（先に読むと lib/prisma が開発用のデータベースにつながる）
const today = '2026-11-28'
const at = (day: string) => new Date(day + 'T12:00:00+09:00')

test('過去の月：記録のある最も古い月まで送れ、今日より前の日は記録だけを3種類の点にし、欄はその月のまとめかその日の記録', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const saved = runtime.prisma
  runtime.prisma = db
  t.after(() => { runtime.prisma = saved })
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-27T15:30:00Z') })
  const { default: WorkCalendar } = await import('@/components/WorkCalendar')
  const { calendarHref, readCalendarView } = await import('@/lib/calendar/day-panel')

  await db.user.create({ data: { id: 'owner', email: 'past@example.invalid', password: 'unused' } })
  await db.user.create({ data: { id: 'empty', email: 'empty@example.invalid', password: 'unused' } })
  await db.farm.create({ data: { id: 'f1', name: '農場1', userId: 'owner' } })
  await db.farm.create({ data: { id: 'f2', name: '農場2', userId: 'owner' } })
  await db.farm.create({ data: { id: 'e', name: '記録の無い農場', userId: 'empty' } })
  await db.crop.create({ data: { id: 'c', farmId: 'f1', name: 'キャベツ', cropKind: 'cabbage', plantingDate: at('2026-08-25') } })
  await db.crop.create({ data: { id: 'h', farmId: 'f1', name: 'はくさい', cropKind: 'chinese-cabbage', plantingDate: at('2026-09-10') } })
  await db.workRecord.create({ data: { farmId: 'f1', cropId: 'c', taskType: '植え付け', date: at('2026-08-25') } })
  await db.workRecord.create({ data: { farmId: 'f1', cropId: 'c', taskType: '追肥', date: at('2026-10-25') } })
  await db.fertilizerRecord.create({ data: { userId: 'owner', farmId: 'f1', productName: '化成肥料', amount: 1, appliedAt: at('2026-10-25') } })
  await db.pesticideRecord.create({ data: { userId: 'owner', farmId: 'f1', cropId: 'c', productName: '乳剤', appliedAt: at('2026-10-03') } })
  await db.harvest.create({ data: { cropId: 'c', quantity: 1, date: at('2026-10-20') } })
  await db.fieldConcern.create({ data: { cropId: 'h', observedAt: at('2026-10-12'), locations: '', symptoms: '' } })
  await db.pestCheck.create({ data: { cropId: 'h', pestKey: 'chinese-cabbage-aphid', present: false, observedAt: at('2026-10-14') } })
  await db.workRecord.create({ data: { farmId: 'f1', cropId: 'c', taskType: '手入れ', date: at('2026-11-20') } })
  // その後を聞く期間が 11月27日〜12月1日の気になること（今日より前の 11月27日には点を打たない）
  await db.fieldConcern.create({ data: { cropId: 'h', observedAt: at('2026-11-24'), locations: '', symptoms: '' } })
  await db.workRecord.create({ data: { farmId: 'f2', taskType: '草刈り', date: at('2026-10-05') } })

  const render = async (props: { userId?: string; farmId?: string; month?: string; day?: string } = {}) =>
    renderWithRouter(await WorkCalendar({ userId: 'owner', ...props }))
  const panelOf = (html: string) => html.slice(html.indexOf('calendar-day-panel'))
  const labelsOf = (html: string, month: number) => [...html.matchAll(new RegExp('aria-label="(' + month + '月\\d+日[^"]*)"', 'g'))].map(m => m[1])
  const summaryLine = (html: string, title: string) => panelOf(html).match(new RegExp('>' + title + '</a><p class="calendar-panel-summary">([^<]*)</p>'))?.[1]

  // 送る：今月の ‹ は前の月（過去の実績へのリンクではない）。最も古い記録の月で ‹ が止まる。記録の無い人は今月で止まる
  const november = await render()
  assert.match(november, /<a class="calendar-month-step" aria-label="前の月" href="\/calendar\?month=2026-10">‹<\/a>/)
  assert.doesNotMatch(november, /calendar\/history|過去の実績/)
  const august = await render({ month: '2026-08' })
  assert.match(august, /2026年8月/)
  assert.match(august, /disabled="" aria-label="前の月（これより前の記録はありません）"/)
  assert.match(august, /<a class="calendar-month-step" aria-label="次の月" href="\/calendar\?month=2026-09">›<\/a>/)
  assert.match(await render({ userId: 'empty' }), /disabled="" aria-label="前の月（これより前の記録はありません）">‹<\/button><h2[^>]*>2026年11月/)
  assert.deepEqual(readCalendarView({ month: '2026-07' }, today, '2027-01', '2026-08'), { month: '2026-08', day: null })

  // 点：作業・施肥／農薬・収穫／畑で見たこと。病害虫の確かめで「いなかった」日は点にしない。10月に見通しの点は無い
  const october = await render({ month: '2026-10' })
  const labels = labelsOf(october, 10)
  assert.ok(labels.includes('10月25日、作業・施肥2件'))
  assert.ok(labels.includes('10月3日、農薬・収穫1件'))
  assert.ok(labels.includes('10月20日、農薬・収穫1件'))
  assert.ok(labels.includes('10月12日、畑で見たこと1件'))
  assert.ok(labels.includes('10月14日'))
  assert.ok(labels.every(label => !/霜・天気|収穫・聞き始め|昨年|あなたの記録から/.test(label)))
  const legend = october.match(/<ul class="calendar-legend">([\s\S]*?)<\/ul>/)?.[1] ?? ''
  assert.deepEqual([...legend.matchAll(/<\/span>([^<]+)<\/li>/g)].map(m => m[1]), ['作業・施肥', '農薬・収穫', '畑で見たこと'])

  // 今月：今日より前の日は記録だけ、11月28日から先は見通し
  const novemberLabels = labelsOf(november, 11)
  assert.ok(novemberLabels.includes('11月20日、作業・施肥1件'))
  assert.ok(novemberLabels.includes('11月24日、畑で見たこと1件'))
  assert.ok(novemberLabels.includes('11月27日'))
  assert.ok(labelsOf(await render({ month: '2026-12' }), 12).includes('12月1日、あなたの記録から1件'))

  // まとめ：作付けごと（農場が2つなので農場名つき）、作付けに結びつかない施肥は農場の行。記録の無い月
  const octoberPanel = panelOf(october)
  assert.match(octoberPanel, /<h2 class="calendar-panel-heading"[^>]*>10月のまとめ<\/h2>/)
  assert.equal(summaryLine(october, 'キャベツ・農場1'), '農薬 10/3・収穫 10/20・追肥 10/25')
  assert.equal(summaryLine(october, 'はくさい・農場1'), '気になること 10/12')
  assert.equal(summaryLine(october, '農場1'), '施肥 10/25')
  assert.equal(summaryLine(october, '農場2'), '草刈り 10/5')
  assert.match(octoberPanel, /日を選ぶと、その日の記録が出ます/)
  assert.doesNotMatch(octoberPanel, /今日の提案|今日から7日/)
  assert.match(panelOf(await render({ month: '2026-09' })), /この月の記録はありません。/)

  // 日：その日の記録だけ。URL に月と日が残り、読み直しても同じ
  const href = calendarHref({ month: '2026-10', day: '2026-10-25' }, today)
  assert.equal(href, '/calendar?month=2026-10&day=2026-10-25')
  const reloaded = readCalendarView(Object.fromEntries(new URL(href, 'http://localhost').searchParams), today, '2027-01', '2026-08')
  assert.deepEqual(reloaded, { month: '2026-10', day: '2026-10-25' })
  const day = panelOf(await render(reloaded))
  assert.match(day, /<h2 class="calendar-panel-heading"[^>]*>10月25日（日）<\/h2>/)
  assert.deepEqual([...day.matchAll(/class="calendar-panel-title"[^>]*>([^<]+)</g)].map(m => m[1]).sort(), ['施肥：化成肥料', '追肥（キャベツ）'])
  assert.match(day, /農場1・あなた（作業の記録）/)
  assert.match(day, /class="calendar-panel-title" href="\/work-records\/[^"]+">追肥（キャベツ）/)
  assert.match(day, /10月のまとめに戻る/)

  // 農場の絞り込み：過去の月と選んだ日を保つ。絞った農場の最も古い記録の月まで
  const filtered = await render({ farmId: 'f1', month: '2026-10', day: '2026-10-25' })
  assert.match(filtered, /<option value="f1" selected/)
  assert.match(filtered, /<input type="hidden" name="month" value="2026-10"\/>/)
  assert.match(filtered, /<input type="hidden" name="day" value="2026-10-25"\/>/)
  assert.ok(labelsOf(filtered, 10).includes('10月5日'))
  const second = await render({ farmId: 'f2', month: '2026-08' })
  assert.match(second, /2026年10月/)
  assert.match(second, /disabled="" aria-label="前の月（これより前の記録はありません）"/)
  assert.equal(summaryLine(second, '農場2'), '草刈り 10/5')
})

test('前のリンクと昨年の行の押した先', async () => {
  const { historyRedirectHref } = await import('@/lib/calendar/day-panel')
  const { outlookRows } = await import('@/lib/calendar/outlook')
  assert.equal(historyRedirectHref({ year: '2026', month: '8' }), '/calendar?month=2026-08')
  assert.equal(historyRedirectHref({}), '/calendar')
  const farm: FarmOutlook = { id: 'f', name: '秋田の畑', prefectureCode: '05', frost: [], forecast: [] }
  const crop = { id: 'c', name: 'キャベツ', farmId: 'f', cropKind: 'cabbage', variety: null, planted: '2026-11-08', growing: true,
    growingSite: 'open', plantingMethod: 'transplant', hasHarvest: false, milestones: [{ key: 'cabbage-firm' }], concerns: [], window: null }
  const rows = outlookRows(today, '2027-01-31', [farm], [crop], [{ id: 's', farmId: 'f', date: '2025-12-01', label: '収穫' }])
  assert.equal(rows.find(r => r.kind === 'lastYear')?.href, '/calendar?month=2025-12&day=2025-12-01')
})
