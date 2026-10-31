import { normalizeCropNameForMatch } from '@/lib/benchmarks/crops'

/** 終了確認を収穫予定日から聞く品目。エダマメの開花後・ブロッコリーの出蕾後の積算温度とは独立。 */
const KEYWORDS = [
  'タマネギ',
  'たまねぎ',
  '玉ねぎ',
  '玉葱',
  'イチゴ',
  'いちご',
  '苺',
  'エダマメ',
  'えだまめ',
  '枝豆',
  'ホウレンソウ',
  'ほうれんそう',
  'ほうれん草',
  'レタス',
  'キャベツ',
  'きゃべつ',
  'ブロッコリー',
  'ネギ',
  'ねぎ',
] as const

export const DAYLENGTH_NOTE =
  'この品目の終了確認は、収穫がなければ収穫予定日を過ぎてから聞きます。エダマメは開花後、ブロッコリーは出蕾後に積算温度の目安を使います。'

export const DAYLENGTH_SOURCE =
  '宮城県「みやぎの野菜指導指針」、秋田県「野菜栽培技術指針」、長野県「たまねぎ 地域慣行基準」、栃木県農業試験場「いちご「とちおとめ」の栽培技術」、農研機構'

export function isDaylengthCrop(cropName: string, variety?: string | null): boolean {
  const hay = normalizeCropNameForMatch(`${cropName}${variety ?? ''}`)
  let best = 0
  for (const keyword of KEYWORDS) {
    const needle = normalizeCropNameForMatch(keyword)
    if (needle.length >= 2 && hay.includes(needle) && needle.length > best) best = needle.length
  }
  return best >= 2
}
