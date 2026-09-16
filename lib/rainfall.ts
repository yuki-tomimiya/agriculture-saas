const DEFAULT_TARGET_RAINFALL_MM = 500

/**
 * 作物ごとの「植え付け〜収穫期までの累積雨量」目安（暫定値）
 * 運用しながら地域・作型に合わせて調整する前提。
 */
export const TARGET_RAINFALL_BY_CROP: Record<string, number> = {
  さつまいも: 520,
  ふくむらさき: 520,
  紅はるか: 500,
  トマト: 420,
  ナス: 480,
  ピーマン: 450,
  キュウリ: 430,
  スイートコーン: 520,
  イチゴ: 380,
}

export function getTargetRainfallForCrop(cropName: string): number {
  for (const [key, value] of Object.entries(TARGET_RAINFALL_BY_CROP)) {
    if (cropName.includes(key)) return value
  }
  return DEFAULT_TARGET_RAINFALL_MM
}
