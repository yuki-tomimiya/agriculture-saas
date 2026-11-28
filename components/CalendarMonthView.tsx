'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CompactWeatherDataSource, JmaDataSource } from './WeatherDataSource'
import {
  calendarHref, cellLabel, dayHeading, dotsByDay, kindsInMonth, monthCells, monthDayLabel, monthSummary, monthSummaryHeading,
  panelSources, panelWeek, rowsOnDay, seasonLines, shiftView, type CalendarView,
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
  rows, today, firstMonth = today.slice(0, 7), lastMonth, loadedPastMonths = [], initialView, farms, farmId, proposalCount, hasCrops,
}: {
  rows: OutlookRow[]
  today: string
  /** 記録のある最も古い月 'YYYY-MM'（記録が無ければ今月。台帳 I28） */
  firstMonth?: string
  /** 見通しの範囲（台帳 I28）の終わりの月 'YYYY-MM' */
  lastMonth: string
  /** 記録を読み込んである今月より前の月。ほかの今月より前の月へは URL で読み直す */
  loadedPastMonths?: string[]
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
  const isPastMonth = view.month < thisMonth
  const [year, month] = view.month.split('-').map(Number)
  const previous = shiftView(view, -1, today, lastMonth, firstMonth)
  const next = shiftView(view, 1, today, lastMonth, firstMonth)
  const dots = dotsByDay(rows, today)
  const legend = kindsInMonth(dots, view.month)
  const seasons = seasonLines(rows, view.month)
  const dayRows = view.day ? rowsOnDay(rows, view.day, today) : []
  const pastDay = view.day != null && view.day < today
  const summary = !view.day && isPastMonth ? monthSummary(rows, view.month, farms.length > 1) : null
  const week = view.day || summary ? [] : panelWeek(rows, today)
  const shown = view.day ? dayRows : week.flatMap(group => group.rows)
  const sources = panelSources(shown)
  const showsProposals = proposalCount > 0 && (view.day ? view.day === today : !isPastMonth)
  // 読み込んである月へは画面の中で送り、ほかの今月より前の月へは URL で読み直す
  const step = (target: CalendarView | null, label: string, symbol: string, none: string) => {
    if (!target) return <button type="button" className="calendar-month-step" disabled aria-label={none}>{symbol}</button>
    if (target.month < thisMonth && !loadedPastMonths.includes(target.month))
      return <Link href={calendarHref(target, today, farmId)} scroll={false} className="calendar-month-step" aria-label={label}>{symbol}</Link>
    return <button type="button" className="calendar-month-step" onClick={() => update(target)} aria-label={label}>{symbol}</button>
  }

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
          {step(previous, '前の月', '‹', '前の月（これより前の記録はありません）')}
          <h2 className="calendar-month-title" id="calendar-month-heading" aria-live="polite">{year}年{month}月</h2>
          {step(next, '次の月', '›', '次の月（見通しはこの月まで）')}
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
              className={'calendar-cell' + (day === today ? ' calendar-cell--today' : '') + (day < today ? ' calendar-cell--past' : '') + (selected ? ' calendar-cell--selected' : '')}
              onClick={() => update({ ...view, day: selected ? null : day })}>
              <span className="calendar-cell-day">{Number(day.slice(8, 10))}</span>
              {day === today && <span className="calendar-cell-today">今日</span>}
              <span className="calendar-cell-dots" aria-hidden="true">
                {legend.filter(({ kind }) => counts?.[kind]).map(({ kind }) => <span key={kind} className={'calendar-dot calendar-dot--' + kind} />)}
              </span>
            </button>
          })}
        </div>
        {legend.length > 0 && <ul className="calendar-legend">
          {legend.map(({ kind, label }) => <li key={kind}><span className={'calendar-dot calendar-dot--' + kind} aria-hidden="true" />{label}</li>)}
        </ul>}
        {legend.some(({ kind }) => kind === 'lastYear') && <p className="dashboard-calendar-note">昨年の印は、前年の同じ日の前後2日の作業・施肥です。</p>}
      </section>
      <section className="calendar-day-panel" aria-labelledby="calendar-panel-heading">
        <h2 className="calendar-panel-heading" id="calendar-panel-heading" aria-live="polite">
          {view.day ? dayHeading(view.day, today) : summary ? monthSummaryHeading(view.month, today) : '今日から7日'}
        </h2>
        {showsProposals && <p className="calendar-panel-proposals"><Link href="/dashboard/ai-proposal">今日の提案 {proposalCount}件</Link></p>}
        {view.day
          ? dayRows.length ? <ul className="calendar-panel-rows">{dayRows.map(row => <PanelRow key={row.id} row={row} />)}</ul>
            : <p className="calendar-panel-empty">{pastDay ? 'この日の記録はありません。' : 'この日に、見通しや記録はありません。'}</p>
          : summary
            ? <>
              {summary.length ? <ul className="calendar-panel-rows">{summary.map(group => <li key={group.key} className="calendar-panel-row">
                {group.href ? <Link href={group.href} className="calendar-panel-title">{group.title}</Link> : <span className="calendar-panel-title">{group.title}</span>}
                <p className="calendar-panel-summary">{group.line}</p>
              </li>)}</ul> : <p className="calendar-panel-empty">この月の記録はありません。</p>}
              <p className="calendar-panel-hint">日を選ぶと、その日の記録が出ます</p>
            </>
            : week.length ? week.map(group => <div key={group.day} className="calendar-panel-group">
              <h3 className="calendar-panel-day">{dayHeading(group.day, today)}</h3>
              <ul className="calendar-panel-rows">{group.rows.map(row => <PanelRow key={row.id} row={row} />)}</ul>
            </div>)
              : <p className="calendar-panel-empty">この7日に、見通しや記録はありません。日を選ぶと、その日のことが出ます。</p>}
        {view.day && <button type="button" className="calendar-panel-back" onClick={() => update({ ...view, day: null })}>
          {isPastMonth ? monthSummaryHeading(view.month, today) + 'に戻る' : '今日から7日に戻る'}
        </button>}
        {sources.openMeteo && <CompactWeatherDataSource />}
        {sources.jma && <JmaDataSource />}
        {!hasCrops && <p className="calendar-panel-empty"><Link className="underline" href="/crops/new">作付けを登録</Link>すると、収穫の見込みや聞く時期がここに出ます。</p>}
      </section>
    </div>
  </div>
}
