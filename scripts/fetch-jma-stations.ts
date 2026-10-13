import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { parseStationPage } from '../lib/jma/parse'
import { JMA_FETCH_GAP_MS, JMA_STATION_LIST_SOURCE } from '../lib/jma/thresholds'
import type { JmaStation } from '../lib/jma/stations'

const INDEX_URL = 'https://www.data.jma.go.jp/stats/etrn/select/prefecture00.php'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Tillto/station-list' } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.text()
}

async function main() {
  const index = await fetchText(INDEX_URL)
  const precNos = [...index.matchAll(/prefecture\.php\?prec_no=(\d+)/g)].map((match) => Number(match[1]))
  const unique = [...new Set(precNos)]
  console.log(`prefectures ${unique.length}`)
  const stations: JmaStation[] = []
  for (const precNo of unique) {
    await sleep(JMA_FETCH_GAP_MS)
    const html = await fetchText(`https://www.data.jma.go.jp/stats/etrn/select/prefecture.php?prec_no=${precNo}`)
    const found = parseStationPage(html, precNo)
    stations.push(...found)
    console.log(`prec ${precNo} stations ${found.length}`)
  }
  const out = {
    fetchedOn: new Date().toLocaleDateString('sv-SE'),
    sourceUrl: JMA_STATION_LIST_SOURCE,
    stations,
  }
  const file = path.join(process.cwd(), 'data', 'jma-stations.json')
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(out))
  console.log(`wrote ${stations.length} -> ${file}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
