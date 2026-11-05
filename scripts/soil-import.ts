import { mkdir, open, unlink } from 'node:fs/promises'
import path from 'node:path'
import { PREFECTURES } from '../lib/places/catalog'
import { DEFAULT_SOIL_ROOT } from '../lib/soil-map/storage'
import { importSoilMaps } from './soil-map/import'

async function main() {
  const flags = new Map<string, string>()
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i += 2) {
    if (!['--pref', '--zip50', '--zip200', '--root'].includes(args[i]) || !args[i + 1]) throw new Error('soil:import -- --pref 12 [--zip50 原本.zip --zip200 原本.zip] [--root 保存先]')
    flags.set(args[i], args[i + 1])
  }
  const pref = (flags.get('--pref') ?? '').padStart(2, '0')
  const prefecture = PREFECTURES.find(p => p.code === pref)
  if (!prefecture) throw new Error('県番号を01〜47で指定してください')
  const root = path.resolve(flags.get('--root') ?? DEFAULT_SOIL_ROOT)
  await mkdir(root, { recursive: true })
  const lockPath = path.join(root, '.import.lock')
  const lock = await open(lockPath, 'wx')
  try {
    const name = prefecture.name
    const shortName = name.replace(/[都府県]$/, '')
    const result = await importSoilMaps({ root, prefecture: pref, sources: {
      '50000': { url: `https://soil-inventory.rad.naro.go.jp/download/Shape5/${encodeURIComponent(name)}.zip`, localZip: flags.get('--zip50') },
      '200000': { url: `https://soil-inventory.rad.naro.go.jp/download/Shape20/${encodeURIComponent(shortName + '_20')}.zip`, localZip: flags.get('--zip200') },
    } })
    console.log(JSON.stringify({ datasetId: result.datasetId, prefecture: pref, layers: result.manifest.layers }, null, 2))
  } finally { await lock.close(); await unlink(lockPath) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
