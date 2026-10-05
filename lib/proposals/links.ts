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
  action?: { kind: 'work' | 'task' | 'sale' | 'finish' | 'pesticide'; taskType?: string; title?: string }
}

export function recordHref(proposal: LinkInput): string {
  const date = formatLocalYmd(proposal.suggestedDate ?? new Date())
  if (proposal.action?.kind === 'pesticide') {
    const params = new URLSearchParams()
    if (proposal.relatedCropId) params.set('cropId', proposal.relatedCropId)
    if (proposal.relatedFarmId) params.set('farmId', proposal.relatedFarmId)
    params.set('date', date)
    return `/pesticides/new?${params}`
  }
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
  if (raw) {
    params.set('taskType', resolveWorkTaskType(raw))
    if (raw !== resolveWorkTaskType(raw) && !isWorkTaskType(raw)) {
      params.set('description', raw)
    }
  }
  params.set('date', date)
  return `/work-records/new?${params}`
}

export function harvestHref(input: {
  cropId: string
  farmId?: string
  date?: Date
  returnTo?: string
}): string {
  const params = new URLSearchParams()
  params.set('cropId', input.cropId)
  if (input.farmId) params.set('farmId', input.farmId)
  params.set('date', formatLocalYmd(input.date ?? new Date()))
  if (input.returnTo) params.set('returnTo', input.returnTo)
  return `/harvests/new?${params}`
}

export function taskHref(proposal: LinkInput): string {
  const params = new URLSearchParams()
  if (proposal.relatedCropId) params.set('cropId', proposal.relatedCropId)
  if (proposal.relatedFarmId) params.set('farmId', proposal.relatedFarmId)
  params.set('title', proposal.action?.title || proposal.title)
  params.set('dueDate', formatLocalYmd(proposal.suggestedDate ?? new Date()))
  return `/tasks/new?${params}`
}
