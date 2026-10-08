import { prisma } from '@/lib/prisma'
import {
  getHistoricalDailyPrecipitation,
  hasWeatherCoordinates,
} from '@/lib/weather-forecast'
import { getLocationDailyNormals, sumNormalPrecip } from '@/lib/weather-normals'
import { TEN_YEAR_MEAN } from '@/lib/weather-labels'

export type RegionalRainSummary = {
  farmId: string | null
  farmName: string | null
  month: number
  year: number
  dayOfMonth: number
  /** 今月1日〜比較日までの累積雨量（mm） */
  thisYearMm: number | null
  /** 同じ暦日範囲の平年降水量（mm） */
  normalMm: number | null
  /** 今年 ÷ 平年 × 100。平年0のときは null */
  normalRatioPct: number | null
  /** 昨年同月同時期の累積雨量（mm） */
  lastYearMm: number | null
  /** 平年との差（%）。平年が無いときは null */
  diffPct: number | null
  /** カード・提案用の短い解釈 */
  shortLine: string
  /** 分析ページ用のやや長い解釈 */
  interpretation: string
}

function tokyoParts(d = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value
      return acc
    }, {})
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  }
}

function dateAtTokyo(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

function sumMm(rows: { precipitationMm: number }[]): number {
  const total = rows.reduce((s, r) => s + r.precipitationMm, 0)
  return Math.round(total * 10) / 10
}

/**
 * Open-Meteo archive は数日遅れることがあるため、比較日は「今日の2日前」までに抑える。
 * 1日未満なら1日とする。
 */
function compareDayOfMonth(year: number, month: number, todayDay: number): number {
  const lastDay = new Date(year, month, 0).getDate()
  const capped = Math.max(1, todayDay - 2)
  return Math.min(capped, lastDay)
}

function buildInterpretation(args: {
  month: number
  dayOfMonth: number
  thisYearMm: number | null
  normalMm: number | null
  lastYearMm: number | null
  farmName: string | null
}): { shortLine: string; interpretation: string; diffPct: number | null; normalRatioPct: number | null } {
  const place = args.farmName ? `${args.farmName}周辺` : 'この地域'
  const period =
    args.dayOfMonth <= 1 ? `${args.month}月1日まで` : `${args.month}月1日〜${args.dayOfMonth}日`

  if (args.thisYearMm === null) {
    const msg = `${place}の降水量データを取得できませんでした。緯度・経度や通信状況を確認してください。`
    return { shortLine: msg, interpretation: msg, diffPct: null, normalRatioPct: null }
  }

  const base = `${place}の${period}の降水量は約${args.thisYearMm}mm`
  const lastNote =
    args.lastYearMm !== null ? `昨年同時期は約${args.lastYearMm}mm。` : ''

  if (args.normalMm === null) {
    return fallbackLastYear({
      dayOfMonth: args.dayOfMonth,
      thisYearMm: args.thisYearMm,
      lastYearMm: args.lastYearMm,
      base,
    })
  }

  const normalRatioPct =
    args.normalMm > 0 ? Math.round((args.thisYearMm / args.normalMm) * 100) : null
  const diffPct =
    args.normalMm > 0 ? Math.round(((args.thisYearMm - args.normalMm) / args.normalMm) * 100) : null
  const ratioText = normalRatioPct !== null ? `${TEN_YEAR_MEAN}の${normalRatioPct}%` : ''
  let fact = ''
  if (args.normalMm === 0 && args.thisYearMm === 0) {
    fact = `${TEN_YEAR_MEAN}もほぼ降水なしです。`
  } else if (normalRatioPct !== null && normalRatioPct <= 75) {
    fact = `${TEN_YEAR_MEAN}より雨が少ないです。`
  } else if (normalRatioPct !== null && normalRatioPct >= 125) {
    fact = `${TEN_YEAR_MEAN}より雨が多いです。`
  }
  const compare =
    ratioText !== ''
      ? `降水量は${ratioText}です（推計では約${args.thisYearMm}mm、${TEN_YEAR_MEAN}は約${args.normalMm}mm）`
      : `${TEN_YEAR_MEAN}の同じ期間は約${args.normalMm}mmです（推計）`
  const shortLine = `${place}の${period}。${compare}。${lastNote}${fact}`
  const interpretation = shortLine
  return { shortLine, interpretation, diffPct, normalRatioPct }
}

function fallbackLastYear(args: {
  dayOfMonth: number
  thisYearMm: number
  lastYearMm: number | null
  base: string
}): { shortLine: string; interpretation: string; diffPct: number | null; normalRatioPct: number | null } {
  const tooEarly = args.dayOfMonth < 7
  if (tooEarly) {
    const line = `${args.base}。${TEN_YEAR_MEAN}を取得できなかったため、昨年との割合は7日分そろってから見ます。`
    return { shortLine: line, interpretation: line, diffPct: null, normalRatioPct: null }
  }
  let diffPct: number | null = null
  if (args.lastYearMm !== null && args.lastYearMm > 0) {
    diffPct = Math.round(((args.thisYearMm - args.lastYearMm) / args.lastYearMm) * 100)
  }
  let compare = ''
  if (args.lastYearMm === null) {
    compare = '昨年同時期のデータは取得できませんでした'
  } else if (args.lastYearMm === 0 && args.thisYearMm === 0) {
    compare = '昨年同時期もほぼ降水なし'
  } else if (diffPct !== null && diffPct >= 25) {
    compare = `昨年同時期（約${args.lastYearMm}mm）より多め（+${diffPct}%）`
  } else if (diffPct !== null && diffPct <= -25) {
    compare = `昨年同時期（約${args.lastYearMm}mm）より少なめ（${diffPct}%）`
  } else {
    compare = `昨年同時期（約${args.lastYearMm}mm）と同程度`
  }
  const shortLine = `${args.base}。${compare}。`
  return { shortLine, interpretation: shortLine, diffPct, normalRatioPct: null }
}

/**
 * 農場座標の「今月の降水量（今月1日〜比較日）」と「昨年同時期」を比較し、解釈文を返す。
 */
export async function getRegionalRainSummary(args: {
  latitude?: number | null
  longitude?: number | null
  farmId?: string | null
  farmName?: string | null
}): Promise<RegionalRainSummary | null> {
  if (!hasWeatherCoordinates(args)) return null

  const { year, month, day } = tokyoParts()
  const dayOfMonth = compareDayOfMonth(year, month, day)

  const thisStart = dateAtTokyo(year, month, 1)
  const thisEnd = dateAtTokyo(year, month, dayOfMonth)
  const lastStart = dateAtTokyo(year - 1, month, 1)
  const lastEnd = dateAtTokyo(year - 1, month, dayOfMonth)

  const point = {
    latitude: Number(args.latitude),
    longitude: Number(args.longitude),
  }

  const [thisRows, lastRows, normals] = await Promise.all([
    getHistoricalDailyPrecipitation({ startDate: thisStart, endDate: thisEnd, point }),
    getHistoricalDailyPrecipitation({ startDate: lastStart, endDate: lastEnd, point }),
    getLocationDailyNormals(point),
  ])

  const thisYearMm = thisRows.length > 0 ? sumMm(thisRows) : null
  const lastYearMm = lastRows.length > 0 ? sumMm(lastRows) : null
  const normalMm = normals ? sumNormalPrecip(normals, thisStart, thisEnd) : null

  const { shortLine, interpretation, diffPct, normalRatioPct } = buildInterpretation({
    month,
    dayOfMonth,
    thisYearMm,
    normalMm,
    lastYearMm,
    farmName: args.farmName ?? null,
  })

  return {
    farmId: args.farmId ?? null,
    farmName: args.farmName ?? null,
    month,
    year,
    dayOfMonth,
    thisYearMm,
    normalMm,
    normalRatioPct,
    lastYearMm,
    diffPct,
    shortLine,
    interpretation,
  }
}

/**
 * ユーザーの農場（座標あり）について地域サマリーを取得。
 * 先頭が「代表農場」（最初に座標がある農場）。
 */
export async function getRegionalContextForUser(userId: string): Promise<{
  primary: RegionalRainSummary | null
  byFarmId: Record<string, RegionalRainSummary>
  needsCoordinates: boolean
}> {
  const farms = await prisma.farm.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })

  const withCoords = farms.filter((f) => hasWeatherCoordinates(f))
  if (withCoords.length === 0) {
    return { primary: null, byFarmId: {}, needsCoordinates: farms.length > 0 }
  }

  const byFarmId: Record<string, RegionalRainSummary> = {}
  // 代表＋比較カード用に、座標のある農場を最大3件まで（API負荷抑制）
  const targets = withCoords.slice(0, 3)
  const results = await Promise.all(
    targets.map((f) =>
      getRegionalRainSummary({
        latitude: f.latitude,
        longitude: f.longitude,
        farmId: f.id,
        farmName: f.name,
      })
    )
  )

  for (let i = 0; i < targets.length; i++) {
    const summary = results[i]
    if (summary) byFarmId[targets[i].id] = summary
  }

  const primary = results.find((r) => r !== null) ?? null
  return { primary, byFarmId, needsCoordinates: false }
}

/** AI提案の地域層向け：月次降水量の短い一文（取得できなければ null） */
export async function getRegionalMonthlyLine(point?: {
  latitude?: number | null
  longitude?: number | null
  farmName?: string | null
}): Promise<string | null> {
  const summary = await getRegionalRainSummary(point ?? {})
  return summary?.shortLine ?? null
}
