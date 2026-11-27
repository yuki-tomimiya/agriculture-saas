import { normalizeCropNameForMatch } from '@/lib/benchmarks/crops'

export const SOIL_PH_SOURCE_GIFU = {
  name: '主要園芸作物標準技術体系（資料編）',
  url: 'https://www.maff.go.jp/j/seisan/kankyo/hozen_type/h_sehi_kizyun/pdf/siryo3.pdf',
} as const

export const SOIL_PH_SOURCE_SAITAMA = 'https://www.pref.saitama.lg.jp/documents/20041/r7sehikijun_tech.pdf'
export const TARO_PH_SOURCE_MIYAZAKI = 'https://www.maff.go.jp/j/seisan/kankyo/hozen_type/h_sehi_kizyun/pdf/08450106chap03yasai.pdf'

/** 千葉県農林水産技術会議・技術指導資料・令和5年3月 */
export const SOIL_PH_SOURCE_CHIBA = {
  name: 'サツマイモ栽培技術指針',
  publisher: '千葉県農林水産技術会議',
  year: '令和5年3月',
  url: 'https://www.pref.chiba.lg.jp/ninaite/seikafukyu/documents/r4-06-satumaimosaibai.pdf',
} as const

export type SoilPhRange = {
  name: string
  keywords: readonly string[]
  min: number
  max: number
  /** false の品目は、pHが低いことを理由に矯正を出さない */
  adviseLow: boolean
  /** 上限を超えたときの注意。石灰を勧めない品目用 */
  highCaution?: string
  source: 'gifu' | 'chiba' | 'saitama-miyazaki'
}

export const SOIL_PH_RANGES: readonly SoilPhRange[] = [
  // 台帳 E1。さといもは埼玉県の表23と宮崎県「20．さといも」による。
  { name: 'さといも', keywords: ['さといも', 'サトイモ', '里芋'], min: 6.0, max: 6.5, adviseLow: true, source: 'saitama-miyazaki' },
  { name: 'かぼちゃ', keywords: ['かぼちゃ', 'カボチャ', '南瓜'], min: 6.0, max: 6.5, adviseLow: true, source: 'gifu' },
  { name: 'はくさい', keywords: ['はくさい', 'ハクサイ', '白菜'], min: 6.0, max: 6.5, adviseLow: true, source: 'gifu' },
  { name: 'にんじん', keywords: ['にんじん', 'ニンジン', '人参'], min: 5.5, max: 6.5, adviseLow: true, source: 'gifu' },
  { name: 'ホウレンソウ', keywords: ['ホウレンソウ', 'ほうれん草', 'ほうれんそう'], min: 6.5, max: 7.0, adviseLow: true, source: 'gifu' },
  { name: 'トマト', keywords: ['トマト', 'とまと', 'tomato'], min: 6.0, max: 6.5, adviseLow: true, source: 'gifu' },
  { name: 'ナス', keywords: ['ナス', 'なす', '茄子'], min: 6.0, max: 6.5, adviseLow: true, source: 'gifu' },
  { name: 'ピーマン', keywords: ['ピーマン', 'パプリカ', 'ししとう', 'シシトウ'], min: 6.0, max: 6.5, adviseLow: true, source: 'gifu' },
  { name: 'キュウリ', keywords: ['キュウリ', 'きゅうり', '胡瓜'], min: 6.0, max: 6.5, adviseLow: true, source: 'gifu' },
  { name: 'スイートコーン', keywords: ['スイートコーン', 'とうもろこし', 'トウモロコシ', 'コーン'], min: 6.0, max: 6.5, adviseLow: true, source: 'gifu' },
  { name: 'エダマメ', keywords: ['エダマメ', 'えだまめ', '枝豆'], min: 6.0, max: 6.5, adviseLow: true, source: 'gifu' },
  { name: 'レタス', keywords: ['レタス'], min: 6.0, max: 6.5, adviseLow: true, source: 'gifu' },
  { name: 'ネギ', keywords: ['ネギ', 'ねぎ', '葱'], min: 6.0, max: 6.5, adviseLow: true, source: 'gifu' },
  { name: 'ブロッコリー', keywords: ['ブロッコリー', 'ブロッコリ'], min: 6.0, max: 6.5, adviseLow: true, source: 'gifu' },
  { name: 'イチゴ', keywords: ['イチゴ', 'いちご', '苺'], min: 5.5, max: 6.5, adviseLow: true, source: 'gifu' },
  { name: 'キャベツ', keywords: ['キャベツ', 'きゃべつ'], min: 5.5, max: 6.5, adviseLow: true, source: 'gifu' },
  { name: 'コマツナ', keywords: ['コマツナ', 'こまつな', '小松菜'], min: 5.5, max: 6.5, adviseLow: true, source: 'gifu' },
  { name: 'ダイコン', keywords: ['ダイコン', 'だいこん', '大根'], min: 5.5, max: 6.5, adviseLow: true, source: 'gifu' },
  { name: 'タマネギ', keywords: ['タマネギ', 'たまねぎ', '玉ねぎ', '玉葱'], min: 5.5, max: 6.5, adviseLow: true, source: 'gifu' },
  { name: 'ジャガイモ', keywords: ['ジャガイモ', 'じゃがいも', '馬鈴薯', 'ばれいしょ'], min: 5.5, max: 6.0, adviseLow: true, source: 'gifu' },
  {
    name: 'さつまいも',
    keywords: ['さつまいも', 'サツマイモ', 'さつま芋', 'かんしょ'],
    min: 5.5,
    max: 6.0,
    adviseLow: false,
    highCaution: 'pHが高いと立枯病が出やすいので、石灰は入れないでください',
    source: 'chiba',
  },
]

/** 長いキーワードを優先する（タマネギをネギと取り違えない） */
export function matchedSoilPh(cropName: string, variety?: string | null): SoilPhRange | null {
  const hay = normalizeCropNameForMatch(`${cropName}${variety ?? ''}`)
  let best: { row: SoilPhRange; score: number } | null = null
  for (const row of SOIL_PH_RANGES) {
    for (const keyword of row.keywords) {
      const needle = normalizeCropNameForMatch(keyword)
      if (needle.length < 2 || !hay.includes(needle)) continue
      if (!best || needle.length > best.score) best = { row, score: needle.length }
    }
  }
  return best?.row ?? null
}

export function formatSoilPhRange(min: number, max: number): string {
  return `${min.toFixed(1)}〜${max.toFixed(1)}`
}

/** 範囲内、または低い側を助言しない品目が低いときは null */
export function soilPhSignal(ph: number, range: SoilPhRange): 'correct' | 'high-caution' | null {
  if (ph >= range.min && ph <= range.max) return null
  if (ph < range.min && !range.adviseLow) return null
  if (ph > range.max && range.highCaution) return 'high-caution'
  return 'correct'
}
