# プロジェクトコンテキスト（次回作業用）

このファイルは、作業を再開するときにプロジェクトの全体像と現在地を把握するためのメモです。

---

## 続きから作業するとき（AIに読み込ませる方法）

**新しいチャットを開いたら、最初に次のどれかで依頼するだけです。**

- 「**PROJECT_CONTEXT.md を読んで、このプロジェクトの続きの作業をして**」
- 「**@PROJECT_CONTEXT.md を参照して** [やりたいこと]」
- 「**PROJECT_CONTEXT.md の内容を前提に** [質問や依頼]」

ファイルを `@` で指定すると、その内容が会話に含まれるので確実です。読んだうえで、続きの実装や修正ができます。

---

## プロジェクト概要

- **名前**: 農業SaaS（agriculture-saas）
- **対象**: 中小規模の農家・新規就農者
- **提供価値**: 圃場管理 × 作業記録 × 気象データ × 収支管理をひとつの画面で。気象・GDD・栽培スケジュールをもとに **AIが今日の作業を提案** する機能を前面に出す方針。

---

## 技術スタック

- **フレームワーク**: Next.js 14（App Router）
- **言語**: TypeScript
- **スタイル**: Tailwind CSS
- **DB / ORM**: Prisma
- **認証**: 自前（cookie + bcryptjs、`lib/auth.ts`）

---

## ディレクトリ構成（主要）

```
app/
  page.tsx           # ホーム（未ログイン用ランディング）
  layout.tsx
  auth/signin, signup/
  dashboard/page.tsx # ダッシュボード（ログイン後）
  farms/, farms/[id]/   # 農場一覧・農場詳細
  crops/, crops/[id]/   # 作物一覧・作物詳細
  tasks/, tasks/[id]/   # タスク一覧・タスク詳細
  harvests/, harvests/[id]/  # 収穫一覧・収穫詳細
  api/auth/signin, signup/           # 認証API
components/
  Sidebar.tsx        # 左サイドバー（ダッシュボード等で表示）
  Navbar.tsx
  WeatherNav.tsx     # 今週の気象ナビ
  WeatherForecast.tsx# 今後2週間の気象
  WorkCalendar.tsx   # 作業カレンダー（提案と実績）
  GDDChart.tsx       # 積算温度グラフ
lib/
  auth.ts, prisma.ts, utils.ts
prisma/
  schema.prisma      # Farm, Crop, Task, Harvest 等
```

**プレビュー用HTML**（スタイル確認用、本番とは別）:
- `ui-preview-index.html` … **プレビュー一覧**（全プレビューへのリンク）
- `ui-preview-home.html` … ホーム
- `ui-preview-dashboard.html` … ダッシュボード
- `ui-preview-ai-proposal.html` … 今日の提案
- `ui-preview-farms.html` / `ui-preview-farm-detail.html` … 農場一覧・詳細
- `ui-preview-crops.html` / `ui-preview-crop-detail.html` … 作物一覧・詳細
- `ui-preview-tasks.html` / `ui-preview-task-detail.html` … タスク一覧・詳細
- `ui-preview-harvests.html` / `ui-preview-harvest-detail.html` … 収穫一覧・詳細

---

## 現在のUI・機能の状態

### ホーム（`app/page.tsx`, `ui-preview-home.html`）

- 上: キャッチコピー・説明・CTA（無料ではじめる / すでにアカウントをお持ちの方）
- 下: 「このサービスでできること」の **4枚のカード**（2列グリッド）
  - 農場管理、作物・作業管理、データ分析・収支、気象データ連携
- ※ AI提案は **ホームには出さず、ダッシュボードの左メニューに集約** 済み

### ダッシュボード（`app/dashboard/page.tsx`）

- **左**: サイドバー（`components/Sidebar.tsx`）
  - **1行目**: 「✨ AIが今日の作業を提案」（紫ハイライト、/dashboard/ai-proposal へ）
  - 2行目: ダッシュボード、農場、作物、収穫記録、タスク
- **メイン**: タイトル → サマリー4枚（農場数・作物数・未完了タスク・最近の収穫）→ 最近の作物/収穫 → 今週の気象ナビ → 3列（気象予報 / 作業カレンダー / 積算温度グラフ）
- **「今日の提案」専用ページ**: `/dashboard/ai-proposal`。サイドバー「AIが今日の作業を提案」から遷移。ルールベースで1〜3件表示（タスク期限・栽培スケジュール・気象）。ロジックは `lib/ai-proposal.ts` の `getTodayProposals(userId)`。

### サイドバー（`components/Sidebar.tsx`）

- ホーム・認証ページでは非表示
- `highlight: true` の項目は紫スタイル（AI提案）
- 同じ `href` で複数ラベルがある場合は `key={item.label}` で一意化

---

## デザイン・スタイルの約束

- メインカラー: 緑（green）… ボタン・アクティブメニュー
- AI関連: 紫（violet）… 「AIが今日の作業を提案」のみ
- カード: `rounded-xl`, `border`, ホバー時は背景を少し濃く

---

## 次回作業でやりたいことの例

- サービス名の決定・反映（現在は「農業SaaS」などの仮名）
- ~~「AIが今日の作業を提案」の専用ページ・モーダル実装~~ → 済（/dashboard/ai-proposal + ルールベース提案）
- ホームのカード文言・並びの調整
- 気象・GDD・タスクデータに基づく「今日の提案」ロジックの実装

---

## 公開までに用意するとよいもの

- **RELEASE_CHECKLIST.md** に「何をダウンロードするか」「公開までの手順」をまとめてある
- 最低限: **Node.js**（実行用）、**Git**（バージョン管理・デプロイ連携用）
- ルートの **.gitignore** で `.env` と `node_modules` をコミット対象外にしている（秘密情報・ビルド成果物の除外）

## 注意事項

- プレビュー用HTML（`ui-preview-*.html`）と本番（`app/*`, `components/*`）の両方を触ることがあるので、**変更時はどちらも揃える**とよい
- 認証は cookie ベース。`getCurrentUser()` で未ログイン時は `redirect('/auth/signin')`

---

*最終更新: プロジェクトコンテキスト初版（サイドバーにAI提案追加済みの状態を反映）*
