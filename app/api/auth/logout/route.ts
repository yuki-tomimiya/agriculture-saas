import { NextResponse } from 'next/server'
import { endSession } from '@/lib/auth-session'

export async function POST() {
  try {
    await endSession()
    return NextResponse.json({ success: true })
  } catch {
    console.error('Logout: セッションを終了できませんでした')
    return NextResponse.json({ error: 'ログアウトできませんでした' }, { status: 500 })
  }
}
