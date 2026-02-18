export default function GDDChart() {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-1">積算温度から見た生育ナビ</h2>
      <p className="text-sm text-gray-500 mb-3">
        植え付け日からの積算温度（GDD）の推移を、標準年と今年で比較して表示します。
      </p>
      {/* 積算温度の推移グラフ（簡易ラインチャート風） */}
      <div className="mb-4">
        <div className="flex justify-between items-center text-xs mb-1">
          <span className="text-gray-600">植え付けからの推移（累積 ℃日）</span>
          <span className="font-semibold text-green-700">現在：820 ℃日 / 目標：1,000 ℃日</span>
        </div>
        <div className="relative w-full h-28 bg-gray-50 rounded-md border border-gray-100 overflow-hidden">
          {/* グリッド線 */}
          <div className="absolute inset-0 flex flex-col justify-between">
            <div className="h-px bg-gray-200/60"></div>
            <div className="h-px bg-gray-200/40"></div>
            <div className="h-px bg-gray-200/20"></div>
          </div>
          {/* 標準年のライン（点線） */}
          <svg className="absolute inset-0 w-full h-full">
            <polyline
              points="0,80 40,70 80,60 120,50 160,40 200,32 240,25 280,18"
              fill="none"
              stroke="#9CA3AF"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            {/* 今年のライン（太線） */}
            <polyline
              points="0,82 40,72 80,58 120,44 160,34 200,24 240,16 280,10"
              fill="none"
              stroke="#16A34A"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          {/* 現在地点のマーカー */}
          <div className="absolute -right-1 top-2 flex flex-col items-end text-[10px]">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-green-600"></span>
              <span className="text-green-700 font-semibold">今年：820 ℃日</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-400"></span>
              <span className="text-gray-500">標準：760 ℃日</span>
            </div>
          </div>
          {/* X軸ラベル */}
          <div className="absolute bottom-1 left-0 right-0 flex justify-between px-2 text-[10px] text-gray-500">
            <span>植え付け（4/10）</span>
            <span>+30日</span>
            <span>+60日</span>
            <span>+90日</span>
          </div>
        </div>
      </div>
      {/* 標準年との比較コメント */}
      <div className="mb-3 text-xs">
        <p className="font-semibold text-gray-700 mb-1">標準年との比較</p>
        <p className="text-gray-700">
          同じ日付時点の標準積算温度：<span className="font-semibold">760 ℃日</span>
          <br />
          → <span className="font-semibold text-green-700">今年は +60 ℃日（約 5〜7日分）進行</span> しており、生育はやや前倒し傾向です。
        </p>
      </div>
      {/* 積算温度に基づく提案 */}
      <div className="text-xs mb-3">
        <p className="font-semibold text-gray-700 mb-1">今すぐ検討したいこと</p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>
            最初のまとまった収穫に備えて、<span className="font-semibold">パートさんのシフト・出荷計画</span>を前倒しで調整。
          </li>
          <li>
            高温で一気に色づく可能性があるため、<span className="font-semibold">収穫間隔を短く</span>（2〜3日おき）に見直し。
          </li>
        </ul>
      </div>
      <p className="text-[11px] text-gray-500">
        ※ 実装時は、日々の気温データから自動で積算温度カーブを更新し、「標準」との差をもとにコメントを生成する想定です。
      </p>
    </div>
  )
}
