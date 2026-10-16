import { normalizeCropNameForMatch } from '@/lib/benchmarks/crops'

/** 単純は日平均気温をそのまま足す。有効は基準温度を引き、0未満は0。 */
export type HeatCount = 'simple' | 'effective'

export type GddSource = {
  label: string
  url: string
}

export type ActiveGddMethod = {
  status: 'active'
  key: 'sweet-potato' | 'daikon'
  count: HeatCount
  baseTemp: number
  low: number
  high: number
  rangeLabel: string
  countLabel: string
  scopeLabel: string
  sourceLine: string
  sources: GddSource[]
  reachTitle: string
  reachBody: string
}

export type PendingGddMethod = {
  status: 'pending'
  key: 'tomato' | 'sweet-corn'
  message: string
  countLabel: string
  scopeLabel: string
  sourceLine: string
  sources: GddSource[]
  valueLabel: string
}

export type NoGddMethod = {
  status: 'none'
  message: string
}

export type GddAvailability = ActiveGddMethod | PendingGddMethod | NoGddMethod

const SWEET_POTATO_SOURCES: GddSource[] = [
  {
    label: '宮城県美里農業改良普及センター「さつまいも通信 vol.3」（令和6年9月20日）',
    url: 'https://www.pref.miyagi.jp/documents/52148/satsuma3.pdf',
  },
  {
    label: '道南農業試験場・花・野菜技術センター「北海道でのさつまいも栽培」（2022）',
    url: 'https://www.hro.or.jp/upload/42740/sweetpotato_manual_2022.pdf',
  },
]

const DAIKON_SOURCES: GddSource[] = [
  {
    label: '千葉県「気象データを活用した秋まき冬どりダイコンの根重の予測モデルの開発」（2019〜2023年度）',
    url: 'https://www.pref.chiba.lg.jp/ninaite/shikenkenkyuu/documents/r5n0312.pdf',
  },
  {
    label: '岩手 高橋・高橋「ダイコンの生育診断と予測 第1報」東北農業研究42（1989）',
    url: 'https://www.naro.go.jp/org/tarc/to-noken/DB/DATA/042/042-269.pdf',
  },
  {
    label: '長崎県「諫早湾干拓地における秋冬ダイコンの収穫予測」（2013年度）',
    url: 'https://www.pref.nagasaki.jp/e-nourin/nougi/theme/result/H25seika-jouhou/shidou/S-25-09.pdf',
  },
]

const TOMATO_SOURCES: GddSource[] = [
  {
    label: '東京都農林総合研究センター「トマトの生育制御（予測）のための日積算気温の利用」p.31〜32',
    url: 'https://www.tokyo-aff.or.jp/uploaded/attachment/9095.pdf',
  },
]

const CORN_SOURCES: GddSource[] = [
  {
    label: '宮城県 野菜栽培指導指針 第8節 スイートコーン p.184',
    url: 'https://www.maff.go.jp/j/seisan/kankyo/hozen_type/h_sehi_kizyun/pdf/miyagi_yasai18_11.pdf',
  },
  {
    label: '秋田県「野菜栽培技術指針」aki3-25 スイートコーン p.160',
    url: 'https://www.maff.go.jp/j/seisan/kankyo/hozen_type/h_sehi_kizyun/attach/pdf/aki3-25.pdf',
  },
  {
    label: '千葉泰弘・八重樫誠次「スイートコーンの収穫適期と収穫後の品質変化」東北農業研究44:241（1991）',
    url: 'https://www.naro.go.jp/org/tarc/to-noken/DB/DATA/044/044-241.pdf',
  },
]

export const GDD_FAQ_ROWS: {
  crop: string
  start: string
  how: string
  value: string
  scope: string
  source: string
}[] = [
  {
    crop: 'さつまいも',
    start: '定植',
    how: '単純（日平均気温をそのまま足す）',
    value: '2,400〜3,000℃（試し掘りを考える目安。熟期はない）',
    scope: '県名つき（宮城・北海道）',
    source: SWEET_POTATO_SOURCES.map((row) => row.label).join('／'),
  },
  {
    crop: 'ダイコン',
    start: '播種（種を直接まいたとき）',
    how: '単純（日平均気温をそのまま足す）',
    value: '850〜1,200℃（品種で違う。根の太さで確かめる）',
    scope: '【一般】（岩手・千葉・長崎）',
    source: DAIKON_SOURCES.map((row) => row.label).join('／'),
  },
  {
    crop: 'トマト',
    start: '第1花房の開花',
    how: '単純（日平均気温をそのまま足す）',
    value: '約1,000℃（大玉）・中玉950・ミニ850。起点を聞くまでは見込みを出さない',
    scope: '【一般】（宮城・東京・熊本）',
    source: TOMATO_SOURCES.map((row) => row.label).join('／'),
  },
  {
    crop: 'スイートコーン',
    start: '絹糸抽出',
    how: '日数',
    value: '20〜25日。起点を聞くまでは見込みを出さない',
    scope: '【一般】（宮城・秋田・岩手・東京・長野）',
    source: CORN_SOURCES.map((row) => row.label).join('／'),
  },
]

export const GDD_NONE_CROPS = [
  'ナス',
  'ピーマン',
  'キュウリ',
  'タマネギ',
  'キャベツ',
  'レタス',
  'ブロッコリー',
  'エダマメ',
  'ホウレンソウ',
  'コマツナ',
  'ネギ',
  'イチゴ',
  'ジャガイモ',
] as const

const JUDGMENTS: { keys: string[]; words: string[]; cue: string }[] = [
  { keys: ['eggplant'], words: ['ナス', 'なす'], cue: '実の大きさ' },
  { keys: ['pepper'], words: ['ピーマン'], cue: '実の大きさ' },
  { keys: ['cucumber'], words: ['キュウリ', 'きゅうり'], cue: '実の長さ' },
  { keys: ['onion'], words: ['タマネギ', 'たまねぎ', '玉ねぎ'], cue: '葉の倒れ' },
  { keys: ['cabbage'], words: ['キャベツ', 'きゃべつ'], cue: '球の固さ' },
  { keys: ['lettuce-head', 'lettuce-leaf'], words: ['レタス'], cue: '結球の状態' },
  { keys: ['broccoli'], words: ['ブロッコリー'], cue: 'つぼみの大きさ' },
  { keys: ['edamame'], words: ['エダマメ', 'えだまめ', '枝豆'], cue: 'さやのふくらみ' },
  { keys: ['spinach'], words: ['ホウレンソウ', 'ほうれんそう', 'ほうれん草'], cue: '草丈' },
  { keys: ['komatsuna'], words: ['コマツナ', 'こまつな'], cue: '草丈' },
  { keys: ['negi-long', 'negi-leaf'], words: ['ネギ', 'ねぎ'], cue: '軟白の長さ' },
  { keys: ['strawberry-june', 'strawberry-ever'], words: ['イチゴ', 'いちご'], cue: '実の色' },
  { keys: ['potato'], words: ['ジャガイモ', 'じゃがいも', 'ばれいしょ'], cue: '茎葉の色' },
]

function haystack(name: string, variety?: string | null): string {
  return normalizeCropNameForMatch(`${name}${variety ?? ''}`)
}

function matchesWords(name: string, variety: string | null | undefined, words: string[]): boolean {
  const hay = haystack(name, variety)
  return words.some((word) => {
    const needle = normalizeCropNameForMatch(word)
    return needle.length >= 2 && hay.includes(needle)
  })
}

function rangeLabel(low: number, high: number): string {
  return `${low.toLocaleString('ja-JP')}〜${high.toLocaleString('ja-JP')}℃`
}

function noneMessage(cue: string | null): string {
  if (!cue) return 'この品目は積算温度の目安がありません。見た目の節目で判断します。'
  return `この品目は積算温度の目安がありません。${cue}で判断します。`
}

export function dailyHeat(avgTemp: number, count: HeatCount, baseTemp: number): number {
  if (!Number.isFinite(avgTemp)) return 0
  if (count === 'simple') return avgTemp
  return Math.max(0, avgTemp - baseTemp)
}

export function gddAvailability(args: {
  cropKind?: string | null
  name: string
  variety?: string | null
  plantingMethod?: string | null
  recordOnly?: boolean
}): GddAvailability {
  if (args.recordOnly) return { status: 'none', message: noneMessage(null) }
  const key = args.cropKind ?? ''
  const sweetPotato = key === 'sweet-potato' || matchesWords(args.name, args.variety, ['さつまいも', 'サツマイモ', 'かんしょ'])
  if (sweetPotato) {
    return {
      status: 'active',
      key: 'sweet-potato',
      count: 'simple',
      baseTemp: 0,
      low: 2400,
      high: 3000,
      rangeLabel: rangeLabel(2400, 3000),
      countLabel: '定植から、日平均気温をそのまま足す',
      scopeLabel: '宮城・北海道',
      sourceLine: SWEET_POTATO_SOURCES.map((row) => row.label).join('／'),
      sources: SWEET_POTATO_SOURCES,
      reachTitle: '試し掘りを考える時期です',
      reachBody: '宮城・北海道の資料では、定植からの積算温度が2,400℃を超えると試し掘りを考える目安です。熟期はないので、太りを見て判断します。',
    }
  }
  const daikon = key === 'daikon' || matchesWords(args.name, args.variety, ['ダイコン', 'だいこん', '大根'])
  if (daikon) {
    if (args.plantingMethod !== 'direct') {
      return {
        status: 'none',
        message: 'ダイコンの積算温度は、種を直接まいたときの数え方です。苗のときは目安を出していません。根の太さで判断します。',
      }
    }
    return {
      status: 'active',
      key: 'daikon',
      count: 'simple',
      baseTemp: 0,
      low: 850,
      high: 1200,
      rangeLabel: rangeLabel(850, 1200),
      countLabel: '播種から、日平均気温をそのまま足す',
      scopeLabel: '一般',
      sourceLine: DAIKON_SOURCES.map((row) => row.label).join('／'),
      sources: DAIKON_SOURCES,
      reachTitle: '根の太さを見て収穫を考える時期です',
      reachBody: '岩手・千葉・長崎の資料では、種まきからの積算温度が850℃を超えると、根の太さを見て収穫を考える目安です。品種によって1,200℃まで幅があります。',
    }
  }
  const tomato = key === 'tomato' || matchesWords(args.name, args.variety, ['トマト', 'とまと'])
  if (tomato) {
    return {
      status: 'pending',
      key: 'tomato',
      message: '第1花房の開花が分かると、収穫の見込みを出せます（準備中）。',
      countLabel: '第1花房の開花から、日平均気温をそのまま足す',
      scopeLabel: '一般',
      sourceLine: TOMATO_SOURCES.map((row) => row.label).join('／'),
      sources: TOMATO_SOURCES,
      valueLabel: '約1,000℃（大玉）・中玉950・ミニ850',
    }
  }
  const corn = key === 'sweet-corn' || matchesWords(args.name, args.variety, ['スイートコーン', 'とうもろこし', 'トウモロコシ'])
  if (corn) {
    return {
      status: 'pending',
      key: 'sweet-corn',
      message: '絹糸（ひげ）が出た日が分かると、収穫の見込みを出せます（準備中）。',
      countLabel: '絹糸が出てから20〜25日',
      scopeLabel: '一般',
      sourceLine: CORN_SOURCES.map((row) => row.label).join('／'),
      sources: CORN_SOURCES,
      valueLabel: '20〜25日',
    }
  }
  const judgment = JUDGMENTS.find(
    (row) => row.keys.includes(key) || matchesWords(args.name, args.variety, row.words)
  )
  return { status: 'none', message: noneMessage(judgment?.cue ?? null) }
}

/** グラフに出す足し方。目安が無い品目は参考の単純積算。 */
export function displayHeat(view: GddAvailability): { count: HeatCount; baseTemp: number } {
  if (view.status === 'active') return { count: view.count, baseTemp: view.baseTemp }
  return { count: 'simple', baseTemp: 0 }
}
