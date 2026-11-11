import Link from 'next/link'
import { harvestDateLabel } from '@/lib/pesticide-safety'
import type { CropRecordGuidance, ProposalRecordGuidance } from '@/lib/proposals/record-guidance'

export function RecordGuidance({ entry }: { entry?: CropRecordGuidance }) {
  if (!entry) return null
  const { fertilizer, harvestFrom } = entry
  const elapsed = fertilizer?.daysAgo == null ? '' : fertilizer.daysAgo === 0 ? '（今日）' : `（${fertilizer.daysAgo}日前）`
  return <>
    {fertilizer && (
      <span className="block text-sm">
        {fertilizer.last
          ? `最後の施肥：${harvestDateLabel(fertilizer.last)}${elapsed}`
          : 'この作付けの施肥の記録はまだありません'}
        {fertilizer.recorded && ' · 記録済み'}
        {' · '}
        <Link href={fertilizer.href} className="underline">施肥を記録する</Link>
      </span>
    )}
    {harvestFrom && (
      <span className="block text-sm">
        農薬の記録では、収穫できるのは{harvestDateLabel(harvestFrom)}からです。
      </span>
    )}
  </>
}

export function FertilizerStandards({ standards }: { standards?: ProposalRecordGuidance['standards'] }) {
  if (!standards?.length) return null
  return (
    <p className="mt-2 text-sm">
      施肥量を確認できる資料：
      {standards.map((standard, index) => (
        <span key={standard.url}>
          {index > 0 && '、'}
          <a href={standard.url} className="underline">{standard.title}</a>
        </span>
      ))}
      {standards.some(standard => standard.fallback) &&
        '。近くの県の基準を参考にできる場合があります。普及指導員に相談してください。'}
    </p>
  )
}
