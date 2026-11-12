import { cookies } from 'next/headers'

export async function readUserIdCookie(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get('userId')?.value
}
