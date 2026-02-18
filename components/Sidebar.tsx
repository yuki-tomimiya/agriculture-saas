'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Sidebar() {
  const pathname = usePathname()

  const isAuthPage = pathname?.startsWith('/auth')
  const isHomePage = pathname === '/'

  // ホームページと認証ページではサイドバーを表示しない
  if (isAuthPage || isHomePage) {
    return null
  }

  const menuItems = [
    { href: '/dashboard/ai-proposal', label: 'AIが今日の作業を提案', icon: '✨', highlight: true },
    { href: '/dashboard', label: 'ダッシュボード', icon: '📊' },
    { href: '/farms', label: '農場', icon: '🏡' },
    { href: '/crops', label: '作物', icon: '🌾' },
    { href: '/harvests', label: '収穫記録', icon: '📦' },
    { href: '/tasks', label: 'タスク', icon: '📋' },
  ]

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-[calc(100vh-4rem)] fixed left-0 top-16 z-20 overflow-y-auto">
      <nav className="p-4 space-y-1">
        {menuItems.map((item) => {
          const isAiProposal = 'highlight' in item && item.highlight
          const isActive = isAiProposal
            ? pathname === '/dashboard/ai-proposal'
            : pathname === item.href
          const linkClass = isAiProposal
            ? isActive
              ? 'bg-violet-100 text-violet-900 font-semibold border border-violet-300'
              : 'bg-violet-50 text-violet-800 font-semibold border border-violet-200 hover:bg-violet-100'
            : isActive
              ? 'bg-green-50 text-green-700 font-semibold border border-green-200'
              : 'text-gray-700 hover:bg-gray-50'
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${linkClass}`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
