export type MarketPrice = {
  marketName: string
  cropName: string
  grade: string
  unit: string
  avgPrice: number
  highPrice: number
  lowPrice: number
}

/**
 * 本日分の市場価格（サンプルデータ）
 * 実装時は農水省・各市場APIなどから取得する想定
 */
export function getTodayMarketPrices(): MarketPrice[] {
  return [
    {
      marketName: '◯◯中央卸売市場',
      cropName: 'トマト',
      grade: 'A品',
      unit: 'kg',
      avgPrice: 320,
      highPrice: 360,
      lowPrice: 280,
    },
    {
      marketName: '◯◯中央卸売市場',
      cropName: 'キュウリ',
      grade: 'A品',
      unit: 'kg',
      avgPrice: 280,
      highPrice: 310,
      lowPrice: 250,
    },
    {
      marketName: '△△地方卸売市場',
      cropName: 'ナス',
      grade: 'A品',
      unit: 'kg',
      avgPrice: 350,
      highPrice: 390,
      lowPrice: 300,
    },
  ]
}

