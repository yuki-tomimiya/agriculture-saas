# プロジェクトコンテキスト（実装再開用）

**このファイルの役割**: コードベースの地図と作業再開手順。  
**方針・決定・ロードマップの正本**: `docs/議事録/minutes-content.json`（→ `Tillto_開発議事録.docx`）

*議事録と同期: 2026-09-16*

---

## 作業再開（AIへの依頼例）

- Obsidian の `Tillto/SESSION_HANDOFF.md` と、このリポジトリの **@PROJECT_CONTEXT.md** **@docs/議事録/minutes-content.json** を読んで続きを
- 直近の合意・未着手 → **Obsidian SESSION_HANDOFF**
- 方針・優先順 → **議事録**
- どのファイルを触るか → **このファイル**
- 日報・調査メモ → **`C:\Users\yukit\Desktop\cursor_obsidian\Tillto\`**

---

## 一言

**Tillto**（決定済み）— 一般 × 地域 × あなた → **今日の一手**。  
3層の説明・Phase・完了/未着手の全文は議事録 ›「プロダクト趣旨・ポジション」「次にやること」。

---

## 次にやること（要約のみ）

1. 来年の計画（`/plan`）は一覧だけ。日付は収穫時点の実績を平年に引き直してから出す
2. 農場名「メイン➁」の文字替えと、雨の目安520mmを残すかは確認待ち
3. トマトは第3花房、さつまいもは活着と試し掘りを聞いてから助言する。日数では断定しない。次はモバイル

→ 詳細・完了一覧・やらないことは **議事録 ›「次にやること（最新版）」**  
→ 日報・引き継ぎ・ナレッジは **`C:\Users\yukit\Desktop\cursor_obsidian\Tillto\`**（Obsidian）

---

## 技術スタック

Next.js 14（App Router） / TypeScript / Tailwind + `app/globals.css` / Prisma / 自前認証（`lib/auth.ts`） / 気象 Open-Meteo（`lib/weather-forecast.ts`）

内部名: `package.json` の `agriculture-saas`（ユーザー向け表示には使わない）

---

## 画面とルート

| パス | 役割 |
|------|------|
| `/dashboard/ai-proposal` | 今日の一手（3層提案） |
| `/gdd` | 生育ナビ・栽培中 |
| `/gdd/past` | 過去の生育データ（2階層目） |
| `/gdd?cropId=…` | 作付け別グラフ（過去時はバナー） |
| `/plan` | 来年の計画（振り返りと計画のカード。詳細ページはなし） |
| `/records` | 記録の入口（作業・農薬・収穫・販売。施肥は作業のタブ） |
| `/soil` | 土壌診断（農場管理の下。写真・圃場あり。詳細ページはなし） |
| `/insights` | 振り返りと計画（入口カード。来年の計画を含む） |
| `/insights/compare` | 作付け比較（あなた） |
| `/insights/regional` | この地域の気象（地域） |
| `/insights/general` | 栽培暦の目安（一般） |
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
| 平年値 | `lib/weather-normals.ts`（生育ナビ、提案の地域層、来年の計画） |
| 来年の計画 | `app/plan/page.tsx`, `lib/insights/next-year-plan.ts`, `lib/insights/harvest-gdd-basis.ts`（計画・生育ナビ・提案・振り返りで同じ基準） |
| 分析・比較 | `app/insights/`, `lib/insights/crop-season-compare.ts` |
| 作付け振り返り | `lib/insights/crop-season-retrospective.ts`, `app/crops/[id]/retrospective/` |
| 地域（降水量） | `lib/insights/regional-context.ts` |
| 一般目安 | `lib/benchmarks/crops.ts`, `lib/benchmarks/base-temperature.ts`（基準温度。FAQ の表もここ） |
| 生育ナビ | `app/gdd/`, `app/gdd/past/`, `components/GDDCropList.tsx`, `lib/gdd.ts` |
| カレンダー昨年 | `components/WorkCalendar.tsx` |
| 土壌診断 | `app/soil/`, `app/api/soil-diagnoses/`, `lib/soil-diagnosis.ts` |
| 生育の節目 | `lib/proposals/milestones.ts`, `lib/proposals/stages.ts`, `CropMilestone`（作付け詳細で手入力もできる）。窓の日数は問いかけにだけ使う。防除間隔は `lib/benchmarks/spray-interval.ts` |
| 削除 | 作物・農場は詳細、収穫・タスクも詳細、販売は一覧。各 `app/api/.../[id]` の DELETE。作物が残る農場は消せない |
| 議事録 | `docs/議事録/minutes-content.json`, `generate-minutes.mjs` |

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

| 変えたこと | 更新するもの |
|------------|--------------|
| 方針・優先順・Phase・決定 | **議事録**（json → `node docs/議事録/generate-minutes.mjs`） |
| パス・画面・lib・Sidebar | **PROJECT_CONTEXT.md**（このファイル） |
| 大きなリリース前 | 要約3行が議事録とズレていないか確認 |

---

## 開発時の注意

- 未ログイン: `getCurrentUser()` → `redirect('/auth/signin')`
- 起動: `npm run dev` または `アプリを起動.bat`
- UI 確認は本番アプリのみ（静的 `ui-preview-*.html` は廃止済み）
- `.env` / `node_modules` はコミットしない
- 直近チャットの文脈は `docs/SESSION_HANDOFF.md`

---

*最終更新: 2026-09-16 — プレビュー HTML 廃止を反映。*
