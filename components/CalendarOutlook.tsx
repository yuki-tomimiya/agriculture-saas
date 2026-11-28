import Link from 'next/link'
import { CompactWeatherDataSource, JmaDataSource, WeatherDataNotes } from './WeatherDataSource'
import type { OutlookRow } from '@/lib/calendar/outlook'

function dayLabel(day: string) {
  const [, month, date] = day.split('-').map(Number)
  return month + '月' + date + '日'
}

export default function CalendarOutlook({ rows, hasCrops }: { rows: OutlookRow[]; hasCrops: boolean }) {
  const hasWeather = rows.some(row => row.source && row.source !== 'station')
  return <section className="mt-5 min-w-0" aria-labelledby="outlook-heading">
    <h2 className="dashboard-section-title" id="outlook-heading">これからの見通し</h2>
    {rows.length ? <ul className="divide-y">{rows.map(row =>
      <li key={row.id} id={'outlook-' + row.id} className="py-2 break-words">
        <Link href={row.href} className="font-semibold underline">{row.mark === '県の月' ? Number(row.start.slice(5, 7)) + '月' :
          dayLabel(row.start) + (row.start === row.end ? '' : '〜' + dayLabel(row.end))}　{row.text}</Link>
        <p className="text-sm">{[row.cropName, row.farmName, row.layer].filter(Boolean).join(' · ')}</p>
        {row.source === 'station' ? <JmaDataSource /> : row.source && <CompactWeatherDataSource />}
      </li>)}</ul> : <p>この期間の見通しはありません。</p>}
    {!hasCrops && <p><Link className="underline" href="/crops/new">作付けを登録</Link>すると、収穫の見込みや聞く時期がここに出ます。</p>}
    {hasWeather && <WeatherDataNotes archive forecast />}
  </section>
}
