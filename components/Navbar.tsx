'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import TilltoLogo from '@/components/TilltoLogo'

export default function Navbar() {
  const pathname = usePathname()

  const isAuthPage = pathname?.startsWith('/auth')
  const isHomePage = pathname === '/'

  if (isAuthPage || isHomePage) {
    return null
  }

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/dashboard" className="app-header-brand">
          <TilltoLogo size={28} />
          <span>Tillto</span>
        </Link>
        <Link href="/auth/signin" className="app-header-logout">
          ログアウト
        </Link>
      </div>
    </header>
  )
}
