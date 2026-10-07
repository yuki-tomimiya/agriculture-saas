'use client'

import Link from 'next/link'
import { matchedBaseCrop } from '@/lib/benchmarks/base-temperature'

export default function BaseTempField({
  value,
  cropName,
  variety,
  onChange,
}: {
  value: string
  cropName: string
  variety: string
  onChange: (next: string) => void
}) {
  const matched = matchedBaseCrop(cropName, variety)
  const usual = matched?.baseTemp ?? null
  const numeric = value.trim() === '' ? null : Number(value)
  const differs =
    usual != null && numeric != null && Number.isFinite(numeric) && numeric !== usual

  return (
    <div className="auth-field">
      <label htmlFor="crop-base-temp" className="label">
        基準温度
        <Link href="/faq/base-temp" className="chart-help" aria-label="基準温度とは">
          ？
        </Link>
      </label>
      <input
        id="crop-base-temp"
        type="number"
        inputMode="decimal"
        min={0}
        max={20}
        step={0.5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
        placeholder={usual == null ? '空欄なら10℃' : `空欄なら${usual}℃`}
      />
      {differs && (
        <p className="insights-regional-meta" style={{ marginTop: '0.35rem' }}>
          {matched?.name ?? 'この作物'}の一般値は{usual}℃です。意図的でなければ{usual}℃をおすすめします。保存はできます。
        </p>
      )}
    </div>
  )
}
