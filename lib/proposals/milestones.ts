import { normalizeCropNameForMatch } from '@/lib/benchmarks/crops'

/**
 * 節目は、答えが助言を変えるときだけ聞く。
 * 窓の日数・比率に出典はない。問いかけを出すかどうかだけに使い、断定には使わない。
 */

export const MILESTONE_SOURCE_AKITA = {
  publisher: '秋田県',
  name: '野菜栽培技術指針・果菜類',
  detail: '（農林水産省「都道府県施肥基準等」収録）p.111',
  url: 'https://www.maff.go.jp/j/seisan/kankyo/hozen_type/h_sehi_kizyun/attach/pdf/aki3-5.pdf',
}

export const MILESTONE_SOURCE_CHIBA = {
  publisher: '千葉県',
  name: 'サツマイモ栽培技術指針',
  year: '令和5年3月',
  url: 'https://www.pref.chiba.lg.jp/ninaite/seikafukyu/documents/r4-06-satumaimosaibai.pdf',
}

export const MILESTONE_SOURCE_LINKS: { label: string; url: string }[] = [
  { label: '秋田県「野菜栽培技術指針」果菜類', url: MILESTONE_SOURCE_AKITA.url },
  { label: '宮城県「みやぎの野菜指導指針」トマト', url: 'https://www.maff.go.jp/j/seisan/kankyo/hozen_type/h_sehi_kizyun/pdf/miyagi_yasai18_05.pdf' },
  { label: '徳島県「主要農作物施肥基準」野菜', url: 'https://www.pref.tokushima.lg.jp/file/attachment/624144.pdf' },
  { label: '千葉県「サツマイモ栽培技術指針」', url: MILESTONE_SOURCE_CHIBA.url },
  { label: '秋田県「野菜栽培技術指針」根菜類', url: 'https://www.maff.go.jp/j/seisan/kankyo/hozen_type/h_sehi_kizyun/attach/pdf/aki3-7.pdf' },
  { label: '宮城県美里農業改良普及センター「さつまいも通信 vol.3」', url: 'https://www.pref.miyagi.jp/documents/52148/satsuma3.pdf' },
  { label: '秋田県「野菜栽培技術指針」キュウリ', url: 'https://www.maff.go.jp/j/seisan/kankyo/hozen_type/h_sehi_kizyun/attach/pdf/aki3-10.pdf' },
  { label: '宮城県「みやぎの野菜指導指針」きゅうり', url: 'https://www.maff.go.jp/j/seisan/kankyo/hozen_type/h_sehi_kizyun/pdf/miyagi_yasai18_04.pdf' },
  { label: '熊本県野菜振興協会「耕種基準」キュウリ（夏秋雨よけ）', url: 'https://k-engei.net/contents/koushu_standard/16%EF%BD%B7%EF%BD%AD%EF%BD%B3%EF%BE%98%EF%BC%88%E5%A4%8F%E7%A7%8B%E9%9B%A8%E3%82%88%E3%81%91%EF%BC%89.pdf' },
  { label: '秋田県「野菜栽培技術指針」ナス・ピーマン', url: 'https://www.maff.go.jp/j/seisan/kankyo/hozen_type/h_sehi_kizyun/attach/pdf/aki3-25.pdf' },
  { label: '宮城県「みやぎの野菜指導指針」なす', url: 'https://www.maff.go.jp/j/seisan/kankyo/hozen_type/h_sehi_kizyun/pdf/miyagi_yasai18_10.pdf' },
  { label: '熊本県野菜振興協会「耕種基準」ナス（促成）', url: 'https://k-engei.net/contents/koushu_standard/7%E3%83%8A%E3%82%B9%EF%BC%88%E4%BF%83%E6%88%90%E3%83%BB%E6%94%B9%E8%A8%82%EF%BC%89.pdf' },
  { label: '高知県施肥基準', url: 'https://www.nogyo.tosa.pref.kochi.lg.jp/info/dtl.php?ID=5581' },
  { label: '宮崎県「主要作物の施肥基準」野菜', url: 'https://www.maff.go.jp/j/seisan/kankyo/hozen_type/h_sehi_kizyun/pdf/08450106chap03yasai.pdf' },
  { label: '鳥取県「020 ピーマン（夏秋）」', url: 'https://www.pref.tottori.lg.jp/secure/434374/020.pdf' },
  { label: '熊本県野菜振興協会「耕種基準」バレイショ（春作）', url: 'https://k-engei.net/contents/koushu_standard/74%E6%B7%BB%E5%89%8A%E5%BE%8C%20%E3%83%90%E3%83%AC%E3%82%A4%E3%82%B7%E3%83%A7%EF%BC%88%E6%98%A5%E4%BD%9C%EF%BC%89.pdf' },
  { label: '鹿児島県「有機野菜栽培事例」', url: 'https://www.pref.kagoshima.jp/ag04/sangyo-rodo/nogyo/gizyutu/kankyo/yuuki/documents/71177_20190315143757-1.pdf' },
  { label: '北海道立十勝農業試験場「ばれいしょの極早期培土効果」', url: 'https://www.hro.or.jp/agricultural/center/result/kenkyuseika/seikajoho/h06s_joho/h0600009.htm' },
]

export type MilestoneRecord = {
  key: string
  observedAt: Date
}

export type MilestoneAsk = {
  key: string
  trigger: string
  question: string
  term: string
  ifYes: string
  sourceLabel: string
  howTo: string[]
  yesLabel: string
}

export type MilestoneFaqRow = {
  crop: string
  question: string
  term: string
  source: string
  windowNote: string
}

export type MilestoneFormItem = {
  key: string
  term: string
  question: string
  sourceLabel: string
  observedAt: string | null
}

type Window =
  | { kind: 'days'; from: number; to: number }
  | { kind: 'gddRatio'; from: number }

type MilestoneDef = {
  key: string
  cropLabel: string
  match: (cropName: string, variety?: string | null) => boolean
  question: string
  term: string
  yesLabel: string
  ifYes: string
  conditional: string
  recordedLine: (days: number) => string
  sourceLabel: string
  howTo: string[]
  window: Window
  windowNote: string
  /** false のときは聞かない。条件つきの文か、収穫記録の文にだけ使う */
  ask?: boolean
  skipWhenHarvest?: boolean
  /** 収穫記録があるときの【一般】。間隔の数字は県名つき */
  harvestLine?: string
}

const WINDOW_PROVISIONAL = '⚠ 暫定・窓だけ。出典なし。問いかけを出すかどうかだけに使い、断定には使わない'
const TOMATO_SOURCES = '秋田県・宮城県・徳島県の資料'
const CHIBA_P18 = `${MILESTONE_SOURCE_CHIBA.publisher}「${MILESTONE_SOURCE_CHIBA.name}」（${MILESTONE_SOURCE_CHIBA.year}）p.18`
const CHIBA_P28 = `${MILESTONE_SOURCE_CHIBA.publisher}「${MILESTONE_SOURCE_CHIBA.name}」（${MILESTONE_SOURCE_CHIBA.year}）p.28`
const AKITA_ROOT = '秋田県「野菜栽培技術指針」根菜類 p.295'
const MIYAGI_DIG = '宮城県美里農業改良普及センター「さつまいも通信 vol.3」（令和6年9月）'

const TEST_DIG_HOW_TO = [
  '畝の端や枕地は太りやすいので、避けます',
  '畝の端から3m以上内側で、生育が中くらい、欠株のない場所を2〜3株掘ります',
  '隣り合う2畝を掘ると、より確かです（植えた向きで太り方が変わります）',
]

function nameIncludes(cropName: string, variety: string | null | undefined, words: string[]): boolean {
  const names = [cropName, variety ?? ''].map((value) => normalizeCropNameForMatch(value))
  const needles = words.map((word) => normalizeCropNameForMatch(word))
  return names.some((name) => needles.some((word) => name.includes(word)))
}

function isTomato(cropName: string, variety?: string | null): boolean {
  return nameIncludes(cropName, variety, ['トマト', 'とまと', 'tomato'])
}

function isSweetPotato(cropName: string, variety?: string | null): boolean {
  return nameIncludes(cropName, variety, ['さつまいも', 'サツマイモ', '薩摩芋', 'かんしょ'])
}

function isCucumber(cropName: string, variety?: string | null): boolean {
  return nameIncludes(cropName, variety, ['キュウリ', 'きゅうり', '胡瓜'])
}

function isEggplant(cropName: string, variety?: string | null): boolean {
  return nameIncludes(cropName, variety, ['ナス', 'なす', '茄子'])
}

function isPepper(cropName: string, variety?: string | null): boolean {
  return nameIncludes(cropName, variety, ['ピーマン', 'パプリカ', 'ししとう'])
}

function isPotato(cropName: string, variety?: string | null): boolean {
  return nameIncludes(cropName, variety, ['ジャガイモ', 'じゃがいも', '馬鈴薯', 'ばれいしょ'])
}

/**
 * 窓の数値に出典はない。問いかけを出すかどうかだけに使う。断定には使わない。
 * トマト 25〜50日・さつまいも活着 5〜20日は、以前の日数段階を広げた暫定。
 * 試し掘りは収穫目安の積算温度の 85% 以上（実績ベース）。
 */
const MILESTONES: MilestoneDef[] = [
  {
    key: 'flower-3rd',
    cropLabel: 'トマト',
    match: isTomato,
    question: '下から3段目の花のかたまりが咲きましたか？（いちばん下の実がピンポン玉くらいのころ）',
    term: '第3花房の開花',
    yesLabel: '咲いた',
    ifYes: '咲いていれば、追肥（穴肥）を始める時期です。秋田県・宮城県の資料では、灌水もこのころから控えめをやめて積極的にします。',
    conditional:
      '下から3段目の花が咲いていれば、追肥（穴肥）を始めます。秋田県・宮城県の資料では、灌水もこのころから控えめをやめて積極的にします。腋芽は、混みすぎないよう随時かいてください。',
    recordedLine: (days) =>
      `${days <= 0 ? '第3花房の開花は今日です' : `第3花房の開花から${days}日です`}。追肥（穴肥）を始める時期です。秋田県・宮城県の資料では、灌水もこのころから控えめをやめて積極的にします。`,
    sourceLabel: TOMATO_SOURCES,
    howTo: [],
    window: { kind: 'days', from: 25, to: 50 },
    windowNote: `植付から25〜50日（${WINDOW_PROVISIONAL}）`,
  },
  {
    key: 'rooting',
    cropLabel: 'さつまいも',
    match: isSweetPotato,
    question: '苗が根付いて、葉が立ってきましたか？',
    term: '活着',
    yesLabel: '根付いた',
    ifYes: '根付いていれば、畝間の除草を始めます。つるが畝を覆うまでは続けます。',
    conditional: '苗が根付いていれば、畝間の除草を始めます。',
    recordedLine: (days) =>
      `${days <= 0 ? '活着は今日です' : `活着から${days}日です`}。畝間の除草を始める時期です。つるが畝を覆うまでは続けます。`,
    sourceLabel: `${CHIBA_P18}、${AKITA_ROOT}`,
    howTo: [],
    window: { kind: 'days', from: 5, to: 20 },
    windowNote: `植付から5〜20日（${WINDOW_PROVISIONAL}）`,
  },
  {
    key: 'test-dig',
    cropLabel: 'さつまいも',
    match: isSweetPotato,
    question: '試し掘りをして、イモの太りを見ましたか？',
    term: '試し掘り',
    yesLabel: '掘った',
    ifYes: '太っていれば収穫へ。細ければ、もう少し置きます。宮城県の資料では200〜500gのイモが多くなってきたら収穫です。秋田県の資料では、早掘りで100g程度が1株に2個以上なら掘り取ります。',
    conditional: '試し掘りで太っていれば収穫へ。細ければ、もう少し置きます。宮城県の資料では200〜500gのイモが多くなってきたら収穫です。秋田県の資料では、早掘りで100g程度が1株に2個以上なら掘り取ります。',
    recordedLine: (days) =>
      `${days <= 0 ? '試し掘りは今日です' : `試し掘りから${days}日です`}。太っていれば収穫へ。細ければ、もう少し置きます。宮城県の資料では200〜500gのイモが多くなってきたら収穫です。秋田県の資料では、早掘りで100g程度が1株に2個以上なら掘り取ります。`,
    sourceLabel: `${CHIBA_P28}、${MIYAGI_DIG}`,
    howTo: TEST_DIG_HOW_TO,
    window: { kind: 'gddRatio', from: 0.85 },
    windowNote: '積算温度が収穫の目安の85%以上（日数ではない。窓を過ぎたあとも、収穫記録がなければ条件つきのまま）',
    skipWhenHarvest: true,
  },
  {
    key: 'first-fruit',
    cropLabel: 'キュウリ',
    match: isCucumber,
    question: '最初の実（1番果）がふくらみ始めましたか？',
    term: '1番果',
    yesLabel: 'ふくらみ始めた',
    ifYes: 'ふくらみ始めていれば、1回目の追肥の時期です。',
    conditional: '最初の実がふくらみ始めていれば、1回目の追肥をします。',
    recordedLine: (days) =>
      `${days <= 0 ? '1番果は今日です' : `1番果から${days}日です`}。1回目の追肥の時期です。`,
    sourceLabel: '秋田県・宮城県・熊本県野菜振興協会の資料',
    howTo: [],
    window: { kind: 'days', from: 20, to: 45 },
    windowNote: `植付から20〜45日（${WINDOW_PROVISIONAL}）`,
    skipWhenHarvest: true,
    harvestLine:
      '収穫が始まっています。追肥を続けます。秋田県の資料では収穫500〜700kgごと、宮城県の資料では10日ごとです。',
  },
  {
    key: 'main-stem',
    cropLabel: 'キュウリ',
    match: isCucumber,
    ask: false,
    question: '主枝が支柱の高さまで伸びましたか？',
    term: '主枝の摘心',
    yesLabel: '伸びた',
    ifYes: '支柱の高さ（20節前後）まで伸びていれば、主枝を摘心します。',
    conditional: '主枝が支柱の高さ（20節前後）まで伸びていれば、主枝を摘心します。',
    recordedLine: (days) =>
      `${days <= 0 ? '主枝の摘心は今日です' : `主枝の摘心から${days}日です`}。`,
    sourceLabel: '秋田県・熊本県野菜振興協会の資料',
    howTo: [],
    window: { kind: 'days', from: 46, to: 80 },
    windowNote: `植付から46〜80日（${WINDOW_PROVISIONAL}）。聞かない。条件つきの文だけ`,
  },
  {
    key: 'side-shoot',
    cropLabel: 'ナス',
    match: isEggplant,
    question: 'わき芽が伸び始めましたか？（1番果がつくころ）',
    term: '3〜4本仕立て',
    yesLabel: '伸び始めた',
    ifYes: '伸び始めていれば、1番果の上下のわき芽を残して3〜4本に仕立てます。それより下のわき芽はかきます。',
    conditional: 'わき芽が伸び始めていれば、1番果の上下のわき芽を残して3〜4本に仕立てます。それより下のわき芽はかきます。',
    recordedLine: (days) =>
      `${days <= 0 ? '仕立ては今日です' : `仕立てから${days}日です`}。1番果の上下のわき芽を残して3〜4本にします。`,
    sourceLabel: '秋田県・宮城県・熊本県野菜振興協会の資料',
    howTo: [],
    window: { kind: 'days', from: 15, to: 40 },
    windowNote: `植付から15〜40日（${WINDOW_PROVISIONAL}）`,
    skipWhenHarvest: true,
    harvestLine:
      '収穫が始まっています。追肥を始め、続けます。秋田県の資料では10〜14日おき、宮城県の資料では15〜20日おきです。短い雌しべの花が増えていれば、草勢が落ちているので追肥を早めます。',
  },
  {
    key: 'pepper-feed',
    cropLabel: 'ピーマン',
    match: isPepper,
    ask: false,
    question: '収穫が始まったら、追肥を始めます',
    term: '収穫開始の追肥',
    yesLabel: '始めた',
    ifYes: '収穫が始まっていれば、追肥を始め、続けます。',
    conditional: '収穫が始まっていれば、追肥を始め、続けます。',
    recordedLine: () => '収穫が始まっています。追肥を続けます。',
    sourceLabel: '秋田県・宮崎県の資料',
    howTo: [],
    window: { kind: 'days', from: 100000, to: 100000 },
    windowNote: '聞かない。収穫の記録で出す',
    harvestLine:
      '収穫が始まっています。追肥を始め、続けます。宮崎県の資料では月ごと、鳥取県の資料では15〜20日おきです。',
  },
  {
    key: 'sprout',
    cropLabel: 'ジャガイモ',
    match: isPotato,
    question: '芽が出そろいましたか？（芽が10cmくらい）',
    term: '芽そろい',
    yesLabel: '出そろった',
    ifYes: '出そろっていれば、1株1〜2本を残して芽をかきます。あわせて1回目の土寄せをします。',
    conditional: '芽が出そろっていれば、1株1〜2本を残して芽をかきます。あわせて1回目の土寄せをします。',
    recordedLine: (days) =>
      `${days <= 0 ? '芽そろいは今日です' : `芽そろいから${days}日です`}。1株1〜2本を残して芽をかき、1回目の土寄せをします。`,
    sourceLabel: '秋田県・熊本県野菜振興協会・鹿児島県の資料',
    howTo: [],
    window: { kind: 'days', from: 15, to: 45 },
    windowNote: `植付から15〜45日（${WINDOW_PROVISIONAL}）`,
    skipWhenHarvest: true,
  },
  {
    key: 'bud',
    cropLabel: 'ジャガイモ',
    match: isPotato,
    question: 'つぼみが見えてきましたか？',
    term: 'つぼみ',
    yesLabel: '見えた',
    ifYes: '見えていれば、2回目の土寄せをします。花が咲いてからでは遅いです。',
    conditional: 'つぼみが見えていれば、2回目の土寄せをします。花が咲いてからでは遅いです。',
    recordedLine: (days) =>
      `${days <= 0 ? 'つぼみは今日です' : `つぼみから${days}日です`}。2回目の土寄せをします。花が咲いてからでは遅いです。`,
    sourceLabel: '秋田県・鹿児島県の資料。北海道立十勝農業試験場は着蕾期の土寄せを標準にしています',
    howTo: [],
    window: { kind: 'days', from: 30, to: 70 },
    windowNote: `植付から30〜70日（${WINDOW_PROVISIONAL}）。前の問いが残っているあいだは出さない`,
    skipWhenHarvest: true,
  },
  {
    key: 'yellowing',
    cropLabel: 'ジャガイモ',
    match: isPotato,
    question: '茎や葉が黄色く枯れてきましたか？',
    term: '茎葉の黄変',
    yesLabel: '枯れてきた',
    ifYes: '枯れていれば、晴れが続いて土が乾いた日に掘ります。',
    conditional: '茎や葉が黄色く枯れていれば、晴れが続いて土が乾いた日に掘ります。',
    recordedLine: (days) =>
      `${days <= 0 ? '黄変は今日です' : `黄変から${days}日です`}。晴れが続いて土が乾いた日に掘ります。`,
    sourceLabel: '秋田県・熊本県野菜振興協会の資料',
    howTo: [],
    window: { kind: 'days', from: 70, to: 130 },
    windowNote: `植付から70〜130日（${WINDOW_PROVISIONAL}）。前の問いが残っているあいだは出さない`,
    skipWhenHarvest: true,
  },
]

export function milestoneTrigger(key: string): string {
  return `milestone:${key}`
}

export function isMilestoneTrigger(trigger: string | undefined | null): boolean {
  return !!trigger && trigger.startsWith('milestone:')
}

export function milestoneKeyFromTrigger(trigger: string): string | null {
  if (!isMilestoneTrigger(trigger)) return null
  return trigger.slice('milestone:'.length)
}

function catalogFor(cropName: string, variety?: string | null): MilestoneDef[] {
  return MILESTONES.filter((item) => item.match(cropName, variety))
}

export function daysSinceDate(from: Date, today: Date): number {
  const start = new Date(from)
  start.setHours(0, 0, 0, 0)
  const end = new Date(today)
  end.setHours(0, 0, 0, 0)
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
}

/** 日付入力の YYYY-MM-DD を、その日の正午（ローカル）にする */
export function parseMilestoneDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date
}

export function milestoneDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type WindowPlace = 'before' | 'inside' | 'after' | 'unknown'

function windowPlace(
  window: Window,
  progress: { daysSincePlanting?: number | null; gddRatio?: number | null }
): WindowPlace {
  if (window.kind === 'days') {
    const days = progress.daysSincePlanting
    if (days == null) return 'unknown'
    if (days < window.from) return 'before'
    if (days > window.to) return 'after'
    return 'inside'
  }
  const ratio = progress.gddRatio
  if (ratio == null || !Number.isFinite(ratio)) return 'unknown'
  if (ratio < window.from) return 'before'
  return 'inside'
}

function recordedOf(records: MilestoneRecord[], key: string): MilestoneRecord | undefined {
  return records.find((record) => record.key === key)
}

export function pickMilestoneAsk(input: {
  cropName: string
  variety?: string | null
  daysSincePlanting?: number | null
  gddRatio?: number | null
  hasHarvest?: boolean
  records: { key: string }[]
  hiddenKeys?: string[]
}): MilestoneAsk | null {
  const hidden = new Set(input.hiddenKeys ?? [])
  const recorded = new Set(input.records.map((record) => record.key))
  for (const item of catalogFor(input.cropName, input.variety)) {
    if (item.ask === false) continue
    if (recorded.has(item.key) || hidden.has(item.key)) continue
    if (item.skipWhenHarvest && input.hasHarvest) continue
    if (windowPlace(item.window, input) !== 'inside') continue
    return {
      key: item.key,
      trigger: milestoneTrigger(item.key),
      question: item.question,
      term: item.term,
      ifYes: item.ifYes,
      sourceLabel: item.sourceLabel,
      howTo: item.howTo,
      yesLabel: item.yesLabel,
    }
  }
  return null
}

/**
 * 記録があれば断定。記録が無く窓の中なら条件つき。
 * 窓を過ぎたあとは言わない。活着の「根付いていれば」を、植付150日でも出し続けていた。
 */
export function formatMilestoneGeneral(input: {
  cropName: string
  variety?: string | null
  daysSincePlanting?: number | null
  gddRatio?: number | null
  hasHarvest?: boolean
  records: MilestoneRecord[]
  today?: Date
}): string | null {
  const today = input.today ?? new Date()
  const items = catalogFor(input.cropName, input.variety)
  if (input.hasHarvest) {
    const harvestLine = items.find((item) => item.harvestLine)?.harvestLine
    if (harvestLine) return harvestLine
    // さつまいも・ジャガイモは、収穫記録のあとは片付け側に譲る
    if (items.some((item) => item.skipWhenHarvest)) return null
  }
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index]
    const record = recordedOf(input.records, item.key)
    if (record) {
      const days = daysSinceDate(record.observedAt, today)
      return item.recordedLine(days)
    }
    if (item.skipWhenHarvest && input.hasHarvest) continue
    if (windowPlace(item.window, input) === 'inside') return item.conditional
  }
  return null
}

export function milestoneFormItems(
  cropName: string,
  variety: string | null | undefined,
  records: MilestoneRecord[]
): MilestoneFormItem[] {
  return catalogFor(cropName, variety).map((item) => {
    const record = recordedOf(records, item.key)
    return {
      key: item.key,
      term: item.term,
      question: item.question,
      sourceLabel: item.sourceLabel,
      observedAt: record ? milestoneDateInputValue(record.observedAt) : null,
    }
  })
}

export function milestoneFaqRows(): MilestoneFaqRow[] {
  return MILESTONES.map((item) => ({
    crop: item.cropLabel,
    question: item.question,
    term: item.term,
    source: item.sourceLabel,
    windowNote: item.windowNote,
  }))
}

export function isKnownMilestoneKey(cropName: string, variety: string | null | undefined, key: string): boolean {
  return catalogFor(cropName, variety).some((item) => item.key === key)
}
