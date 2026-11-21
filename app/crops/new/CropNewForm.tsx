'use client'

import CropForm, { emptyCropForm, type SpringDateBrief } from '@/components/CropForm'

type FarmWithFields = { id: string; name: string; fields: { id: string; name: string }[] }

export default function CropNewForm({
  farms,
  springByFarm,
  initialFarmId,
}: {
  farms: FarmWithFields[]
  springByFarm: Record<string, SpringDateBrief>
  initialFarmId?: string
}) {
  return <CropForm mode="new" initial={{ ...emptyCropForm(), farmId: initialFarmId ?? '' }}
    autoSelectFarm={initialFarmId === undefined} returnFarmId={initialFarmId || undefined} farms={farms} springByFarm={springByFarm} />
}
