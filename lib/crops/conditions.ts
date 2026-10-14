/** 作付けの条件。助言の当てはめは品目のキーを先に使う。 */

export type CropKindDef = {
  key: string
  label: string
  recordOnly: boolean
  /** 既存のキーワード表に渡す名前。記録だけは null */
  benchmarkName: string | null
}

export const CROP_KINDS: CropKindDef[] = [
  { key: 'tomato', label: 'トマト', recordOnly: false, benchmarkName: 'トマト' },
  { key: 'cucumber', label: 'キュウリ', recordOnly: false, benchmarkName: 'キュウリ' },
  { key: 'eggplant', label: 'ナス', recordOnly: false, benchmarkName: 'ナス' },
  { key: 'pepper', label: 'ピーマン', recordOnly: false, benchmarkName: 'ピーマン' },
  { key: 'sweet-potato', label: 'さつまいも', recordOnly: false, benchmarkName: 'さつまいも' },
  { key: 'sweet-corn', label: 'スイートコーン', recordOnly: false, benchmarkName: 'スイートコーン' },
  { key: 'cabbage', label: 'キャベツ', recordOnly: false, benchmarkName: 'キャベツ' },
  { key: 'daikon', label: 'ダイコン', recordOnly: false, benchmarkName: 'ダイコン' },
  { key: 'onion', label: '玉ねぎ', recordOnly: false, benchmarkName: '玉ねぎ' },
  { key: 'potato', label: 'ジャガイモ', recordOnly: false, benchmarkName: 'ジャガイモ' },
  { key: 'spinach', label: 'ホウレンソウ', recordOnly: false, benchmarkName: 'ホウレンソウ' },
  { key: 'broccoli', label: 'ブロッコリー', recordOnly: false, benchmarkName: 'ブロッコリー' },
  { key: 'edamame', label: 'エダマメ', recordOnly: false, benchmarkName: 'エダマメ' },
  { key: 'komatsuna', label: 'コマツナ', recordOnly: false, benchmarkName: 'コマツナ' },
  { key: 'strawberry-june', label: 'イチゴ（一季成り）', recordOnly: false, benchmarkName: 'イチゴ' },
  { key: 'strawberry-ever', label: 'イチゴ（四季成り）', recordOnly: true, benchmarkName: null },
  { key: 'lettuce-head', label: '玉レタス', recordOnly: false, benchmarkName: 'レタス' },
  { key: 'lettuce-leaf', label: 'リーフレタス', recordOnly: true, benchmarkName: null },
  { key: 'negi-long', label: '根深ネギ', recordOnly: false, benchmarkName: 'ネギ' },
  { key: 'negi-leaf', label: '葉ネギ', recordOnly: true, benchmarkName: null },
  { key: 'other', label: 'その他（記録だけ）', recordOnly: true, benchmarkName: null },
]

export const COVER_OPTIONS = [
  { key: 'mulch', label: 'マルチ' },
  { key: 'tunnel', label: 'トンネル' },
  { key: 'rowcover', label: 'べたがけ' },
] as const

export const RECORD_ONLY_NOTE = 'この品目はまだ助言の対象外です。記録は貯まります。'
export const CONDITIONS_PROMPT =
  '育て方の型・植え方を選んでください（あとで同じ条件の作付けと比べるために使います）'

export function cropKindByKey(key: string | null | undefined): CropKindDef | null {
  if (!key) return null
  return CROP_KINDS.find((kind) => kind.key === key) ?? null
}

export type AdviceNames = {
  recordOnly: boolean
  /** 一般の目安へ渡す名前。記録だけ、または未設定で名前も無いときは空 */
  name: string
  variety: string | null
  label: string | null
}

/** 品目の欄があればそれを使う。空の古い作付けだけ、呼び名から探す。 */
export function adviceNames(crop: {
  cropKind?: string | null
  name: string
  variety?: string | null
}): AdviceNames {
  const kind = cropKindByKey(crop.cropKind)
  if (kind?.recordOnly) {
    return { recordOnly: true, name: '', variety: null, label: kind.label }
  }
  if (kind?.benchmarkName) {
    return {
      recordOnly: false,
      name: kind.benchmarkName,
      variety: crop.variety ?? null,
      label: kind.label,
    }
  }
  return {
    recordOnly: false,
    name: crop.name,
    variety: crop.variety ?? null,
    label: null,
  }
}

export function plantingDateLabel(method: string | null | undefined): string {
  if (method === 'transplant') return '定植日（苗を植えた日）'
  if (method === 'direct') return '播種日（種・種いもを植えた日）'
  return '植え付け日'
}

export function parseCovers(value: string | null | undefined): string[] {
  if (!value) return []
  return value.split(',').map((part) => part.trim()).filter(Boolean)
}

export function formatCovers(keys: string[]): string | null {
  const unique = [...new Set(keys.filter(Boolean))]
  if (unique.length === 0) return null
  if (unique.includes('none')) return 'none'
  return unique.join(',')
}

export function coverLabel(value: string | null | undefined): string {
  if (!value) return ''
  if (value === 'none') return 'なし'
  return parseCovers(value)
    .map((key) => COVER_OPTIONS.find((option) => option.key === key)?.label ?? key)
    .join('・')
}

export function siteLabel(site: string | null | undefined): string {
  if (site === 'open') return '露地'
  if (site === 'house') return 'ハウス'
  return ''
}

export function heatingLabel(heating: string | null | undefined): string {
  if (heating === 'yes') return '暖房あり'
  if (heating === 'no') return '暖房なし（雨よけ・無加温）'
  return ''
}

export function methodLabel(method: string | null | undefined): string {
  if (method === 'transplant') return '苗を植えた'
  if (method === 'direct') return '種・種いもを直接植えた'
  return ''
}

/** 呼び名の「（120本）」から株数を取る。無ければ null */
export function plantCountFromName(name: string): number | null {
  const match = name.normalize('NFKC').match(/[（(](\d+)\s*本[）)]/)
  if (!match) return null
  const count = Number(match[1])
  return Number.isInteger(count) && count > 0 ? count : null
}

export function conditionsMissing(crop: {
  growingSite?: string | null
  covers?: string | null
  heating?: string | null
  plantingMethod?: string | null
  plantCount?: number | null
  areaM2?: number | null
}): boolean {
  if (!crop.growingSite || !crop.plantingMethod) return true
  if (crop.growingSite === 'open' && !crop.covers) return true
  if (crop.growingSite === 'house' && !crop.heating) return true
  if (crop.plantCount == null && crop.areaM2 == null) return true
  return false
}

export type CropConditionInput = {
  cropKind: string
  name: string
  growingSite: 'open' | 'house'
  covers: string | null
  heating: 'yes' | 'no' | null
  plantingMethod: 'transplant' | 'direct'
  plantCount: number | null
  areaM2: number | null
  fieldId: string | null
  fieldUndivided: boolean
}

export function parseCropConditions(
  body: Record<string, unknown>,
  options: { farmHasFields: boolean }
): { error: string } | { value: CropConditionInput } {
  const cropKind = typeof body.cropKind === 'string' ? body.cropKind : ''
  const kind = cropKindByKey(cropKind)
  if (!kind) return { error: '品目を選んでください' }

  const rawName = typeof body.name === 'string' ? body.name.trim() : ''
  if (kind.key === 'other' && !rawName) return { error: '呼び名（作物名）を入力してください' }
  const name = rawName || kind.label

  const growingSite = body.growingSite === 'open' || body.growingSite === 'house' ? body.growingSite : null
  if (!growingSite) return { error: '場所を選んでください' }

  let covers: string | null = null
  let heating: 'yes' | 'no' | null = null
  if (growingSite === 'open') {
    const selected = Array.isArray(body.covers) ? body.covers.filter((item) => typeof item === 'string') : []
    const none = body.coverNone === true || selected.includes('none')
    covers = none ? 'none' : formatCovers(selected.filter((key) => key !== 'none'))
    if (!covers) return { error: '露地の覆いを選んでください。無いときは「なし」を選んでください' }
  } else {
    heating = body.heating === 'yes' || body.heating === 'no' ? body.heating : null
    if (!heating) return { error: 'ハウスの暖房を選んでください' }
  }

  const plantingMethod =
    body.plantingMethod === 'transplant' || body.plantingMethod === 'direct' ? body.plantingMethod : null
  if (!plantingMethod) return { error: '植え方を選んでください' }

  const plantCount = parseOptionalInt(body.plantCount)
  const areaM2 = parseOptionalNumber(body.areaM2)
  if (plantCount === 'bad') return { error: '株数は1以上の整数にしてください' }
  if (areaM2 === 'bad') return { error: '栽培面積は0より大きい数にしてください' }
  if (plantCount == null && areaM2 == null) return { error: '株数か栽培面積のどちらかを入力してください' }

  const fieldUndivided = body.fieldUndivided === true
  const fieldId = typeof body.fieldId === 'string' && body.fieldId.trim() ? body.fieldId.trim() : null
  if (options.farmHasFields && !fieldId && !fieldUndivided) {
    return { error: '圃場を選んでください。分けていないときは「圃場を分けていない」を選んでください' }
  }

  return {
    value: {
      cropKind: kind.key,
      name,
      growingSite,
      covers,
      heating,
      plantingMethod,
      plantCount,
      areaM2,
      fieldId: fieldUndivided ? null : fieldId,
      fieldUndivided,
    },
  }
}

function parseOptionalInt(value: unknown): number | null | 'bad' {
  if (value == null || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(number) || number < 1) return 'bad'
  return number
}

function parseOptionalNumber(value: unknown): number | null | 'bad' {
  if (value == null || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number) || number <= 0) return 'bad'
  return number
}
