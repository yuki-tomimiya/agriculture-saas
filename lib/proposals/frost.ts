import { normalizeCropNameForMatch } from '@/lib/benchmarks/crops'
import { LATE_FROST_COVER, LATE_FROST_POTATO, LATE_FROST_SOURCE } from '@/lib/benchmarks/planting-conditions'
import { formatHarvestWindow, type HarvestDateWindow } from '@/lib/insights/harvest-date-window'
import { formatHarvestGddOutlook, formatHarvestGddTarget, type HarvestGddReference } from '@/lib/gdd'
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
export const SPRING_FROST_TRIGGER = 'spring-frost'

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
  return trigger === FROST_FORECAST_TRIGGER || trigger === FROST_SEASON_TRIGGER || trigger === SPRING_FROST_TRIGGER
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
  reason: string
  confirmationReason: string
  confirmationLayers: { regional: string; general: string; conclusion: string }
  deadline?: string
  conclusion: string
  harvestOutlook?: { text: string; windowText: string | null }
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
  const period = origin.usableYears === FROST_ARCHIVE_YEARS
    ? '過去10年の観測では'
    : `この観測所の記録のそろった${origin.usableYears}年では`
  const observed =
    frost.years < origin.usableYears
      ? `${period}、${origin.usableYears}年中${frost.years}年で最低気温が初めて4℃以下になり、平均は${mean}、最も早い年は${early}です${where}`
      : `${period}、最低気温が初めて4℃以下になったのは平均${mean}、最も早い年は${early}です${where}`
  if (origin.near) return observed
  const elev = origin.elevationDiffM == null ? '' : `（標高差${origin.elevationDiffM}m）`
  return `${observed}。観測所は農場から${formatKm(origin.distanceKm ?? 0)}km${elev}離れているので、目安です`
}

function earliestDateThisYear(today: Date, frost: FirstFrostSummary): Date {
  return new Date(today.getFullYear(), frost.earliest.month - 1, frost.earliest.day, 12, 0, 0, 0)
}

function formatConfirmationDate(label: string, days: number): string {
  if (days < 0) return `${label}（今年はもう過ぎています）`
  if (days === 0) return `${label}（今日）`
  return `${label}（${days === 1 ? 'あす' : `あと${days}日`}）`
}

export function formatSeasonDateEnding(days: number): string {
  if (days < 0) return 'で、今年はもう過ぎています。'
  if (days === 0) return 'で、今日にあたります。'
  return `で、${days === 1 ? 'あす' : `あと${days}日`}です。`
}

function formatWindowDates(window: HarvestDateWindow): string {
  const early = `${window.early.getMonth() + 1}月${window.early.getDate()}日`
  const late = `${window.late.getMonth() + 1}月${window.late.getDate()}日`
  return early === late ? early : `${early}〜${late}`
}

export function assessSweetPotatoFrost(args: {
  today: Date
  forecast: ForecastDay[]
  firstFrost: FrostOrigin | null
  currentGdd: number | null
  targetGdd: number
  reference?: HarvestGddReference
  hasSeenRoots: boolean
  /** 年ごとの気温で出した幅。null は年内に届いた年が0 */
  harvestWindow: HarvestDateWindow | null
  /** false のときは季節のカードを出さない（年ごとの気温が無い） */
  harvestWindowReady: boolean
}): SweetPotatoFrost | null {
  const upcoming = args.forecast.find(day => day.minTemp != null && day.minTemp <= FROST_RISK_MAX_C)
  if (upcoming?.minTemp != null) {
    const when = formatYmd(upcoming.date)
    const temp = formatCelsius(upcoming.minTemp)
    const days = daysUntilYmd(args.today, upcoming.date)
    const withinWeek = days <= FORECAST_TODAY_DAYS
    return {
      trigger: FROST_FORECAST_TRIGGER,
      urgency: withinWeek ? 'today' : 'thisWeek',
      title: `数値予報モデルの計算では、${when}の最低気温は${temp}℃です`,
      reason: `${when}の最低気温は${temp}℃の計算です（数値予報モデル）。`,
      confirmationReason: `${formatConfirmationDate(when, days)}の最低気温は${temp}℃の計算です（数値予報モデル）。`,
      confirmationLayers: {
        regional: FORECAST_FROST_NOTE, general: baseSourceLine(), conclusion: forecastConclusion(args.hasSeenRoots),
      },
      deadline: upcoming.date,
      conclusion: forecastConclusion(args.hasSeenRoots),
      generalLine: `数値予報モデルの計算では、${when}の最低気温は${temp}℃です。霜のおそれがあるので、${args.hasSeenRoots ? 'その前に掘り上げます' : 'まず試し掘りで太りを確かめて、その前に掘り上げます'}。${FORECAST_FROST_NOTE}`,
      sourceLine: baseSourceLine(),
    }
  }

  const origin = args.firstFrost
  if (!origin || args.currentGdd == null || !args.harvestWindowReady || args.targetGdd <= 0) return null
  const frost = origin.summary
  const days = daysUntilMonthDay(args.today, frost.earliest)
  if (days > SEASON_LEAD_DAYS) return null
  const when = frostWhen(origin)
  const fewerObservedYears = origin.source === 'station' && origin.usableYears < FROST_ARCHIVE_YEARS
  const period = fewerObservedYears ? `この観測所の記録のそろった${origin.usableYears}年` : '過去10年'
  const reason = `${period}で、最低気温が最も早く4℃以下になったのは${formatMonthDay(frost.earliest)}です（${origin.source === 'station' ? '観測' : '推計'}）。`
  const note = origin.source === 'station' ? STATION_FROST_NOTE : FORECAST_FROST_NOTE
  const action = digLine(args.hasSeenRoots)
  const window = args.harvestWindow
  const windowText = window ? formatHarvestWindow(window) : null
  const outlook = formatHarvestGddOutlook({
    currentGdd: args.currentGdd,
    targetGdd: args.targetGdd,
    reference: args.reference,
    windowText,
  })
  const earlyFrost = `${formatMonthDay(frost.earliest)}（${origin.source === 'station' ? '観測' : '推計'}）`
  const target = formatHarvestGddTarget(args.targetGdd, args.reference)
  const targetTiming = window
    ? args.currentGdd >= args.targetGdd
      ? `${target}にはすでに届いています。`
      : `${target}に届く見込みは${formatWindowDates(window)}です。`
    : `${target}には今季届かない見込みです。`
  const confirmationReason = `${targetTiming}${period}で最も早く最低気温が4℃以下になった日は${earlyFrost}${formatSeasonDateEnding(days)}`
  const station = origin.source === 'station'
    ? `${origin.stationName}観測所（農場から${formatKm(origin.distanceKm ?? 0)}km${origin.elevationDiffM == null ? '' : `、標高差${origin.elevationDiffM}m`}）の日別値を使っています。`
    : '近くの観測所の記録が使えないため、推計の気温を使っています。'
  const confirmationLayers = {
    regional: fewerObservedYears
      ? `${when}。${note}`
      : `${station}過去10年で最低気温が初めて4℃以下になった日の平均は${formatMonthDay(frost.mean)}です。${frost.years < FROST_ARCHIVE_YEARS ? `該当したのは${frost.years}年です。` : ''}${note}`,
    general: baseSourceLine(),
    conclusion: `${window && args.currentGdd < args.targetGdd ? '見込みの時期より先に霜が来る年があります。' : ''}${action}。`,
  }
  if (!window) {
    return {
      trigger: FROST_SEASON_TRIGGER,
      urgency: 'thisWeek',
      title: '霜の前に収穫を考えましょう',
      reason,
      confirmationReason,
      confirmationLayers,
      conclusion: `${when}。${action}。`,
      harvestOutlook: { text: outlook, windowText },
      generalLine: `${outlook}${when}。${args.hasSeenRoots ? '霜の前に掘り上げます' : 'まず試し掘りで太りを確かめて、霜の前に掘り上げます'}。${note}`,
      sourceLine: sourceLine(origin),
    }
  }
  if (window.late.getTime() <= earliestDateThisYear(args.today, frost).getTime()) return null

  const after = args.hasSeenRoots ? '霜の前に掘り上げます' : 'まず試し掘りで太りを確かめて、霜の前に掘り上げます'
  return {
    trigger: FROST_SEASON_TRIGGER,
    urgency: 'thisWeek',
    title: when,
    reason,
    confirmationReason,
    confirmationLayers,
    conclusion: `見込みの時期より先に霜が来る年があります。${action}。`,
    harvestOutlook: { text: outlook, windowText },
    generalLine: `${when}。${outlook}見込みの時期より先に霜が来る年があります。${after}。${note}`,
    sourceLine: sourceLine(origin),
  }
}

export type SpringLateFrost = {
  trigger: typeof SPRING_FROST_TRIGGER
  urgency: 'today' | 'thisWeek'
  title: string
  reason: string
  confirmationReason: string
  regionalNote: string
  deadline: string
  conclusion: string
  generalLine: string
  sourceLine: string
  potato: boolean
}

export function assessSpringLateFrost(args: {
  today: Date
  forecast: ForecastDay[]
  potato: boolean
}): SpringLateFrost | null {
  const upcoming = args.forecast.find((day) => {
    if (day.minTemp == null || day.minTemp > FROST_RISK_MAX_C) return false
    const month = Number(day.date.slice(5, 7))
    return month >= 1 && month <= 6
  })
  if (upcoming?.minTemp == null) return null
  const when = formatYmd(upcoming.date)
  const temp = formatCelsius(upcoming.minTemp)
  const days = daysUntilYmd(args.today, upcoming.date)
  const withinWeek = days <= FORECAST_TODAY_DAYS
  const hill = args.potato ? LATE_FROST_POTATO : ''
  const conclusion = `霜のおそれがあります。${LATE_FROST_COVER}${hill}`
  return {
    trigger: SPRING_FROST_TRIGGER,
    urgency: withinWeek ? 'today' : 'thisWeek',
    title: `数値予報モデルの計算では、${when}の最低気温は${temp}℃です`,
    reason: `${when}の最低気温は${temp}℃の計算です（数値予報モデル）。`,
    confirmationReason: `${formatConfirmationDate(when, days)}の最低気温は${temp}℃の計算です（数値予報モデル）。`,
    regionalNote: FORECAST_FROST_NOTE,
    deadline: upcoming.date,
    conclusion,
    generalLine: `数値予報モデルの計算では、${when}の最低気温は${temp}℃です。霜のおそれがあります。${LATE_FROST_COVER}${hill}${FORECAST_FROST_NOTE}`,
    sourceLine: `出典：${LATE_FROST_SOURCE}。`,
    potato: args.potato,
  }
}
