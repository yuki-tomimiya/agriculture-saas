import { readSessionUser } from './auth-session'

export async function readUserIdCookie(): Promise<string | undefined> {
  return (await readSessionUser())?.id
}
