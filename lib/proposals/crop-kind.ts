import { findCropBenchmark } from '@/lib/benchmarks/crops'

/**
 * 秋田県「野菜栽培技術指針・果菜類」p.111。
 * 花粉の発育には最低13〜15℃。花粉ができない側の下限 13℃ を使う。
 * https://www.maff.go.jp/j/seisan/kankyo/hozen_type/h_sehi_kizyun/attach/pdf/aki3-5.pdf
 */
export const TOMATO_POLLEN_MIN_C = 13

/** 夜の冷えを探す開始日。霜の季節窓と同じく 8月15日。 */
export const NIGHT_COOL_FROM_MONTH = 8
export const NIGHT_COOL_FROM_DAY = 15

export const TOMATO_NIGHT_SOURCE =
  '秋田県「野菜栽培技術指針・果菜類」p.111（花粉の発育には最低気温13〜15℃。下限の13℃で判断しています）'

const ONCE = new Set([
  'さつまいも',
  'ジャガイモ',
  '玉ねぎ',
  'ダイコン',
  'キャベツ',
  'レタス',
  'ブロッコリー',
  'スイートコーン',
  'エダマメ',
  'ホウレンソウ',
  'コマツナ',
  'ネギ',
])

const CONTINUOUS = new Set(['トマト', 'キュウリ', 'ナス', 'ピーマン類', 'イチゴ'])

export type CropHarvestKind = 'once' | 'continuous' | 'unspecified'

/** 品目マスタに無い作物は unspecified。終了確認は一斉収穫型と同じにし、型の名前は言わない。 */
export function cropHarvestKind(cropName: string, variety?: string | null): CropHarvestKind {
  const bench = findCropBenchmark(cropName, variety)
  if (!bench) return 'unspecified'
  if (CONTINUOUS.has(bench.displayName)) return 'continuous'
  if (ONCE.has(bench.displayName)) return 'once'
  return 'unspecified'
}

export function isTomatoCrop(cropName: string, variety?: string | null): boolean {
  return findCropBenchmark(cropName, variety)?.displayName === 'トマト'
}

/**
 * 一斉収穫型と、型が分からない作物。
 * 収穫の記録があれば聞く。無ければ、収穫予定日を過ぎて目安以上のときだけ聞く。
 * 日長の品目は、収穫が無ければ収穫予定日を過ぎたときだけ聞く。積算温度は見ない。
 * 連続収穫型は、収穫が1回でもあれば聞かない。
 */
export function askSeasonFinish(input: {
  kind: CropHarvestKind
  hasHarvest: boolean
  harvestDatePast: boolean
  overTarget: boolean
  daylength?: boolean
}): boolean {
  if (input.kind === 'continuous') return false
  if (input.hasHarvest) return true
  if (input.daylength) return input.harvestDatePast
  return input.harvestDatePast && input.overTarget
}
