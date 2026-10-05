import { normalizeCropNameForMatch } from '@/lib/benchmarks/crops'

/** generalTips に日数が書いてある品目だけ。トマトの「防除は7〜10日間隔が目安」 */
export const SPRAY_INTERVALS = [
  { name: 'トマト', keywords: ['トマト', 'とまと', 'tomato'], minDays: 7, maxDays: 10 },
] as const

export type SprayInterval = (typeof SPRAY_INTERVALS)[number]

export function matchedSprayInterval(cropName: string, variety?: string | null): SprayInterval | null {
  const names = [cropName, variety ?? ''].map((value) => normalizeCropNameForMatch(value))
  return (
    SPRAY_INTERVALS.find((row) =>
      names.some((name) => row.keywords.some((word) => name.includes(normalizeCropNameForMatch(word))))
    ) ?? null
  )
}

export function formatSprayInterval(interval: SprayInterval): string {
  return `${interval.minDays}〜${interval.maxDays}日`
}

/** 目安の上限を超えたときだけ。上限ちょうどはまだ範囲内 */
export function sprayIntervalExceeded(daysSinceLast: number, interval: SprayInterval): boolean {
  return daysSinceLast > interval.maxDays
}
