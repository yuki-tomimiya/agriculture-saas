import type { ListRow } from '@/components/ManagementList'
import { daysSincePlanting, formatDateShort } from '@/lib/utils'

export function archiveStatusLabel(status: string) {
  return status === 'harvested' ? '収穫済み' : '完了'
}

export function cropListRow(crop: {
  id: string
  name: string
  variety: string | null
  status: string
  plantingDate: Date | null
  harvestDate: Date | null
  farm: { name: string } | null
  field: { name: string } | null
  _count: { harvests: number; tasks: number; workRecords: number }
}, archive: boolean): ListRow {
  const days = crop.plantingDate ? daysSincePlanting(crop.plantingDate) : null
  return {
    id: crop.id,
    cells: [
      ...(archive ? [{ text: archiveStatusLabel(crop.status) }] : []),
      { text: crop.name, href: `/crops/${crop.id}` },
      crop.variety ? { text: crop.variety } : null,
      crop.farm ? { text: crop.farm.name } : null,
      crop.field ? { text: crop.field.name } : null,
      crop.plantingDate ? {
        text: formatDateShort(crop.plantingDate) + (days == null ? '' : `（植付から${days}日）`),
        value: crop.plantingDate.getTime(),
      } : null,
      crop.harvestDate ? { text: formatDateShort(crop.harvestDate), value: crop.harvestDate.getTime() } : null,
      { text: String(crop._count.harvests), value: crop._count.harvests },
      ...(archive ? [] : [{ text: String(crop._count.tasks), value: crop._count.tasks }]),
      { text: String(crop._count.workRecords), value: crop._count.workRecords },
    ],
    action: archive ? { href: `/crops/${crop.id}/retrospective`, text: '振り返り' }
      : crop.plantingDate ? { href: `/gdd/${crop.id}`, text: '生育ナビ' } : undefined,
  }
}
