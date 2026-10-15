/** アメダスの気温の観測所の間隔（約21km）に合わせた運用の値 */
export const STATION_NEAR_KM = 20
/** 気温が約0.6℃変わる高さ。運用の値 */
export const STATION_NEAR_ELEV_M = 100
/** これより遠い観測所は使わず、推計に戻す */
export const STATION_FAR_KM = 40
/** 集計の期間で欠けた日がこの割合を超える年は、霜の集計に入れない。秋は8/15〜12/31、春は1/1〜6/30 */
export const STATION_MISSING_RATE = 0.1
/** これ以上の年が欠け少なくそろっていて、4℃以下に届かないときは、推計に戻さない */
export const STATION_ENOUGH_YEARS = 8
/** 気象庁への連続アクセスをあける間隔 */
export const JMA_FETCH_GAP_MS = 3000

export const JMA_SEARCH_TOP = 'https://www.data.jma.go.jp/stats/etrn/index.php'
export const JMA_STATION_LIST_SOURCE = 'https://www.data.jma.go.jp/stats/etrn/select/prefecture.php'
