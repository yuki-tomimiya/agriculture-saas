import Link from 'next/link'

const TABS = [
  { href: '/work-records', label: '作業記録', key: 'work' },
  { href: '/pesticides', label: '農薬', key: 'pesticides' },
  { href: '/harvests', label: '収穫', key: 'harvests' },
  { href: '/sales', label: '販売', key: 'sales' },
] as const

export type RecordTabKey = (typeof TABS)[number]['key']

export function RecordTabs({ active }: { active: RecordTabKey }) {
  return (
    <div className="work-management-tabs" role="tablist" aria-label="記録">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          role="tab"
          aria-selected={tab.key === active}
          className={`work-management-tab${tab.key === active ? ' work-management-tab--active' : ''}`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
