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
  skipWhenHarvest?: boolean
}

const AKITA = `${MILESTONE_SOURCE_AKITA.publisher} ${MILESTONE_SOURCE_AKITA.name}${MILESTONE_SOURCE_AKITA.detail}`
const CHIBA_P18 = `${MILESTONE_SOURCE_CHIBA.publisher}「${MILESTONE_SOURCE_CHIBA.name}」（${MILESTONE_SOURCE_CHIBA.year}）p.18`
const CHIBA_P28 = `${MILESTONE_SOURCE_CHIBA.publisher}「${MILESTONE_SOURCE_CHIBA.name}」（${MILESTONE_SOURCE_CHIBA.year}）p.28`

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
    question: '下から3段目の花のかたまりが咲きましたか？',
    term: '第3花房の開花',
    yesLabel: '咲いた',
    ifYes: '咲いていれば、追肥（穴肥）を始める時期です。灌水も、控えめから積極的に切り替えます。',
    conditional:
      '下から3段目の花が咲いていれば、追肥（穴肥）を始めます。まだなら、もう少し様子を見てください。腋芽は、混みすぎないよう随時かいてください。',
    recordedLine: (days) =>
      `${days <= 0 ? '第3花房の開花は今日です' : `第3花房の開花から${days}日です`}。追肥（穴肥）を始める時期です。灌水も、控えめから積極的に切り替えます。`,
    sourceLabel: AKITA,
    howTo: [],
    window: { kind: 'days', from: 25, to: 50 },
    windowNote: '植付から25〜50日（暫定・出典なし。問いかけの窓だけで、断定には使わない）',
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
    sourceLabel: CHIBA_P18,
    howTo: [],
    window: { kind: 'days', from: 5, to: 20 },
    windowNote: '植付から5〜20日（暫定・出典なし。問いかけの窓だけで、断定には使わない）',
  },
  {
    key: 'test-dig',
    cropLabel: 'さつまいも',
    match: isSweetPotato,
    question: '試し掘りをして、イモの太りを見ましたか？',
    term: '試し掘り',
    yesLabel: '掘った',
    ifYes: '太っていれば収穫へ。細ければ、もう少し置きます。',
    conditional: '試し掘りで太っていれば収穫へ。細ければ、もう少し置きます。',
    recordedLine: (days) =>
      `${days <= 0 ? '試し掘りは今日です' : `試し掘りから${days}日です`}。太っていれば収穫へ。細ければ、もう少し置きます。`,
    sourceLabel: CHIBA_P28,
    howTo: TEST_DIG_HOW_TO,
    window: { kind: 'gddRatio', from: 0.85 },
    windowNote: '積算温度が収穫の目安の85%以上（日数ではない。窓を過ぎたあとも、収穫記録がなければ条件つきのまま）',
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

/** 記録があれば断定。無ければ、窓の中か窓を過ぎたときだけ条件つき。それ以外は null */
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
  // さつまいもは収穫記録が収穫開始の節目。活着・試し掘りの文で片付けを上書きしない
  if (input.hasHarvest && items.some((item) => item.skipWhenHarvest)) return null
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index]
    const record = recordedOf(input.records, item.key)
    if (record) {
      const days = daysSinceDate(record.observedAt, today)
      return item.recordedLine(days)
    }
    if (item.skipWhenHarvest && input.hasHarvest) continue
    const place = windowPlace(item.window, input)
    if (place === 'inside' || place === 'after') return item.conditional
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
