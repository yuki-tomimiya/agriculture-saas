import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { farmSoilService } from '@/lib/farm-soil'
import { FarmSoilError } from '@/lib/farm-soil/service'
import { MANUAL_SOIL_OPTIONS, SOIL_OPTIONS_SOURCE } from '@/lib/farm-soil/options'

type Context = { params: Promise<{ id: string }> }
function failure(error: unknown) {
  if (error instanceof FarmSoilError) return NextResponse.json({ error: error.message }, { status: error.status })
  console.error('Farm soil API:', error)
  return NextResponse.json({ error: '土の種類の処理に失敗しました' }, { status: 500 })
}
export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const userId = (await cookies()).get('userId')?.value
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const { id } = await params
    const { farm, effective } = await farmSoilService.getOwned(userId, id)
    return NextResponse.json({ soil: farm.soil, effective, options: MANUAL_SOIL_OPTIONS, source: SOIL_OPTIONS_SOURCE })
  } catch (error) { return failure(error) }
}
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const userId = (await cookies()).get('userId')?.value
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const { id } = await params
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['action', 'soilKey'].includes(key))) {
      return NextResponse.json({ error: '入力が不正です' }, { status: 400 })
    }
    const { farm, effective } = await farmSoilService.correct(userId, id, body.action, body.soilKey)
    return NextResponse.json({ success: true, soil: farm.soil, effective })
  } catch (error) { return failure(error) }
}
