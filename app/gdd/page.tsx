import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCropWhere } from '@/lib/queries'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import GDDCropList from '@/components/GDDCropList'
import ScrollToGddDetail from '@/components/ScrollToGddDetail'
import GDDChart from '@/components/GDDChart'
import RainfallDataCard from '@/components/RainfallDataCard'
import SunshineChart from '@/components/SunshineChart'
import { getForecastDailyPrecipitation, getForecastDailyTemps, getHistoricalDailyPrecipitation, getHistoricalDailyRadiation, getHistoricalDailyTemps, hasWeatherCoordinates } from '@/lib/weather-forecast'
import { computeGDDProjection, getTargetGDDForCrop } from '@/lib/gdd'
import { getPreviousSeasonWeather } from '@/lib/insights/previous-season-weather'
import { accumulateNormals, getLocationDailyNormals } from '@/lib/weather-normals'

export default async function GDDPage({
  searchParams,
}: {
  searchParams?: Promise<{ cropId?: string }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  const { where: cropWhere, whereFallback: cropWhereFallback } = getCropWhere(user.id)
  let crops = await prisma.crop.findMany({
    where: cropWhere,
    include: { farm: true },
    orderBy: { name: 'asc' },
  }).catch(() =>
    prisma.crop.findMany({
      where: cropWhereFallback,
      include: { farm: true },
      orderBy: { name: 'asc' },
    })
  )

  const sp = searchParams ? await searchParams : undefined
  const selectedCropId = sp?.cropId
  const cropsWithPlanting = crops.filter((c) => c.plantingDate != null)
  const growingWithPlanting = cropsWithPlanting.filter((c) => c.status === 'growing')

  // 明示の cropId があれば表示可（/gdd/past からの深リンク用）。初期選択は栽培中のみ。
  const selectedCrop =
    (selectedCropId ? cropsWithPlanting.find((c) => c.id === selectedCropId) : null) ??
    growingWithPlanting[0] ??
    null
  const viewingPastCrop = !!selectedCrop && selectedCrop.status !== 'growing'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const point = {
    latitude: selectedCrop?.farm?.latitude ?? null,
    longitude: selectedCrop?.farm?.longitude ?? null,
  }
  const canFetchWeather = hasWeatherCoordinates(point)
  const forecastTempsRaw =
    selectedCrop?.plantingDate && canFetchWeather
      ? await getForecastDailyTemps(today, { latitude: Number(point.latitude), longitude: Number(point.longitude) })
      : []
  // 予報見込みは「明日以降」を使う（今日分は実績と重複させない）
  const forecastTemps = forecastTempsRaw.filter((d) => d.date.getTime() > today.getTime())
  const baseTemp = selectedCrop?.baseTemperature ?? 10
  const historicalTemps =
    selectedCrop?.plantingDate && canFetchWeather
      ? await getHistoricalDailyTemps({
          startDate: new Date(selectedCrop.plantingDate),
          endDate: today,
          point: { latitude: Number(point.latitude), longitude: Number(point.longitude) },
        })
      : []
  const historicalRadiation =
    selectedCrop?.plantingDate && canFetchWeather
      ? await getHistoricalDailyRadiation({
          startDate: new Date(selectedCrop.plantingDate),
          endDate: today,
          point: { latitude: Number(point.latitude), longitude: Number(point.longitude) },
        })
      : []
  const historicalRainfall =
    selectedCrop?.plantingDate && canFetchWeather
      ? await getHistoricalDailyPrecipitation({
          startDate: new Date(selectedCrop.plantingDate),
          endDate: today,
          point: { latitude: Number(point.latitude), longitude: Number(point.longitude) },
        })
      : []
  const forecastRainfall =
    canFetchWeather
      ? await getForecastDailyPrecipitation({
          latitude: Number(point.latitude),
          longitude: Number(point.longitude),
        })
      : []
  let cumulativeGDD = 0
  const historicalCumulative = historicalTemps.map((day) => {
    cumulativeGDD += Math.max(0, day.avgTemp - baseTemp)
    return {
      date: day.date,
      cumulativeGDD: Math.round(cumulativeGDD * 10) / 10,
    }
  })
  let cumulativeRadiation = 0
  const radiationCumulative = historicalRadiation.map((day) => {
    cumulativeRadiation += day.radiationMj
    return {
      date: day.date,
      cumulativeRadiationMj: Math.round(cumulativeRadiation * 10) / 10,
    }
  })
  let cumulativeRain = 0
  const rainfallCumulative = historicalRainfall.map((day) => {
    cumulativeRain += day.precipitationMm
    return {
      date: day.date,
      cumulativeMm: Math.round(cumulativeRain * 10) / 10,
    }
  })
  const currentGDD = historicalCumulative[historicalCumulative.length - 1]?.cumulativeGDD ?? 0
  const targetGDD = selectedCrop ? getTargetGDDForCrop(selectedCrop.name, selectedCrop.variety) : 1000
  const normalTable =
    canFetchWeather
      ? await getLocationDailyNormals({
          latitude: Number(point.latitude),
          longitude: Number(point.longitude),
        })
      : undefined
  const normalSeries =
    normalTable && selectedCrop?.plantingDate
      ? accumulateNormals({
          normals: normalTable,
          plantingDate: new Date(selectedCrop.plantingDate),
          days: 220,
          baseTemp,
        })
      : null
  const daysFromPlanting =
    selectedCrop?.plantingDate != null
      ? Math.floor((today.getTime() - new Date(selectedCrop.plantingDate).getTime()) / (24 * 60 * 60 * 1000))
      : 0
  const projection =
    selectedCrop && selectedCrop.plantingDate && canFetchWeather
      ? computeGDDProjection(
          currentGDD,
          baseTemp,
          forecastTemps,
          targetGDD
        )
      : null
  const heavyRainDays = forecastRainfall.filter((d) => d.precipitationMm >= 20)

  const previousSeason =
    selectedCrop?.plantingDate != null
      ? await getPreviousSeasonWeather({
          cropId: selectedCrop.id,
          name: selectedCrop.name,
          variety: selectedCrop.variety,
          farmId: selectedCrop.farmId,
          plantingDate: new Date(selectedCrop.plantingDate),
          latitude: selectedCrop.farm?.latitude ?? null,
          longitude: selectedCrop.farm?.longitude ?? null,
          baseTemperature: baseTemp,
        })
      : null

  const lastYearShortLabel = previousSeason
    ? `${previousSeason.plantingDate.getFullYear()}年作${previousSeason.source === 'demo' ? '・仮' : ''}`
    : null

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page gdd-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <h1 className="farms-title">生育ナビ</h1>
            <p className="farms-subtitle">
              栽培中の作付けについて、積算温度（GDD）・雨量・日射の進捗を確認できます
            </p>
          </div>
          <div className="insights-header-actions">
            <Link href="/dashboard/ai-proposal" className="btn btn-primary farms-add-button">
              今日の提案
            </Link>
            <Link href="/insights" className="btn btn-outline farms-add-button">
              分析・振り返り
            </Link>
            <Link href="/gdd/past" className="btn btn-outline farms-add-button">
              過去の生育データ
            </Link>
            <Link href="/crops" className="btn btn-outline farms-add-button">
              作物一覧
            </Link>
          </div>
        </div>

        <div className="calendar-page-content">
          {viewingPastCrop && selectedCrop && (
            <div className="card gdd-past-banner">
              <p className="gdd-past-banner-text">
                過去の生育データ「{selectedCrop.name}
                {selectedCrop.variety ? `（${selectedCrop.variety}）` : ''}
                」の生育データを表示しています。日常の進捗確認は栽培中の作物を選んでください。
              </p>
              <div className="gdd-past-banner-actions">
                <Link href="/gdd/past" className="btn btn-outline farms-add-button">
                  過去の生育データ一覧へ
                </Link>
                {growingWithPlanting[0] && (
                  <Link
                    href={`/gdd?cropId=${growingWithPlanting[0].id}`}
                    className="btn btn-primary farms-add-button"
                  >
                    栽培中の作物へ
                  </Link>
                )}
              </div>
            </div>
          )}

          <GDDCropList
            crops={crops.map((c) => ({
              id: c.id,
              name: c.name,
              variety: c.variety,
              plantingDate: c.plantingDate,
              harvestDate: c.harvestDate,
              status: c.status,
              baseTemperature: c.baseTemperature,
              farm: c.farm ? { name: c.farm.name } : null,
            }))}
            selectedCropId={selectedCrop?.id}
          />

          <ScrollToGddDetail cropId={selectedCropId} />
          <div id="gdd-detail">
          <GDDChart
            crop={
              selectedCrop
                ? {
                    id: selectedCrop.id,
                    name: selectedCrop.name,
                    variety: selectedCrop.variety,
                    plantingDate: selectedCrop.plantingDate,
                    baseTemperature: selectedCrop.baseTemperature,
                  }
                : undefined
            }
            currentGDD={currentGDD}
            targetGDD={targetGDD}
            daysFromPlanting={daysFromPlanting}
            historicalPoints={historicalCumulative}
            dailyProjections={projection?.dailyProjections.map((p) => ({ date: p.date, cumulativeGDD: p.cumulativeGDD })) ?? []}
            lastYearPoints={previousSeason?.gdd ?? []}
            lastYearLabel={lastYearShortLabel}
            normalGddByDay={canFetchWeather ? normalSeries?.gdd ?? null : undefined}
          />

          {selectedCrop && canFetchWeather && (
            <RainfallDataCard
              cropName={`${selectedCrop.name}${selectedCrop.variety ? `（${selectedCrop.variety}）` : ''}`}
              daysFromPlanting={daysFromPlanting}
              currentCumulativeMm={rainfallCumulative[rainfallCumulative.length - 1]?.cumulativeMm ?? 0}
              normalCumulativeMm={normalSeries?.precipMm ?? null}
              historicalPoints={rainfallCumulative}
              rainyDays={heavyRainDays.map((d) => ({ dayLabel: d.dayLabel, precipitationMm: d.precipitationMm }))}
              lastYearPoints={previousSeason?.rain ?? []}
              lastYearLabel={lastYearShortLabel}
            />
          )}

          <SunshineChart
            crop={
              selectedCrop
                ? {
                    id: selectedCrop.id,
                    name: selectedCrop.name,
                    variety: selectedCrop.variety,
                    plantingDate: selectedCrop.plantingDate,
                  }
                : undefined
            }
            daysFromPlanting={daysFromPlanting}
            historicalPoints={radiationCumulative}
            lastYearPoints={previousSeason?.radiation ?? []}
            lastYearLabel={lastYearShortLabel}
            normalCumulativeMj={canFetchWeather ? normalSeries?.radiationMj ?? null : undefined}
          />
          </div>
        </div>
      </main>
    </div>
  )
}
