import assert from 'node:assert/strict'
import { test } from 'node:test'
import { farmElevationM } from '@/lib/jma/elevation'
import { loadDailyWeather, weatherLocation } from '@/lib/open-meteo/archive'
import { japanDateKey } from '@/lib/pesticide-safety'
import { prisma } from '@/lib/prisma'
import { getForecastDailyPrecipitation, getForecastDays } from '@/lib/weather-forecast'

test('Open-Meteoの応答本文が時間切れになったときも取得失敗として扱う', async (t) => {
  const point = { latitude: 35, longitude: 139 }
  const day = japanDateKey(new Date())
  const saved = {
    location: weatherLocation(point), date: day, fetchedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    tempMean: 15, tempMax: 19, tempMin: 11, precip: 0, radiation: 1, sunshine: 2,
  }

  const daily = prisma.openMeteoDaily
  const elevation = prisma.openMeteoElevation
  const { findMany } = daily
  const { findUnique, upsert } = elevation
  const transaction = prisma.$transaction
  t.after(() => {
    daily.findMany = findMany
    elevation.findUnique = findUnique
    elevation.upsert = upsert
    prisma.$transaction = transaction
  })
  const archiveWrite = t.mock.fn(async () => [])
  const elevationWrite = t.mock.fn(async () => null)
  daily.findMany = (async () => [saved]) as unknown as typeof daily.findMany
  elevation.findUnique = (async () => null) as unknown as typeof elevation.findUnique
  elevation.upsert = elevationWrite as unknown as typeof elevation.upsert
  prisma.$transaction = archiveWrite as unknown as typeof prisma.$transaction
  t.mock.method(console, 'info', () => {})
  t.mock.method(console, 'warn', () => {})
  t.mock.method(console, 'error', () => {})

  const timeouts: number[] = []
  t.mock.method(AbortSignal, 'timeout', (milliseconds: number) => {
    timeouts.push(milliseconds)
    const controller = new AbortController()
    setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), 5)
    return controller.signal
  })
  const paths: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    paths.push(new URL(url).pathname)
    const signal = options.signal
    assert.ok(signal)
    return new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        signal.addEventListener('abort', () => controller.error(signal.reason), { once: true })
      },
    }))
  })

  assert.deepEqual(await getForecastDays(point), [])
  assert.deepEqual(await getForecastDailyPrecipitation(point), [])
  assert.deepEqual(await loadDailyWeather(point, day, day), [saved])
  assert.equal(await farmElevationM(point.latitude, point.longitude), null)
  assert.deepEqual(paths, ['/v1/forecast', '/v1/forecast', '/v1/archive', '/v1/elevation'])
  assert.deepEqual(timeouts, [10_000, 10_000, 10_000, 10_000])
  assert.equal(archiveWrite.mock.callCount(), 0)
  assert.equal(elevationWrite.mock.callCount(), 0)

  const before = Date.now()
  const now = t.mock.method(Date, 'now', () => before + 59 * 60 * 1000)
  assert.deepEqual(await loadDailyWeather(point, day, day), [saved])
  assert.equal(await farmElevationM(point.latitude, point.longitude), null)
  assert.equal(paths.length, 4)
  now.mock.mockImplementation(() => before + 61 * 60 * 1000)
  assert.deepEqual(await loadDailyWeather(point, day, day), [saved])
  assert.equal(await farmElevationM(point.latitude, point.longitude), null)
  assert.equal(paths.length, 6)
})
