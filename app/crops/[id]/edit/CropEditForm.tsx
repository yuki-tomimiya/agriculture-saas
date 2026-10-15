'use client'

import CropForm, { type CropFormInitial, type SpringDateBrief } from '@/components/CropForm'

type FarmWithFields = { id: string; name: string; fields: { id: string; name: string }[] }

export default function CropEditForm({
  cropId,
  initial,
  farms,
  springByFarm,
}: {
  cropId: string
  initial: CropFormInitial
  farms: FarmWithFields[]
  springByFarm: Record<string, SpringDateBrief>
}) {
  return <CropForm mode="edit" cropId={cropId} initial={initial} farms={farms} springByFarm={springByFarm} />
}
