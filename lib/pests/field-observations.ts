import { adviceNames } from '@/lib/crops/conditions'
import { pests } from '@/lib/pests/catalog'

export function fieldObservationPests(crop: { cropKind: string | null; name: string; variety: string | null }) {
  if (adviceNames(crop).recordOnly) return []
  return pests.filter(pest => pest.cropKind === crop.cropKind).map(pest => ({
    key: pest.key, name: pest.name, marker: pest.marker, appearanceUrl: pest.appearance?.url,
  }))
}
