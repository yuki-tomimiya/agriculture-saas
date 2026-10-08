import type { Prisma } from '@prisma/client'

/**
 * 認証済みユーザーの「作物」取得用 where（userId または farm.userId）
 * マイグレーション未適用時用の fallback も返す
 */
export function getCropWhere(
  userId: string,
  options?: { farmId?: string }
): { where: Prisma.CropWhereInput; whereFallback: Prisma.CropWhereInput } {
  const baseOr: Prisma.CropWhereInput[] = [{ userId }, { farm: { userId } }]
  const withFarmFilter: Prisma.CropWhereInput = options?.farmId
    ? { AND: [{ farmId: options.farmId }, { OR: baseOr }] }
    : { OR: baseOr }
  const fallback = options?.farmId
    ? { farmId: options.farmId, farm: { userId } }
    : { farm: { userId } }
  return { where: withFarmFilter, whereFallback: fallback }
}

/**
 * 認証済みユーザーの「収穫」取得用 where（crop.userId または crop.farm.userId）
 */
export function getHarvestWhere(
  userId: string,
  options?: { cropId?: string }
): { where: Prisma.HarvestWhereInput; whereFallback: Prisma.HarvestWhereInput } {
  const cropOr: Prisma.CropWhereInput[] = [{ userId }, { farm: { userId } }]
  const where: Prisma.HarvestWhereInput = options?.cropId
    ? { crop: { id: options.cropId, OR: cropOr } }
    : { crop: { OR: cropOr } }
  const whereFallback = options?.cropId
    ? { crop: { id: options.cropId, farm: { userId } } }
    : { crop: { farm: { userId } } }
  return { where, whereFallback }
}

/**
 * 認証済みユーザーの「農薬記録」取得用 where（userId）
 */
export function getPesticideWhere(
  userId: string,
  options?: { cropId?: string; farmId?: string }
): { where: Prisma.PesticideRecordWhereInput; whereFallback: Prisma.PesticideRecordWhereInput } {
  const base = { userId }
  const where = options?.cropId
    ? { ...base, cropId: options.cropId }
    : options?.farmId
    ? { ...base, farmId: options.farmId }
    : base
  return { where, whereFallback: where }
}

/**
 * 認証済みユーザーの「作業記録」取得用 where（farm.userId）
 */
export function getWorkRecordWhere(
  userId: string,
  options?: { cropId?: string; farmId?: string }
): { where: Prisma.WorkRecordWhereInput; whereFallback: Prisma.WorkRecordWhereInput } {
  const base = { farm: { userId } }
  const where = options?.cropId
    ? { ...base, cropId: options.cropId }
    : options?.farmId
    ? { ...base, farmId: options.farmId }
    : base
  return { where, whereFallback: where }
}

/**
 * 認証済みユーザーの「施肥記録」取得用 where（userId）
 */
export function getFertilizerWhere(
  userId: string,
  options?: { cropId?: string; farmId?: string }
): { where: Prisma.FertilizerRecordWhereInput; whereFallback: Prisma.FertilizerRecordWhereInput } {
  const base = { userId }
  const where = options?.cropId
    ? { ...base, cropId: options.cropId }
    : options?.farmId
    ? { ...base, farmId: options.farmId }
    : base
  return { where, whereFallback: where }
}

/**
 * 認証済みユーザーの「売上」取得用 where（userId）
 */
export function getSaleWhere(
  userId: string,
  options?: { cropId?: string; farmId?: string }
): { where: Prisma.SaleWhereInput; whereFallback: Prisma.SaleWhereInput } {
  const base = { userId }
  const where = options?.cropId
    ? { ...base, cropId: options.cropId }
    : options?.farmId
    ? { ...base, farmId: options.farmId }
    : base
  return { where, whereFallback: where }
}
