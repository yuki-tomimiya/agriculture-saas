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
import { computeGDDProjection, describeForecastCoverage, formatHarvestGddOutlook } from '@/lib/gdd'
import { dailyHeat, displayHeat, gddStartDate, type ActiveDayMethod, type ActiveGddMethod } from '@/lib/benchmarks/gdd-methods'
import { cropHeatEndDate, loadHarvestSamples, pickHarvestBasis } from '@/lib/insights/harvest-gdd-basis'
import { getPreviousSeasonWeather } from '@/lib/insights/previous-season-weather'
import { accumulateNormals, getLocationDailyNormals, loadLocationArchive } from '@/lib/weather-normals'
import { FORECAST_HEAVY_RAIN_MM } from '@/lib/weather-thresholds'
import {
  forecastAvgByDate,
  formatHarvestWindow,
  calculateHarvestWindow,
} from '@/lib/insights/harvest-date-window'
function cropLabel(name: string, variety: string | null): string {
  return variety ? `${name}（${variety}）` : name
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function formatMonthDay(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function calendarDaysBetween(start: Date, end: Date): number {
  const from = new Date(start)
  from.setHours(0, 0, 0, 0)
  const to = new Date(end)
  to.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)))
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
  const include = {
    farm: true,
    milestones: { select: { key: true, observedAt: true } },
    harvests: { orderBy: { date: 'asc' }, select: { date: true } },
  } as const
  const crops = await prisma.crop.findMany({
    where: cropWhere,
    include,
    orderBy: { name: 'asc' },
  }).catch(() =>
    prisma.crop.findMany({
      where: cropWhereFallback,
      include,
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

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const point = {
    latitude: selectedCrop.farm?.latitude ?? null,
    longitude: selectedCrop.farm?.longitude ?? null,
  }
  const weatherPoint = hasWeatherCoordinates(point)
    ? { latitude: Number(point.latitude), longitude: Number(point.longitude) }
    : null
  const forecastTemps = weatherPoint && !viewingPastCrop
    ? await getForecastDailyTemps(now, weatherPoint)
    : []
  const coverage = describeForecastCoverage(today, forecastTemps)
  const projectionLabel = coverage.complete ? '14日後見込み' :
    coverage.lastLabel ? `${coverage.lastLabel}までの取得できた日分` : undefined
  const harvestSamples = await loadHarvestSamples(user.id)
  const harvestBasis = pickHarvestBasis(harvestSamples, selectedCrop)
  const heat = displayHeat(harvestBasis.view)
  const activeMethod: ActiveGddMethod | null =
    harvestBasis.view.status === 'active' ? harvestBasis.view : null
  const dayMethod: ActiveDayMethod | null =
    harvestBasis.view.status === 'days' ? harvestBasis.view : null
  const historyEnd = viewingPastCrop ? cropHeatEndDate(selectedCrop, harvestBasis.view) : today
  const canFetchHistory = weatherPoint !== null && historyEnd !== null
  const plantingDate = new Date(selectedCrop.plantingDate!)
  const gddOriginDate = activeMethod
    ? gddStartDate(activeMethod, plantingDate)
    : plantingDate
  const hasPastGddMethod = !viewingPastCrop || (harvestBasis.view.status !== 'pending' && !dayMethod)
  const historicalTemps = canFetchHistory && hasPastGddMethod
    ? await getHistoricalDailyTemps({
        startDate: gddOriginDate,
        endDate: historyEnd,
        point: weatherPoint,
      })
    : []
  const historicalRadiation = canFetchHistory
    ? await getHistoricalDailyRadiation({
        startDate: plantingDate,
        endDate: historyEnd,
        point: weatherPoint,
      })
    : []
  const historicalRainfall = canFetchHistory
    ? await getHistoricalDailyPrecipitation({
        startDate: plantingDate,
        endDate: historyEnd,
        point: weatherPoint,
      })
    : []
  const forecastRainfall = weatherPoint && !viewingPastCrop
    ? await getForecastDailyPrecipitation(weatherPoint, now)
    : []
  let cumulativeGDD = 0
  const historicalCumulative = historicalTemps.map((day) => {
    cumulativeGDD += dailyHeat(day.avgTemp, heat.count, heat.baseTemp)
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
  const currentGDD = historicalCumulative.at(-1)?.cumulativeGDD ?? null
  const targetGDD = harvestBasis.gdd ?? 0
  const reference = activeMethod ? { sampleCount: harvestBasis.sampleCount, method: activeMethod } : undefined
  const [normalTable, archive] = await Promise.all([
    canFetchHistory ? getLocationDailyNormals(weatherPoint) : undefined,
    weatherPoint && !viewingPastCrop && activeMethod && currentGDD != null ? loadLocationArchive(weatherPoint) : null,
  ])
  const daysFromPlanting = historyEnd ? calendarDaysBetween(plantingDate, historyEnd) : 0
  const daysFromGddOrigin = historyEnd ? calendarDaysBetween(gddOriginDate, historyEnd) : 0
  const normalSeries =
    normalTable && selectedCrop.plantingDate
      ? accumulateNormals({
          normals: normalTable,
          plantingDate: new Date(selectedCrop.plantingDate),
          days: viewingPastCrop ? daysFromPlanting + 1 : 220,
          count: heat.count,
          baseTemp: heat.baseTemp,
        })
      : null
  const gddNormalSeries =
    normalTable && selectedCrop.plantingDate
      ? activeMethod?.startDate
        ? accumulateNormals({
            normals: normalTable,
            plantingDate: gddOriginDate,
            days: viewingPastCrop ? daysFromGddOrigin + 1 : 220,
            count: heat.count,
            baseTemp: heat.baseTemp,
          })
        : normalSeries
      : null
  const windowResult =
    !viewingPastCrop && currentGDD != null && activeMethod && archive && targetGDD > 0
      ? calculateHarvestWindow({
          today,
          currentGdd: currentGDD,
          targetGdd: targetGDD,
          count: heat.count,
          baseTemp: heat.baseTemp,
          archive,
          forecastByYmd: forecastAvgByDate(forecastTemps),
        })
      : null
  const harvestWindowText = windowResult?.status === 'projected' && currentGDD != null && currentGDD < targetGDD
    ? formatHarvestWindow(windowResult.window)
    : null
  const seasonUnreachable = windowResult?.status === 'unreachable'
  const harvestOutlook = currentGDD != null && (harvestWindowText || seasonUnreachable)
    ? formatHarvestGddOutlook({ currentGdd: currentGDD, targetGdd: targetGDD, reference, windowText: harvestWindowText })
    : null
  const projection = !viewingPastCrop && currentGDD != null && activeMethod && targetGDD > 0
    ? computeGDDProjection(currentGDD, heat.count, heat.baseTemp, forecastTemps, targetGDD, {
        harvestWindowText,
        seasonUnreachable,
        reference,
        today,
      })
    : null
  const heavyRainDays = forecastRainfall.filter((d) => d.precipitationMm >= FORECAST_HEAVY_RAIN_MM)
  const previousSeason = canFetchHistory ? await getPreviousSeasonWeather({
    userId: user.id,
    cropId: selectedCrop.id,
    name: selectedCrop.name,
    cropKind: selectedCrop.cropKind,
    variety: selectedCrop.variety,
    farmId: selectedCrop.farmId,
    growingSite: selectedCrop.growingSite,
    plantingDate: new Date(selectedCrop.plantingDate!),
    latitude: selectedCrop.farm?.latitude ?? null,
    longitude: selectedCrop.farm?.longitude ?? null,
    count: heat.count,
    baseTemp: heat.baseTemp,
  }) : null
  const gddUnavailable = !historyEnd
    ? '収穫日も収穫の記録もないため、作付けの終わりの日を決められません。積算温度は計算できません。'
    : !weatherPoint
      ? '農場の位置が未登録のため、積算温度は計算できません。'
      : !hasPastGddMethod
        ? 'この作付けは振り返りで積算温度を計算する条件を満たしていません。'
        : '日平均気温を取得できなかった日があるため、積算温度は計算できません。'
  const lastYearShortLabel = previousSeason
    ? `${previousSeason.plantingDate.getFullYear()}年作`
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

          {previousSeason?.plantingGapNote && (
            <p className="dashboard-gdd-summary-text">{previousSeason.plantingGapNote}。</p>
          )}
          {viewingPastCrop && historyEnd && (
            <p className="dashboard-gdd-summary-text">作付けの終わり（{formatMonthDay(historyEnd)}）までの記録を表示します。</p>
          )}
          {currentGDD == null ? <p className="dashboard-gdd-summary-text">{gddUnavailable}</p> : <GDDChart
            crop={{
              id: selectedCrop.id,
              name: selectedCrop.name,
              variety: selectedCrop.variety,
              plantingDate: gddOriginDate,
              baseTemperature: selectedCrop.baseTemperature,
            }}
            currentGDD={currentGDD}
            targetGDD={targetGDD}
            showHarvestTarget={!viewingPastCrop && activeMethod != null}
            harvestReference={reference}
            valueCaption={
              activeMethod || viewingPastCrop
                ? undefined
                : `現在：${currentGDD} ℃日（参考：植え付けから日平均気温をそのまま足したもの）`
            }
            daysFromPlanting={daysFromGddOrigin}
            originLabel={activeMethod?.originLabel}
            historicalPoints={historicalCumulative}
            dailyProjections={projection?.dailyProjections.map((p) => ({ date: p.date, cumulativeGDD: p.cumulativeGDD })) ?? []}
            projectionLabel={projectionLabel}
            lastYearPoints={activeMethod?.startDate ? [] : previousSeason?.gdd ?? []}
            lastYearLabel={lastYearShortLabel}
            normalGddByDay={gddNormalSeries?.gdd ?? null}
            viewingPastCrop={viewingPastCrop}
          />}
          <p className="dashboard-gdd-summary-text">
            {activeMethod
              ? `${activeMethod.countLabel}。目安は${activeMethod.rangeLabel}（${activeMethod.scopeLabel}）。`
              : dayMethod
                ? `${dayMethod.countLabel}。収穫の目安は${formatMonthDay(addDays(dayMethod.startDate, dayMethod.lowDays))}〜${formatMonthDay(addDays(dayMethod.startDate, dayMethod.highDays))}ごろです。`
              : harvestBasis.summary}
            {harvestBasis.source === 'variety' || harvestBasis.source === 'crop'
              ? ` ${harvestBasis.summary}。`
              : ''}
          </p>
          {activeMethod && (
            <p className="dashboard-gdd-summary-text">
              出典：{activeMethod.sourceLine}
            </p>
          )}
          {dayMethod && (
            <>
              <p className="dashboard-gdd-summary-text">
                {!viewingPastCrop && `今日は、ひげが出てから${calendarDaysBetween(dayMethod.startDate, today)}日目です。`}
                積算温度の目安の線は出しません。
              </p>
              <p className="dashboard-gdd-summary-text">出典：{dayMethod.sourceLine}</p>
            </>
          )}
          {harvestOutlook && (
            <p className="dashboard-gdd-summary-text">{harvestOutlook}</p>
          )}
          {!viewingPastCrop && activeMethod && currentGDD != null && currentGDD < targetGDD &&
            (!windowResult || windowResult.status === 'unavailable') && (
              <p className="dashboard-gdd-summary-text">過去の日平均気温が取れないため、収穫の見込みは計算できません。</p>
            )}
          {!viewingPastCrop && activeMethod && currentGDD != null && currentGDD >= activeMethod.low && (
            <p className="dashboard-gdd-summary-text">{activeMethod.reachBody}</p>
          )}

          {rainfallCumulative.length > 0 && historicalRainfall.length === daysFromPlanting + 1 && (
            <RainfallDataCard
              cropName={title}
              plantingDate={selectedCrop.plantingDate}
              daysFromPlanting={daysFromPlanting}
              currentCumulativeMm={cumulativeRain}
              normalCumulativeMm={normalSeries?.precipMm ?? null}
              historicalPoints={rainfallCumulative}
              rainyDays={heavyRainDays.map((d) => ({ dayLabel: d.dayLabel, precipitationMm: d.precipitationMm }))}
              lastYearPoints={previousSeason?.rain ?? []}
              lastYearLabel={lastYearShortLabel}
              periodEndLabel={viewingPastCrop && historyEnd ? formatMonthDay(historyEnd) : undefined}
            />
          )}

          {radiationCumulative.length > 0 && historicalRadiation.length === daysFromPlanting + 1 && <SunshineChart
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
            normalCumulativeMj={normalSeries?.radiationMj ?? null}
          />}
        </div>
      </main>
    </div>
  )
}
