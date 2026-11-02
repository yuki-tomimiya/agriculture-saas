import { plantingConditionForKind } from '@/lib/benchmarks/planting-conditions'
import { cropKindByKey } from '@/lib/crops/conditions'

export default function FarmPlantingConditions({ crops }: {
  crops: { cropKind: string | null; growingSite: string | null; plantingMethod: string | null }[]
}) {
  const conditions = new Map<string, { label: string; text: string; scope: string }>()
  for (const crop of crops) {
    const kind = cropKindByKey(crop.cropKind)
    if (crop.growingSite === 'house' || !kind || kind.recordOnly) continue
    const condition = plantingConditionForKind(kind.key, crop.plantingMethod)
    if (condition) conditions.set(kind.key, { label: kind.label, text: condition.text, scope: condition.scopeLabel })
  }
  if (!conditions.size) return null
  return (
    <section className="bg-white p-6 rounded-lg shadow mb-8">
      <h2 className="text-xl font-semibold mb-4">この農場の作付けの植える条件</h2>
      <ul className="space-y-3">
        {Array.from(conditions, ([key, condition]) => (
          <li key={key}>
            <h3 className="font-semibold">{condition.label}</h3>
            <p className="text-gray-800">{condition.text}</p>
            <p className="text-sm text-gray-500">{condition.scope}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
