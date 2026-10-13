import { normalizeCropNameForMatch } from '@/lib/benchmarks/crops'
import { formatHarvestWindow, type HarvestDateWindow } from '@/lib/insights/harvest-date-window'
import { MILESTONE_SOURCE_CHIBA } from '@/lib/proposals/milestones'
import type { ForecastDay } from '@/lib/weather-forecast'
import {
  FROST_RISK_MAX_C,
  daysUntilMonthDay,
  daysUntilYmd,
  formatCelsius,
  formatMonthDay,
  formatYmd,
  FROST_ARCHIVE_YEARS,
  type FirstFrostSummary,
} from '@/lib/weather-frost'
import { formatKm } from '@/lib/jma/stations'
import { JMA_SEARCH_TOP } from '@/lib/jma/thresholds'
import type { FrostOrigin } from '@/lib/jma/frost-record'

export const FROST_FORECAST_TRIGGER = 'frost-forecast'
export const FROST_SEASON_TRIGGER = 'frost-season'

export const FROST_SOURCE_FUKUOKA = {
  publisher: '福岡管区気象台',
  name: 'はれるん',
  detail: '2020年11月26日号（第17号）',
  url: 'https://www.data.jma.go.jp/fukuoka/chosa/files/harerun0080.pdf',
}

export const FROST_SOURCE_JMA = {
  publisher: '気象庁',
  name: '警報・注意報発表基準一覧表',
  url: 'https://www.jma.go.jp/jma/kishou/know/kijun/index.html',
}

const SEASON_LEAD_DAYS = 30
const FORECAST_TODAY_DAYS = 6
const FORECAST_FROST_NOTE =
  '海沿いでは、計算の夜の気温が高めに出て、霜が実際より遅く見えることがあります。谷や窪地では、これより早く霜がおりることがあります。'
const STATION_FROST_NOTE =
  '観測所と畑では冷え込みが違うことがあります。窪地や内陸の畑は、これより早く霜がおりることがあります。'

export function isFrostTrigger(trigger: string | undefined): boolean {
  return trigger === FROST_FORECAST_TRIGGER || trigger === FROST_SEASON_TRIGGER
}

export function isSweetPotatoCrop(cropName: string, variety?: string | null): boolean {
  const names = [cropName, variety ?? ''].map((value) => normalizeCropNameForMatch(value))
  const words = ['さつまいも', 'サツマイモ', '薩摩芋', 'かんしょ'].map((word) => normalizeCropNameForMatch(word))
  return names.some((name) => words.some((word) => name.includes(word)))
}

export type SweetPotatoFrost = {
  trigger: typeof FROST_FORECAST_TRIGGER | typeof FROST_SEASON_TRIGGER
  urgency: 'today' | 'thisWeek'
  title: string
  conclusion: string
  /** 同じ作付けの別カードの【一般】に添える一文 */
  generalLine: string
  sourceLine: string
}

function baseSourceLine(): string {
  return `さつまいもは寒さに弱いので、収穫は降霜前に終わらせます（${MILESTONE_SOURCE_CHIBA.publisher}「${MILESTONE_SOURCE_CHIBA.name}」${MILESTONE_SOURCE_CHIBA.year} p.28）。最低気温${FROST_RISK_MAX_C}℃以下を霜のおそれとしています。`
}

function sourceLine(origin: FrostOrigin | null): string {
  const base = baseSourceLine()
  if (origin?.source !== 'station') return base
  return `${base}出典：気象庁ホームページ『過去の気象データ検索』（${JMA_SEARCH_TOP}）の日別値を加工して作成。`
}

function digLine(hasSeenRoots: boolean): string {
  return hasSeenRoots
    ? '霜の前に掘り上げましょう'
    : 'まず試し掘りで太りを確かめて、霜の前に掘り上げましょう'
}

function forecastConclusion(hasSeenRoots: boolean): string {
  return hasSeenRoots
    ? '霜のおそれがあるので、その前に掘り上げましょう。'
    : '霜のおそれがあるので、まず試し掘りで太りを確かめて、その前に掘り上げましょう。'
}

function frostWhen(origin: FrostOrigin): string {
  const frost = origin.summary
  const early = formatMonthDay(frost.earliest)
  if (origin.source === 'estimate') {
    const mean = formatMonthDay(frost.mean)
    const estimated =
      frost.years < FROST_ARCHIVE_YEARS
        ? `過去10年の推計では、10年中${frost.years}年で最低気温が初めて4℃以下になり、平均は${mean}、最も早い年は${early}です`
        : `過去10年の推計では、最低気温が初めて4℃以下になったのは平均${mean}、最も早い年は${early}です`
    return `${estimated}。近くの観測所の記録が使えないため、推計の気温から出しています`
  }
  const mean = formatMonthDay(frost.mean)
  const where = `（${origin.stationName}観測所・農場から${formatKm(origin.distanceKm ?? 0)}km）`
  const observed =
    frost.years < FROST_ARCHIVE_YEARS
      ? `過去10年の観測では、10年中${frost.years}年で最低気温が初めて4℃以下になり、平均は${mean}、最も早い年は${early}です${where}`
      : `過去10年の観測では、最低気温が初めて4℃以下になったのは平均${mean}、最も早い年は${early}です${where}`
  if (origin.near) return observed
  const elev = origin.elevationDiffM == null ? '' : `（標高差${origin.elevationDiffM}m）`
  return `${observed}。観測所は農場から${formatKm(origin.distanceKm ?? 0)}km${elev}離れているので、目安です`
}

function earliestDateThisYear(today: Date, frost: FirstFrostSummary): Date {
  return new Date(today.getFullYear(), frost.earliest.month - 1, frost.earliest.day, 12, 0, 0, 0)
}

export function assessSweetPotatoFrost(args: {
  today: Date
  forecast: ForecastDay[]
  firstFrost: FrostOrigin | null
  currentGdd: number | null
  targetGdd: number
  hasSeenRoots: boolean
  /** 年ごとの気温で出した幅。null は年内に届いた年が0 */
  harvestWindow: HarvestDateWindow | null
  /** false のときは季節のカードを出さない（年ごとの気温が無い） */
  harvestWindowReady: boolean
}): SweetPotatoFrost | null {
  const upcoming = args.forecast.find((day) => day.minTemp <= FROST_RISK_MAX_C)
  if (upcoming) {
    const when = formatYmd(upcoming.date)
    const temp = formatCelsius(upcoming.minTemp)
    const withinWeek = daysUntilYmd(args.today, upcoming.date) <= FORECAST_TODAY_DAYS
    return {
      trigger: FROST_FORECAST_TRIGGER,
      urgency: withinWeek ? 'today' : 'thisWeek',
      title: `数値予報モデルの計算では、${when}の最低気温は${temp}℃です`,
      conclusion: forecastConclusion(args.hasSeenRoots),
      generalLine: `数値予報モデルの計算では、${when}の最低気温は${temp}℃です。霜のおそれがあるので、${args.hasSeenRoots ? 'その前に掘り上げます' : 'まず試し掘りで太りを確かめて、その前に掘り上げます'}。${FORECAST_FROST_NOTE}`,
      sourceLine: baseSourceLine(),
    }
  }

  const origin = args.firstFrost
  if (!origin || args.currentGdd == null || !args.harvestWindowReady || args.targetGdd <= 0) return null
  const frost = origin.summary
  if (daysUntilMonthDay(args.today, frost.earliest) > SEASON_LEAD_DAYS) return null
  const when = frostWhen(origin)
  const note = origin.source === 'station' ? STATION_FROST_NOTE : FORECAST_FROST_NOTE
  const action = digLine(args.hasSeenRoots)
  const window = args.harvestWindow
  if (!window) {
    return {
      trigger: FROST_SEASON_TRIGGER,
      urgency: 'thisWeek',
      title: '今季は、収穫の目安に届かない見込みです',
      conclusion: `${when}。${action}。`,
      generalLine: `今季は、収穫の目安に届かない見込みです。${when}。${args.hasSeenRoots ? '霜の前に掘り上げます' : 'まず試し掘りで太りを確かめて、霜の前に掘り上げます'}。${note}`,
      sourceLine: sourceLine(origin),
    }
  }
  if (window.late.getTime() <= earliestDateThisYear(args.today, frost).getTime()) return null

  const span = formatHarvestWindow(window)
  const after = args.hasSeenRoots ? '霜の前に掘り上げます' : 'まず試し掘りで太りを確かめて、霜の前に掘り上げます'
  return {
    trigger: FROST_SEASON_TRIGGER,
    urgency: 'thisWeek',
    title: when,
    conclusion: `収穫の目安に届くのは${span}。それより、霜が先になる年があります。${action}。`,
    generalLine: `${when}。収穫の目安に届くのは${span}。それより、霜が先になる年があります。${after}。${note}`,
    sourceLine: sourceLine(origin),
  }
}
