import { mkdir, unlink, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const PHOTO_DIR = path.join(process.cwd(), 'data', 'soil-photos')
const MAX_PHOTO_BYTES = 4 * 1024 * 1024
const PHOTO_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
])

export function parseOptionalNumber(value: FormDataEntryValue | null, label: string, min: number, max?: number): number | null | { error: string } {
  if (typeof value !== 'string' || value.trim() === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < min || (max != null && n > max)) {
    return { error: max != null ? `${label}は${min}〜${max}の数値です` : `${label}は${min}以上の数値です` }
  }
  return n
}

export async function saveSoilPhoto(file: File): Promise<string> {
  const ext = PHOTO_TYPES.get(file.type)
  if (!ext) throw new Error('写真は JPEG、PNG、WebP のいずれかにしてください')
  if (file.size > MAX_PHOTO_BYTES) throw new Error('写真は4MBまでです')
  const name = `${randomUUID()}${ext}`
  await mkdir(PHOTO_DIR, { recursive: true })
  await writeFile(path.join(PHOTO_DIR, name), Buffer.from(await file.arrayBuffer()))
  return name
}

export function soilPhotoAbsolutePath(photoPath: string): string | null {
  if (!/^[\w-]+\.(jpg|png|webp)$/.test(photoPath)) return null
  return path.join(PHOTO_DIR, photoPath)
}

export async function removeSoilPhoto(photoPath: string | null | undefined): Promise<void> {
  if (!photoPath) return
  const file = soilPhotoAbsolutePath(photoPath)
  if (!file) return
  await unlink(file).catch(() => undefined)
}

export function soilPhotoContentType(photoPath: string): string {
  if (photoPath.endsWith('.png')) return 'image/png'
  if (photoPath.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}
