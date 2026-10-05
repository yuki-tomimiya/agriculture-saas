/** 作業記録の作業種別（施肥・防除は専用記録へ） */
export const WORK_TASK_TYPES = [
  '植え付け',
  '除草',
  '整地',
  '土づくり',
  '土寄せ',
  '収穫準備',
  '試し掘り',
  '収穫',
  '誘引・仕立て',
  '摘花・除葉',
  'その他',
] as const

export type WorkTaskType = (typeof WORK_TASK_TYPES)[number]

export function isWorkTaskType(value: string): value is WorkTaskType {
  return (WORK_TASK_TYPES as readonly string[]).includes(value)
}

const WORK_TASK_ALIASES: Record<string, WorkTaskType> = {
  つる返し: '誘引・仕立て',
  除草: '除草',
  植え付け: '植え付け',
  芽かき: '摘花・除葉',
  摘芯: '摘花・除葉',
  整枝: '誘引・仕立て',
}

/** 提案の作業名を、作業記録フォームの選択肢に合わせる */
export function resolveWorkTaskType(value: string | undefined): WorkTaskType {
  if (value && isWorkTaskType(value)) return value
  if (value && WORK_TASK_ALIASES[value]) return WORK_TASK_ALIASES[value]
  return value ? 'その他' : WORK_TASK_TYPES[0]
}
