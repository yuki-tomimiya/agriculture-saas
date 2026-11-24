import bcrypt from 'bcryptjs'
import { readSessionUser } from './auth-session'

export async function getCurrentUser() {
  try {
    return await readSessionUser()
  } catch {
    console.error('getCurrentUser: セッションを確認できませんでした')
    return null
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}
