import { redirect } from 'next/navigation'
import { historyRedirectHref } from '@/lib/calendar/day-panel'

/** 前の「過去の実績」。カレンダーで今月より前へ送れるようになったので、前のリンク・ブックマークはカレンダーのその月へ送る */
export default async function CalendarHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ year?: string; month?: string }>
}) {
  redirect(historyRedirectHref((await searchParams) ?? {}))
}
