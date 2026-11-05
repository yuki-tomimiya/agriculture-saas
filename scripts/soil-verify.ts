import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { DEFAULT_SOIL_ROOT, datasetDirectory, readCatalog, loadDataset } from '../lib/soil-map/storage'

async function main() {
  const args = process.argv.slice(2)
  if (args.length && (args.length !== 2 || args[0] !== '--root')) throw new Error('soil:verify [--root 保存先]')
  const root = path.resolve(args[1] ?? DEFAULT_SOIL_ROOT)
  const active = await readCatalog(root)
  if (!Object.keys(active.prefectures).length) throw new Error('配備された県がありません')
  for (const [pref, id] of Object.entries(active.prefectures)) {
    const directory = datasetDirectory(root, id, pref)
    const data = await loadDataset(directory, id, pref, true)
    for (const scale of ['50000', '200000'] as const) {
      const bytes = await readFile(path.join(directory, `${scale}.source.zip`))
      if (createHash('sha256').update(bytes).digest('hex') !== data.manifest.layers[scale].zipSha256) throw new Error('原本ZIPのハッシュが一致しません')
    }
    console.log(`${pref} ${id}: OK（索引・本体・原本ZIP・版・全区画のバイト位置）`)
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
