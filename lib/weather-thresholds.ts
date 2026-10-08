/**
 * どの予報を画面で取り上げるか。農業の判断基準ではない（根拠台帳 H3・H4・H7・H8）。
 * 提案・気象ナビ・ダッシュボードは、ここを読む。
 */
export const FORECAST_RAIN_HIGHLIGHT_PCT = 55
export const FORECAST_WIND_HIGHLIGHT_MS = 10
export const FORECAST_HEAVY_RAIN_MM = 20

/**
 * 直近の最高気温が、同じ暦日の10年平均よりこの割合以上ずれたら「高い／低い」と言う。
 * 来年の計画の 103%・97%（根拠台帳 B8）と同じ 3% 幅。
 */
export const FORECAST_TEMP_DIFF_RATIO = 0.03
