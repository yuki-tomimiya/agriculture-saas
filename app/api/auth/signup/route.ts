import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { startSession } from '@/lib/auth-session'
import { newPasswordError, validEmail } from '@/lib/auth-validation'

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json()
    const { name, email, password } = body && typeof body === 'object' ? body as Record<string, unknown> : {}

    if (!validEmail(email) || (name != null && typeof name !== 'string')) {
      return NextResponse.json(
        { error: 'メールアドレスとお名前を正しく入力してください' },
        { status: 400 }
      )
    }

    const passwordError = newPasswordError(password)
    if (passwordError || typeof password !== 'string') {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    // 既存ユーザーをチェック
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に登録されています' },
        { status: 400 }
      )
    }

    // パスワードをハッシュ化
    const hashedPassword = await hashPassword(password)

    // ユーザーを作成
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
      },
    })

    await startSession(user.id)

    return NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name } })
  } catch {
    console.error('Signup: 新規登録の処理に失敗しました')
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
