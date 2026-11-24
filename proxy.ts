import { NextRequest, NextResponse } from 'next/server'
import { hasAllowedOrigin } from './lib/request-origin'

export function proxy(request: NextRequest) {
  const changesData = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)
  const response = request.nextUrl.pathname.startsWith('/api/') && changesData && !hasAllowedOrigin(request)
    ? NextResponse.json({ error: '送信元を確認できませんでした' }, { status: 403 })
    : NextResponse.next()
  if (request.cookies.has('userId')) response.cookies.delete('userId')
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
