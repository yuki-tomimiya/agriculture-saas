# プロジェクトコンテキスト（実装再開用）

**このファイルの役割**: コードベースの地図と作業再開手順。  
**方針・決定・優先の順番の正本**: `docs/議事録/minutes-content.json`。どこに何を書くかは `CLAUDE.md` の「記録の正本と書き方」

---

## 作業再開

読む順はメインが `CLAUDE.md`、実装担当が `AGENTS.md`。このファイルは「どのファイルを触るか」を見るためのもの

---

## 一言

**Tillto**（決定済み）— 一般 × 地域 × あなた → **今日の一手**。  
3層の説明・優先の順番は議事録 ›「プロダクト趣旨・ポジション」「優先の順番とロードマップ」。

---

## 技術スタック

Next.js 14（App Router） / TypeScript / Tailwind + `app/globals.css` / Prisma / 自前認証（`lib/auth.ts`） / 気象 Open-Meteo（`lib/weather-forecast.ts`）

内部名: `package.json` の `agriculture-saas`（ユーザー向け表示には使わない）

---

## 画面とルート

| パス | 役割 |
|------|------|
| `/dashboard/ai-proposal` | 今日の一手（3層提案） |
| `/gdd` | 生育ナビの入口（栽培中を選ぶ。1件だけならその作付けへ） |
| `/gdd/[cropId]` | その作付けの積算温度・雨量・日射。過去の作付けも開ける |
| `/gdd/past` | 過去の生育データ（2階層目） |
| `/faq` | よくある質問の入口 |
| `/faq/[slug]` | 1つの質問の答え |
| `/plan` | 来年の計画（振り返りと計画のカード。詳細ページはなし） |
| `/records` | 記録の入口（作業・農薬・収穫・販売。施肥は作業のタブ） |
| `/soil` | 土壌診断（農場管理の下。写真・圃場あり。詳細ページはなし） |
| `/insights` | 振り返りと計画（入口カード。来年の計画を含む） |
| `/insights/compare` | 作付け比較（あなた） |
| `/insights/regional` | この地域の気象（地域） |
| `/insights/general` | 外した。出典の付いた栽培暦ができたら戻す（いまは `/insights` へ送る） |
| `/crops` | 作物管理・栽培中 |
| `/crops/archive` | 過去の作付け（収穫済み・完了） |
| `/crops/[id]/retrospective` | 作付け終了時の振り返り1枚 |
| `/calendar` | 作業カレンダー（これから・昨年オーバーレイ） |
| `/calendar/history` | 過去の実績（パンくず: カレンダー / 過去の実績） |
| `/weather` | 気象ナビ |

階層方針: 1階層＝入口、2階層＝詳細・過去。生育ナビ・分析とも2階層。

---

## 主要ファイル（触るときの早見）

| 領域 | パス |
|------|------|
| 今日の提案 | `lib/ai-proposal.ts`, `lib/proposals/`（採点・ステージ・節目・「今はしない」・終了確認は3日）, `app/dashboard/ai-proposal/`, `app/api/proposals/dismiss/` |
| 平年値・初霜・見込みの幅 | `lib/weather-normals.ts`, `lib/weather-frost.ts`, `lib/jma/`（観測所一覧 `data/jma-stations.json`、日別気温は `JmaDailyTemp`）、`lib/insights/harvest-date-window.ts`, `lib/proposals/frost.ts`（さつまいもの霜の締切。春の霜の終わりは1〜6月の最後の4℃以下） |
| 天気の保存・出典 | `lib/open-meteo/archive.ts` が過去の全項目を地点（小数4桁）・日付ごとに `OpenMeteoDaily` へ保存。直近7日は24時間ごとに更新、昨年以前は再取得しない。`lib/weather-forecast.ts` は項目ごとに欠測日を除外し、前回作付けの比較線・雨量グラフは日付から日数を求める。標高は `lib/jma/elevation.ts` → `OpenMeteoElevation`。`lib/open-meteo/url.ts` で住所を共通化し、`OPEN_METEO_API_KEY` があれば契約者用ホストへ切り替える。表示は `components/WeatherDataSource.tsx`（気象庁用も共通）。予報の1時間の取り置きは従来どおり |
| 植える条件 | `lib/benchmarks/planting-conditions.ts`。登録画面・来年の計画・農場の詳細・植えた後の遅霜のカード。ブロッコリーは苗、スイートコーンは直まきの条件。植え方が空なら表示し、不一致なら出さない。推計の地温は出さない |
| 来年の計画 | `app/plan/page.tsx`, `lib/insights/next-year-plan.ts`, `lib/insights/harvest-gdd-basis.ts`（計画・生育ナビ・提案・振り返りで同じ基準）。トマト・エダマメは植付→節目（単純）と節目→最初の収穫を合わせて歩く。ブロッコリーは `projectTwoStageHarvestWindow`（`lib/insights/harvest-date-window.ts`）で、同じ過去年ごとに植付→出蕾（単純）、その翌日→収穫（有効5℃）を歩く。スイートコーンは絹糸の幅に日数を足す。節目なしは日付を出さない |
| 分析・比較 | `app/insights/`, `lib/insights/crop-season-compare.ts` |
| 作付け振り返り | `lib/insights/crop-season-retrospective.ts`, `app/crops/[id]/retrospective/` |
| 地域（降水量） | `lib/insights/regional-context.ts`。気温・雨の同期間10年の3階級（3・4・3）は `lib/insights/ten-year-classes.ts`。欠測・同値で境界が分けられない場合は言い分けない |
| 一般目安 | `lib/benchmarks/crops.ts`。積算温度の数え方は `lib/benchmarks/gdd-methods.ts`（品目ごと。基準温度の入力欄は外した）。トマトは第1花房、スイートコーンは絹糸、エダマメは開花（秋田）、ブロッコリーは出蕾（宮城・有効5℃）から数える |
| 作付けの条件 | `lib/crops/conditions.ts`（選べる品目と `adviceNames`）。Crop の品目・場所・覆い・暖房・植え方・株数・面積・圃場を分けていない。呼び名は `name` のまま |
| 作付けの結果 | 振り返り先頭の結果（`CropOutcome`、`lib/crops/outcome.ts`。イチゴの呼び方は正品、ほかはA品）。収穫の重さは kg（`lib/crops/harvest.ts`）。自分の記録のまとまりは `personalGroupKey`。前回の作付けは `previousPlanting`（`lib/crops/conditions.ts`） |
| 農場の場所 | 都道府県・市区町村は `Farm.prefectureCode` / `municipalityCode`（`data/municipalities.json`、`lib/places/`）。県の候補は近い観測所の番号（`data/jma-prec-no.json`） |
| 発生予察 | `data/pest-forecast-offices.json`、`lib/pest-forecast.ts`。FAQ「防除のタイミングは？」と農薬の記録。今日の提案には出さない |
| 生育ナビ | `app/gdd/`（入口）、`app/gdd/[cropId]/`、`app/gdd/past/`、`components/GDDCropList.tsx`, `lib/gdd.ts`。目安は `lib/benchmarks/gdd-methods.ts` の数え方。トマト・スイートコーンは起点の節目が記録されたときだけ、その日から数える。トマトは開花のあと、収穫開始の日付の幅も出す |
| カレンダー昨年 | `components/WorkCalendar.tsx` |
| 土壌診断 | `app/soil/`, `app/api/soil-diagnoses/`, `lib/soil-diagnosis.ts` |
| 生育の節目 | `lib/proposals/milestones.ts`, `lib/proposals/stages.ts`, `CropMilestone`（作付け詳細で手入力もできる）。窓の日数は問いかけにだけ使う。防除間隔は `lib/benchmarks/spray-interval.ts` |
| 削除 | 作物・農場は詳細、収穫・タスクも詳細、販売は一覧。各 `app/api/.../[id]` の DELETE。作物が残る農場は消せない |
| 議事録 | 正本は `docs/議事録/minutes-content.json`。Word は 2026-10-30 の版のファイルだけを残し、生成する道具は 2026-10-31 に外した |

```
app/  dashboard/, dashboard/ai-proposal/, plan/, records/, insights/, insights/compare/, insights/regional/,
      insights/general/, gdd/, gdd/past/, calendar/, weather/, farms/, soil/, crops/, tasks/,
      work-records/, fertilizers/, pesticides/, harvests/, sales/, faq/, data/
lib/  ai-proposal*.ts, insights/, benchmarks/, weather-forecast.ts, gdd.ts, auth.ts, prisma.ts
```

---

## サイドバー（`Sidebar.tsx`）

AI提案（紫）→ ダッシュボード → カレンダー → 気象ナビ → 生育ナビ → 農場管理（土壌診断）→ 作物管理 → 記録 → 振り返りと計画 → 区切り → タスク → 外部連携 → FAQ

---

## デザイン（コード作業用）

- 緑: 通常UI / 紫: AI提案メニューのみ
- 3層タグ: `.insights-layer-tag`（あなた / 地域 / 一般 / 今日の一手）

---

## ドキュメントの更新ルール

パス・画面・lib・Sidebar を変えたら、このファイルだけ直す。ほかは `CLAUDE.md` の「記録の正本と書き方」

---

## 開発時の注意

- 未ログイン: `getCurrentUser()` → `redirect('/auth/signin')`
- 起動: `npm run dev` または `アプリを起動.bat`
- UI 確認は本番アプリのみ（静的 `ui-preview-*.html` は廃止済み）
- `.env` / `node_modules` はコミットしない
- 起動できないとき：`npm install` → `npx prisma generate` → `npx prisma migrate dev`。ポート3000が埋まっていれば `サーバー停止.bat`。`.env` と `prisma/dev.db` があるか確認（旧 SETUP.md の要点。2026-10-07 に統合）
- 公開前のチェックリストは Obsidian の `調査/RELEASE_CHECKLIST.md`（2026-10-07 にリポジトリから移動）
- 気象庁の観測所一覧は `npm run jma:stations`（地点が変わったとき。年1回で足りる）。日別の最低気温は `npm run jma:observations`（保存済みの月は取り直さない。年が明けたら、前年の12か月が足される）。画面を開いたときは保存済みだけを読む
- 開発用の部品 `tsx`（気象庁の取り込みを動かす）は、版を固定して `package.json` に入れている。新しいPCでは `npm ci` で同じ版がそろう
- 別のPCへ移すときは Obsidian の `PC移行/開発環境の移行手順.md`（`dev.db`・`.env`・ボールト・Claude のメモリは GitHub に無い）

---

*最終更新: 2026-10-19 — PC移行の準備（使っている部品を package.json に書いた）。10-13〜16 に霜（観測所の記録）・作付けの条件と結果・農場の都道府県と市区町村・予察へのリンク・春の締切・積算温度の品目ごとの数え方。*
