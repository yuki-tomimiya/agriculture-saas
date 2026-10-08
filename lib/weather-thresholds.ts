/**
 * どの予報を画面で取り上げるか。農業の判断基準ではない（根拠台帳 H3・H4・H7・H8）。
 * 提案・気象ナビ・ダッシュボードは、ここを読む。
 */
export const FORECAST_RAIN_HIGHLIGHT_PCT = 55
export const FORECAST_WIND_HIGHLIGHT_MS = 10
export const FORECAST_HEAVY_RAIN_MM = 20

/**
 * 直近の最高気温の平均と、同じ暦日の10年平均との差がこれ未満なら「10年平均並み」。
 * 推計の気温は実測と ±1.5℃ほどずれる（根拠台帳 A3）ので、それより小さい差は誤差の内側。
 */
export const FORECAST_TEMP_DIFF_C = 1.5

/** 10年平均が無くなければ、0℃以下でも差で比べる。 */
export function tempCompareLabel(avgMax: number, normalMax: number | null): string | null {
  if (normalMax == null || !Number.isFinite(normalMax) || !Number.isFinite(avgMax)) return null
  const diff = avgMax - normalMax
  if (Math.abs(diff) < FORECAST_TEMP_DIFF_C) return '10年平均並み'
  const rounded = Math.round(Math.abs(diff) * 10) / 10
  return diff > 0 ? `10年平均より${rounded}℃高い` : `10年平均より${rounded}℃低い`
}
