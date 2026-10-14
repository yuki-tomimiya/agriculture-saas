export const COUNT_UNITS = ['個', '本', '袋', '箱'] as const

export type ParsedHarvest = {
  quantityKg: number
  countQuantity: number | null
  countUnit: string | null
}

/** 重さは kg で保存する。g で来た値は 1000 で割る。個数は任意。 */
export function parseHarvestBody(body: Record<string, unknown>): { error: string } | { value: ParsedHarvest } {
  const raw = typeof body.quantity === 'number' ? body.quantity : Number(body.quantity)
  if (body.quantity == null || body.quantity === '' || !Number.isFinite(raw) || raw <= 0) {
    return { error: '収穫量（kg）を入力してください' }
  }
  const weightUnit = body.weightUnit === 'g' || body.unit === 'g' ? 'g' : 'kg'
  const quantityKg = weightUnit === 'g' ? raw / 1000 : raw
  if (quantityKg <= 0) return { error: '収穫量（kg）を入力してください' }

  const countBlank = body.countQuantity == null || body.countQuantity === ''
  const countUnit = typeof body.countUnit === 'string' ? body.countUnit.trim() : ''
  if (countBlank && !countUnit) {
    return { value: { quantityKg, countQuantity: null, countUnit: null } }
  }
  const countQuantity = typeof body.countQuantity === 'number' ? body.countQuantity : Number(body.countQuantity)
  if (!Number.isFinite(countQuantity) || countQuantity <= 0) {
    return { error: '個数を入れるときは、1以上の数と単位を選んでください' }
  }
  if (!COUNT_UNITS.includes(countUnit as (typeof COUNT_UNITS)[number])) {
    return { error: '個数の単位は、個・本・袋・箱から選んでください' }
  }
  return { value: { quantityKg, countQuantity, countUnit } }
}

export function formatHarvestAmount(row: {
  quantity: number
  unit: string
  countQuantity?: number | null
  countUnit?: string | null
}): string {
  const weight = `${row.quantity} ${row.unit}`
  if (row.countQuantity != null && row.countUnit) return `${weight}（${row.countQuantity}${row.countUnit}）`
  return weight
}
