import { NextRequest } from 'next/server'
import { readFieldConcernPhoto } from '@/lib/crops/field-concern-photos'
import { concernError, fieldConcernAccess } from '@/lib/crops/field-concern-service'
import { prisma } from '@/lib/prisma'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; concernId: string }> }) {
  const { id, concernId } = await params
  const { failure, crop } = await fieldConcernAccess(id)
  if (failure) return failure
  const concern = await prisma.fieldConcern.findFirst({
    where: { id: concernId, cropId: crop.id },
    select: { photoName: true },
  })
  const photo = concern?.photoName && await readFieldConcernPhoto(concern.photoName)
  if (!photo) return concernError('写真が見つかりません。', 404)

  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      'Content-Type': photo.type,
      'Cache-Control': 'private, no-store',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
