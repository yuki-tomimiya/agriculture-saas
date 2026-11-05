/** 保存形式だけを定義する。土壌コードの意味づけはここでは行わない。 */
export const FORMAT_VERSION = 1 as const
export const COORDINATE_POLICY = 'wgs84-as-jgd2000-approx-v1'
export type Scale = '50000' | '200000'
export type Bbox = [number, number, number, number]
export type Geometry = { type: 'Polygon'; coordinates: number[][][] } |
  { type: 'MultiPolygon'; coordinates: number[][][][] }
export type RawProperties = Record<string, string | number | boolean | null>
export type SoilFeature = {
  id: string
  geometry: Geometry
  properties: RawProperties
  codes: { group: string | null; subgroup: string | null; series: string | null }
  soilName: string | null
  landUse: string | null
  codeConflict: boolean
}
export type IndexEntry = { id: string; bbox: Bbox; offset: number; length: number }
export type SoilIndex = {
  formatVersion: number; datasetId: string; prefecture: string; scale: Scale
  bbox: Bbox; entries: IndexEntry[]
}
export type FileDigest = { bytes: number; sha256: string }
export type LayerManifest = {
  scale: Scale; sourceUrl: string; fetchedAt: string; zipSha256: string
  sourceCrs: string; sourcePrj: string; encoding: string
  count: number; codeConflictCount: number; bbox: Bbox
  index: FileDigest; features: FileDigest
}
export type Manifest = {
  formatVersion: number; generatorVersion: string; datasetId: string; prefecture: string
  createdAt: string; coordinatePolicy: string
  attribution: string; license: string; licenseUrl: string; processing: string
  layers: Record<Scale, LayerManifest>
}
export type ActiveCatalog = { formatVersion: number; prefectures: Record<string, string> }

export function safeId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(value)
}
export function validPref(value: unknown): value is string {
  return typeof value === 'string' && /^(0[1-9]|[1-3][0-9]|4[0-7])$/.test(value)
}
export function validBbox(box: unknown): box is Bbox {
  return Array.isArray(box) && box.length === 4 && box.every(Number.isFinite) &&
    box[0] >= -180 && box[2] <= 180 && box[1] >= -90 && box[3] <= 90 &&
    box[0] <= box[2] && box[1] <= box[3]
}
export function contains(box: Bbox, lon: number, lat: number): boolean {
  return lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3]
}
export function geometryBbox(geometry: Geometry): Bbox {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) throw new Error('Polygon以外の形状')
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const box: Bbox = [180, 90, -180, -90]
  if (!polygons.length) throw new Error('空の形状')
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || !polygon.length) throw new Error('空のpolygon')
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) throw new Error('不正なring')
      for (const point of ring) {
        if (!Array.isArray(point) || point.length !== 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) ||
          Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) throw new Error('不正な経緯度')
        box[0] = Math.min(box[0], point[0]); box[1] = Math.min(box[1], point[1])
        box[2] = Math.max(box[2], point[0]); box[3] = Math.max(box[3], point[1])
      }
      const last = ring[ring.length - 1]
      if (ring[0][0] !== last[0] || ring[0][1] !== last[1]) throw new Error('閉じていないring')
    }
  }
  return box
}
export function unionBoxes(boxes: Bbox[]): Bbox {
  if (!boxes.length) throw new Error('区画がありません')
  return boxes.reduce<Bbox>((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]),
    Math.max(a[2], b[2]), Math.max(a[3], b[3])], [...boxes[0]])
}
function stringValue(value: unknown): string | null {
  return value == null ? null : String(value)
}
export function rawFeature(id: string, geometry: Geometry, properties: RawProperties, scale: Scale): SoilFeature {
  const codes = scale === '50000'
    ? { group: stringValue(properties['群コード']), subgroup: stringValue(properties['亜群コード']), series: stringValue(properties['統群コード']) }
    : { group: stringValue(properties.SG_CD), subgroup: stringValue(properties.SSbG_CD), series: stringValue(properties.SSerGrCD) }
  // 原値は保持。空白以外の補正・別名の当てはめは後続の対応表で行う。
  const [group, subgroup, series] = [codes.group, codes.subgroup, codes.series].map(v => v?.replace(/\s/g, '') ?? '')
  const codeConflict = Boolean((group && subgroup && !subgroup.startsWith(group)) ||
    (group && series && !series.startsWith(group)) || (subgroup && series && !series.startsWith(subgroup)))
  return { id, geometry, properties, codes, codeConflict,
    soilName: stringValue(scale === '50000' ? properties['包括_統群'] : properties.SoilName),
    landUse: stringValue(properties['地目区分']) }
}
