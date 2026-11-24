import { createHash, randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

// ページ・APIテストの一時DB専用。旧userId Cookieを有効な認証として使わない。
export async function testSession(db: PrismaClient, userId: string) {
  const token = randomBytes(32).toString('hex')
  await db.session.create({ data: {
    userId, tokenHash: createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date('2100-01-01T00:00:00Z'),
  } })
  return {
    token,
    header: `tilltol-session=${token}`,
    get: (name: string) => name === 'tilltol-session' ? { value: token } : undefined,
  }
}
