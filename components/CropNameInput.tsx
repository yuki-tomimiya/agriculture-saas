'use client'

import { listBenchmarkDisplayNames } from '@/lib/benchmarks/crops'

const CROP_NAME_SUGGESTIONS = listBenchmarkDisplayNames()

export default function CropNameInput({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="input"
        placeholder="例：トマト"
        maxLength={200}
        list={`${id}-suggestions`}
        autoComplete="off"
      />
      <datalist id={`${id}-suggestions`}>
        {CROP_NAME_SUGGESTIONS.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <p className="text-sm text-gray-500 mt-1">
        候補から選ぶと、基準温度や提案の目安がその品目に揃います。候補にない名前も登録できます。
      </p>
    </>
  )
}
