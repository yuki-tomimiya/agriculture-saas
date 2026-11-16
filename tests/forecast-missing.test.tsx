import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import GDDChart from '@/components/GDDChart'
import WeatherForecast from '@/components/WeatherForecast'
import { describeForecastCoverage } from '@/lib/gdd'
import { forecastAvgByDate, projectHarvestWindow, ymdKey } from '@/lib/insights/harvest-date-window'
import { assessSpringLateFrost, assessSweetPotatoFrost } from '@/lib/proposals/frost'
import { getForecastDailyPrecipitation, getForecastDailyTemps, getForecastDays, type ForecastDay } from '@/lib/weather-forecast'
import { summarizeAutumnFirstFrost, summarizeSpringLastFrost } from '@/lib/weather-frost'

Object.assign(globalThis, { React })
const farm = { latitude: 36.5551, longitude: 139.8828 }

test('予報は今日から14日先まで取得し、欠測と丸め前の値をそのまま返す', async t => {
  const now = new Date('2026-12-16T12:00:00+09:00')
  const time = Array.from({ length: 16 }, (_, index) => `2026-12-${16 + index}`)
  const missing = new Set([1])
  const min = time.map((_, index) => missing.has(index) ? null : index === 2 ? 4.04 : 5)
  const mean = time.map((_, index) => index === 14 ? 30 : index === 0 || index === 15 ? 100 : 0)
  const fetch = t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    assert.equal(url.searchParams.get('latitude'), '36.5551')
    assert.equal(url.searchParams.get('start_date'), '2026-12-16')
    assert.equal(url.searchParams.get('end_date'), '2026-12-30')
    return new Response(JSON.stringify({ daily: {
      time, temperature_2m_min: min, temperature_2m_mean: mean, temperature_2m_max: [null, '不明', 10.04],
      precipitation_probability_max: [null, 54.99, 55], windspeed_10m_max: [null, 9.99, 10],
      precipitation_sum: [null, 19.99, 20],
    } }))
  })
  const days = await getForecastDays(farm, now)
  assert.equal(days.length, 15)
  assert.equal(days[0].wind, null)
  assert.equal(days[0].precipitation, null)
  assert.equal(days[1].minTemp, null)
  assert.equal(days[1].maxTemp, null)
  assert.equal(days[1].precipitation, 54.99)
  assert.equal(days[1].wind, 9.99)
  assert.equal(days[2].minTemp, 4.04)
  assert.equal(assessSweetPotatoFrost({
    today: now, forecast: days, firstFrost: null, currentGdd: 2370, targetGdd: 2400,
    hasSeenRoots: false, harvestWindow: null, harvestWindowReady: false,
  }), null)
  const frost = assessSweetPotatoFrost({
    today: now, forecast: [...days.slice(0, -1), { ...days.at(-1)!, minTemp: 4 }], firstFrost: null,
    currentGdd: 2370, targetGdd: 2400, hasSeenRoots: false, harvestWindow: null, harvestWindowReady: false,
  })
  assert.equal(frost?.deadline, '2026-12-30')
  const temps = await getForecastDailyTemps(now, farm)
  assert.equal(temps.length, 14)
  assert.equal(ymdKey(temps[0].date), '2026-12-17')
  assert.equal(ymdKey(temps.at(-1)!.date), '2026-12-30')
  const rain = await getForecastDailyPrecipitation(farm, now)
  assert.deepEqual(rain.map(row => row.precipitationMm), [19.99, 20])
  assert.equal(fetch.mock.callCount(), 3)

  const forecast = forecastAvgByDate(temps)
  forecast.set('2026-12-16', 100)
  forecast.set('2026-12-31', 100)
  const window = (forecastByYmd: Map<string, number>) => projectHarvestWindow({
    today: now, currentGdd: 2370, targetGdd: 2400, count: 'simple', baseTemp: 0, forecastByYmd,
    archive: { times: ['2025-12-30', '2025-12-31'], tempMean: [10, 20], tempMin: null, tempMax: null,
      precip: [null, null], radiation: [null, null] },
  })
  assert.equal(ymdKey(window(forecast)!.early), '2026-12-30')
  forecast.delete('2026-12-30')
  assert.equal(ymdKey(window(forecast)!.early), '2026-12-31')
  // 15日目の予報100℃は使わない。その日の過去の値20℃では届かない。
  assert.equal(window(new Map([...forecast, ['2026-12-30', 1]])), null)
})

test('遅霜は欠測を除き、6月30日・4℃を含めて判定する', () => {
  const day = (date: string, minTemp: number | null): ForecastDay => ({
    date, minTemp, dayLabel: date, weather: '晴れ', weatherCode: 1, maxTemp: 15, avgTemp: 10,
    precipitation: null, wind: null,
  })
  const today = new Date(2026, 5, 28)
  const forecast = [day('2026-06-29', null), day('2026-06-30', 4.1), day('2026-07-01', 4)]
  assert.equal(assessSpringLateFrost({ today, forecast, potato: false }), null)
  forecast[1].minTemp = 4
  assert.equal(assessSpringLateFrost({ today, forecast, potato: false })?.deadline, '2026-06-30')
  assert.deepEqual(summarizeSpringLastFrost(['2016-02-29', '2020-02-29', '2024-02-29'], [4, 3, 0]), {
    mean: { month: 2, day: 29 }, latest: { month: 2, day: 29 }, years: 3,
  })
  assert.deepEqual(summarizeAutumnFirstFrost(['2024-11-10', '2025-11-14'], [4, 3]), {
    mean: { month: 11, day: 12 }, earliest: { month: 11, day: 10 }, years: 2,
  })
})

test('気象の欠けはダッシュで表示し、閾値の直前は強調しない', async t => {
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const first = new URL(String(input)).searchParams.get('start_date')!
    const second = new Date(Date.parse(first) + 86_400_000).toISOString().slice(0, 10)
    return new Response(JSON.stringify({ daily: {
      time: [first, second], windspeed_10m_max: [null, 9.99], precipitation_probability_max: [null, 54.99],
    } }))
  })
  const html = renderToStaticMarkup(await WeatherForecast(farm))
  assert.match(html, /降水 —/)
  assert.match(html, /風速 —/)
  assert.doesNotMatch(html, /dashboard-forecast-alert/)
})

test('グラフは欠けた日を詰めずに予報を日付の位置に置く', () => {
  const plantingDate = new Date(2026, 10, 10)
  const today = new Date(2026, 10, 16)
  const dailyProjections = [17, 19].map(day => ({ date: new Date(2026, 10, day), cumulativeGDD: day * 10 }))
  const coverage = describeForecastCoverage(today, dailyProjections)
  assert.deepEqual(coverage, { complete: false, lastLabel: '11月19日' })
  const html = renderToStaticMarkup(<GDDChart
    crop={{ id: 'test', name: 'テスト', variety: null, plantingDate, baseTemperature: null }}
    historicalPoints={[{ date: new Date(2026, 10, 14), cumulativeGDD: 80 }]}
    dailyProjections={dailyProjections}
    projectionLabel="11月19日までの取得できた日分"
  />)
  const path = html.match(/<polyline points="([^"]+)"[^>]*stroke-dasharray="4 3"/)?.[1]
  assert.ok(path)
  const days = path.split(' ').map(pair => Math.round((Number(pair.split(',')[0]) - 40) * 10 / 1872))
  assert.deepEqual(days, [4, 7, 9])
  assert.doesNotMatch(html, /14日後見込み/)
})
