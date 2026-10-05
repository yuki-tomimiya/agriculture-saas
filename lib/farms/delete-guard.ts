export type FarmDeleteCounts = {
  crops: number
  workRecords: number
  tasks: number
  soilDiagnoses: number
  pesticideRecords: number
  fertilizerRecords: number
  sales: number
  fields: number
}

/**
 * 作物が無くても、作業・タスク・土壌診断は農場ごと消える。
 * 農薬・施肥・販売は農場の紐づけが外れる。残件がある農場は消さない。
 */
export function farmDeleteBlockMessage(counts: FarmDeleteCounts): string | null {
  const parts: string[] = []
  if (counts.crops > 0) parts.push(`作物${counts.crops}件`)
  if (counts.workRecords > 0) parts.push(`作業記録${counts.workRecords}件`)
  if (counts.tasks > 0) parts.push(`タスク${counts.tasks}件`)
  if (counts.soilDiagnoses > 0) parts.push(`土壌診断${counts.soilDiagnoses}件`)
  if (counts.pesticideRecords > 0) parts.push(`農薬記録${counts.pesticideRecords}件`)
  if (counts.fertilizerRecords > 0) parts.push(`施肥記録${counts.fertilizerRecords}件`)
  if (counts.sales > 0) parts.push(`販売${counts.sales}件`)
  if (parts.length === 0) return null
  if (counts.crops > 0) {
    return `この農場には${parts.join('・')}があります。先に作物を移すか削除してください。`
  }
  return `この農場には${parts.join('・')}が残っています。先にそれらを削除してください。`
}

export function farmDeleteConfirmMessage(counts: FarmDeleteCounts): string {
  if (counts.fields > 0) {
    return `この農場を削除します。圃場${counts.fields}件も一緒に消えます。`
  }
  return 'この農場を削除しますか？'
}
