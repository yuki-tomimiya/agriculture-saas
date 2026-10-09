import { nationalYieldCopy } from '@/lib/benchmarks/national-yield'

export default function NationalYieldNote({
  cropName,
  variety,
  qty,
  unit,
  areaM2,
  sharedField = false,
}: {
  cropName: string
  variety: string | null
  qty: number
  unit: string
  areaM2: number | null
  sharedField?: boolean
}) {
  const copy = nationalYieldCopy(cropName, variety, { qty, unit, areaM2, sharedField })
  if (!copy) return null
  return (
    <p className="insights-regional-text" style={{ marginTop: '0.75rem' }}>
      {copy.text}
      {' '}
      <a href={copy.sourceUrl} className="text-green-700 hover:underline">
        出典
      </a>
    </p>
  )
}
