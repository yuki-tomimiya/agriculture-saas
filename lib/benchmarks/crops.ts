/**
 * 一般目安（教科書的な参考値）
 * マッチしない作物は null（「目安準備中」表示用）
 */

export type CropBenchmark = {
  /** マッチ用キーワード（作物名・品種名・表記ゆれ） */
  keywords: string[]
  displayName: string
  /** 収量の目安（中小規模・参考レンジ） */
  yieldHint: string
  /** 収量レンジ（kg、1作付けあたりのざっくり目安） */
  yieldKgRange?: { min: number; max: number }
  /** この時期に多い作業（月 1–12 → 文言） */
  monthlyWorkHints: Partial<Record<number, string>>
  /** 防除間隔などの一般ルール */
  generalTips: string[]
}

export const CROP_BENCHMARKS: CropBenchmark[] = [
  {
    keywords: ['トマト', 'とまと', 'tomato'],
    displayName: 'トマト',
    yieldHint: '中小規模の目安：1作付けあたりおおよそ 80〜200kg（規模・品種で大きく変動）',
    yieldKgRange: { min: 80, max: 200 },
    monthlyWorkHints: {
      3: '定植・誘引の準備が多い時期',
      4: '定植・初期の追肥・誘引が多い時期',
      5: '追肥・防除・芽かきが多い時期',
      6: '追肥・防除・摘芯が多い時期',
      7: '収穫・防除・追肥が多い時期',
      8: '収穫ピーク・追肥・防除が多い時期',
      9: '後半の収穫・片付けの準備が多い時期',
    },
    generalTips: ['防除は7〜10日間隔が目安', '追肥は生育に合わせて3〜4回程度が目安'],
  },
  {
    keywords: ['キュウリ', 'きゅうり', '胡瓜', '黄瓜'],
    displayName: 'キュウリ',
    yieldHint: '中小規模の目安：1作付けあたりおおよそ 60〜180kg（規模・品種で変動）',
    yieldKgRange: { min: 60, max: 180 },
    monthlyWorkHints: {
      4: '定植・誘引が多い時期',
      5: '追肥・防除・収穫開始が多い時期',
      6: '収穫・追肥・防除が多い時期',
      7: '収穫ピーク・防除が多い時期',
      8: '収穫・更新・防除が多い時期',
    },
    generalTips: ['収穫最盛期はほぼ毎日の収穫が目安', 'うどんこ病などへの定期防除を検討'],
  },
  {
    keywords: ['ナス', 'なす', '茄子'],
    displayName: 'ナス',
    yieldHint: '中小規模の目安：1作付けあたりおおよそ 50〜150kg（規模・品種で変動）',
    yieldKgRange: { min: 50, max: 150 },
    monthlyWorkHints: {
      5: '定植・活着後の管理が多い時期',
      6: '追肥・防除・整枝が多い時期',
      7: '収穫・追肥・防除が多い時期',
      8: '収穫・整枝・防除が多い時期',
      9: '収穫継続・追肥が多い時期',
    },
    generalTips: ['整枝・摘葉で風通しを確保', 'ハダニ・アザミウマへの注意'],
  },
  {
    keywords: ['ピーマン', 'ししとう', 'シシトウ', 'パプリカ', '唐辛子', 'トウガラシ'],
    displayName: 'ピーマン類',
    yieldHint: '中小規模の目安：1作付けあたりおおよそ 40〜120kg（規模・品種で変動）',
    yieldKgRange: { min: 40, max: 120 },
    monthlyWorkHints: {
      5: '定植・初期管理が多い時期',
      6: '追肥・防除が多い時期',
      7: '収穫・追肥が多い時期',
      8: '収穫ピーク・防除が多い時期',
    },
    generalTips: ['連続収穫のため肥料切れに注意', 'アブラムシ・アザミウマへの防除を検討'],
  },
  {
    keywords: ['イチゴ', 'いちご', '苺', 'ストロベリー'],
    displayName: 'イチゴ',
    yieldHint: '中小規模の目安：1作付けあたりおおよそ 30〜100kg（規模・作型で変動）',
    yieldKgRange: { min: 30, max: 100 },
    monthlyWorkHints: {
      9: '定植が多い時期',
      10: '活着・保温準備が多い時期',
      11: '温度管理・病害対策が多い時期',
      12: '開花・受粉管理が多い時期',
      1: '収穫開始が多い時期',
      2: '収穫ピークが多い時期',
      3: '収穫・追肥が多い時期',
      4: '収穫後期・片付けが多い時期',
    },
    generalTips: ['うどんこ病・灰色かび病への注意', '温度・湿度管理が収量に直結しやすい'],
  },
  {
    keywords: [
      'さつまいも',
      'サツマイモ',
      'さつま芋',
      '甘藷',
      'かんしょ',
      'カンショ',
      '紅はるか',
      'べにはるか',
      'ベニハルカ',
      'ふくむらさき',
      'フクムラサキ',
      '鳴門金時',
      'なると金時',
      '安納',
      'シルクスイート',
    ],
    displayName: 'さつまいも',
    yieldHint: '中小規模の目安：1作付けあたりおおよそ 50〜150kg（規模・品種で変動）',
    yieldKgRange: { min: 50, max: 150 },
    monthlyWorkHints: {
      4: '苗床・定植準備が多い時期',
      5: '苗の定植が多い時期',
      6: '活着確認・除草が多い時期',
      7: 'つる返し・追肥が多い時期',
      8: 'つる管理・試し掘りが多い時期',
      9: '収穫準備が多い時期',
      10: '本収穫が多い時期',
      11: '貯蔵・キュアリングの確認が多い時期',
    },
    generalTips: ['つる返しでイモ肥大を促す', '収穫は霜前が目安'],
  },
  {
    keywords: ['スイートコーン', 'とうもろこし', 'トウモロコシ', '玉蜀黍', 'コーン'],
    displayName: 'スイートコーン',
    yieldHint: '中小規模の目安：1作付けあたりおおよそ 40〜120kg（本数・品種で変動）',
    yieldKgRange: { min: 40, max: 120 },
    monthlyWorkHints: {
      4: '播種・定植が多い時期',
      5: '追肥・除草が多い時期',
      6: '雄穂・絹糸管理・追肥が多い時期',
      7: '収穫が多い時期',
      8: '後半作の播種・収穫が多い時期',
    },
    generalTips: ['絹糸抽出後の適期収穫が品質を左右する', 'カラス・害虫対策を早めに'],
  },
  {
    keywords: ['レタス', 'リーフレタス', '玉レタス', 'サラダ菜'],
    displayName: 'レタス',
    yieldHint: '中小規模の目安：1作付けあたりおおよそ 30〜100kg（作型・規模で変動）',
    yieldKgRange: { min: 30, max: 100 },
    monthlyWorkHints: {
      3: '春作の定植が多い時期',
      4: '収穫・防除が多い時期',
      5: '春作収穫・暑さ対策が多い時期',
      9: '秋作の定植が多い時期',
      10: '追肥・防除が多い時期',
      11: '収穫が多い時期',
    },
    generalTips: ['軟腐病・チップバーンに注意', '高温期は抽苔しやすい'],
  },
  {
    keywords: ['キャベツ', 'きゃべつ'],
    displayName: 'キャベツ',
    yieldHint: '中小規模の目安：1作付けあたりおおよそ 50〜150kg（玉数・規模で変動）',
    yieldKgRange: { min: 50, max: 150 },
    monthlyWorkHints: {
      3: '春キャベツの収穫・防除が多い時期',
      4: '収穫ピークが多い時期',
      8: '秋冬作の定植が多い時期',
      9: '追肥・防除が多い時期',
      10: '結球確認・防除が多い時期',
      11: '収穫開始が多い時期',
      12: '収穫継続が多い時期',
    },
    generalTips: ['アオムシ・コナガへの定期防除を検討', '結球前の追肥タイミングが重要'],
  },
  {
    keywords: ['ダイコン', 'だいこん', '大根'],
    displayName: 'ダイコン',
    yieldHint: '中小規模の目安：1作付けあたりおおよそ 40〜120kg（本数・規模で変動）',
    yieldKgRange: { min: 40, max: 120 },
    monthlyWorkHints: {
      3: '春まき・間引きが多い時期',
      4: '追肥・収穫開始が多い時期',
      8: '秋まきが多い時期',
      9: '間引き・追肥が多い時期',
      10: '収穫が多い時期',
      11: '収穫・貯蔵が多い時期',
    },
    generalTips: ['キスジノミハムシ・軟腐病に注意', '肥切れと乾燥で岐根が出やすい'],
  },
  {
    keywords: ['玉ねぎ', 'タマネギ', 'たまねぎ', '玉葱'],
    displayName: '玉ねぎ',
    yieldHint: '中小規模の目安：1作付けあたりおおよそ 50〜150kg（球数・規模で変動）',
    yieldKgRange: { min: 50, max: 150 },
    monthlyWorkHints: {
      10: '定植が多い時期',
      11: '活着・除草が多い時期',
      2: '追肥が多い時期',
      3: '追肥・防除が多い時期',
      4: '倒伏確認・収穫準備が多い時期',
      5: '収穫・乾燥が多い時期',
      6: '貯蔵管理が多い時期',
    },
    generalTips: ['倒伏後の適期収穫が貯蔵性を左右する', 'べと病への注意'],
  },
  {
    keywords: ['ジャガイモ', 'じゃがいも', '馬鈴薯', 'ばれいしょ', 'バレイショ'],
    displayName: 'ジャガイモ',
    yieldHint: '中小規模の目安：1作付けあたりおおよそ 50〜150kg（規模・品種で変動）',
    yieldKgRange: { min: 50, max: 150 },
    monthlyWorkHints: {
      2: '植付け準備が多い時期',
      3: '植付けが多い時期',
      4: '土寄せ・追肥が多い時期',
      5: '防除・土寄せが多い時期',
      6: '収穫が多い時期',
      7: '秋作の植付け準備が多い時期',
    },
    generalTips: ['疫病防除と土寄せが収量の鍵', '緑化防止のため覆土を十分に'],
  },
  {
    keywords: ['ホウレンソウ', 'ほうれん草', 'ほうれんそう'],
    displayName: 'ホウレンソウ',
    yieldHint: '中小規模の目安：1作付けあたりおおよそ 20〜80kg（作型・規模で変動）',
    yieldKgRange: { min: 20, max: 80 },
    monthlyWorkHints: {
      3: '春まき・収穫が多い時期',
      4: '収穫・とう立ち注意が多い時期',
      9: '秋まきが多い時期',
      10: '追肥・収穫が多い時期',
      11: '収穫ピークが多い時期',
      12: '保温・収穫が多い時期',
    },
    generalTips: ['べと病への注意', '高温・長日でとう立ちしやすい'],
  },
  {
    keywords: ['ブロッコリー', 'ブロッコリ'],
    displayName: 'ブロッコリー',
    yieldHint: '中小規模の目安：1作付けあたりおおよそ 30〜100kg（株数・規模で変動）',
    yieldKgRange: { min: 30, max: 100 },
    monthlyWorkHints: {
      3: '春作の定植が多い時期',
      4: '防除・追肥が多い時期',
      5: '収穫が多い時期',
      8: '秋作の定植が多い時期',
      9: '追肥・防除が多い時期',
      10: '収穫が多い時期',
      11: '収穫継続が多い時期',
    },
    generalTips: ['花蕾肥大期の水分と防除が重要', 'アオムシ・コナガに注意'],
  },
  {
    keywords: ['エダマメ', '枝豆', 'えだまめ'],
    displayName: 'エダマメ',
    yieldHint: '中小規模の目安：1作付けあたりおおよそ 20〜80kg（作型・規模で変動）',
    yieldKgRange: { min: 20, max: 80 },
    monthlyWorkHints: {
      4: '播種・定植が多い時期',
      5: '追肥・中耕が多い時期',
      6: '開花・着莢管理が多い時期',
      7: '収穫が多い時期',
      8: '後半作の収穫が多い時期',
    },
    generalTips: ['適期収穫（豆の肥大）が味を左右する', 'ハスモンヨトウなど食葉害虫に注意'],
  },
  {
    keywords: ['コマツナ', '小松菜', 'こまつな'],
    displayName: 'コマツナ',
    yieldHint: '中小規模の目安：1作付けあたりおおよそ 20〜70kg（作型・規模で変動）',
    yieldKgRange: { min: 20, max: 70 },
    monthlyWorkHints: {
      3: '播種・収穫が多い時期',
      4: '連作・防除が多い時期',
      5: '暑さ対策・遮光が多い時期',
      9: '秋まき・収穫が多い時期',
      10: '収穫ピークが多い時期',
      11: '保温・収穫が多い時期',
    },
    generalTips: ['キスジノミハムシ・カブラハバチに注意', '短期栽培のため播種計画が収益の鍵'],
  },
  {
    keywords: ['ネギ', 'ねぎ', '長ねぎ', '長ネギ', '葉ねぎ', '葉ネギ'],
    displayName: 'ネギ',
    yieldHint: '中小規模の目安：1作付けあたりおおよそ 30〜100kg（作型・規模で変動）',
    yieldKgRange: { min: 30, max: 100 },
    monthlyWorkHints: {
      3: '追肥・土寄せが多い時期',
      4: '土寄せ・防除が多い時期',
      5: '収穫・土寄せが多い時期',
      9: '定植・土寄せが多い時期',
      10: '追肥・土寄せが多い時期',
      11: '収穫が多い時期',
    },
    generalTips: ['土寄せの回数・タイミングが品質を左右する', 'さび病・ネギアザミウマに注意'],
  },
]

/**
 * マッチ用に正規化：全角半角統一、空白除去、括弧書き（本数・メモ等）を除去
 * 例: 「さつまいも（200本）」→「さつまいも」
 */
export function normalizeCropNameForMatch(name: string): string {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\u3000]/g, '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[・･._\-]/g, '')
    .trim()
}

function matchScore(haystack: string, keyword: string): number {
  if (!haystack || !keyword) return 0
  if (haystack === keyword) return keyword.length + 100
  if (haystack.includes(keyword)) return keyword.length
  return 0
}

/**
 * 作物名・品種名から一般目安を探す。
 * 長いキーワードを優先（例: 「スイートコーン」>「コーン」）。
 */
export function findCropBenchmark(
  cropName: string,
  variety?: string | null
): CropBenchmark | null {
  const rawCandidates = [cropName, variety ?? '']
    .map((s) => s.trim())
    .filter(Boolean)

  if (rawCandidates.length === 0) return null

  const candidates = [
    ...rawCandidates.map(normalizeCropNameForMatch),
    // 括弧を残したままの部分一致も試す（キーワードが括弧内品種のとき用）
    ...rawCandidates.map((s) => s.normalize('NFKC').toLowerCase().replace(/[\s\u3000]/g, '')),
  ].filter(Boolean)

  let best: { benchmark: CropBenchmark; score: number } | null = null

  for (const b of CROP_BENCHMARKS) {
    for (const keyword of b.keywords) {
      const nk = normalizeCropNameForMatch(keyword)
      if (nk.length < 2) continue
      for (const c of candidates) {
        const score = matchScore(c, nk)
        if (score > 0 && (!best || score > best.score)) {
          best = { benchmark: b, score }
        }
      }
    }
  }

  return best?.benchmark ?? null
}

/** 今月の栽培暦ヒント（マッチした品目から最大5件） */
export function getSeasonalWorkHints(
  cropNames: string[],
  month: number = new Date().getMonth() + 1
): { cropLabel: string; hint: string }[] {
  const seen = new Set<string>()
  const results: { cropLabel: string; hint: string }[] = []
  for (const name of cropNames) {
    const b = findCropBenchmark(name)
    if (!b || seen.has(b.displayName)) continue
    const hint = b.monthlyWorkHints[month]
    if (!hint) continue
    seen.add(b.displayName)
    results.push({ cropLabel: b.displayName, hint })
    if (results.length >= 5) break
  }
  return results
}

export function commentYieldVsBenchmark(
  quantityKg: number,
  benchmark: CropBenchmark | null
): string | null {
  if (!benchmark?.yieldKgRange) return null
  const { min, max } = benchmark.yieldKgRange
  if (quantityKg < min * 0.7) return '一般的な目安レンジより少なめです（規模差もあり得ます）'
  if (quantityKg > max * 1.3) return '一般的な目安レンジより多めです'
  if (quantityKg < min) return '一般的な目安レンジの下限付近です'
  if (quantityKg > max) return '一般的な目安レンジの上限付近です'
  return '一般的な目安のレンジ内です'
}

/** 登録済みの一般目安品目名（UI表示用） */
export function listBenchmarkDisplayNames(): string[] {
  return CROP_BENCHMARKS.map((b) => b.displayName)
}
