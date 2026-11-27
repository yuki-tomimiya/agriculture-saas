import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderWithRouter } from './helpers/next-runtime'
import { matchedSoilPh } from '../lib/benchmarks/soil-ph'
import FaqAnswer from '@/app/faq/articles'
import WeatherDataSource, { WeatherDataNotes } from '@/components/WeatherDataSource'

test('適正pHの出典と従来の品目、天気の種類に応じた帰属を表示する', () => {
  for (const [name, min, max] of [['ホウレンソウ', 6.5, 7], ['トマト', 6, 6.5], ['にんじん', 5.5, 6.5], ['かぼちゃ', 6, 6.5], ['ジャガイモ', 5.5, 6], ['さつまいも', 5.5, 6]] as const) {
    const ph = matchedSoilPh(name)
    assert.deepEqual([ph?.min, ph?.max], [min, max])
  }
  const faq = renderWithRouter(<FaqAnswer slug="soil-ph" />)
  assert.match(faq, /岐阜県.*主要園芸作物標準技術体系.*埼玉県.*さといもは、埼玉県の表23と宮崎県/s)
  assert.doesNotMatch(faq, /農林水産省「都道府県施肥基準等」資料3/)
  for (const archive of [false, true]) {
    for (const view of [<WeatherDataSource key="source" kind={archive ? 'archive' : 'forecast'} />, <WeatherDataNotes key="notes" archive={archive} forecast />]) {
      const html = renderWithRouter(view)
      assert.match(html, /This service is based on data and products of the European Centre for Medium-Range Weather Forecasts \(ECMWF\)/)
      assert.match(html, /open-meteo.com\/en\/licence/)
      assert.equal(html.includes('10.24381/cds.adbb2d47'), archive)
      assert.equal(html.includes('10.24381/cds.e2161bac'), archive)
      if (archive) assert.match(html, /2017年.*ECMWF.*ERA5-Land/s)
      assert.doesNotMatch(html, /ERA5などに基づく再解析/)
    }
  }
})
