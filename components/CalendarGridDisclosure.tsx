'use client'

import { useState, type ReactNode } from 'react'

export default function CalendarGridDisclosure({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false)
  return <div className="calendar-grid-disclosure">
    <button type="button" className="btn btn-outline calendar-grid-toggle" onClick={() => setExpanded(!expanded)}
      aria-controls="calendar-months" aria-expanded={expanded}>{expanded ? '月のマスを閉じる' : '月のマスを開く'}</button>
    <div id="calendar-months" data-expanded={expanded}>{children}</div>
  </div>
}
