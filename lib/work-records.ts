/** 作業記録の作業種別（施肥・防除は専用記録へ） */
export const WORK_TASK_TYPES = [
  '植え付け',
  '除草',
  '整地',
  '収穫準備',
  '誘引・仕立て',
  '摘花・除葉',
  'その他',
] as const

export type WorkTaskType = (typeof WORK_TASK_TYPES)[number]

export function isWorkTaskType(value: string): value is WorkTaskType {
  return (WORK_TASK_TYPES as readonly string[]).includes(value)
}
