import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { prisma } from './prisma'

export const SESSION_COOKIE = 'tilltol-session'
// 台帳 I25。期限は発行時から固定し、読み取りでは延長しない。
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

export function sessionTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function findSessionUser(token: string | undefined, now = new Date()) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null
  const session = await prisma.session.findUnique({
    where: { tokenHash: sessionTokenHash(token) },
    include: { user: true },
  })
  if (!session || session.expiresAt.getTime() <= now.getTime()) return null
  return session.user
}

export async function readSessionUser() {
  const cookieStore = await cookies()
  // userId Cookieからセッションを作らない。旧Cookieの削除はProxyで行う。
  return findSessionUser(cookieStore.get(SESSION_COOKIE)?.value)
}

export async function startSession(userId: string) {
  const cookieStore = await cookies()
  const now = new Date()
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS)
  const previous = cookieStore.get(SESSION_COOKIE)?.value
  await prisma.$transaction([
    prisma.session.deleteMany({ where: {
      OR: [
        { userId, expiresAt: { lte: now } },
        ...(previous ? [{ tokenHash: sessionTokenHash(previous) }] : []),
      ],
    } }),
    prisma.session.create({ data: { userId, tokenHash: sessionTokenHash(token), expiresAt } }),
  ])
  cookieStore.delete('userId')
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export async function endSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sessionTokenHash(token) } })
  cookieStore.delete(SESSION_COOKIE)
  cookieStore.delete('userId')
}
