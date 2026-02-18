export default function WorkCalendar() {
  // 4月のカレンダーデータ（サンプル）
  const calendarDays = [
    // 1週目（空白〜6日）
    ...Array(4).fill(null),
    { day: 1 },
    { day: 2 },
    { day: 3 },
    // 2週目（4〜10日）
    { day: 4 },
    { day: 5 },
    { day: 6 },
    { day: 7 },
    { day: 8 },
    { day: 9 },
    { day: 10, proposals: ['植え付け'], records: ['植え付け'] },
    // 3週目（11〜17日）
    { day: 11 },
    { day: 12 },
    { day: 13, proposals: ['活着確認'] },
    { day: 14 },
    { day: 15, proposals: ['初回追肥'] },
    { day: 16, records: ['初回追肥'] },
    { day: 17 },
    // 4週目（18〜24日）
    { day: 18 },
    { day: 19, proposals: ['防除'] },
    { day: 20, records: ['防除'] },
    { day: 21 },
    { day: 22 },
    { day: 23 },
    { day: 24 },
    // 5週目（25〜30日＋空白）
    { day: 25 },
    { day: 26 },
    { day: 27 },
    { day: 28 },
    { day: 29 },
    { day: 30 },
    null,
  ]

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-1">作業カレンダー（4月：提案と実績）</h2>
      <p className="text-sm text-gray-500 mb-3">
        一般的な月間カレンダー形式で、植え付け〜初回追肥までのスケジュールと実績を確認します。
      </p>
      {/* 月間カレンダー */}
      <div className="border border-gray-200 rounded-lg mb-3">
        <div className="flex justify-between items-center px-3 py-2 border-b">
          <div className="text-xs text-gray-700 font-semibold">
            2026年 4月 ／ A圃場 トマト
          </div>
          <div className="flex gap-2 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>提案
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>実績
            </span>
          </div>
        </div>
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 text-center text-[10px] bg-gray-50 border-b">
          <div className="py-1 text-red-500 font-semibold">日</div>
          <div className="py-1 text-gray-600 font-semibold">月</div>
          <div className="py-1 text-gray-600 font-semibold">火</div>
          <div className="py-1 text-gray-600 font-semibold">水</div>
          <div className="py-1 text-gray-600 font-semibold">木</div>
          <div className="py-1 text-gray-600 font-semibold">金</div>
          <div className="py-1 text-blue-500 font-semibold">土</div>
        </div>
        {/* 日付セル */}
        <div className="grid grid-cols-7 text-[11px]">
          {calendarDays.map((item, idx) => {
            if (item === null) {
              return <div key={idx} className="h-16 border-r border-b bg-gray-50"></div>
            }
            const hasProposals = item.proposals && item.proposals.length > 0
            const hasRecords = item.records && item.records.length > 0
            const bgColor = hasProposals || hasRecords ? 'bg-green-50/40' : ''

            return (
              <div
                key={idx}
                className={`h-16 border-r border-b flex flex-col items-start p-1 ${bgColor}`}
              >
                <span className="text-xs text-gray-700 mb-0.5">{item.day}</span>
                {hasProposals && item.proposals.map((prop, pIdx) => (
                  <span
                    key={pIdx}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[9px] mb-0.5"
                  >
                    提案：{prop}
                  </span>
                ))}
                {hasRecords && item.records.map((rec, rIdx) => (
                  <span
                    key={rIdx}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px]"
                  >
                    実績：{rec}
                  </span>
                ))}
              </div>
            )
          })}
        </div>
      </div>
      {/* 振り返りと今後の提案 */}
      <div className="text-xs mb-2">
        <p className="font-semibold text-gray-700 mb-1">4月の振り返りと、これからの提案</p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>
            植え付けは提案どおり10日に実施できています。今後も、<span className="font-semibold">植え付け日を基準にした積算温度の管理</span>が重要です。
          </li>
          <li>
            初回追肥は提案（15日）より1日遅れの16日に実施。生育に大きな問題はありませんが、来週以降の気温推移によっては、<span className="font-semibold">2回目追肥をやや前倒し</span>する提案を行います。
          </li>
          <li>
            防除は提案（19日）と実績（20日）が1日ずれているため、降雨予報が強い週は、<span className="font-semibold">事前にリマインド</span>を出すと安心です。
          </li>
        </ul>
      </div>
      <p className="text-[11px] text-gray-500">
        ※ 実装時は、このカレンダー上で日付をクリックして作業実績を登録し、提案スケジュールとの差分から「次にいつ・何をすべきか」をAIが再提案するイメージです。
      </p>
    </div>
  )
}
