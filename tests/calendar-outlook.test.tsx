import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderWithRouter } from './helpers/next-runtime'
import CalendarOutlook from '@/components/CalendarOutlook'
import { lastYearOverlay } from '@/lib/calendar/dates'
import { outlookRows, type CropOutlook, type FarmOutlook } from '@/lib/calendar/outlook'
import { harvestDatesByCrop, japanDateKey } from '@/lib/pesticide-safety'
import { organizeConfirmations } from '@/lib/proposals/presentation'
import type { ForecastDay } from '@/lib/weather-forecast'

const today = '2026-11-28'
const through = '2027-01-31'
const farm: FarmOutlook = { id: 'f', name: '秋田の畑', prefectureCode: '05', frost: [], forecast: [] }
const cabbage: CropOutlook = {
  id: 'c', name: 'キャベツ', farmId: 'f', cropKind: 'cabbage', variety: null, planted: '2026-11-08',
  growing: true, growingSite: 'open', plantingMethod: 'transplant', hasHarvest: false, milestones: [], concerns: [], window: null,
}

test('日本時間の28日から、節目は明日以降の最初の1日、農薬と異変は記録どおり', () => {
  assert.equal(japanDateKey(new Date('2026-11-27T15:30Z')), today)
  const dates = harvestDatesByCrop([{ cropId: 'c', appliedAt: new Date('2026-11-25'), daysBeforeHarvest: 7 }, { cropId: 'unknown', appliedAt: new Date(), daysBeforeHarvest: null }])
  assert.equal(dates.has('unknown'), false)
  const crop = { ...cabbage, harvestFrom: dates.get('c'), concerns: [{ id: 'i', observed: '2026-11-24', answered: false }] }
  const rows = outlookRows(today, through, [farm], [crop, { ...cabbage, id: 'h', cropKind: 'chinese-cabbage', name: 'はくさい', planted: '2026-11-18' }], [])
  assert.deepEqual(rows.map(r => [r.start, r.end, r.mark]), [
    ['2026-11-27', '2026-12-01', '異変'], ['2026-12-02','2026-12-02','農薬'],
    ['2026-12-23','2026-12-23','聞き始め'], ['2026-12-28','2026-12-28','聞き始め'],
  ])
  assert.ok(rows.filter(r => r.mark === '聞き始め').every(r => r.text.includes('球のしまりを聞きます')))
  assert.deepEqual(outlookRows(today, through, [farm], [{ ...crop, hasHarvest: true, harvestFrom: today, concerns: [{ ...crop.concerns[0], answered: true }] }], []), [])
  assert.deepEqual(outlookRows(today, through, [farm], [{ ...cabbage, milestones: [{ key: 'cabbage-firm' }] }], []), [])
})

test('空の農場の霜・収穫の幅・県の月・直近の雨と昨年の幅を分ける', () => {
  const frost: FarmOutlook['frost'] = [20, 5].map((day, i) => ({ month: i ? 12 : 11, day, label: i ? '平均' : '最早', text: '観測', source: 'station' }))
  const forecast = ['2026-11-28', '2026-11-29'].map(date => ({ date, dayLabel: date, minTemp: 4, precipitation: 55 } as ForecastDay))
  const empty = outlookRows(today, through, [{ ...farm, frost, forecast }], [], [])
  assert.deepEqual(empty.map(r => r.start), ['2026-12-05'])
  assert.match(renderWithRouter(<CalendarOutlook rows={empty} hasCrops={false} />), /作付けを登録/)
  const taro = { ...cabbage, name: 'さといも', cropKind: 'taro' }
  const win = { start: '2026-12-01', end: '2026-12-20', text: '収穫の幅' }
  const previous = [{ id: 'r', farmId: 'f', date: '2025-12-31', label: '施肥' }, { id: 's', farmId: 'f', date: '2025-12-01', label: '収穫' }]
  const rows = outlookRows(today, through, [{ ...farm, forecast }], [taro, { ...cabbage, window: win }], previous)
  assert.deepEqual(rows.filter(r => r.mark === '収穫の見込み').map(r => [r.start,r.end]), [[win.start,win.end]])
  assert.equal(rows.filter(r => r.mark === '雨').length, 1)
  assert.equal(rows.filter(r => r.source === 'forecast' && r.mark === '霜').length, 2)
  assert.deepEqual(rows.filter(r => r.mark === '昨年').map(r => [r.start,r.end]), [['2026-11-29','2026-12-03']])
  assert.ok(lastYearOverlay('2025-12-31').includes('2027-01-02'))
  assert.equal(rows.some(r => r.mark === '県の月'), false)
  assert.deepEqual(outlookRows('2026-08-10','2026-10-31',[farm],[taro],[]).map(r => r.start), ['2026-08-01','2026-09-01'])
  assert.deepEqual(outlookRows('2026-08-10','2026-10-31',[{ ...farm, prefectureCode: '13' }],[taro],[]), [])
  const html = renderWithRouter(<CalendarOutlook rows={rows} hasCrops />)
  assert.equal(html.split('出典・免責の原文').length - 1, 1)
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
})
