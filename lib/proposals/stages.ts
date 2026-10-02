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
    generalLine: 'さつまいもは積算温度が目標に達し、収穫適期です。雨の前の掘り取りが安心です',
    nextHint: '収穫と出荷の段取り',
  },
  {
    key: 'test-dig',
    label: '試し掘り',
    fromGddRatio: 0.9,
    toGddRatio: 1,
    expectedWorkTypes: ['試し掘り', '病害確認'],
    generalLine: 'さつまいもは目標の積算温度に近づいており、試し掘りで肥大を確かめる時期です',
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

function isSweetPotato(cropName: string, variety?: string | null): boolean {
  const names = [cropName, variety ?? ''].map((s) => normalizeCropNameForMatch(s))
  return names.some(
    (name) =>
      name.includes('さつまいも') || name.includes('サツマイモ') || name.includes('薩摩芋')
  )
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

/** さつまいも以外、またはどの段階にも当てはまらないときは null */
export function resolveCropStage(
  cropName: string,
  variety: string | null | undefined,
  progress: StageProgress
): CropStage | null {
  if (!isSweetPotato(cropName, variety)) return null
  return SWEET_POTATO_STAGES.find((stage) => stageMatches(stage, progress)) ?? null
}

export function formatStageGeneralLine(stage: CropStage): string {
  return `${stage.generalLine}。次は${stage.nextHint}。`
}
