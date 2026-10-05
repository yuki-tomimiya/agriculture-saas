export type CropDeleteCounts = {
  harvests: number
  workRecords: number
  pesticideRecords: number
  fertilizerRecords: number
  sales: number
  tasks: number
}

/** 記録がなければ短い確認。収穫は消える。それ以外は紐づけだけ外れる。 */
export function cropDeleteConfirmMessage(
  counts: CropDeleteCounts,
  options?: { suggestComplete?: boolean }
): string {
  const remain: string[] = []
  if (counts.workRecords > 0) remain.push(`作業記録${counts.workRecords}件`)
  if (counts.pesticideRecords > 0) remain.push(`農薬${counts.pesticideRecords}件`)
  if (counts.fertilizerRecords > 0) remain.push(`施肥${counts.fertilizerRecords}件`)
  if (counts.sales > 0) remain.push(`販売${counts.sales}件`)
  if (counts.tasks > 0) remain.push(`タスク${counts.tasks}件`)

  const hasAny = counts.harvests > 0 || remain.length > 0
  if (!hasAny) return 'この作付けを削除しますか？'

  const parts = ['この作付けを削除します。']
  if (counts.harvests > 0) {
    parts.push(`収穫${counts.harvests}件も一緒に消えます。`)
  }
  if (remain.length > 0) {
    parts.push(`${remain.join('・')}は残りますが、作付けとの紐づけは外れます。`)
  }
  if (options?.suggestComplete) {
    parts.push('誤登録でなければ、削除せず編集から完了にしてください。')
  }
  return parts.join('')
}
