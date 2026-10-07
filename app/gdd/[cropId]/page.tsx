import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCropWhere } from '@/lib/queries'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import GDDChart from '@/components/GDDChart'
import RainfallDataCard from '@/components/RainfallDataCard'
import SunshineChart from '@/components/SunshineChart'
import { getForecastDailyPrecipitation, getForecastDailyTemps, getHistoricalDailyPrecipitation, getHistoricalDailyRadiation, getHistoricalDailyTemps, hasWeatherCoordinates } from '@/lib/weather-forecast'
import { computeGDDProjection } from '@/lib/gdd'
import { loadHarvestSamples, pickHarvestBasis } from '@/lib/insights/harvest-gdd-basis'
import { getPreviousSeasonWeather } from '@/lib/insights/previous-season-weather'
import { accumulateNormals, getLocationDailyNormals, loadLocationArchive } from '@/lib/weather-normals'
import {
  forecastAvgByDate,
  formatHarvestWindow,
  projectHarvestWindow,
} from '@/lib/insights/harvest-date-window'

function cropLabel(name: string, variety: string | null): string {
  return variety ? `${name}（${variety}）` : name
}

export default async function GddCropPage({
  params,
}: {
  params: Promise<{ cropId: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const { cropId } = await params
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

  const cropsWithPlanting = crops.filter((c) => c.plantingDate != null)
  const growing = crops.filter((c) => c.status === 'growing')
  const growingWithPlanting = cropsWithPlanting.filter((c) => c.status === 'growing')
  const selectedCrop = cropsWithPlanting.find((c) => c.id === cropId) ?? null
  if (!selectedCrop) redirect('/gdd')

  const viewingPastCrop = selectedCrop.status !== 'growing'
  const onlyGrowing = growing.length === 1 && !viewingPastCrop

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const point = {
    latitude: selectedCrop.farm?.latitude ?? null,
    longitude: selectedCrop.farm?.longitude ?? null,
  }
  const canFetchWeather = hasWeatherCoordinates(point)
  const forecastTempsRaw = canFetchWeather
    ? await getForecastDailyTemps(today, { latitude: Number(point.latitude), longitude: Number(point.longitude) })
    : []
  const forecastTemps = forecastTempsRaw.filter((d) => d.date.getTime() > today.getTime())
  const baseTemp = selectedCrop.baseTemperature ?? 10
  const historicalTemps = canFetchWeather
    ? await getHistoricalDailyTemps({
        startDate: new Date(selectedCrop.plantingDate!),
        endDate: today,
        point: { latitude: Number(point.latitude), longitude: Number(point.longitude) },
      })
    : []
  const historicalRadiation = canFetchWeather
    ? await getHistoricalDailyRadiation({
        startDate: new Date(selectedCrop.plantingDate!),
        endDate: today,
        point: { latitude: Number(point.latitude), longitude: Number(point.longitude) },
      })
    : []
  const historicalRainfall = canFetchWeather
    ? await getHistoricalDailyPrecipitation({
        startDate: new Date(selectedCrop.plantingDate!),
        endDate: today,
        point: { latitude: Number(point.latitude), longitude: Number(point.longitude) },
      })
    : []
  const forecastRainfall = canFetchWeather
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
  const harvestSamples = await loadHarvestSamples(user.id)
  const harvestBasis = pickHarvestBasis(harvestSamples, selectedCrop.name, selectedCrop.variety)
  const targetGDD = harvestBasis.gdd
  const weatherPoint = canFetchWeather
    ? { latitude: Number(point.latitude), longitude: Number(point.longitude) }
    : null
  const [normalTable, archive] = await Promise.all([
    weatherPoint ? getLocationDailyNormals(weatherPoint) : Promise.resolve(undefined),
    weatherPoint ? loadLocationArchive(weatherPoint) : Promise.resolve(null),
  ])
  const normalSeries =
    normalTable && selectedCrop.plantingDate
      ? accumulateNormals({
          normals: normalTable,
          plantingDate: new Date(selectedCrop.plantingDate),
          days: 220,
          baseTemp,
        })
      : null
  const daysFromPlanting = Math.floor(
    (today.getTime() - new Date(selectedCrop.plantingDate!).getTime()) / (24 * 60 * 60 * 1000)
  )
  const provisionalTarget = harvestBasis.source === 'provisional'
  const harvestWindow =
    archive && targetGDD > 0
      ? projectHarvestWindow({
          today,
          currentGdd: currentGDD,
          targetGdd: targetGDD,
          baseTemp,
          archive,
          forecastByYmd: forecastAvgByDate(forecastTemps),
        })
      : null
  const projection = canFetchWeather
    ? computeGDDProjection(currentGDD, baseTemp, forecastTemps, targetGDD, {
        harvestWindowText:
          harvestWindow && currentGDD < targetGDD
            ? formatHarvestWindow(harvestWindow, { provisional: provisionalTarget })
            : null,
        seasonUnreachable: Boolean(archive) && !harvestWindow && currentGDD < targetGDD,
      })
    : null
  const heavyRainDays = forecastRainfall.filter((d) => d.precipitationMm >= 20)
  const previousSeason = await getPreviousSeasonWeather({
    cropId: selectedCrop.id,
    name: selectedCrop.name,
    variety: selectedCrop.variety,
    farmId: selectedCrop.farmId,
    plantingDate: new Date(selectedCrop.plantingDate!),
    latitude: selectedCrop.farm?.latitude ?? null,
    longitude: selectedCrop.farm?.longitude ?? null,
    baseTemperature: baseTemp,
  })
  const lastYearShortLabel = previousSeason
    ? `${previousSeason.plantingDate.getFullYear()}年作${previousSeason.source === 'demo' ? '・仮' : ''}`
    : null
  const title = cropLabel(selectedCrop.name, selectedCrop.variety)

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page gdd-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <p className="gdd-breadcrumb">
              {onlyGrowing ? (
                <span>生育ナビ</span>
              ) : (
                <Link href="/gdd" className="gdd-breadcrumb-link">
                  生育ナビ
                </Link>
              )}
              <span className="gdd-breadcrumb-sep">/</span>
              <span>{title}</span>
            </p>
            <h1 className="farms-title">{title}</h1>
            <p className="farms-subtitle">
              積算温度（GDD）・雨量・日射の進捗を確認できます
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
          {viewingPastCrop && (
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
                  <Link href="/gdd" className="btn btn-primary farms-add-button">
                    栽培中の作物へ
                  </Link>
                )}
              </div>
            </div>
          )}

          <GDDChart
            crop={{
              id: selectedCrop.id,
              name: selectedCrop.name,
              variety: selectedCrop.variety,
              plantingDate: selectedCrop.plantingDate,
              baseTemperature: selectedCrop.baseTemperature,
            }}
            currentGDD={currentGDD}
            targetGDD={targetGDD}
            targetCaption={harvestBasis.summary}
            daysFromPlanting={daysFromPlanting}
            historicalPoints={historicalCumulative}
            dailyProjections={projection?.dailyProjections.map((p) => ({ date: p.date, cumulativeGDD: p.cumulativeGDD })) ?? []}
            lastYearPoints={previousSeason?.gdd ?? []}
            lastYearLabel={lastYearShortLabel}
            normalGddByDay={canFetchWeather ? normalSeries?.gdd ?? null : undefined}
          />
          {projection?.suggestions[0] ? (
            <p className="dashboard-gdd-summary-text">
              {projection.suggestions[0].replace(/<\/?strong>/g, '')}
            </p>
          ) : null}

          {canFetchWeather && (
            <RainfallDataCard
              cropName={title}
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
            crop={{
              id: selectedCrop.id,
              name: selectedCrop.name,
              variety: selectedCrop.variety,
              plantingDate: selectedCrop.plantingDate,
            }}
            daysFromPlanting={daysFromPlanting}
            historicalPoints={radiationCumulative}
            lastYearPoints={previousSeason?.radiation ?? []}
            lastYearLabel={lastYearShortLabel}
            normalCumulativeMj={canFetchWeather ? normalSeries?.radiationMj ?? null : undefined}
          />
        </div>
      </main>
    </div>
  )
}
