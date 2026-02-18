export default function WeatherForecast() {
  const forecastData = [
    { day: '本日', weather: '晴れ 時々 くもり', max: 18, min: 8, precipitation: 10, wind: null },
    { day: '1日後', weather: 'くもり のち 雨', max: 15, min: 7, precipitation: 80, wind: null },
    { day: '2日後', weather: '雨 一時 強風', max: 13, min: 6, precipitation: null, wind: 12 },
    { day: '3日後', weather: 'くもり', max: 14, min: 5, precipitation: 20, wind: null },
    { day: '4日後', weather: '晴れ', max: 17, min: 7, precipitation: 10, wind: null },
    { day: '5日後', weather: '晴れ 時々 くもり', max: 19, min: 9, precipitation: 20, wind: null },
    { day: '6日後', weather: 'くもり 一時 雨', max: 16, min: 8, precipitation: 60, wind: null },
    { day: '7日後', weather: '晴れ 時々 くもり', max: 20, min: 10, precipitation: 20, wind: null },
    { day: '8日後', weather: 'くもり', max: 18, min: 9, precipitation: 30, wind: null },
    { day: '9日後', weather: '雨', max: 17, min: 8, precipitation: 70, wind: null },
    { day: '10日後', weather: '雨 のち くもり', max: 18, min: 9, precipitation: 60, wind: null },
    { day: '11日後', weather: 'くもり', max: 19, min: 9, precipitation: 30, wind: null },
    { day: '12日後', weather: '晴れ', max: 21, min: 11, precipitation: 10, wind: null },
    { day: '13日後', weather: '晴れ 時々 くもり', max: 22, min: 12, precipitation: 10, wind: null },
  ]

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-1">今後2週間の気象情報</h2>
      <p className="text-sm text-gray-500 mb-4">
        拠点：農場A（北緯 43.0 / 東経 141.0）／ 本日から14日先までの日ごとの予報
      </p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <ul className="space-y-1">
          {forecastData.slice(0, 7).map((item, idx) => (
            <li key={idx} className="flex justify-between items-center border-b pb-1.5">
              <div>
                <p className="font-medium">{item.day}</p>
                <p className="text-xs text-gray-500">{item.weather}</p>
              </div>
              <div className="text-right text-xs text-gray-600">
                <p>{item.max}℃ / {item.min}℃</p>
                {item.precipitation !== null ? (
                  <p className={item.precipitation >= 60 ? 'text-red-500' : ''}>
                    降水 {item.precipitation}%
                  </p>
                ) : (
                  <p className="text-red-500">風速 {item.wind}m/s</p>
                )}
              </div>
            </li>
          ))}
        </ul>
        <ul className="space-y-1">
          {forecastData.slice(7, 14).map((item, idx) => (
            <li key={idx + 7} className="flex justify-between items-center border-b pb-1.5">
              <div>
                <p className="font-medium">{item.day}</p>
                <p className="text-xs text-gray-500">{item.weather}</p>
              </div>
              <div className="text-right text-xs text-gray-600">
                <p>{item.max}℃ / {item.min}℃</p>
                {item.precipitation !== null ? (
                  <p className={item.precipitation >= 60 ? 'text-red-500' : ''}>
                    降水 {item.precipitation}%
                  </p>
                ) : (
                  <p className="text-red-500">風速 {item.wind}m/s</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
