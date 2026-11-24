'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import TilltolLogo from '@/components/TilltolLogo'
import { useState } from 'react'

export default function Navbar() {
  const pathname = usePathname()
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState('')

  const logout = async () => {
    setLoggingOut(true)
    setError('')
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error('logout failed')
      // Router Cacheに残った本人の画面も破棄する。
      window.location.replace('/auth/signin')
    } catch {
      setError('ログアウトできませんでした。もう一度お試しください')
      setLoggingOut(false)
    }
  }

  const isAuthPage = pathname?.startsWith('/auth')
  const isHomePage = pathname === '/'

  if (isAuthPage || isHomePage) {
    return null
  }

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/dashboard" className="app-header-brand">
          <TilltolLogo size={28} />
          <span>Tilltol</span>
        </Link>
        <div>
          <button type="button" className="app-header-logout" onClick={logout} disabled={loggingOut}>
            {loggingOut ? 'ログアウト中…' : 'ログアウト'}
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      </div>
    </header>
  )
}
