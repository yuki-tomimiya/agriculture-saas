'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export type ListCell = { text: string; value?: number | string; href?: string }
export type ListRow = {
  id: string
  cells: (ListCell | null)[]
  action?: { href: string; text: string }
}

type Sort = { column: number; direction: 'ascending' | 'descending' }
const collator = new Intl.Collator('ja', { numeric: true })

export function sortListRows(rows: ListRow[], { column, direction }: Sort) {
  return [...rows].sort((a, b) => {
    const left = a.cells[column]
    const right = b.cells[column]
    if (!left || !right) return left ? -1 : right ? 1 : 0
    const x = left.value ?? left.text
    const y = right.value ?? right.text
    const comparison = typeof x === 'number' && typeof y === 'number'
      ? x - y : collator.compare(String(x), String(y))
    return direction === 'ascending' ? comparison : -comparison
  })
}

export default function ManagementList({ cookieName, initialView, columns, rows, tiles, empty }: {
  cookieName: string
  initialView?: string
  columns: string[]
  rows: ListRow[]
  tiles: ReactNode
  empty: ReactNode
}) {
  const router = useRouter()
  const [view, setView] = useState(initialView === 'tiles' ? 'tiles' : 'list')
  const [sort, setSort] = useState<Sort | null>(null)
  const sortedRows = sort && view === 'list' ? sortListRows(rows, sort) : rows

  function changeView(next: 'tiles' | 'list') {
    if (view === next) return
    document.cookie = `${cookieName}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`
    setView(next)
    router.refresh()
  }

  return <>
    <div className="management-list-toggle" role="group" aria-label="表示形式">
      <button type="button" className="btn btn-outline" aria-pressed={view === 'tiles'} onClick={() => changeView('tiles')}>タイル</button>
      <button type="button" className="btn btn-outline" aria-pressed={view === 'list'} onClick={() => changeView('list')}>リスト</button>
    </div>
    {rows.length === 0 ? empty : view === 'tiles' ? tiles : (
      <div className="management-list-scroll">
        <table className="management-list-table">
          <thead>
            <tr>
              {columns.map((label, column) => {
                const direction = sort?.column === column ? sort.direction : undefined
                return <th key={label} scope="col" aria-sort={direction}>
                  <button type="button" onClick={() => setSort({
                    column,
                    direction: direction === 'ascending' ? 'descending' : 'ascending',
                  })}>
                    {label} <span aria-hidden="true">{direction === 'ascending' ? '↑' : direction === 'descending' ? '↓' : '↕'}</span>
                  </button>
                </th>
              })}
              <th scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map(row => <tr key={row.id}>
              {row.cells.map((cell, column) => <td key={columns[column]}>
                {cell?.href ? <Link href={cell.href} className="farms-card-title-link">{cell.text}</Link> : cell?.text ?? '—'}
              </td>)}
              <td>{row.action && <Link href={row.action.href} className="farms-card-title-link">{row.action.text}</Link>}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    )}
  </>
}
