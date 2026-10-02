'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type MenuItem = {
  href: string
  label: string
  icon: string
  highlight?: boolean
  matchPaths?: string[]
}

type MenuSection = {
  title?: string
  items: MenuItem[]
}

const listPages = [
  '/pesticides',
  '/fertilizers',
  '/work-records',
  '/harvests',
  '/sales',
  '/insights',
  '/plan',
  '/crops',
  '/farms',
  '/tasks',
  '/faq',
  '/data',
]

export default function Sidebar() {
  const pathname = usePathname()

  const isAuthPage = pathname?.startsWith('/auth')
  const isHomePage = pathname === '/'

  if (isAuthPage || isHomePage) {
    return null
  }

  const menuSections: MenuSection[] = [
    {
      items: [
        { href: '/dashboard/ai-proposal', label: 'AIが今日の作業を提案', icon: '✨', highlight: true },
        { href: '/dashboard', label: 'ダッシュボード', icon: '📊' },
        { href: '/calendar', label: 'カレンダー', icon: '📅', matchPaths: ['/calendar'] },
        { href: '/weather', label: '気象ナビ', icon: '🌤️' },
        { href: '/gdd', label: '生育ナビ', icon: '🌡️', matchPaths: ['/gdd'] },
        { href: '/farms', label: '農場管理', icon: '🏡' },
        { href: '/crops', label: '作物管理', icon: '🌾' },
        {
          href: '/work-records',
          label: '作業管理',
          icon: '🛠️',
          matchPaths: ['/work-records', '/fertilizers', '/work'],
        },
        { href: '/pesticides', label: '農薬管理', icon: '🧪' },
        { href: '/harvests', label: '収穫管理', icon: '📦' },
        { href: '/sales', label: '販売管理', icon: '💰' },
        { href: '/insights', label: '分析・振り返り', icon: '📈' },
        { href: '/plan', label: '来年の計画', icon: '🌱' },
        { href: '/tasks', label: 'タスク', icon: '📋' },
        { href: '/data', label: '外部連携', icon: '🔁' },
        { href: '/faq', label: 'よくある質問', icon: '❓' },
      ],
    },
  ]

  const isItemActive = (item: MenuItem) => {
    const isAiProposal = 'highlight' in item && item.highlight

    if (isAiProposal) {
      return pathname === '/dashboard/ai-proposal'
    }

    if (item.matchPaths) {
      return item.matchPaths.some(
        (path) => pathname === path || (pathname?.startsWith(path + '/') ?? false)
      )
    }

    const isListPage = listPages.includes(item.href)
    if (isListPage) {
      return pathname === item.href || (pathname?.startsWith(item.href + '/') ?? false)
    }

    return pathname === item.href
  }

  return (
    <aside className="app-sidebar">
      <nav className="app-sidebar-nav">
        {menuSections.map((section, sectionIndex) => (
          <div key={section.title ?? `section-${sectionIndex}`}>
            {section.title && (
              <p className="app-sidebar-section-title">{section.title}</p>
            )}
            {section.items.map((item) => {
              const isActive = isItemActive(item)
              const isAiProposal = 'highlight' in item && item.highlight
              const baseClass = 'app-sidebar-link'
              let stateClass = ''

              if (isAiProposal) {
                stateClass = isActive ? 'app-sidebar-link--ai-active' : 'app-sidebar-link--ai'
              } else if (isActive) {
                stateClass = 'app-sidebar-link--active'
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`${baseClass} ${stateClass}`.trim()}
                >
                  <span className="app-sidebar-icon">{item.icon}</span>
                  <span className="app-sidebar-label">{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
