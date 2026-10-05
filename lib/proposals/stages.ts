import { normalizeCropNameForMatch } from '@/lib/benchmarks/crops'

export type CropStage = {
  key: string
  label: string
  fromDays?: number
  toDays?: number
  /** 目標GDDに対する比率。0.9 なら 90% */
  fromGddRatio?: number
  /** この値未満まで。収穫（100%以上）と試し掘りを分ける */
  toGddRatio?: number
  requiresHarvest?: boolean
  expectedWorkTypes: string[]
  generalLine: string
  nextHint: string
}

export type StageProgress = {
  daysSincePlanting?: number | null
  gddRatio?: number | null
  hasHarvest?: boolean
}

/** 先に書いた段階を優先する（片付け → 収穫 → 試し掘り → 日数の段階） */
const SWEET_POTATO_STAGES: CropStage[] = [
  {
    key: 'cleanup',
    label: '片付け',
    requiresHarvest: true,
    expectedWorkTypes: ['片付け', '貯蔵'],
    generalLine: '収穫のあとは、片付け・貯蔵と次作の準備に入る時期です',
    nextHint: '残さの処理と貯蔵条件の確認',
  },
  {
    key: 'harvest',
    label: '収穫',
    fromGddRatio: 1,
    expectedWorkTypes: ['収穫'],
    generalLine: 'さつまいもは積算温度が収穫の目安に達しています。雨の前の掘り取りが安心です',
    nextHint: '収穫と出荷の段取り',
  },
  {
    key: 'test-dig',
    label: '試し掘り',
    fromGddRatio: 0.9,
    toGddRatio: 1,
    expectedWorkTypes: ['試し掘り', '病害確認'],
    generalLine: 'さつまいもは収穫の目安に近づいており、試し掘りで肥大を確かめる時期です',
    nextHint: '試し掘りと、問題があれば収穫の前倒し',
  },
  {
    key: 'vine-turning',
    label: 'つる返し期',
    fromDays: 45,
    toDays: 60,
    expectedWorkTypes: ['つる返し', '除草'],
    generalLine: 'さつまいもはつるを返して、イモの肥大を促す時期です',
    nextHint: 'つる返しと除草',
  },
  {
    key: 'rooting',
    label: '活着',
    fromDays: 5,
    toDays: 10,
    expectedWorkTypes: ['植え付け', '灌水'],
    generalLine: 'さつまいもは苗の活着を確認する時期です',
    nextHint: '欠株の確認と、乾いていれば灌水',
  },
]

function nameIncludes(cropName: string, variety: string | null | undefined, words: string[]): boolean {
  const names = [cropName, variety ?? ''].map((value) => normalizeCropNameForMatch(value))
  const needles = words.map((word) => normalizeCropNameForMatch(word))
  return names.some((name) => needles.some((word) => name.includes(word)))
}

function isSweetPotato(cropName: string, variety?: string | null): boolean {
  return nameIncludes(cropName, variety, ['さつまいも', 'サツマイモ', '薩摩芋', 'かんしょ'])
}

/** 月次ヒントの「定植・誘引」を、植付直後の短い期間にした */
const TOMATO_STAGES: CropStage[] = [
  {
    key: 'harvest',
    label: '収穫',
    fromGddRatio: 1,
    expectedWorkTypes: ['収穫'],
    generalLine: 'トマトは積算温度が収穫の目安に達しています',
    nextHint: '収穫',
  },
  {
    key: 'pinching',
    label: '芽かき・摘芯',
    fromDays: 30,
    toDays: 60,
    expectedWorkTypes: ['摘花・除葉', '芽かき'],
    generalLine: 'トマトは芽かき・摘芯で茎を整理する時期です',
    nextHint: '芽かき・摘芯',
  },
  {
    key: 'rooting',
    label: '定植・誘引',
    fromDays: 0,
    toDays: 21,
    expectedWorkTypes: ['植え付け', '誘引・仕立て'],
    generalLine: 'トマトは定植のあと、誘引を始める時期です',
    nextHint: '誘引',
  },
]

/** 月次ヒントの「定植・活着」「整枝」と、目標積算温度1000 */
const EGGPLANT_STAGES: CropStage[] = [
  {
    key: 'harvest',
    label: '収穫',
    fromGddRatio: 1,
    expectedWorkTypes: ['収穫'],
    generalLine: 'ナスは積算温度が収穫の目安に達しています',
    nextHint: '収穫',
  },
  {
    key: 'training',
    label: '整枝',
    fromDays: 30,
    toDays: 60,
    expectedWorkTypes: ['誘引・仕立て', '整枝'],
    generalLine: 'ナスは整枝・摘葉で風通しを確保する時期です',
    nextHint: '整枝・摘葉',
  },
  {
    key: 'rooting',
    label: '定植・活着',
    fromDays: 0,
    toDays: 21,
    expectedWorkTypes: ['植え付け'],
    generalLine: 'ナスは定植後、活着を確認する時期です',
    nextHint: '活着の確認',
  },
]

/** 月次ヒントの「定植・誘引」「収穫開始」と、目標積算温度750。中間の段階はヒントに作業名がない */
const CUCUMBER_STAGES: CropStage[] = [
  {
    key: 'harvest',
    label: '収穫',
    fromGddRatio: 1,
    expectedWorkTypes: ['収穫'],
    generalLine: 'キュウリは積算温度が収穫の目安に達しています。最盛期はほぼ毎日の収穫が目安です',
    nextHint: '収穫',
  },
  {
    key: 'rooting',
    label: '定植・誘引',
    fromDays: 0,
    toDays: 21,
    expectedWorkTypes: ['植え付け', '誘引・仕立て'],
    generalLine: 'キュウリは定植のあと、誘引を始める時期です',
    nextHint: '誘引',
  },
]

/** 目標積算温度950。月次ヒントの中間は追肥・防除だけで、作業記録の段階にはしていない */
const PEPPER_STAGES: CropStage[] = [
  {
    key: 'harvest',
    label: '収穫',
    fromGddRatio: 1,
    expectedWorkTypes: ['収穫'],
    generalLine: 'ピーマンは積算温度が収穫の目安に達しています',
    nextHint: '収穫',
  },
  {
    key: 'rooting',
    label: '定植',
    fromDays: 0,
    toDays: 21,
    expectedWorkTypes: ['植え付け'],
    generalLine: 'ピーマンは定植後の初期管理の時期です',
    nextHint: '活着の確認',
  },
]

/** 目標積算温度はない。3月植付け・4月土寄せの月次ヒントを、植付からの日数にした */
const POTATO_STAGES: CropStage[] = [
  {
    key: 'hilling',
    label: '土寄せ',
    fromDays: 20,
    toDays: 45,
    expectedWorkTypes: ['土寄せ'],
    generalLine: 'ジャガイモは土寄せでイモの緑化を防ぐ時期です',
    nextHint: '土寄せ',
  },
  {
    key: 'rooting',
    label: '植付け',
    fromDays: 0,
    toDays: 14,
    expectedWorkTypes: ['植え付け'],
    generalLine: 'ジャガイモは植付け直後です',
    nextHint: '萌芽の確認',
  },
]

const STAGE_SETS: { name: string; match: (cropName: string, variety?: string | null) => boolean; stages: CropStage[] }[] = [
  { name: 'さつまいも', match: isSweetPotato, stages: SWEET_POTATO_STAGES },
  { name: 'トマト', match: (name, variety) => nameIncludes(name, variety, ['トマト', 'とまと', 'tomato']), stages: TOMATO_STAGES },
  { name: 'ナス', match: (name, variety) => nameIncludes(name, variety, ['ナス', 'なす', '茄子']), stages: EGGPLANT_STAGES },
  { name: 'キュウリ', match: (name, variety) => nameIncludes(name, variety, ['キュウリ', 'きゅうり', '胡瓜']), stages: CUCUMBER_STAGES },
  { name: 'ピーマン', match: (name, variety) => nameIncludes(name, variety, ['ピーマン', 'パプリカ', 'ししとう']), stages: PEPPER_STAGES },
  { name: 'ジャガイモ', match: (name, variety) => nameIncludes(name, variety, ['ジャガイモ', 'じゃがいも', '馬鈴薯', 'ばれいしょ']), stages: POTATO_STAGES },
]

export const CROP_STAGE_CATALOG: { name: string; stages: CropStage[] }[] = STAGE_SETS.map((set) => ({
  name: set.name,
  stages: set.stages,
}))

export function formatStageCondition(stage: CropStage): string {
  if (stage.requiresHarvest) return '収穫の記録があるとき'
  if (stage.fromGddRatio != null || stage.toGddRatio != null) {
    const from = stage.fromGddRatio != null ? `${Math.round(stage.fromGddRatio * 100)}%以上` : ''
    const to = stage.toGddRatio != null ? `${Math.round(stage.toGddRatio * 100)}%未満` : ''
    return `積算温度が収穫の目安の${[from, to].filter(Boolean).join('、')}`
  }
  if (stage.fromDays != null && stage.toDays != null) return `植付から${stage.fromDays}〜${stage.toDays}日`
  if (stage.fromDays != null) return `植付から${stage.fromDays}日以上`
  if (stage.toDays != null) return `植付から${stage.toDays}日まで`
  return ''
}

function stageMatches(stage: CropStage, progress: StageProgress): boolean {
  if (stage.requiresHarvest) return !!progress.hasHarvest

  if (stage.fromGddRatio != null || stage.toGddRatio != null) {
    const ratio = progress.gddRatio
    if (ratio == null || !Number.isFinite(ratio)) return false
    if (stage.fromGddRatio != null && ratio < stage.fromGddRatio) return false
    if (stage.toGddRatio != null && ratio >= stage.toGddRatio) return false
    return true
  }

  if (stage.fromDays != null || stage.toDays != null) {
    const days = progress.daysSincePlanting
    if (days == null) return false
    if (stage.fromDays != null && days < stage.fromDays) return false
    if (stage.toDays != null && days > stage.toDays) return false
    return true
  }

  return false
}

/** 定義のない品目、またはどの段階にも当てはまらないときは null */
export function resolveCropStage(
  cropName: string,
  variety: string | null | undefined,
  progress: StageProgress
): CropStage | null {
  const set = STAGE_SETS.find((item) => item.match(cropName, variety))
  if (!set) return null
  return set.stages.find((stage) => stageMatches(stage, progress)) ?? null
}

export function formatStageGeneralLine(stage: CropStage): string {
  return `${stage.generalLine}。次は${stage.nextHint}。`
}
