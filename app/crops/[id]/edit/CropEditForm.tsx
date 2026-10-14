'use client'

import CropForm, { type CropFormInitial } from '@/components/CropForm'

type FarmWithFields = { id: string; name: string; fields: { id: string; name: string }[] }

export default function CropEditForm({
  cropId,
  initial,
  farms,
}: {
  cropId: string
  initial: CropFormInitial
  farms: FarmWithFields[]
}) {
  return <CropForm mode="edit" cropId={cropId} initial={initial} farms={farms} />
}
