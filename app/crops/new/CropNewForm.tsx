'use client'

import CropForm, { emptyCropForm } from '@/components/CropForm'

type FarmWithFields = { id: string; name: string; fields: { id: string; name: string }[] }

export default function CropNewForm({ farms }: { farms: FarmWithFields[] }) {
  return <CropForm mode="new" initial={emptyCropForm()} farms={farms} />
}
