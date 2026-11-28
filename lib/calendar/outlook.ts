import { calendarDate, lastYearOverlay, offsetDay } from './dates'
import { adviceNames } from '@/lib/crops/conditions'
import { milestoneAskStarts } from '@/lib/proposals/milestones'
import { firstFollowUpDay, lastFollowUpDay } from '@/lib/crops/field-concerns'
import { harvestDateLabel } from '@/lib/pesticide-safety'
import { pests } from '@/lib/pests/catalog'
import { FROST_RISK_MAX_C } from '@/lib/weather-frost'
import { FORECAST_LEAD_DAYS, highlightedRainDay } from '@/lib/weather-thresholds'
import type { ForecastDay } from '@/lib/weather-forecast'
import type { CalendarKind } from './day-panel'

type Source = 'station' | 'archive' | 'forecast' | 'mixed'
type Subject = { farmId: string | null; farmName?: string; cropName?: string }
/** title は欄の1行目、layer と note は2行目（層と出典の一言）、text は行の中で開く長い文 */
export type OutlookRow = Subject & {
  id: string; start: string; end: string; mark: string; kind: CalendarKind
  title: string; text: string; layer: string; note?: string; href: string; source?: Source
}
export type FarmOutlook = {
  id: string; name: string; prefectureCode: string | null
  frost: { month: number; day: number; label: string; text: string; note?: string; source: 'archive' | 'station' }[]
  forecast: ForecastDay[]
}
export type CropOutlook = {
  id: string; name: string; farmId: string | null; cropKind: string | null; variety: string | null
  growingSite: string | null; plantingMethod: string | null; planted: string | null; growing: boolean
  hasHarvest: boolean; milestones: { key: string }[]; harvestFrom?: string
  /** labels は記録で選んだ場所・様子の言葉（concernChoiceLabels） */
  concerns: { id: string; observed: string; answered: boolean; labels?: string[] }[]
  window: { start: string; end: string; text: string } | null
}
export type CalendarRecord = Subject & { id: string; date: string; label: string }

const slashDay = (day: string) => Number(day.slice(5, 7)) + '/' + Number(day.slice(8, 10))
const monthDay = (day: string) => Number(day.slice(5, 7)) + '月' + Number(day.slice(8, 10)) + '日'

/** 気になることの記録の短い名前。言葉が無い記録は「気になること」だけ */
export function concernTitle(cropName: string, observed: string, labels: string[] = []) {
  const words = labels.length ? ' ' + labels.slice(0, 3).join('・') + (labels.length > 3 ? ' ほか' : '') : ''
  return `${cropName}の気になること（${slashDay(observed)}${words}）のその後を聞く期間`
}

export function outlookRows(today: string, through: string, farms: FarmOutlook[], crops: CropOutlook[], previous: CalendarRecord[]) {
  const rows: OutlookRow[] = []
  const add = (subject: Subject, row: Omit<OutlookRow, keyof Subject>) => {
    if (row.end >= today && row.start <= through) rows.push({ ...subject, ...row })
  }
  const proposal = '/dashboard/ai-proposal'
  for (const farm of farms) {
    const subject = { farmId: farm.id, farmName: farm.name }
    for (const frost of farm.frost) {
      for (let year = Number(today.slice(0, 4)); year <= Number(through.slice(0, 4)); year++) {
        const day = calendarDate(year, frost.month, frost.day)
        add(subject, { id: farm.id + frost.label + day, start: day, end: day, mark: '霜', kind: 'weather', title: frost.label,
          text: frost.label + '。' + frost.text, layer: '地域', note: frost.note, href: '/farms/' + farm.id, source: frost.source })
      }
    }
    if (!crops.some(c => c.farmId === farm.id && c.growing)) continue
    const forecast = farm.forecast.filter(d => d.date >= today && d.date <= offsetDay(today, FORECAST_LEAD_DAYS))
    // 台帳 I28。今日の提案と同じく、農場ごとに最初の1日だけ。
    const frost = forecast.find(d => d.minTemp != null && d.minTemp <= FROST_RISK_MAX_C)
    if (frost?.minTemp != null)
      add(subject, { id: farm.id + 'frost' + frost.date, start: frost.date, end: frost.date, mark: '霜', kind: 'weather',
        title: '最低気温 ' + frost.minTemp + '℃ の計算', text: '数値予報モデルの計算では、' + frost.dayLabel + 'の最低気温は' + frost.minTemp + '℃です。',
        layer: '地域', note: '数値予報モデル', href: proposal, source: 'forecast' })
    const rain = highlightedRainDay(forecast)
    if (rain?.precipitation != null) {
      const percent = rain.precipitation.toFixed(0)
      add(subject, { id: farm.id + 'rain' + rain.date, start: rain.date, end: rain.date, mark: '雨', kind: 'weather',
        title: '降水確率 ' + percent + '% の計算', text: '数値予報モデルの計算では、' + rain.dayLabel + 'の降水確率は' + percent + '%です。',
        layer: '地域', note: '数値予報モデル', href: proposal, source: 'forecast' })
    }
  }
  for (const crop of crops) {
    const farm = farms.find(f => f.id === crop.farmId)
    const subject = { farmId: crop.farmId, farmName: farm?.name, cropName: crop.name }
    if (crop.harvestFrom && crop.harvestFrom > today)
      add(subject, { id: crop.id + 'pesticide', start: crop.harvestFrom, end: crop.harvestFrom, mark: '農薬', kind: 'mine',
        title: crop.name + 'の収穫ができるようになる日', text: '記録上、収穫できるのは' + harvestDateLabel(crop.harvestFrom) + 'からです。',
        layer: 'あなた', note: '農薬の記録', href: '/pesticides' })
    if (!crop.growing) continue
    for (const concern of crop.concerns) {
      if (!concern.answered) add(subject, { id: 'concern-' + concern.id, start: offsetDay(concern.observed, firstFollowUpDay),
        end: offsetDay(concern.observed, lastFollowUpDay), mark: '気になること', kind: 'mine',
        title: concernTitle(crop.name, concern.observed, concern.labels), text: '畑で見た気になることのその後を聞きます。',
        layer: 'あなた', note: '畑で見たことの記録', href: proposal })
    }
    const names = adviceNames(crop)
    if (names.recordOnly) continue
    if (crop.window) add(subject, { id: crop.id + 'harvest', start: crop.window.start, end: crop.window.end, mark: '収穫の見込み',
      kind: 'harvest', title: crop.name + 'の収穫の見込み', text: crop.window.text, layer: '地域・一般',
      note: '積算温度と過去10年の気温', href: '/gdd/' + crop.id, source: 'mixed' })
    if (crop.planted) {
      for (const item of milestoneAskStarts({ cropName: names.name, variety: names.variety, plantingMethod: crop.plantingMethod, records: crop.milestones, hasHarvest: crop.hasHarvest })) {
        const day = offsetDay(crop.planted, item.days)
        if (day > today) add(subject, { id: crop.id + item.key, start: day, end: day, mark: '聞き始め', kind: 'harvest',
          title: 'このころから、' + crop.name + 'の' + item.term + 'を聞きます', text: 'このころから、' + item.term + 'を聞きます（畑で見て確かめる）。',
          layer: '一般', note: '畑で見て確かめる', href: '/crops/' + crop.id })
      }
    }
    for (const pest of pests.filter(p => p.cropKind === crop.cropKind)) {
      for (const season of pest.seasons.filter(s => s.code === farm?.prefectureCode && (!s.site || s.site === crop.growingSite))) {
        const [year, month] = today.split('-').map(Number)
        for (let m = month; calendarDate(year, m, 1) <= through; m++) {
          const first = calendarDate(year, m, 1)
          if (season.months.includes(Number(first.slice(5, 7))))
            add(subject, { id: crop.id + pest.key + first, start: first, end: calendarDate(year, m + 1, 0), mark: '県の月', kind: 'season',
              title: pest.name, text: season.label, layer: '地域', href: proposal })
        }
      }
    }
  }
  if (crops.length) for (const record of previous) {
    // 昨年の重ねも、ほかの見通しと同じく表示する3か月の末日まで（台帳 I28）
    const keys = lastYearOverlay(record.date).filter(k => k >= today && k <= through)
    if (keys.length) add(record, { id: 'previous-' + record.id, start: keys[0], end: keys[keys.length - 1], mark: '昨年', kind: 'lastYear',
      title: '昨年の記録：' + record.label, text: '昨年の記録：' + record.label, layer: 'あなた', note: '昨年' + monthDay(record.date) + 'の記録',
      href: '/calendar/history?year=' + record.date.slice(0,4) + '&month=' + Number(record.date.slice(5,7)) })
  }
  return rows.sort((a,b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
}

/** その日の実績（作業・施肥）。表示する月の中なら、今日より前の日も出す */
export function recordRows(records: CalendarRecord[]): OutlookRow[] {
  return records.map(record => ({
    ...record, start: record.date, end: record.date, mark: '実績', kind: 'mine', title: record.label, text: record.label,
    layer: 'あなた', note: record.id.startsWith('fertilizer-') ? '施肥の記録' : '作業の記録', href: '/work-records',
  }))
}
