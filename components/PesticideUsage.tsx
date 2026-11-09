import { pesticideUsage } from '@/lib/pesticide-safety'

export default function PesticideUsage({ count, entered, limit }: {
  count: number; entered: number | null; limit: number | null
}) {
  const usage = pesticideUsage(count, entered, limit)
  if (!usage.count && limit == null) return null
  return <>
    {usage.count > 0 && <span>{usage.count}回目</span>}
    {limit != null && <span>{usage.count > 0 ? '／' : ''}上限{limit}回</span>}
    {usage.state && <strong className="block text-red-700">
      {usage.state === 'over' ? '本剤の使用回数の上限を超えています' : '本剤の使用回数の上限に達しています'}
    </strong>}
  </>
}
