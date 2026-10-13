import { prisma } from '../lib/prisma'
import { parseDailyPage } from '../lib/jma/parse'
import { loadStationCatalog, pickNearestStation, type JmaStation } from '../lib/jma/stations'
import { archiveYears } from '../lib/jma/frost-record'
import { JMA_FETCH_GAP_MS } from '../lib/jma/thresholds'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function monthsThroughPrevious(today = new Date()): { year: number; month: number }[] {
  const end = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const { fromYear } = archiveYears(today)
  const months: { year: number; month: number }[] = []
  for (let year = fromYear; year <= end.getFullYear(); year++) {
    const last = year === end.getFullYear() ? end.getMonth() + 1 : 12
    for (let month = 1; month <= last; month++) months.push({ year, month })
  }
  return months
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Tillto/daily-temps' } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.text()
}

async function fetchMonth(station: JmaStation, year: number, month: number) {
  const page = station.kind === 's' ? 'daily_s1.php' : 'daily_a1.php'
  const url = `https://www.data.jma.go.jp/stats/etrn/view/${page}?prec_no=${station.precNo}&block_no=${station.blockNo}&year=${year}&month=${month}&day=&view=`
  await sleep(JMA_FETCH_GAP_MS)
  const html = await fetchText(url)
  const days = parseDailyPage(html, year, month)
  if (days.length === 0) throw new Error(`no days parsed ${station.name} ${year}-${month}`)
  const missing = days.filter((day) => day.tMin == null).length
  for (const day of days) {
    await prisma.jmaDailyTemp.upsert({
      where: { blockNo_date: { blockNo: station.blockNo, date: day.date } },
      create: { blockNo: station.blockNo, date: day.date, tMean: day.tMean, tMax: day.tMax, tMin: day.tMin },
      update: { tMean: day.tMean, tMax: day.tMax, tMin: day.tMin },
    })
  }
  await prisma.jmaMonthFetch.upsert({
    where: { blockNo_year_month: { blockNo: station.blockNo, year, month } },
    create: { blockNo: station.blockNo, year, month },
    update: { fetchedAt: new Date() },
  })
  console.log(`${station.name} ${year}-${month} days ${days.length} missing-min ${missing}`)
}

async function stationsToFetch(): Promise<JmaStation[]> {
  const extra = process.argv.slice(2)
  const catalog = loadStationCatalog()
  const chosen = new Map<string, JmaStation>()
  for (const blockNo of extra) {
    const station = catalog.stations.find((row) => row.blockNo === blockNo)
    if (!station) throw new Error(`unknown block ${blockNo}`)
    chosen.set(station.blockNo, station)
  }
  const farms = await prisma.farm.findMany({
    where: { latitude: { not: null }, longitude: { not: null } },
    select: { name: true, latitude: true, longitude: true },
  })
  for (const farm of farms) {
    const pick = pickNearestStation(Number(farm.latitude), Number(farm.longitude), null)
    if (!pick) continue
    console.log(`${farm.name} -> ${pick.station.name} ${pick.distanceKm.toFixed(1)}km usable ${pick.usable}`)
    if (pick.usable) chosen.set(pick.station.blockNo, pick.station)
  }
  return [...chosen.values()]
}

async function main() {
  const args = process.argv.slice(2)
  if (args[0] === '--one') {
    const catalog = loadStationCatalog()
    const station = catalog.stations.find((row) => row.blockNo === args[1])
    if (!station) throw new Error(`unknown block ${args[1]}`)
    await fetchMonth(station, Number(args[2]), Number(args[3]))
    console.log('fetched pages 1')
    return
  }
  const stations = await stationsToFetch()
  const months = monthsThroughPrevious()
  let fetched = 0
  for (const station of stations) {
    const done = await prisma.jmaMonthFetch.findMany({
      where: { blockNo: station.blockNo },
      select: { year: true, month: true },
    })
    const have = new Set(done.map((row) => `${row.year}-${row.month}`))
    for (const month of months) {
      if (have.has(`${month.year}-${month.month}`)) continue
      await fetchMonth(station, month.year, month.month)
      fetched += 1
    }
  }
  console.log(`fetched pages ${fetched}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
