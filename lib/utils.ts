export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function daysSincePlanting(date: Date | string, today = new Date()): number | null {
  const start = new Date(date)
  if (Number.isNaN(start.getTime())) return null
  start.setHours(0, 0, 0, 0)
  const end = new Date(today)
  end.setHours(0, 0, 0, 0)
  const diff = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  return diff >= 0 ? diff : null
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}
