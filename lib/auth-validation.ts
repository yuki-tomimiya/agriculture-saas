// 台帳 I26。文字数とUTF-8バイト数を分け、bcryptの切り捨てを防ぐ。
export function newPasswordError(password: unknown): string | null {
  if (typeof password !== 'string') return 'パスワードを文字列で入力してください'
  if ([...password].length < 15) return 'パスワードは15文字以上で入力してください'
  if (new TextEncoder().encode(password).length > 72) {
    return 'パスワードはUTF-8で72バイト以下にしてください（日本語は1文字で複数バイトになります）'
  }
  return null
}

export function validEmail(email: unknown): email is string {
  return typeof email === 'string' && email.length > 0 && email.length <= 254 &&
    /^[^\s@]+@[^\s@]+$/.test(email)
}
