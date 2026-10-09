import { normalizeCropNameForMatch } from '@/lib/benchmarks/crops'

export const NATIONAL_YIELD_SOURCE = {
  name: '令和6年産野菜生産出荷統計',
  publisher: '農林水産省「作物統計調査 作況調査（野菜）確報」',
  detail: '表3',
  url: 'https://www.e-stat.go.jp/stat-search/files?page=1&layout=datalist&lid=000001473711',
} as const

export const SWEET_POTATO_YIELD_SOURCE = {
  name: '令和6年産作物統計',
  publisher: '農林水産省',
  detail: '表4 かんしょ',
  url: 'https://www.e-stat.go.jp/stat-search/files?page=1&layout=datalist&lid=000001452343',
} as const

type YieldRow = {
  keywords: readonly string[]
  label: string
  /** 1本の全国値。作型がある品目は使わない */
  single?: number
  seasons?: { label: string; kgPer10a: number }[]
  fruitNote?: boolean
  sweetPotato?: boolean
}

const ROWS: readonly YieldRow[] = [
  { keywords: ['トマト', 'とまと'], label: 'トマト', seasons: [{ label: '冬春', kgPer10a: 10200 }, { label: '夏秋', kgPer10a: 4230 }], fruitNote: true },
  { keywords: ['キュウリ', 'きゅうり'], label: 'キュウリ', seasons: [{ label: '冬春', kgPer10a: 10700 }, { label: '夏秋', kgPer10a: 3600 }], fruitNote: true },
  { keywords: ['ナス', 'なす'], label: 'ナス', seasons: [{ label: '冬春', kgPer10a: 10700 }, { label: '夏秋', kgPer10a: 2640 }], fruitNote: true },
  { keywords: ['ピーマン'], label: 'ピーマン', seasons: [{ label: '冬春', kgPer10a: 10300 }, { label: '夏秋', kgPer10a: 2940 }], fruitNote: true },
  { keywords: ['ジャガイモ', 'じゃがいも', 'ばれいしょ', 'バレイショ'], label: 'ジャガイモ', seasons: [{ label: '春植え', kgPer10a: 3290 }, { label: '秋植え', kgPer10a: 1500 }] },
  { keywords: ['さつまいも', 'サツマイモ', 'かんしょ'], label: 'さつまいも', single: 2250, sweetPotato: true },
  { keywords: ['イチゴ', 'いちご'], label: 'イチゴ', single: 3330 },
  { keywords: ['スイートコーン', 'とうもろこし', 'トウモロコシ'], label: 'スイートコーン', single: 1010 },
  { keywords: ['タマネギ', 'たまねぎ', '玉ねぎ'], label: 'タマネギ', single: 4500 },
  { keywords: ['ダイコン', 'だいこん'], label: 'ダイコン', single: 4070 },
  { keywords: ['キャベツ', 'きゃべつ'], label: 'キャベツ', single: 3960 },
  { keywords: ['レタス'], label: 'レタス', single: 2770 },
  { keywords: ['ブロッコリー'], label: 'ブロッコリー', single: 928 },
  { keywords: ['エダマメ', 'えだまめ', '枝豆'], label: 'エダマメ', single: 489 },
  { keywords: ['ホウレンソウ', 'ほうれんそう', 'ほうれん草'], label: 'ホウレンソウ', single: 1060 },
  { keywords: ['コマツナ', 'こまつな'], label: 'コマツナ', single: 1600 },
  { keywords: ['ネギ', 'ねぎ'], label: 'ネギ', single: 1880 },
]

function matchRow(cropName: string, variety?: string | null): YieldRow | null {
  const hay = normalizeCropNameForMatch(`${cropName}${variety ?? ''}`)
  let best: { row: YieldRow; score: number } | null = null
  for (const row of ROWS) {
    for (const keyword of row.keywords) {
      const needle = normalizeCropNameForMatch(keyword)
      if (needle.length < 2 || !hay.includes(needle)) continue
      if (!best || needle.length > best.score) best = { row, score: needle.length }
    }
  }
  return best?.row ?? null
}

function formatKg(value: number): string {
  return Math.round(value).toLocaleString('ja-JP')
}

export const SHARED_FIELD_YIELD_NOTE =
  '同じ時期にこの圃場で別の作付けがあるため、10a 当たりには直していません。'

export function latestHarvestDate(dates: Date[]): Date | null {
  return dates.reduce<Date | null>((latest, date) => (!latest || date > latest ? date : latest), null)
}

export type FieldStay = {
  id: string
  fieldId: string | null
  plantingDate: Date | null
  status: string
  lastHarvestDate: Date | null
}

function startOfDay(value: Date): number {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** 栽培中は今日まで。収穫済みは最後の収穫日まで。終わりが分からなければ null */
function stayEnd(stay: FieldStay, today: Date): number | null {
  if (stay.status === 'growing') return startOfDay(today)
  if (stay.lastHarvestDate) return startOfDay(stay.lastHarvestDate)
  return null
}

/**
 * 同じ圃場で期間が重なる別の作付けがあるか。
 * 植付日が無い、または終わりが分からない作付けが同じ圃場にあれば、重なるものとして扱う。
 */
export function sharesFieldPeriod(self: FieldStay, others: FieldStay[], today = new Date()): boolean {
  if (!self.fieldId) return false
  const mates = others.filter((other) => other.id !== self.id && other.fieldId === self.fieldId)
  if (mates.length === 0) return false
  const selfEnd = self.plantingDate ? stayEnd(self, today) : null
  if (!self.plantingDate || selfEnd == null) return true
  const selfStart = startOfDay(self.plantingDate)
  for (const other of mates) {
    const otherEnd = other.plantingDate ? stayEnd(other, today) : null
    if (!other.plantingDate || otherEnd == null) return true
    const otherStart = startOfDay(other.plantingDate)
    if (selfStart <= otherEnd && otherStart <= selfEnd) return true
  }
  return false
}

/** 収穫量が kg で、圃場面積（㎡）があるときだけ kg/10a にする */
export function kgPer10a(qty: number, unit: string, areaM2: number | null | undefined): number | null {
  if (unit !== 'kg' || areaM2 == null || areaM2 <= 0 || qty <= 0) return null
  return (qty / areaM2) * 1000
}

export function nationalYieldCopy(
  cropName: string,
  variety: string | null | undefined,
  own: { qty: number; unit: string; areaM2: number | null | undefined; sharedField?: boolean }
): { text: string; sourceUrl: string } | null {
  const row = matchRow(cropName, variety)
  if (!row) return null
  const parts = row.seasons
    ? row.seasons.map((season) => `${season.label}${row.label} ${formatKg(season.kgPer10a)} kg/10a`)
    : [`${row.label} ${formatKg(row.single ?? 0)} kg/10a`]
  const lines = [`全国平均（令和6年産・作物統計）：${parts.join('、')}。`]
  if (row.fruitNote) lines.push('露地の小規模なら夏秋と比べるのが近いです。')
  const per = own.sharedField ? null : kgPer10a(own.qty, own.unit, own.areaM2)
  if (own.sharedField) {
    lines.push(SHARED_FIELD_YIELD_NOTE)
  } else if (per != null) {
    lines.push(`この作付けは ${formatKg(per)} kg/10a です（圃場 ${formatKg(own.areaM2 ?? 0)} m²）。`)
  } else if (own.areaM2 == null || own.areaM2 <= 0) {
    lines.push('圃場の面積を登録すると比べられます。')
  } else if (own.unit !== 'kg') {
    lines.push('収穫の単位が kg ではないので、10a 当たりには直していません。')
  } else {
    lines.push('収穫の記録がないので、自分の 10a 当たりは出していません。')
  }
  return {
    text: lines.join(''),
    sourceUrl: row.sweetPotato ? SWEET_POTATO_YIELD_SOURCE.url : NATIONAL_YIELD_SOURCE.url,
  }
}
