export default function WeatherNav() {
  return (
    <div className="bg-white border border-green-100 rounded-lg shadow mb-8 p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-xl font-semibold mb-1">今週の気象ナビ</h2>
          <p className="text-sm text-gray-600">
            過去5年分の同じ作付けシーズン（4〜9月）の気象データと、直近2週間の予報をもとにした、今シーズン向けのアドバイスです。
          </p>
        </div>
        <div className="flex gap-2 text-xs text-gray-600">
          <span className="px-2 py-1 rounded-full bg-green-50 border border-green-200">
            対象作付け：A圃場 トマト（4/10 植え付け）
          </span>
          <span className="px-2 py-1 rounded-full bg-gray-50 border border-gray-200">
            期間：4/10 〜 9/30
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="bg-green-50 border border-green-100 rounded-md p-3">
          <p className="text-xs font-semibold text-green-800 mb-1">平年との違い</p>
          <ul className="space-y-1 text-xs text-gray-700">
            <li>・今週は平均より <span className="font-semibold text-red-600">+2〜3℃ 高め</span> の予想。</li>
            <li>・降水量は平年比 <span className="font-semibold text-blue-700">80%</span> で、やや少なめ。</li>
            <li>・日照時間は平年より長く、乾燥傾向です。</li>
          </ul>
        </div>
        <div className="bg-yellow-50 border border-yellow-100 rounded-md p-3">
          <p className="text-xs font-semibold text-yellow-800 mb-1">今週やっておきたいこと</p>
          <ol className="list-decimal list-inside space-y-1 text-xs text-gray-700">
            <li>高温＋乾燥対策として、<span className="font-semibold">潅水量を10〜20%増やす</span>計画を検討。</li>
            <li>日中の高温時間帯（13〜15時）のハウス作業を避け、<span className="font-semibold">早朝・夕方に集中</span>。</li>
            <li>多雨の翌週に備え、<span className="font-semibold">病害防除のタイミングを1〜2日前倒し</span>。</li>
          </ol>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-md p-3">
          <p className="text-xs font-semibold text-blue-800 mb-1">注意すべき日</p>
          <ul className="space-y-1 text-xs text-gray-700">
            <li>・<span className="font-semibold">4日後（木）</span>：強風（最大12m/s）＋雨予報 → ハウス・資材の固定を事前に確認。</li>
            <li>・<span className="font-semibold">7日後（日）</span>：終日くもり＋高湿度 → 葉面の乾きが悪く病害リスク↑。</li>
            <li>・その前日までに、<span className="font-semibold">排水路の点検</span>とハウス内の換気計画を確認。</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
