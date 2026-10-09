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
  { keywords: ['ピーマン', 'パプリカ'], label: 'ピーマン', seasons: [{ label: '冬春', kgPer10a: 10300 }, { label: '夏秋', kgPer10a: 2940 }], fruitNote: true },
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

/** 収穫量が kg で、圃場面積（㎡）があるときだけ kg/10a にする */
export function kgPer10a(qty: number, unit: string, areaM2: number | null | undefined): number | null {
  if (unit !== 'kg' || areaM2 == null || areaM2 <= 0 || qty <= 0) return null
  return (qty / areaM2) * 1000
}

export function nationalYieldCopy(
  cropName: string,
  variety: string | null | undefined,
  own: { qty: number; unit: string; areaM2: number | null | undefined }
): { text: string; sourceUrl: string } | null {
  const row = matchRow(cropName, variety)
  if (!row) return null
  const parts = row.seasons
    ? row.seasons.map((season) => `${season.label}${row.label} ${formatKg(season.kgPer10a)} kg/10a`)
    : [`${row.label} ${formatKg(row.single ?? 0)} kg/10a`]
  const lines = [`全国平均（令和6年産・作物統計）：${parts.join('、')}。`]
  if (row.fruitNote) lines.push('露地の小規模なら夏秋と比べるのが近いです。')
  const per = kgPer10a(own.qty, own.unit, own.areaM2)
  if (per != null) {
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
