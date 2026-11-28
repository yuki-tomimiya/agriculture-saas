import { calendarDate, lastYearOverlay, offsetDay } from './dates'
import { adviceNames } from '@/lib/crops/conditions'
import { milestoneAskStarts } from '@/lib/proposals/milestones'
import { firstFollowUpDay, lastFollowUpDay } from '@/lib/crops/field-concerns'
import { harvestDateLabel } from '@/lib/pesticide-safety'
import { pests } from '@/lib/pests/catalog'
import { FROST_RISK_MAX_C } from '@/lib/weather-frost'
import { FORECAST_LEAD_DAYS, highlightedRainDay } from '@/lib/weather-thresholds'
import type { ForecastDay } from '@/lib/weather-forecast'

type Source = 'station' | 'archive' | 'forecast' | 'mixed'
type Subject = { farmId: string | null; farmName?: string; cropName?: string }
export type OutlookRow = Subject & {
  id: string; start: string; end: string; mark: string; text: string; layer: string; href: string; source?: Source
}
export type FarmOutlook = {
  id: string; name: string; prefectureCode: string | null
  frost: { month: number; day: number; label: string; text: string; source: 'archive' | 'station' }[]
  forecast: ForecastDay[]
}
export type CropOutlook = {
  id: string; name: string; farmId: string | null; cropKind: string | null; variety: string | null
  growingSite: string | null; plantingMethod: string | null; planted: string | null; growing: boolean
  hasHarvest: boolean; milestones: { key: string }[]; harvestFrom?: string
  concerns: { id: string; observed: string; answered: boolean }[]
  window: { start: string; end: string; text: string } | null
}
export type CalendarRecord = Subject & { id: string; date: string; label: string }
export function outlookRows(today: string, through: string, farms: FarmOutlook[], crops: CropOutlook[], previous: CalendarRecord[]) {
  const rows: OutlookRow[] = []
  const add = (subject: Subject, id: string, start: string, end: string, mark: string, text: string, layer: string, href: string, source?: Source) => {
    if (end >= today && start <= through) rows.push({ ...subject, id, start, end, mark, text, layer, href, source })
  }
  const proposal = '/dashboard/ai-proposal'
  for (const farm of farms) {
    const subject = { farmId: farm.id, farmName: farm.name }
    for (const frost of farm.frost) {
      for (let year = Number(today.slice(0, 4)); year <= Number(through.slice(0, 4)); year++) {
        const day = calendarDate(year, frost.month, frost.day)
        add(subject, farm.id + frost.label + day, day, day, '霜', frost.label + '。' + frost.text, '地域', '/farms/' + farm.id, frost.source)
      }
    }
    if (!crops.some(c => c.farmId === farm.id && c.growing)) continue
    const forecast = farm.forecast.filter(d => d.date >= today && d.date <= offsetDay(today, FORECAST_LEAD_DAYS))
    for (const d of forecast) {
      if (d.minTemp != null && d.minTemp <= FROST_RISK_MAX_C)
        add(subject, farm.id + 'frost' + d.date, d.date, d.date, '霜', '数値予報モデルの計算では、' + d.dayLabel + 'の最低気温は' + d.minTemp + '℃です。', '地域', proposal, 'forecast')
    }
    const rain = highlightedRainDay(forecast)
    if (rain?.precipitation != null)
      add(subject, farm.id + 'rain' + rain.date, rain.date, rain.date, '雨', '数値予報モデルの計算では、' + rain.dayLabel + 'の降水確率は' + rain.precipitation.toFixed(0) + '%です。', '地域', proposal, 'forecast')
  }
  for (const crop of crops) {
    const farm = farms.find(f => f.id === crop.farmId)
    const subject = { farmId: crop.farmId, farmName: farm?.name, cropName: crop.name }
    if (crop.harvestFrom && crop.harvestFrom > today)
      add(subject, crop.id + 'pesticide', crop.harvestFrom, crop.harvestFrom, '農薬', '記録上、収穫できるのは' + harvestDateLabel(crop.harvestFrom) + 'からです。', 'あなた', '/pesticides')
    if (!crop.growing) continue
    for (const concern of crop.concerns) {
      if (!concern.answered) add(subject, 'concern-' + concern.id, offsetDay(concern.observed, firstFollowUpDay), offsetDay(concern.observed, lastFollowUpDay), '異変', '畑で見た異変のその後を聞きます。', 'あなた', proposal)
    }
    const names = adviceNames(crop)
    if (names.recordOnly) continue
    if (crop.window) add(subject, crop.id + 'harvest', crop.window.start, crop.window.end, '収穫の見込み', crop.window.text, '地域・一般', '/gdd/' + crop.id, 'mixed')
    if (crop.planted) {
      for (const item of milestoneAskStarts({ cropName: names.name, variety: names.variety, plantingMethod: crop.plantingMethod, records: crop.milestones, hasHarvest: crop.hasHarvest })) {
        const day = offsetDay(crop.planted, item.days)
        if (day > today) add(subject, crop.id + item.key, day, day, '聞き始め', 'このころから、' + item.term + 'を聞きます（畑で見て確かめる）。', '一般', '/crops/' + crop.id)
      }
    }
    for (const pest of pests.filter(p => p.cropKind === crop.cropKind)) {
      for (const season of pest.seasons.filter(s => s.code === farm?.prefectureCode && (!s.site || s.site === crop.growingSite))) {
        const [year, month] = today.split('-').map(Number)
        for (let m = month; calendarDate(year, m, 1) <= through; m++) {
          const first = calendarDate(year, m, 1)
          if (season.months.includes(Number(first.slice(5, 7))))
            add(subject, crop.id + pest.key + first, first, calendarDate(year, m + 1, 0), '県の月', season.label, '地域', proposal)
        }
      }
    }
  }
  if (crops.length) for (const record of previous) {
    const keys = lastYearOverlay(record.date).filter(k => k >= today && k <= through && k <= offsetDay(today, 30))
    if (keys.length) add(record, 'previous-' + record.id, keys[0], keys[keys.length - 1], '昨年', '昨年の記録：' + record.label, 'あなた', '/calendar/history?year=' + record.date.slice(0,4) + '&month=' + Number(record.date.slice(5,7)))
  }
  return rows.sort((a,b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
}
