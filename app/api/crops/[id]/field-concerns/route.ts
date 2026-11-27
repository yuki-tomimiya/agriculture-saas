import { NextRequest, NextResponse } from 'next/server'
import {
  concernChoiceLabel, concernExtents, concernLocations, concernNotesLimit, concernSymptoms,
} from '@/lib/crops/field-concerns'
import { FieldConcernPhotoError, removeFieldConcernPhoto, saveFieldConcernPhoto } from '@/lib/crops/field-concern-photos'
import { concernError, fieldConcernAccess } from '@/lib/crops/field-concern-service'
import { observedDate } from '@/lib/crops/observed-date'
import { forecastOffice } from '@/lib/pest-forecast'
import { fieldObservationPests } from '@/lib/pests/field-observations'
import { prisma } from '@/lib/prisma'

function choiceKeys(data: FormData, key: string, choices: Record<string, string>) {
  const entries = data.getAll(key)
  if (!entries.every(value => typeof value === 'string' && concernChoiceLabel(choices, value))) return null
  return [...new Set(entries as string[])]
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { failure, crop } = await fieldConcernAccess((await params).id)
  if (failure) return failure
  if (crop.status !== 'growing') return concernError('栽培中の作付けを選んでください。', 400)

  const form = await request.formData().catch(() => null)
  if (!form) return concernError('記録の内容を確かめてください。', 400)
  const observedAt = observedDate(form.get('observedDay'))
  if (!observedAt) return concernError('見た日は今日までの日付を入力してください。', 400)
  const locations = choiceKeys(form, 'locations', concernLocations)
  const symptoms = choiceKeys(form, 'symptoms', concernSymptoms)
  const extent = form.get('extent') || null
  if (!locations || !symptoms || (extent !== null && (
    typeof extent !== 'string' || !concernChoiceLabel(concernExtents, extent)
  ))) return concernError('場所・様子・広さの選択を確かめてください。', 400)
  if (!locations.length && !symptoms.length) return concernError('場所か様子を1つ以上選んでください。', 400)

  const rawNotes = form.get('notes')
  const notes = typeof rawNotes === 'string' ? rawNotes.trim() || null : null
  if (notes && notes.length > concernNotesLimit) return concernError(`メモは${concernNotesLimit}文字までです。`, 400)
  const photos = form.getAll('photo')
  const photo = photos[0]
  if (photos.length > 1 || typeof photo === 'string') return concernError('写真は1枚選んでください。', 400)

  let photoName: string | null = null
  try {
    if (photo && (photo.size || photo.name)) photoName = await saveFieldConcernPhoto(photo)
    const row = await prisma.fieldConcern.create({
      data: { cropId: crop.id, observedAt, locations: locations.join(','), symptoms: symptoms.join(','), extent, notes, photoName },
      select: { id: true },
    })
    return NextResponse.json({
      id: row.id,
      candidates: fieldObservationPests(crop),
      forecast: forecastOffice(crop.farm?.prefectureCode),
    }, { status: 201 })
  } catch (error) {
    if (error instanceof FieldConcernPhotoError) return concernError(error.message, 400)
    await removeFieldConcernPhoto(photoName).catch(cleanupError => console.error('Field concern photo cleanup failed:', cleanupError))
    throw error
  }
}
