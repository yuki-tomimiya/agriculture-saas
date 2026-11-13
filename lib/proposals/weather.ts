import { readCoolNight, readFarmFrost } from '@/lib/jma/frost-record'
import { getAccumulatedGDDFromApi, getForecastDays, getHistoricalDailyPrecipitation } from '@/lib/weather-forecast'
import { loadLocationArchive } from '@/lib/weather-normals'

/** 今日の提案が使う気象データ。テストでは全ての取得先を差し替える。 */
export type ProposalWeather = {
  forecast: typeof getForecastDays
  accumulatedGdd: typeof getAccumulatedGDDFromApi
  archive: typeof loadLocationArchive
  frost: typeof readFarmFrost
  coolNight: typeof readCoolNight
  precipitation: typeof getHistoricalDailyPrecipitation
}

export const liveProposalWeather: ProposalWeather = {
  forecast: getForecastDays,
  accumulatedGdd: getAccumulatedGDDFromApi,
  archive: loadLocationArchive,
  frost: readFarmFrost,
  coolNight: readCoolNight,
  precipitation: getHistoricalDailyPrecipitation,
}
