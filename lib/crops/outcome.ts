export const END_REASONS = [
  { key: 'finished', label: '収穫しきった' },
  { key: 'disease', label: '病気・虫' },
  { key: 'frost', label: '霜・天候' },
  { key: 'wildlife', label: '獣害' },
  { key: 'stopped', label: '途中でやめた' },
  { key: 'other', label: 'その他' },
] as const

export const GRADE_A_REASONS = [
  { key: 'crack', label: '割れ' },
  { key: 'pest', label: '虫食い' },
  { key: 'disease', label: '病気' },
  { key: 'shape', label: '形が悪い' },
  { key: 'small', label: '小さい' },
  { key: 'rot', label: '腐れ' },
  { key: 'color', label: '色・日焼け' },
  { key: 'bolting', label: 'とう立ち・とり遅れ' },
  { key: 'wildlife', label: '獣害' },
  { key: 'other', label: 'その他' },
] as const

export const GRADE_A_SHARES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const

export const GRADE_A_DEFINITION =
  'A品＝形・色が良く、傷・割れ・病害虫・腐れが無く、熟度がちょうどよく、そのまま出荷・販売できるもの。割合は重さでだいたい何割かを選んでください'

export function gradeLabel(cropName: string, cropKind?: string | null): string {
  return (cropKind ? cropKind.startsWith('strawberry-') : /イチゴ|いちご|苺|strawberry/i.test(cropName)) ? '正品' : 'A品'
}

export const RESULT_PROMPT = '結果を記録してください'

export type CropOutcomeInput = {
  endReason: string
  noHarvest: boolean
  gradeAShare: number | null
  gradeAReason: string | null
  note: string | null
}

export function endReasonLabel(key: string | null | undefined): string {
  return END_REASONS.find((item) => item.key === key)?.label ?? ''
}

export function gradeAReasonLabel(key: string | null | undefined): string {
  return GRADE_A_REASONS.find((item) => item.key === key)?.label ?? ''
}

export function needsGradeAReason(share: number | null, noHarvest: boolean): boolean {
  return !noHarvest && share != null && share <= 50
}

export function parseCropOutcome(body: Record<string, unknown>): { error: string } | { value: CropOutcomeInput } {
  const endReason = typeof body.endReason === 'string' ? body.endReason : ''
  if (!END_REASONS.some((item) => item.key === endReason)) {
    return { error: '終わった理由を選んでください' }
  }
  const noHarvest = body.noHarvest === true || body.gradeAShare === 'none'
  let gradeAShare: number | null = null
  if (!noHarvest) {
    const share = typeof body.gradeAShare === 'number' ? body.gradeAShare : Number(body.gradeAShare)
    if (!GRADE_A_SHARES.includes(share as (typeof GRADE_A_SHARES)[number])) {
      return { error: '出荷・販売できるものの割合を選んでください' }
    }
    gradeAShare = share
  }
  const reasonRaw = typeof body.gradeAReason === 'string' ? body.gradeAReason.trim() : ''
  const gradeAReason = needsGradeAReason(gradeAShare, noHarvest) && reasonRaw
    ? reasonRaw
    : null
  if (gradeAReason && !GRADE_A_REASONS.some((item) => item.key === gradeAReason)) {
    return { error: '出荷・販売できなかった主な理由を選び直してください' }
  }
  const note = typeof body.note === 'string' ? body.note.trim() || null : null
  return { value: { endReason, noHarvest, gradeAShare, gradeAReason, note } }
}

export function outcomeMissing(crop: { status: string; outcome?: { id: string } | null }): boolean {
  return crop.status !== 'growing' && !crop.outcome
}
