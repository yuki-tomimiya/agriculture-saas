export function allowedOrigin(env: { NODE_ENV?: string; TILLTOL_ORIGIN?: string } = process.env) {
  const value = env.TILLTOL_ORIGIN ?? (env.NODE_ENV === 'production' ? undefined : 'http://127.0.0.1:3000')
  if (!value) return undefined
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value ? value : undefined
  } catch {
    return undefined
  }
}

export function hasAllowedOrigin(request: Request): boolean {
  const origin = allowedOrigin()
  return !!origin && request.headers.get('origin') === origin
}
