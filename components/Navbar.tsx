'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()

  const isAuthPage = pathname?.startsWith('/auth')
  const isHomePage = pathname === '/'

  if (isAuthPage || isHomePage) {
    return null
  }

  const navItems = [
    { href: '/dashboard', label: 'ダッシュボード' },
    { href: '/farms', label: '農場' },
    { href: '/crops', label: '作物' },
    { href: '/harvests', label: '収穫記録' },
    { href: '/tasks', label: 'タスク' },
  ]

  return (
    <nav className="bg-white shadow-md fixed top-0 left-0 right-0 z-30 h-16 border-b border-gray-200">
      <div className="flex items-center justify-between h-full px-6">
        <Link href="/dashboard" className="text-xl font-bold text-green-600">
          農業SaaS
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/auth/signin"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ログアウト
          </Link>
        </div>
      </div>
    </nav>
  )
}
