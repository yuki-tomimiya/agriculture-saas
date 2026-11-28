'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CompactWeatherDataSource, JmaDataSource } from './WeatherDataSource'
import {
  DOT_KINDS, calendarHref, cellLabel, dayHeading, dotsByDay, monthCells, monthDayLabel, panelSources, panelWeek,
  rowsOnDay, seasonLines, shiftView, type CalendarView,
} from '@/lib/calendar/day-panel'
import type { OutlookRow } from '@/lib/calendar/outlook'

const weekdayNames = ['日', '月', '火', '水', '木', '金', '土']

function PanelRow({ row }: { row: OutlookRow }) {
  const detail = [
    row.cropName && !row.title.includes(row.cropName) ? row.cropName : null,
    row.farmName,
    row.layer + (row.note ? '（' + row.note + '）' : ''),
    row.start !== row.end ? monthDayLabel(row.start) + '〜' + monthDayLabel(row.end) : null,
  ].filter(Boolean).join('・')
  // 長い文（霜の平均と最も早い年・観測所の距離、収穫の見込みの数え方）は行の中で開く。数字は見通しの文のまま。
  const opens = row.mark === '収穫の見込み' || (row.mark === '霜' && row.source !== 'forecast')
  return <li className="calendar-panel-row">
    <Link href={row.href} className="calendar-panel-title">{row.title}</Link>
    <p className="calendar-panel-detail">{detail}</p>
    {opens && <details className="calendar-panel-more"><summary>くわしく</summary><p>{row.text}</p></details>}
  </li>
}

export default function CalendarMonthView({
  rows, today, lastMonth, initialView, farms, farmId, proposalCount, hasCrops,
}: {
  rows: OutlookRow[]
  today: string
  /** 見通しの範囲（台帳 I28）の終わりの月 'YYYY-MM' */
  lastMonth: string
  initialView: CalendarView
  farms: { id: string; name: string }[]
  farmId: string | null
  proposalCount: number
  hasCrops: boolean
}) {
  const [view, setView] = useState(initialView)
  const update = (next: CalendarView) => {
    setView(next)
    window.history.replaceState(null, '', calendarHref(next, today, farmId))
  }
  const thisMonth = today.slice(0, 7)
  const [year, month] = view.month.split('-').map(Number)
  const previous = shiftView(view, -1, today, lastMonth)
  const next = shiftView(view, 1, today, lastMonth)
  const dots = dotsByDay(rows)
  const seasons = seasonLines(rows, view.month)
  const dayRows = view.day ? rowsOnDay(rows, view.day) : []
  const week = view.day ? [] : panelWeek(rows, today)
  const shown = view.day ? dayRows : week.flatMap(group => group.rows)
  const sources = panelSources(shown)
  const showsProposals = proposalCount > 0 && (!view.day || view.day === today)

  return <div className="calendar-month-wrap">
    {farms.length > 1 && <form action="/calendar" method="get" className="calendar-farm-filter">
      <label>農場 <select name="farm" defaultValue={farmId ?? ''}>
        <option value="">すべての農場</option>
        {farms.map(f => <option value={f.id} key={f.id}>{f.name}</option>)}
      </select></label>
      {view.month !== thisMonth && <input type="hidden" name="month" value={view.month} />}
      {view.day && <input type="hidden" name="day" value={view.day} />}
      <button type="submit" className="btn btn-outline">絞り込む</button>
    </form>}
    <div className="calendar-month-layout">
      <section className="calendar-month" aria-labelledby="calendar-month-heading">
        <div className="calendar-month-nav">
          {previous
            ? <button type="button" className="calendar-month-step" onClick={() => update(previous)} aria-label="前の月">‹</button>
            : <Link href="/calendar/history" className="calendar-month-step calendar-month-step--history">‹ 過去の実績</Link>}
          <h2 className="calendar-month-title" id="calendar-month-heading" aria-live="polite">{year}年{month}月</h2>
          <button type="button" className="calendar-month-step" onClick={() => next && update(next)} disabled={!next}
            aria-label={next ? '次の月' : '次の月（見通しはこの月まで）'}>›</button>
          <button type="button" className="btn btn-outline calendar-today-button" onClick={() => update({ month: thisMonth, day: null })}>今日</button>
        </div>
        {seasons.length > 0 && <ul className="calendar-season-lines">{seasons.map(row =>
          <li key={row.id}><Link href={row.href}>{row.text.includes(row.title) ? row.text : row.title + '：' + row.text}</Link>
            <span className="calendar-season-subject">（{[row.cropName, row.farmName].filter(Boolean).join('・')}）</span></li>)}
        </ul>}
        <div className="calendar-month-weekdays" aria-hidden="true">
          {weekdayNames.map((name, i) => <span key={name} className={i === 0 ? 'calendar-weekday--sun' : i === 6 ? 'calendar-weekday--sat' : undefined}>{name}</span>)}
        </div>
        <div className="calendar-month-grid">
          {monthCells(view.month).map((day, index) => {
            if (!day) return <span key={'blank' + index} className="calendar-cell calendar-cell--blank" aria-hidden="true" />
            const counts = dots.get(day)
            const selected = view.day === day
            return <button type="button" key={day} aria-pressed={selected} aria-label={cellLabel(day, counts, today)}
              className={'calendar-cell' + (day === today ? ' calendar-cell--today' : '') + (selected ? ' calendar-cell--selected' : '')}
              onClick={() => update({ ...view, day: selected ? null : day })}>
              <span className="calendar-cell-day">{Number(day.slice(8, 10))}</span>
              {day === today && <span className="calendar-cell-today">今日</span>}
              <span className="calendar-cell-dots" aria-hidden="true">
                {DOT_KINDS.filter(({ kind }) => counts?.[kind]).map(({ kind }) => <span key={kind} className={'calendar-dot calendar-dot--' + kind} />)}
              </span>
            </button>
          })}
        </div>
        <ul className="calendar-legend">
          {DOT_KINDS.map(({ kind, label }) => <li key={kind}><span className={'calendar-dot calendar-dot--' + kind} aria-hidden="true" />{label}</li>)}
        </ul>
        <p className="dashboard-calendar-note">昨年の印は、前年の同じ日の前後2日の作業・施肥です。</p>
      </section>
      <section className="calendar-day-panel" aria-labelledby="calendar-panel-heading">
        <h2 className="calendar-panel-heading" id="calendar-panel-heading" aria-live="polite">{view.day ? dayHeading(view.day) : '今日から7日'}</h2>
        {showsProposals && <p className="calendar-panel-proposals"><Link href="/dashboard/ai-proposal">今日の提案 {proposalCount}件</Link></p>}
        {view.day
          ? dayRows.length ? <ul className="calendar-panel-rows">{dayRows.map(row => <PanelRow key={row.id} row={row} />)}</ul>
            : <p className="calendar-panel-empty">この日に、見通しや記録はありません。</p>
          : week.length ? week.map(group => <div key={group.day} className="calendar-panel-group">
            <h3 className="calendar-panel-day">{dayHeading(group.day)}</h3>
            <ul className="calendar-panel-rows">{group.rows.map(row => <PanelRow key={row.id} row={row} />)}</ul>
          </div>)
            : <p className="calendar-panel-empty">この7日に、見通しや記録はありません。日を選ぶと、その日のことが出ます。</p>}
        {view.day && <button type="button" className="calendar-panel-back" onClick={() => update({ ...view, day: null })}>今日から7日に戻る</button>}
        {sources.openMeteo && <CompactWeatherDataSource />}
        {sources.jma && <JmaDataSource />}
        {!hasCrops && <p className="calendar-panel-empty"><Link className="underline" href="/crops/new">作付けを登録</Link>すると、収穫の見込みや聞く時期がここに出ます。</p>}
      </section>
    </div>
  </div>
}
