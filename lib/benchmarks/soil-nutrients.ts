/**
 * 作付け前（施肥前）に測った値の目安。栽培中の値には当てはめない。
 * 超えていなければ何も言わない（「適正」とは言わない）。
 */

export const SOIL_NUTRIENT_SOURCE_MAFF = {
  publisher: '農林水産省',
  name: '地力増進基本指針',
  detail: '平成20年10月16日、普通畑の改善目標',
  url: 'https://www.maff.go.jp/j/seisan/kankyo/page/attach/pdf/260217_1-7.pdf',
} as const

export const SOIL_PH_SOURCE_MIYAZAKI = {
  publisher: '宮崎県',
  name: '主要作物の土壌診断基準',
  year: '平成9年3月',
  detail: 'p.21 食用カンショ',
  url: 'https://www.maff.go.jp/j/seisan/kankyo/hozen_type/h_sehi_kizyun/pdf/08450305sakumotu1.pdf',
} as const

/** 普通畑。これを超えたら一言出す。ちょうど 0.3 は出さない */
export const SOIL_EC_OVER_MS = 0.3
/** 岩屑土・砂丘未熟土。土の種類は記録していないので、文で添えるだけ */
export const SOIL_EC_SAND_MS = 0.1
/** これを超えたら一言出す。ちょうど 10 は出さない */
export const SOIL_NITRATE_OVER_MG = 10
/** これ以上ならリン酸を施さなくてよい目安。ちょうど 100 も出す */
export const SOIL_PHOSPHORUS_SKIP_MG = 100

const BEFORE_PLANTING = '作付け前に測った値の目安です。'

export const SOIL_TIMING_BEFORE = '作付け前'
export const SOIL_TIMING_DURING = '栽培中'

export function soilTimingSuffix(timing: string | null | undefined): string {
  if (timing === SOIL_TIMING_BEFORE || timing === SOIL_TIMING_DURING) return `（${timing}）`
  return ''
}

export type SoilNutrientHit = {
  key: 'ec' | 'nitrogen' | 'phosphorus'
  /** 土壌診断の数字の横に付ける短い一言 */
  pageNote: string
  /** 今日の提案の【一般】 */
  sentence: string
}

export function soilNutrientHits(row: {
  ec?: number | null
  nitrogen?: number | null
  phosphorus?: number | null
  timing?: string | null
}): SoilNutrientHit[] {
  if (row.timing === SOIL_TIMING_DURING) return []
  const hits: SoilNutrientHit[] = []
  if (row.ec != null && row.ec > SOIL_EC_OVER_MS) {
    hits.push({
      key: 'ec',
      pageNote: '0.3 を超えています',
      sentence: `作付け前の EC が 0.3 mS/cm を超えています。肥料が土に残っている目安です。硝酸態窒素も測って、次の作付けの元肥の窒素を減らすことを考えます。${BEFORE_PLANTING}砂地（砂丘未熟土など）では 0.1 が目安です。`,
    })
  }
  if (row.nitrogen != null && row.nitrogen > SOIL_NITRATE_OVER_MG) {
    hits.push({
      key: 'nitrogen',
      pageNote: '10 を超えています',
      sentence: `硝酸態窒素が 10 mg/100g を超えています。そのぶん、次の作付けの元肥の窒素を減らせます。${BEFORE_PLANTING}`,
    })
  }
  if (row.phosphorus != null && row.phosphorus >= SOIL_PHOSPHORUS_SKIP_MG) {
    hits.push({
      key: 'phosphorus',
      pageNote: '100 以上です',
      sentence: `有効態リン酸が 100 mg/100g 以上あります。リン酸の肥料は施さなくてよい目安です。${BEFORE_PLANTING}`,
    })
  }
  return hits
}
