'use client'

import { useRouter, useSearchParams } from 'next/navigation'

type FarmOption = {
  id: string
  name: string
}

export default function WeatherFarmSelector({
  farms,
  selectedFarmId,
}: {
  farms: FarmOption[]
  selectedFarmId?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const onChangeFarm = (farmId: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    if (farmId) params.set('farmId', farmId)
    else params.delete('farmId')
    router.push(`/weather?${params.toString()}`)
  }

  if (farms.length === 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <label htmlFor="weather-farm-select" className="label" style={{ marginBottom: 0 }}>
        対象農場
      </label>
      <select
        id="weather-farm-select"
        className="input"
        style={{ maxWidth: 320 }}
        value={selectedFarmId ?? farms[0].id}
        onChange={(e) => onChangeFarm(e.target.value)}
      >
        {farms.map((farm) => (
          <option key={farm.id} value={farm.id}>
            {farm.name}
          </option>
        ))}
      </select>
    </div>
  )
}

