# プロジェクトコンテキスト（実装再開用）

**このファイルの役割**: コードベースの地図と作業再開手順。  
**方針・決定・ロードマップの正本**: `docs/議事録/minutes-content.json`（→ `Tillto_開発議事録.docx`）

*議事録と同期: 2026-08-28*

---

## 作業再開（AIへの依頼例）

- 「**@docs/SESSION_HANDOFF.md** **@PROJECT_CONTEXT.md** **@docs/議事録/minutes-content.json** を読んで続きを」
- **チャット引き継ぎ** → `docs/SESSION_HANDOFF.md`（直近の合意・未着手）
- 方針・優先順 → 議事録
- コードの地図 → このファイル

---

## 一言

**Tillto**（決定済み）— 一般 × 地域 × あなた → **今日の一手**。  
3層の説明・Phase・完了/未着手の全文は議事録 ›「プロダクト趣旨・ポジション」「次にやること」。

---

## 次にやること（要約のみ）

1. 分析・振り返りの**入口化**（比較・地域など2階層へ）
2. ダッシュボード / 今日の提案 ↔ 分析・生育ナビの**導線強化**
3. AI提案に**昨年同時期の作業**（カレンダー昨年との接続）

→ 詳細・完了一覧・やらないことは **議事録 ›「次にやること（最新版）」**

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
| `/gdd/past` | 過去作付けの生育データ一覧（2階層目） |
| `/gdd?cropId=…` | 作付け別グラフ（過去時はバナー） |
| `/insights` | 分析・振り返り（比較・地域・一般） |
| `/calendar` | 作業カレンダー（昨年オーバーレイ） |
| `/weather` | 気象ナビ |

階層方針: 1階層＝入口、2階層＝詳細・過去。生育ナビで確立、分析は未入口化。

---

## 主要ファイル（触るときの早見）

| 領域 | パス |
|------|------|
| 今日の提案 | `lib/ai-proposal.ts`, `lib/ai-proposal-context.ts`, `app/dashboard/ai-proposal/` |
| 分析・比較 | `app/insights/`, `lib/insights/crop-season-compare.ts` |
| 地域（降水量） | `lib/insights/regional-context.ts` |
| 一般目安 | `lib/benchmarks/crops.ts` |
| 生育ナビ | `app/gdd/`, `app/gdd/past/`, `components/GDDCropList.tsx`, `lib/gdd.ts` |
| カレンダー昨年 | `components/WorkCalendar.tsx` |
| サイドバー | `components/Sidebar.tsx` |
| 議事録 | `docs/議事録/minutes-content.json`, `generate-minutes.mjs` |
| **引き継ぎ** | `docs/SESSION_HANDOFF.md`（次チャット用・直近の文脈） |

```
app/  dashboard/, dashboard/ai-proposal/, insights/, gdd/, gdd/past/,
      calendar/, weather/, farms/, crops/, tasks/,
      work-records/, fertilizers/, pesticides/, harvests/, sales/, faq/, data/
lib/  ai-proposal*.ts, insights/, benchmarks/, weather-forecast.ts, gdd.ts, auth.ts, prisma.ts
```

---

## サイドバー（`Sidebar.tsx`）

AI提案（紫）→ ダッシュボード → カレンダー → 気象ナビ → 生育ナビ → 農場 → 作物 → 作業管理 → 農薬 → 収穫 → 販売 → **分析・振り返り** → タスク → 外部連携 → FAQ

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
- `.env` / `node_modules` はコミットしない

---

*最終更新: 2026-08-28 — 議事録との重複を解消し、実装索引に特化。*
