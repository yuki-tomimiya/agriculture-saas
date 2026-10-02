/** FAQ の基準温度表と揃える。表示もこの表を読む。 */
export const CROP_BASE_TEMPERATURES = [
  { name: 'トマト', baseTemp: 10, gddLabel: '約 800〜1,000' },
  { name: 'ナス', baseTemp: 10, gddLabel: '約 900〜1,100' },
  { name: 'ピーマン', baseTemp: 10, gddLabel: '約 850〜1,050' },
  { name: 'キュウリ', baseTemp: 10, gddLabel: '約 650〜850' },
  { name: 'スイートコーン', baseTemp: 10, gddLabel: '約 1,300〜1,500' },
  { name: 'イチゴ', baseTemp: 5, gddLabel: '約 600〜800（開花〜収穫）' },
  { name: 'さつまいも', baseTemp: 10, gddLabel: '約 1,700（暫定）' },
] as const

export const BASE_TEMP_MIN = 0
export const BASE_TEMP_MAX = 20

export function matchedBaseCrop(cropName: string, variety?: string | null) {
  const hay = `${cropName} ${variety ?? ''}`
  return CROP_BASE_TEMPERATURES.find((row) => hay.includes(row.name)) ?? null
}

export function defaultBaseTemperature(cropName: string, variety?: string | null): number | null {
  return matchedBaseCrop(cropName, variety)?.baseTemp ?? null
}

/** 空欄は null。範囲外は invalid。 */
export function parseBaseTemperature(value: unknown): number | null | 'invalid' {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(n) || n < BASE_TEMP_MIN || n > BASE_TEMP_MAX) return 'invalid'
  return Math.round(n * 10) / 10
}

export function resolveBaseTemperature(value: unknown, cropName: string, variety?: string | null): number | { error: string } {
  const parsed = parseBaseTemperature(value)
  if (parsed === 'invalid') {
    return { error: `基準温度は${BASE_TEMP_MIN}〜${BASE_TEMP_MAX}℃で入力してください` }
  }
  if (parsed === null) return defaultBaseTemperature(cropName, variety) ?? 10
  return parsed
}
