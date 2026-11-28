import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderWithRouter } from './helpers/next-runtime'
import CalendarMonthView from '@/components/CalendarMonthView'
import { lastYearOverlay } from '@/lib/calendar/dates'
import {
  calendarHref, dotDays, dotsByDay, panelSources, panelWeek, readCalendarView, rowsOnDay, shiftView, type CalendarView,
} from '@/lib/calendar/day-panel'
import { concernTitle, outlookRows, recordRows, type CropOutlook, type FarmOutlook, type OutlookRow, type RecordEntry } from '@/lib/calendar/outlook'
import { harvestDatesByCrop, japanDateKey } from '@/lib/pesticide-safety'
import { organizeConfirmations } from '@/lib/proposals/presentation'
import type { ForecastDay } from '@/lib/weather-forecast'

const today = '2026-11-28'
const through = '2027-01-31'
const lastMonth = '2027-01'
const farm: FarmOutlook = { id: 'f', name: '秋田の畑', prefectureCode: '05', frost: [], forecast: [] }
const cabbage: CropOutlook = {
  id: 'c', name: 'キャベツ', farmId: 'f', cropKind: 'cabbage', variety: null, planted: '2026-11-08',
  growing: true, growingSite: 'open', plantingMethod: 'transplant', hasHarvest: false, milestones: [], concerns: [], window: null,
}
const forecastDays = (dates: string[], minTemp: number, precipitation = 55) => dates.map(date => ({ date, dayLabel: date, minTemp, precipitation } as ForecastDay))
const view = (rows: OutlookRow[], initialView: CalendarView, extra: Partial<Parameters<typeof CalendarMonthView>[0]> = {}) =>
  renderWithRouter(<CalendarMonthView rows={rows} today={today} lastMonth={lastMonth} initialView={initialView} farms={[]} farmId={null}
    proposalCount={0} hasCrops {...extra} />)
const panelOf = (html: string) => html.slice(html.indexOf('calendar-day-panel'))
const entry = (date: string, title: string, extra: Partial<RecordEntry> = {}): RecordEntry => ({
  id: 'work-' + date + title, farmId: 'f', farmName: '秋田の畑', date, kind: 'work', title, term: title, note: '作業の記録',
  cropId: null, href: '/work-records/x', ...extra })

test('日本時間の28日から、節目は明日以降の最初の1日、農薬と気になることのその後は記録どおり', () => {
  assert.equal(japanDateKey(new Date('2026-11-27T15:30Z')), today)
  const dates = harvestDatesByCrop([{ cropId: 'c', appliedAt: new Date('2026-11-25'), daysBeforeHarvest: 7 }, { cropId: 'unknown', appliedAt: new Date(), daysBeforeHarvest: null }])
  assert.equal(dates.has('unknown'), false)
  const crop = { ...cabbage, harvestFrom: dates.get('c'), concerns: [{ id: 'i', observed: '2026-11-24', answered: false }] }
  const rows = outlookRows(today, through, [farm], [crop, { ...cabbage, id: 'h', cropKind: 'chinese-cabbage', name: 'はくさい', planted: '2026-11-18' }], [])
  assert.deepEqual(rows.map(r => [r.start, r.end, r.mark]), [
    ['2026-11-27', '2026-12-01', '気になること'], ['2026-12-02','2026-12-02','農薬'],
    ['2026-12-23','2026-12-23','聞き始め'], ['2026-12-28','2026-12-28','聞き始め'],
  ])
  assert.ok(rows.filter(r => r.mark === '聞き始め').every(r => r.text.includes('球のしまりを聞きます')))
  assert.deepEqual(rows.filter(r => r.mark === '聞き始め').map(r => r.title), ['このころから、キャベツの球のしまりを聞きます', 'このころから、はくさいの球のしまりを聞きます'])
  assert.equal(rows.find(r => r.mark === '農薬')?.title, 'キャベツの収穫ができるようになる日')
  assert.deepEqual(outlookRows(today, through, [farm], [{ ...crop, hasHarvest: true, harvestFrom: today, concerns: [{ ...crop.concerns[0], answered: true }] }], []), [])
  assert.deepEqual(outlookRows(today, through, [farm], [{ ...cabbage, milestones: [{ key: 'cabbage-firm' }] }], []), [])
})

test('空の農場の霜・収穫の幅・県の月・直近の雨と昨年の幅を分ける', () => {
  const frost: FarmOutlook['frost'] = [20, 5].map((day, i) => ({ month: i ? 12 : 11, day, label: i ? '平均' : '最早', text: '観測', source: 'station' }))
  const forecast = forecastDays(['2026-11-28', '2026-11-29'], 4)
  const empty = outlookRows(today, through, [{ ...farm, frost, forecast }], [], [])
  assert.deepEqual(empty.map(r => r.start), ['2026-12-05'])
  assert.match(view(empty, { month: '2026-11', day: null }, { hasCrops: false }), /作付けを登録/)
  const taro = { ...cabbage, name: 'さといも', cropKind: 'taro' }
  const win = { start: '2026-12-01', end: '2026-12-20', text: '収穫の幅' }
  const previous = [{ id: 'r', farmId: 'f', date: '2025-12-31', label: '施肥' }, { id: 's', farmId: 'f', date: '2025-12-01', label: '収穫' }]
  const rows = outlookRows(today, through, [{ ...farm, forecast }], [taro, { ...cabbage, window: win }], previous)
  assert.deepEqual(rows.filter(r => r.mark === '収穫の見込み').map(r => [r.start,r.end]), [[win.start,win.end]])
  assert.equal(rows.filter(r => r.mark === '雨').length, 1)
  assert.deepEqual(rows.filter(r => r.mark === '昨年').map(r => [r.start,r.end]), [['2026-11-29','2026-12-03'], ['2026-12-29','2027-01-02']])
  assert.ok(lastYearOverlay('2025-12-31').includes('2027-01-02'))
  assert.equal(rows.some(r => r.mark === '県の月'), false)
  const august = outlookRows('2026-08-10','2026-10-31',[farm],[taro],[])
  assert.deepEqual(august.map(r => r.start), ['2026-08-01','2026-09-01'])
  assert.deepEqual(outlookRows('2026-08-10','2026-10-31',[{ ...farm, prefectureCode: '13' }],[taro],[]), [])
  // 県の月は点にせず、月の見出しの下に1行
  assert.deepEqual(dotsByDay(august).size, 0)
  const augustHtml = renderWithRouter(<CalendarMonthView rows={august} today="2026-08-10" lastMonth="2026-10" initialView={{ month: '2026-08', day: null }}
    farms={[]} farmId={null} proposalCount={0} hasCrops />)
  assert.match(augustHtml, /class="calendar-season-lines"><li><a href="\/dashboard\/ai-proposal">秋田県の資料では、ハスモンヨトウは8月から9月に出ます/)
})

test('種類ごとの点：農薬・予報の霜・聞き始め・昨年', () => {
  const crop = { ...cabbage, harvestFrom: '2026-12-02', concerns: [{ id: 'i', observed: '2026-11-24', answered: false }] }
  const previous = [{ id: 's', farmId: 'f', date: '2025-12-01', label: '収穫' }]
  const rows = outlookRows(today, through, [{ ...farm, forecast: forecastDays(['2026-11-30'], 2, 0) }],
    [crop, { ...cabbage, id: 'h', cropKind: 'chinese-cabbage', name: 'はくさい', planted: '2026-11-18' }], previous)
  const kindOf = (mark: string) => rows.find(r => r.mark === mark)?.kind
  assert.equal(kindOf('農薬'), 'mine')
  assert.equal(rows.find(r => r.mark === '霜' && r.source === 'forecast')?.kind, 'weather')
  assert.equal(kindOf('聞き始め'), 'harvest')
  assert.equal(kindOf('昨年'), 'lastYear')
  // その日の実績（作業・施肥）は「作業・施肥」の点（109）
  assert.equal(recordRows([entry('2026-11-20', '手入れ')])[0].kind, 'work')
  const dots = dotsByDay(rows)
  assert.deepEqual(dots.get('2026-11-27'), { mine: 1 })
  assert.deepEqual(dots.get('2026-12-02'), { mine: 1, lastYear: 1 })
  assert.deepEqual(dots.get('2026-11-30'), { weather: 1, lastYear: 1 })
  // 昨年は前年の同じ日の前後2日（台帳 I7）を今のまま毎日に重ねる
  assert.deepEqual(dotDays(rows.find(r => r.mark === '昨年')!), ['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03'])
  const html = view(rows, { month: '2026-12', day: null })
  assert.match(html, /aria-label="12月2日、あなたの記録から1件、昨年1件"/)
  assert.match(html, /aria-label="12月1日、あなたの記録から1件、昨年1件"/)
  // 凡例は、その月に出ている種類だけ（109）。12月に霜・天気は無く、11月30日の予報の霜は11月の凡例に出る
  const legendOf = (markup: string) => [...(markup.match(/<ul class="calendar-legend">([\s\S]*?)<\/ul>/)?.[1] ?? '').matchAll(/<\/span>([^<]+)<\/li>/g)].map(m => m[1])
  assert.deepEqual(legendOf(html), ['収穫・聞き始め', 'あなたの記録から', '昨年'])
  assert.deepEqual(legendOf(view(rows, { month: '2026-11', day: null })), ['霜・天気', '昨年'])
})

test('昨年の点と欄は、表示する3か月の範囲まで（30日先で切らない）', () => {
  const previous = [{ id: 'j', farmId: 'f', farmName: '秋田の畑', date: '2026-01-05', label: '施肥' }]
  const rows = outlookRows(today, through, [farm], [cabbage], previous)
  const lastYear = rows.filter(r => r.kind === 'lastYear')
  assert.deepEqual(lastYear.map(r => [r.start, r.end]), [['2027-01-03', '2027-01-07']])
  assert.deepEqual(dotDays(lastYear[0]), ['2027-01-03', '2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07'])
  const dots = dotsByDay(rows)
  for (const day of ['2027-01-03', '2027-01-05', '2027-01-07']) assert.equal(dots.get(day)?.lastYear, 1)
  assert.equal(dots.get('2027-01-08')?.lastYear, undefined)
  const html = view(rows, { month: '2027-01', day: '2027-01-05' })
  assert.match(html, /aria-label="1月5日、昨年1件"/)
  assert.match(panelOf(html), /1月5日（火）[\s\S]*昨年の記録：施肥[\s\S]*あなた（昨年1月5日の記録）/)
  // 範囲の外（表示の3か月の末日より先）には出さない
  assert.deepEqual(outlookRows(today, through, [farm], [cabbage], [{ ...previous[0], date: '2026-02-05' }]).filter(r => r.kind === 'lastYear'), [])
})

test('幅のあるものは始まりと終わりの日だけに点、間の日を選んでも欄に出す', () => {
  const rows = outlookRows(today, through, [farm], [{ ...cabbage, milestones: [{ key: 'cabbage-firm' }], concerns: [{ id: 'i', observed: '2026-11-24', answered: false }] }], [])
  const concern = rows.find(r => r.id === 'concern-i')!
  assert.deepEqual([concern.start, concern.end], ['2026-11-27', '2026-12-01'])
  assert.deepEqual(dotDays(concern), ['2026-11-27', '2026-12-01'])
  // 今日より前の日は記録の点だけ（109）なので、画面では今日より前の始まりの日（11月27日）に点を打たない
  assert.deepEqual(dotDays(concern, today), ['2026-12-01'])
  assert.deepEqual([...dotsByDay(rows, today).keys()].sort(), ['2026-12-01'])
  assert.deepEqual(rowsOnDay(rows, '2026-11-27', today), [])
  assert.deepEqual(rowsOnDay(rows, '2026-11-30').map(r => r.id), ['concern-i'])
  const html = panelOf(view(rows, { month: '2026-11', day: '2026-11-30' }))
  assert.match(html, /11月30日（月）/)
  assert.match(html, /キャベツの気になること（11\/24）のその後を聞く期間/)
  assert.match(html, /11月27日〜12月1日/)
})

test('開いたときは今日から7日、日を選ぶとその日だけ、URL に日付が残る', () => {
  const rows = recordRows(['2026-11-20', '2026-11-28', '2026-12-02', '2026-12-04', '2026-12-05'].map(date => entry(date, '手入れ' + date)))
  assert.deepEqual(panelWeek(rows, today).map(g => g.day), ['2026-11-28', '2026-12-02', '2026-12-04'])
  const opened = panelOf(view(rows, readCalendarView({}, today, lastMonth)))
  assert.match(opened, /<h2 class="calendar-panel-heading"[^>]*>今日から7日<\/h2>/)
  assert.match(opened, /手入れ2026-11-28[\s\S]*手入れ2026-12-02[\s\S]*手入れ2026-12-04/)
  assert.doesNotMatch(opened, /手入れ2026-12-05|手入れ2026-11-20/)
  assert.match(panelOf(view([], { month: '2026-11', day: null })), /この7日に、見通しや記録はありません。日を選ぶと、その日のことが出ます。/)

  const chosen: CalendarView = { month: '2026-12', day: '2026-12-02' }
  const href = calendarHref(chosen, today, 'a')
  assert.equal(href, '/calendar?farm=a&month=2026-12&day=2026-12-02')
  const reloaded = readCalendarView(Object.fromEntries(new URL(href, 'http://localhost').searchParams), today, lastMonth)
  assert.deepEqual(reloaded, chosen)
  const html = view(rows, reloaded)
  const panel = panelOf(html)
  assert.match(panel, /<h2 class="calendar-panel-heading"[^>]*>12月2日（水）<\/h2>/)
  assert.match(panel, /手入れ2026-12-02/)
  assert.doesNotMatch(panel, /手入れ2026-12-04|手入れ2026-11-28/)
  assert.match(panel, /今日から7日に戻る/)
  assert.match(html, /aria-pressed="true" aria-label="12月2日、作業・施肥1件"/)
  // 今月より前の日・範囲の外の日・ありえない日は読まない
  assert.deepEqual(readCalendarView({ day: '2027-02-01' }, today, lastMonth), { month: '2026-11', day: null })
  assert.deepEqual(readCalendarView({ day: '2026-12-32', month: '2026-10' }, today, lastMonth), { month: '2026-11', day: null })
})

test('予報の霜は農場ごとに最初の1日、天気の出典の短い1行は欄に1回', () => {
  const forecast = forecastDays(['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05'], 3.8)
  const rows = outlookRows(today, through, [{ ...farm, forecast }], [cabbage], [])
  const frost = rows.filter(r => r.mark === '霜')
  assert.deepEqual(frost.map(r => r.start), ['2026-11-28'])
  assert.equal(frost[0].title, '最低気温 3.8℃ の計算')
  assert.equal([...dotsByDay(frost).keys()].length, 1)
  assert.ok(rows.filter(r => r.source === 'forecast').length >= 2)
  const opened = view(rows, { month: '2026-11', day: null })
  assert.equal(opened.split('Weather data by Open-Meteo.com').length - 1, 1)
  assert.deepEqual(panelSources(rowsOnDay(rows, '2026-12-06')), { openMeteo: false, jma: false })
  assert.doesNotMatch(view(rows, { month: '2026-12', day: '2026-12-06' }), /Open-Meteo/)
  const station = outlookRows(today, through, [{ ...farm, frost: [{ month: 11, day: 29, label: '初霜の平均の日', text: '平均11月29日', note: '館山観測所の過去10年', source: 'station' }] }], [], [])
  const stationHtml = panelOf(view(station, { month: '2026-11', day: '2026-11-29' }))
  assert.match(stationHtml, /初霜の平均の日[\s\S]*秋田の畑・地域（館山観測所の過去10年）[\s\S]*くわしく[\s\S]*平均11月29日/)
  assert.equal(stationHtml.split('過去の気象データ検索').length - 1, 1)
  assert.doesNotMatch(stationHtml, /Open-Meteo/)
})

test('カレンダーに「異変」は出さず、言葉の無い記録は「気になること」', () => {
  assert.equal(concernTitle('はくさい', '2026-11-24'), 'はくさいの気になること（11/24）のその後を聞く期間')
  assert.equal(concernTitle('はくさい', '2026-11-24', ['葉', '斑点がある']), 'はくさいの気になること（11/24 葉・斑点がある）のその後を聞く期間')
  const rows = outlookRows(today, through, [farm], [{ ...cabbage, concerns: [{ id: 'i', observed: '2026-11-24', answered: false }] }], [])
  for (const v of [{ month: '2026-11', day: null }, { month: '2026-11', day: '2026-11-28' }]) assert.doesNotMatch(view(rows, v), /異変/)
  assert.ok(rows.every(r => !(r.title + r.text + r.mark).includes('異変')))
})

test('月は今月から見通しの範囲の終わりの月まで送れ、「今日」で今月に戻る', () => {
  const start: CalendarView = { month: '2026-11', day: null }
  assert.equal(shiftView(start, -1, today, lastMonth), null)
  assert.deepEqual(shiftView(start, 1, today, lastMonth), { month: '2026-12', day: null })
  assert.deepEqual(shiftView({ month: '2026-12', day: '2026-12-02' }, 1, today, lastMonth), { month: '2027-01', day: '2026-12-02' })
  assert.equal(shiftView({ month: '2027-01', day: null }, 1, today, lastMonth), null)
  const first = view([], start)
  // 記録が無ければ今月より前へは送らない（109。前の「過去の実績」へのリンクはやめた）
  assert.match(first, /disabled="" aria-label="前の月（これより前の記録はありません）"/)
  assert.doesNotMatch(first, /calendar\/history/)
  assert.match(first, /2026年11月/)
  const last = view([], { month: '2027-01', day: null })
  assert.match(last, /disabled="" aria-label="次の月（見通しはこの月まで）"/)
  assert.match(last, /aria-label="前の月"/)
  assert.match(last, />今日<\/button>/)
  assert.deepEqual(readCalendarView({ month: '2027-01' }, today, lastMonth), { month: '2027-01', day: null })
  assert.deepEqual(readCalendarView({ month: '2027-02' }, today, lastMonth), { month: '2026-11', day: null })
  assert.equal(calendarHref({ month: '2026-11', day: null }, today), '/calendar')
})

test('締切2件と異なる3組の確認は今日の提案5件', () => {
  const crops = ['a','b','c'].map(cropId => ({ cropId, cropName: cropId, reason: 'no-question' as const }))
  const tasks = ['2026-11-28','2026-11-29'].map((deadline,i) => ({
    id: String(i), trigger: 'task-due', signal: { stage: 'deadline' as const, deadline, reason: '' },
    type: 'schedule' as const, title: '作業', description: '', priority: 'low' as const, urgency: 'today' as const,
    layers: { personal: null, regional: null, general: null, conclusion: '作業' },
  }))
  const concerns = crops.map(c => ({ id: c.cropId, cropId: c.cropId, observedDay: '2026-11-24', title: '見回り' }))
  assert.equal(organizeConfirmations(tasks, crops, [], concerns).count, 5)
  const html = view([], { month: '2026-11', day: null }, { proposalCount: 5 })
  assert.match(panelOf(html), /今日の提案 5件/)
  assert.doesNotMatch(panelOf(view([], { month: '2026-12', day: '2026-12-02' }, { proposalCount: 5 })), /今日の提案/)
  assert.doesNotMatch(html.slice(0, html.indexOf('calendar-day-panel')), /今日の提案/)
})
