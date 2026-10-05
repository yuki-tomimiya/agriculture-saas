/** FAQ の適正 pH 表と揃える。一般的な目安で、都道府県の施肥基準ではない。 */
export const SOIL_PH_RANGES = [
  { name: 'トマト', min: 6.0, max: 6.5 },
  { name: 'ナス', min: 6.0, max: 6.5 },
  { name: 'ピーマン', min: 6.0, max: 6.5 },
  { name: 'キュウリ', min: 6.0, max: 6.5 },
  { name: 'スイートコーン', min: 5.5, max: 6.5 },
  { name: 'イチゴ', min: 5.5, max: 6.5 },
  { name: 'さつまいも', min: 5.5, max: 6.0 },
] as const

export function matchedSoilPh(cropName: string, variety?: string | null) {
  const hay = `${cropName} ${variety ?? ''}`
  return SOIL_PH_RANGES.find((row) => hay.includes(row.name)) ?? null
}

export function formatSoilPhRange(min: number, max: number): string {
  return `${min.toFixed(1)}〜${max.toFixed(1)}`
}
