import PesticideUsage from './PesticideUsage'
import { PESTICIDE_COUNT_NOTE } from '@/lib/pesticide-safety'

export default function PesticideUsageField({ limit, onLimitChange, count, entered }: {
  limit: string
  onLimitChange: (value: string) => void
  count: number
  entered: string
}) {
  return <div>
    <label htmlFor="pesticide-application-limit" className="block text-sm font-medium">
      ラベルの本剤の使用回数（上限・任意）
    </label>
    <input id="pesticide-application-limit" className="input" type="number" min="1" max="2147483647"
      value={limit} onChange={event => onLimitChange(event.target.value)} />
    <p className="mt-2 text-sm" aria-live="polite">
      <PesticideUsage count={count} entered={entered ? Number(entered) : null} limit={limit ? Number(limit) : null} />
    </p>
    <p className="mt-1 text-sm text-gray-600">{PESTICIDE_COUNT_NOTE}</p>
  </div>
}
