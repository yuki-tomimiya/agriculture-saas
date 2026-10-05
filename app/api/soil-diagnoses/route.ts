import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { parseOptionalNumber, removeSoilPhoto, saveSoilPhoto } from '@/lib/soil-diagnosis'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('userId')?.value
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const form = await request.formData()
    const farmId = String(form.get('farmId') ?? '').trim()
    const diagnosedAt = new Date(String(form.get('diagnosedAt') ?? ''))
    const notesRaw = String(form.get('notes') ?? '').trim()

    if (!farmId) {
      return NextResponse.json({ error: '農場を選んでください' }, { status: 400 })
    }
    if (Number.isNaN(diagnosedAt.getTime())) {
      return NextResponse.json({ error: '診断日を入力してください' }, { status: 400 })
    }

    const ph = parseOptionalNumber(form.get('ph'), 'pH', 0, 14)
    const ec = parseOptionalNumber(form.get('ec'), 'EC', 0)
    const nitrogen = parseOptionalNumber(form.get('nitrogen'), '硝酸態窒素', 0)
    const phosphorus = parseOptionalNumber(form.get('phosphorus'), '有効態リン酸', 0)
    const potassium = parseOptionalNumber(form.get('potassium'), '交換性カリ', 0)
    const parsed = [ph, ec, nitrogen, phosphorus, potassium]
    const invalid = parsed.find((value) => value != null && typeof value === 'object' && 'error' in value)
    if (invalid && typeof invalid === 'object') {
      return NextResponse.json({ error: invalid.error }, { status: 400 })
    }

    const hasNumber = parsed.some((value) => typeof value === 'number')
    if (!hasNumber && !notesRaw) {
      return NextResponse.json({ error: '数値かメモを入れてください' }, { status: 400 })
    }

    const farm = await prisma.farm.findFirst({ where: { id: farmId, userId } })
    if (!farm) {
      return NextResponse.json({ error: '農場が見つかりません' }, { status: 400 })
    }

    const fieldIdRaw = String(form.get('fieldId') ?? '').trim()
    let fieldId: string | null = null
    if (fieldIdRaw) {
      const field = await prisma.field.findFirst({ where: { id: fieldIdRaw, farmId } })
      if (!field) {
        return NextResponse.json({ error: '圃場が見つかりません' }, { status: 400 })
      }
      fieldId = field.id
    }

    const photo = form.get('photo')
    let photoPath: string | null = null
    if (photo instanceof File && photo.size > 0) {
      try {
        photoPath = await saveSoilPhoto(photo)
      } catch (error) {
        const message = error instanceof Error ? error.message : '写真を保存できませんでした'
        return NextResponse.json({ error: message }, { status: 400 })
      }
    }

    try {
      const record = await prisma.soilDiagnosis.create({
        data: {
          userId,
          farmId,
          fieldId,
          diagnosedAt,
          ph: typeof ph === 'number' ? ph : null,
          ec: typeof ec === 'number' ? ec : null,
          nitrogen: typeof nitrogen === 'number' ? nitrogen : null,
          phosphorus: typeof phosphorus === 'number' ? phosphorus : null,
          potassium: typeof potassium === 'number' ? potassium : null,
          notes: notesRaw || null,
          photoPath,
        },
      })
      return NextResponse.json({ id: record.id })
    } catch (error) {
      await removeSoilPhoto(photoPath)
      throw error
    }
  } catch (error) {
    console.error('Soil diagnosis create error:', error)
    return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 })
  }
}
