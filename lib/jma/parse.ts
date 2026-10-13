import { dmsToDeg, type JmaStation } from '@/lib/jma/stations'

export type ParsedDaily = {
  date: string
  tMean: number | null
  tMax: number | null
  tMin: number | null
}

/** 地点選択ページの viewPoint(...) から、気温を観測中の地点だけ取る */
export function parseStationPage(html: string, precNo: number): JmaStation[] {
  const stations: JmaStation[] = []
  const re = /viewPoint\(([^)]*)\)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const args = [...match[1].matchAll(/'([^']*)'/g)].map((part) => part[1])
    if (args.length < 16) continue
    const [kind, blockNo, name, , latD, latM, lonD, lonM, height, , , fTem, , , , edY] = args
    if (fTem !== '1' || edY !== '9999') continue
    if (kind !== 's' && kind !== 'a') continue
    const lat = dmsToDeg(latD, latM)
    const lon = dmsToDeg(lonD, lonM)
    const elevationM = Number(height)
    if (!blockNo || !name || Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(elevationM)) continue
    stations.push({ precNo, kind, blockNo, name, lat, lon, elevationM })
  }
  const seen = new Set<string>()
  return stations.filter((station) => {
    const key = `${station.precNo}:${station.blockNo}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function stripTags(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, '')
    .replace(/\s+/g, '')
}

function headerCells(rowHtml: string): { text: string; rowspan: number; colspan: number }[] {
  const cells: { text: string; rowspan: number; colspan: number }[] = []
  const re = /<th\b([^>]*)>([\s\S]*?)<\/th>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(rowHtml))) {
    const attrs = match[1]
    const rowspan = Number(attrs.match(/rowspan="(\d+)"/i)?.[1] ?? 1)
    const colspan = Number(attrs.match(/colspan="(\d+)"/i)?.[1] ?? 1)
    cells.push({ text: stripTags(match[2]), rowspan, colspan })
  }
  return cells
}

/** 見出しの rowspan / colspan を広げ、列ごとのラベルを返す */
function headerColumns(tableHtml: string): string[][] {
  const rows = [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => row[1])
  const headerRows = rows.filter((row) => /<th\b/i.test(row) && !/class="data_/i.test(row))
  const grid: string[][] = []
  headerRows.forEach((rowHtml, rowIndex) => {
    const row = grid[rowIndex] ?? []
    grid[rowIndex] = row
    let col = 0
    for (const cell of headerCells(rowHtml)) {
      while (row[col] != null) col += 1
      for (let r = 0; r < cell.rowspan; r++) {
        const target = grid[rowIndex + r] ?? []
        grid[rowIndex + r] = target
        for (let c = 0; c < cell.colspan; c++) {
          if (target[col + c] == null) target[col + c] = cell.text
        }
      }
      col += cell.colspan
    }
  })
  const width = Math.max(0, ...grid.map((row) => row.length))
  const columns: string[][] = []
  for (let col = 0; col < width; col++) {
    columns.push(grid.map((row) => row[col] ?? '').filter((text) => text.length > 0))
  }
  return columns
}

function columnIndex(columns: string[][], group: string, label: string): number {
  return columns.findIndex(
    (labels) =>
      labels.some((text) => text.includes(group)) &&
      labels.some((text) => text === label || text.startsWith(`${label}(`))
  )
}

/** `)` は使い、`]` `×` `///` `#` 空は欠け。列の位置は見出しの「気温」「最低」から決める */
export function parseJmaNumber(raw: string): number | null {
  const text = stripTags(raw)
  if (!text || text === '--' || text.includes(']') || text.includes('×') || text.includes('///') || text.includes('#')) {
    return null
  }
  const match = text.match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const value = Number(match[0])
  return Number.isFinite(value) ? value : null
}

export function parseDailyPage(html: string, year: number, month: number): ParsedDaily[] {
  const table = html.match(/<table\b[^>]*id=['"]tablefix1['"][^>]*>([\s\S]*?)<\/table>/i)?.[1]
  if (!table) return []
  const columns = headerColumns(table)
  const meanCol = columnIndex(columns, '気温', '平均')
  const maxCol = columnIndex(columns, '気温', '最高')
  const minCol = columnIndex(columns, '気温', '最低')
  if (minCol < 1) return []
  const days: ParsedDaily[] = []
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => row[1])
  for (const row of rows) {
    const day = row.match(/day=\d+[^>]*>(\d+)</)?.[1]
    if (!day) continue
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1])
    const values = cells.slice(1)
    const date = `${year}-${String(month).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`
    days.push({
      date,
      tMean: meanCol >= 1 ? parseJmaNumber(values[meanCol - 1] ?? '') : null,
      tMax: maxCol >= 1 ? parseJmaNumber(values[maxCol - 1] ?? '') : null,
      tMin: minCol >= 1 ? parseJmaNumber(values[minCol - 1] ?? '') : null,
    })
  }
  return days
}
