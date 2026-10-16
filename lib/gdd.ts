/**
 * 積算温度（GDD）の予測計算
 * 予報気温から「目標℃日に達する日」を算出し、提案文を生成する
 */

import { dailyHeat, type HeatCount } from '@/lib/benchmarks/gdd-methods'

export type GDDProjectionResult = {
  /** 予報期間中の日別累積GDD（現在値 + 予報分） */
  dailyProjections: { date: Date; cumulativeGDD: number; dailyGDD: number }[]
  /** 目標GDDに達する見込み日（予報期間内に達する場合） */
  targetReachDate: Date | null
  /** 目標GDDに達するまでの日数（概算） */
  daysToTarget: number | null
  /** 予報期間終了時点の見込み累積GDD */
  endCumulativeGDD: number
  /** 提案文の配列 */
  suggestions: string[]
}

/**
 * 現在の累積GDDと予報気温から、今後14日間のGDD見通しと目標到達日・提案を算出する
 */
export function computeGDDProjection(
  currentGDD: number,
  count: HeatCount,
  baseTemp: number,
  forecastDailyTemps: { date: Date; avgTemp: number }[],
  targetGDD: number,
  options?: { harvestWindowText?: string | null; seasonUnreachable?: boolean }
): GDDProjectionResult {
  let cumulative = currentGDD
  const dailyProjections: GDDProjectionResult['dailyProjections'] = []
  let targetReachDate: Date | null = null
  let daysToTarget: number | null = null

  for (const day of forecastDailyTemps) {
    const dGDD = dailyHeat(day.avgTemp, count, baseTemp)
    cumulative += dGDD
    dailyProjections.push({
      date: day.date,
      cumulativeGDD: Math.round(cumulative * 10) / 10,
      dailyGDD: Math.round(dGDD * 10) / 10,
    })
    if (targetReachDate === null && cumulative >= targetGDD) {
      targetReachDate = day.date
      const startDate = forecastDailyTemps[0]?.date
      daysToTarget = startDate ? Math.ceil((day.date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) : null
    }
  }

  const endCumulativeGDD = dailyProjections.length > 0 ? dailyProjections[dailyProjections.length - 1].cumulativeGDD : currentGDD
  const suggestions = buildSuggestions({
    currentGDD,
    targetGDD,
    targetReachDate,
    daysToTarget,
    endCumulativeGDD,
    baseTemp,
    harvestWindowText: options?.harvestWindowText,
    seasonUnreachable: options?.seasonUnreachable,
  })

  return {
    dailyProjections,
    targetReachDate,
    daysToTarget,
    endCumulativeGDD,
    suggestions,
  }
}

function buildSuggestions(args: {
  currentGDD: number
  targetGDD: number
  targetReachDate: Date | null
  daysToTarget: number | null
  endCumulativeGDD: number
  baseTemp: number
  harvestWindowText?: string | null
  seasonUnreachable?: boolean
}): string[] {
  const { currentGDD, targetGDD, targetReachDate, daysToTarget, endCumulativeGDD, harvestWindowText, seasonUnreachable } = args
  const list: string[] = []

  if (harvestWindowText) {
    list.push(`収穫の目安に届くのは${harvestWindowText}。`)
    return list
  }
  if (currentGDD >= targetGDD) {
    list.push('収穫の目安には、すでに届いています。')
    return list
  }
  if (seasonUnreachable) {
    list.push('今季は、収穫の目安に届かない見込みです。')
    return list
  }

  if (targetReachDate && daysToTarget != null) {
    list.push('過去の気温が取れないため、収穫の見込みは日付で出していません。')
  } else if (endCumulativeGDD < targetGDD) {
    list.push(`今後2週間の計算では、まだ目標の${targetGDD}℃日に届きません（見込み：約${Math.round(endCumulativeGDD)}℃日）。`)
  }

  if (list.length === 0) {
    list.push('数値予報モデルの計算を反映した見通しは、植え付け日と現在の積算温度が分かると表示されます。')
  }

  return list
}

