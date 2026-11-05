import type { Farm, Prisma, PrismaClient } from '@prisma/client'
import { createHash, randomUUID } from 'node:crypto'
import { lookupSoilMap, type SoilLookupResult } from '../soil-map/lookup'
import { DEFAULT_SOIL_ROOT, readCatalog } from '../soil-map/storage'
import { COORDINATE_POLICY } from '../soil-map/format'
import { manualSoilOption } from './options'
import { resolveEffectiveSoil } from './resolve'

type FarmData = Pick<Farm, 'name' | 'description' | 'latitude' | 'longitude' | 'prefectureCode' | 'municipalityCode'>
type Snapshot = Pick<Farm, 'id' | 'userId' | 'latitude' | 'longitude' | 'locationVersion' | 'prefectureCode'>
type Lookup = typeof lookupSoilMap
export class FarmSoilError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export async function soilCatalogVersion(): Promise<string | null> {
  try {
    const catalog = await readCatalog(DEFAULT_SOIL_ROOT)
    return createHash('sha256').update(JSON.stringify(Object.entries(catalog.prefectures).sort())).digest('hex')
  } catch { return null }
}
const samePosition = (a: Snapshot, b: Snapshot) => a.id === b.id && a.userId === b.userId &&
  a.locationVersion === b.locationVersion && a.latitude === b.latitude && a.longitude === b.longitude

function emptyMap() {
  return { mapScale: null, datasetId: null, catalogVersion: null, featureId: null, lookedUpAt: null,
    rawGroupCode: null, rawSubgroupCode: null, rawSeriesCode: null, rawSoilName: null, rawLandUse: null,
    rawPropertiesJson: null, candidatesJson: null, codeConflict: false, lookupError: null,
    mappingVersion: null, coordinatePolicy: COORDINATE_POLICY }
}
function resultData(result: SoilLookupResult) {
  const data: Prisma.FarmSoilUncheckedUpdateInput = { ...emptyMap(), lookupStatus: result.status, lookedUpAt: new Date() }
  if (result.status === 'matched') {
    const c = result.candidate
    Object.assign(data, { mapScale: c.scale, datasetId: c.datasetId, featureId: c.id,
      rawGroupCode: c.codes.group, rawSubgroupCode: c.codes.subgroup, rawSeriesCode: c.codes.series,
      rawSoilName: c.soilName, rawLandUse: c.landUse, rawPropertiesJson: JSON.stringify(c.properties), codeConflict: c.codeConflict })
  } else if (result.status === 'ambiguous') data.candidatesJson = JSON.stringify(result.candidates)
  else if (result.status === 'data_unavailable') data.lookupError = result.reason
  return data
}

export function createFarmSoilService(db: PrismaClient, deps: { lookup?: Lookup; catalogVersion?: () => Promise<string | null> } = {}) {
  const lookup = deps.lookup ?? lookupSoilMap
  const version = deps.catalogVersion ?? soilCatalogVersion
  async function getOwned(userId: string, farmId: string) {
    const farm = await db.farm.findFirst({ where: { id: farmId, userId }, include: { soil: true } })
    if (!farm) throw new FarmSoilError(404, '農場が見つかりません')
    return { farm, effective: resolveEffectiveSoil(farm) }
  }
  async function refresh(snapshot: Snapshot): Promise<string> {
    const token = randomUUID()
    const ready = await db.$transaction(async tx => {
      const current = await tx.farm.findFirst({ where: { id: snapshot.id, userId: snapshot.userId } })
      if (!current || !samePosition(current, snapshot)) return false
      await tx.farmSoil.upsert({ where: { farmId: snapshot.id },
        create: { farmId: snapshot.id, latitude: snapshot.latitude, longitude: snapshot.longitude,
          locationVersion: snapshot.locationVersion, lookupStatus: 'pending', lookupToken: token },
        // 自動の更新はmanual系を一切書き換えない。
        update: { lookupStatus: 'pending', lookupToken: token } })
      return true
    })
    if (!ready) return 'stale'
    let beforeVersion: string | null = null
    let afterVersion: string | null = null
    let result: SoilLookupResult
    try {
      beforeVersion = await version()
      result = await lookup({ latitude: snapshot.latitude, longitude: snapshot.longitude, prefectureCode: snapshot.prefectureCode })
      afterVersion = await version()
    } catch (error) {
      result = { status: 'data_unavailable', reason: error instanceof Error ? error.message : '土壌図を照合できません' }
    }
    return db.$transaction(async tx => {
      const current = await tx.farm.findFirst({ where: { id: snapshot.id, userId: snapshot.userId } })
      if (!current || !samePosition(current, snapshot)) return 'stale'
      const saved = await tx.farmSoil.updateMany({ where: { farmId: snapshot.id, lookupToken: token }, data: {
        ...resultData(result), latitude: snapshot.latitude, longitude: snapshot.longitude,
        locationVersion: snapshot.locationVersion, lookupToken: null,
        catalogVersion: beforeVersion === afterVersion ? afterVersion : null,
      } })
      return saved.count ? result.status : 'stale'
    })
  }
  async function tryRefresh(snapshot: Snapshot) {
    try { return await refresh(snapshot) } catch (error) {
      // 農場自体はすでに保存済み。照合失敗で農場APIを500にしない。
      console.error('Farm soil lookup/save:', error)
      return 'pending'
    }
  }
  async function create(userId: string, data: FarmData) {
    const farm = await db.farm.create({ data: { ...data, userId } })
    await tryRefresh(farm)
    return farm
  }
  async function update(userId: string, farmId: string, data: Partial<FarmData>) {
    const result = await db.$transaction(async tx => {
      const existing = await tx.farm.findFirst({ where: { id: farmId, userId } })
      if (!existing) throw new FarmSoilError(404, '農場が見つかりません')
      const latitude = data.latitude === undefined ? existing.latitude : data.latitude
      const longitude = data.longitude === undefined ? existing.longitude : data.longitude
      const moved = latitude !== existing.latitude || longitude !== existing.longitude
      const farm = await tx.farm.update({ where: { id: existing.id }, data: {
        ...data, ...(moved ? { locationVersion: { increment: 1 } } : {}),
      } })
      if (moved) {
        const soil = await tx.farmSoil.findUnique({ where: { farmId } })
        await tx.farmSoil.upsert({ where: { farmId },
          create: { farmId, latitude: farm.latitude, longitude: farm.longitude, locationVersion: farm.locationVersion },
          update: { ...emptyMap(), latitude: farm.latitude, longitude: farm.longitude,
            locationVersion: farm.locationVersion, lookupStatus: 'pending', lookupToken: null,
            manualStatus: soil?.manualSoilKey ? 'needs_review' : 'none' },
        })
      }
      return { farm, moved }
    })
    if (result.moved) await tryRefresh(result.farm)
    return result.farm
  }
  async function correct(userId: string, farmId: string, action: unknown, key?: unknown) {
    if (action !== 'set' && action !== 'reset') throw new FarmSoilError(400, '操作を選んでください')
    const option = manualSoilOption(key)
    if (action === 'set' && !option) throw new FarmSoilError(400, '一覧の土の種類を選んでください')
    await db.$transaction(async tx => {
      const farm = await tx.farm.findFirst({ where: { id: farmId, userId } })
      if (!farm) throw new FarmSoilError(404, '農場が見つかりません')
      const manual = action === 'reset'
        ? { manualSoilKey: null, manualStatus: 'none', manualUpdatedAt: null, manualNote: null }
        : { manualSoilKey: option!.key, manualStatus: 'active', manualUpdatedAt: new Date(), manualNote: null }
      await tx.farmSoil.upsert({ where: { farmId },
        create: { farmId, latitude: farm.latitude, longitude: farm.longitude,
          locationVersion: farm.locationVersion, ...manual }, update: manual,
      })
    })
    return getOwned(userId, farmId)
  }
  async function refreshAll() {
    const currentVersion = await version()
    const farms = await db.farm.findMany({ include: { soil: true } })
    const counts: Record<string, number> = {}
    let skipped = 0
    for (const farm of farms) {
      if (farm.soil && farm.soil.lookupStatus !== 'pending' && farm.soil.lookupStatus !== 'data_unavailable' &&
        currentVersion && farm.soil.catalogVersion === currentVersion &&
        farm.soil.locationVersion === farm.locationVersion && farm.soil.latitude === farm.latitude && farm.soil.longitude === farm.longitude) {
        skipped++; continue
      }
      const status = await tryRefresh(farm)
      counts[status] = (counts[status] ?? 0) + 1
    }
    return { processed: farms.length - skipped, skipped, counts }
  }
  return { create, update, correct, getOwned, refresh, tryRefresh, refreshAll }
}
