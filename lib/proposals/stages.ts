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
  /**
   * 日数で当たった段階。作業の抜けを断定しない。
   * この日数に出典はない。条件つきの文を選ぶためだけに使う。
   */
  windowOnly?: boolean
}

export type StageProgress = {
  daysSincePlanting?: number | null
  gddRatio?: number | null
  hasHarvest?: boolean
  /** 記録済みの節目。積算温度は持たず、観察日からその場で日数を出す */
  milestones?: { key: string; observedAt: Date }[]
  today?: Date
}

/**
 * 先に書いた段階を優先する（片付け → 収穫）。
 * 活着・試し掘りは lib/proposals/milestones.ts。つる返しは段階にしない
 * （千葉県の指針に記載がないため）。
 */
const SWEET_POTATO_STAGES: CropStage[] = [
  {
    key: 'cleanup',
    label: '片付け',
    requiresHarvest: true,
    expectedWorkTypes: ['片付け', '貯蔵'],
    generalLine: '収穫の記録があるので、片付けと貯蔵、次の作付けの準備に入れます',
    nextHint: '残さの処理と貯蔵条件の確認',
  },
  {
    key: 'harvest',
    label: '収穫',
    fromGddRatio: 1,
    expectedWorkTypes: ['収穫'],
    generalLine: 'さつまいもは積算温度が収穫の目安に達しています',
    nextHint: '収穫と出荷の段取り',
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

/**
 * 芽かきは段階にしない（腋芽は随時。摘心は目標段数の1回で、別作業）。
 * 第3花房は milestones.ts。ここにある日数に出典はない。
 */
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
    key: 'rooting',
    label: '定植・誘引',
    fromDays: 0,
    toDays: 21,
    windowOnly: true,
    expectedWorkTypes: ['植え付け', '誘引・仕立て'],
    generalLine: 'トマトは、植えていれば風で折れないよう誘引をします',
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
    windowOnly: true,
    expectedWorkTypes: ['誘引・仕立て', '整枝'],
    generalLine: 'ナスは、茂って風通しが悪ければ、整枝・摘葉をします',
    nextHint: '整枝・摘葉',
  },
  {
    key: 'rooting',
    label: '定植・活着',
    fromDays: 0,
    toDays: 21,
    windowOnly: true,
    expectedWorkTypes: ['植え付け'],
    generalLine: 'ナスは、苗が根付いていれば活着しています。乾いていれば灌水をします',
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
    generalLine: 'キュウリは積算温度が収穫の目安に達しています',
    nextHint: '収穫',
  },
  {
    key: 'rooting',
    label: '定植・誘引',
    fromDays: 0,
    toDays: 21,
    windowOnly: true,
    expectedWorkTypes: ['植え付け', '誘引・仕立て'],
    generalLine: 'キュウリは、定植していれば誘引を始めます',
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
    windowOnly: true,
    expectedWorkTypes: ['植え付け'],
    generalLine: 'ピーマンは、苗が根付いていれば初期の灌水と誘引をします',
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
    windowOnly: true,
    expectedWorkTypes: ['土寄せ'],
    generalLine: 'ジャガイモは、茎が伸びていれば土寄せでイモの緑化を防ぎます',
    nextHint: '土寄せ',
  },
  {
    key: 'rooting',
    label: '植付け',
    fromDays: 0,
    toDays: 14,
    windowOnly: true,
    expectedWorkTypes: ['植え付け'],
    generalLine: 'ジャガイモは、植えたばかりなら萌芽を確認します',
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
  if (stage.key === 'harvest') {
    return stage.generalLine.endsWith('。') ? stage.generalLine : `${stage.generalLine}。`
  }
  return `${stage.generalLine}。次は${stage.nextHint}。`
}
