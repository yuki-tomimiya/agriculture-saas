import { isWorkTaskType, resolveWorkTaskType } from '@/lib/work-records'

export function formatLocalYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

type LinkInput = {
  relatedCropId?: string
  relatedFarmId?: string
  suggestedDate?: Date
  title: string
  action?: { kind: 'work' | 'task' | 'sale'; taskType?: string; title?: string }
}

export function recordHref(proposal: LinkInput): string {
  const date = formatLocalYmd(proposal.suggestedDate ?? new Date())
  if (proposal.action?.kind === 'sale') {
    const params = new URLSearchParams()
    if (proposal.relatedCropId) params.set('cropId', proposal.relatedCropId)
    if (proposal.relatedFarmId) params.set('farmId', proposal.relatedFarmId)
    params.set('date', date)
    return `/sales/new?${params}`
  }
  const params = new URLSearchParams()
  if (proposal.relatedCropId) params.set('cropId', proposal.relatedCropId)
  if (proposal.relatedFarmId) params.set('farmId', proposal.relatedFarmId)
  const raw = proposal.action?.taskType
  params.set('taskType', resolveWorkTaskType(raw))
  if (raw && raw !== resolveWorkTaskType(raw) && !isWorkTaskType(raw)) {
    params.set('description', raw)
  }
  params.set('date', date)
  return `/work-records/new?${params}`
}

export function taskHref(proposal: LinkInput): string {
  const params = new URLSearchParams()
  if (proposal.relatedCropId) params.set('cropId', proposal.relatedCropId)
  if (proposal.relatedFarmId) params.set('farmId', proposal.relatedFarmId)
  params.set('title', proposal.action?.title || proposal.title)
  params.set('dueDate', formatLocalYmd(proposal.suggestedDate ?? new Date()))
  return `/tasks/new?${params}`
}
