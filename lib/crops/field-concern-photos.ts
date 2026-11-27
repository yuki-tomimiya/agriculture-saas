import { randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { concernPhotoLimit, concernPhotoTypes } from './field-concerns'

type Extension = keyof typeof concernPhotoTypes

function photoDirectory() {
  return process.env.FIELD_CONCERN_PHOTO_DIR ?? path.join(process.cwd(), 'data', 'field-photos')
}

function photoExtension(name: string) {
  return /^[a-f0-9-]{36}\.(jpg|png|webp)$/.exec(name)?.[1] as Extension | undefined
}

export class FieldConcernPhotoError extends Error {}

export async function saveFieldConcernPhoto(file: File) {
  const extension = (Object.keys(concernPhotoTypes) as Extension[])
    .find(key => concernPhotoTypes[key] === file.type)
  if (!extension) throw new FieldConcernPhotoError('写真は JPEG、PNG、WebP のいずれかにしてください。')
  if (!file.size || file.size > concernPhotoLimit) throw new FieldConcernPhotoError('写真は4MBまでです。')
  const data = Buffer.from(await file.arrayBuffer())
  const validHeader = {
    jpg: data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
    png: data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    webp: data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP',
  }
  if (!validHeader[extension]) throw new FieldConcernPhotoError('写真の形式を確かめてください。')

  const name = `${randomUUID()}.${extension}`
  const directory = photoDirectory()
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, name), data, { flag: 'wx' })
  return name
}

export async function readFieldConcernPhoto(name: string) {
  const extension = photoExtension(name)
  if (!extension) return null
  try {
    const bytes = await readFile(path.join(photoDirectory(), name))
    return { bytes, type: concernPhotoTypes[extension] }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function removeFieldConcernPhoto(name: string | null) {
  if (!name || !photoExtension(name)) return
  try {
    await unlink(path.join(photoDirectory(), name))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}
