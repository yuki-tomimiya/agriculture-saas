'use client'

import CropForm, { emptyCropForm, type SpringDateBrief } from '@/components/CropForm'

type FarmWithFields = { id: string; name: string; fields: { id: string; name: string }[] }

export default function CropNewForm({
  farms,
  springByFarm,
}: {
  farms: FarmWithFields[]
  springByFarm: Record<string, SpringDateBrief>
}) {
  return <CropForm mode="new" initial={emptyCropForm()} farms={farms} springByFarm={springByFarm} />
}
