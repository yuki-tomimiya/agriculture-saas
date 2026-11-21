/** 保存後は対象の作付けへ。栽培を終えた編集だけは振り返りを開く。 */
export function cropSaveHref({ mode, cropId, initialStatus, status }: {
  mode: 'new' | 'edit'; cropId: string; initialStatus: string; status: string
}): string {
  return mode === 'edit' && initialStatus === 'growing' && (status === 'harvested' || status === 'completed')
    ? `/crops/${cropId}/retrospective?from=status` : `/crops/${cropId}`
}
