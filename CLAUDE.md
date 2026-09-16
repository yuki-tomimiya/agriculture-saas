# Tillto 開発ガイド（Claude Code用）

## 作業開始時に必ず読む（この順）

1. `docs/SESSION_HANDOFF.md` — 直近チャットの文脈・合意・未着手
2. `PROJECT_CONTEXT.md` — コードの地図・ルート・主要 lib
3. `docs/議事録/minutes-content.json` — 方針・Phase・次にやることの正本

## サービス概要

- サービス名: **Tillto**（`package.json` の `name` は `agriculture-saas`。npm内部名のみで、ユーザー向け表示には使わない）
- 一言: 教科書の一般論 × この地域のリアル × あなたの農場の履歴 → **今日の一手**

## 技術スタック・ルート・主要ファイル

`PROJECT_CONTEXT.md` を正本とする（ここには重複記載しない）。

## 開発コマンド

- 起動: `npm run dev`（http://localhost:3000）または `アプリを起動.bat`
- DB: `npx prisma migrate dev` / `npx prisma generate`
- 議事録Word再生成: `node docs/議事録/generate-minutes.mjs`

## ドキュメント更新ルール（重要・指示がなくても自律的に行う）

| 変えたこと | 更新するもの |
|---|---|
| 方針・優先順・Phase・決定 | `docs/議事録/minutes-content.json` を更新 → `node docs/議事録/generate-minutes.mjs` を実行して `docs/議事録/Tillto_開発議事録.docx` を上書き再生成（日付別ファイルは作らない、常に1本のみ） |
| パス・画面・lib・Sidebarの変更 | `PROJECT_CONTEXT.md` のみ更新 |
| チャット終了時・大きな合意後 | `docs/SESSION_HANDOFF.md` を上書き（セクション3・4を更新） |

同じ説明文を複数ファイルに重複して書かない。方針が変わったら議事録を更新し、`PROJECT_CONTEXT.md` の要約が古ければ1〜3行だけ直す。

### 議事録を更新すべきタイミング

- プロダクトの趣旨・ポジション・キャッチコピー・「先生」としての役割の合意/変更
- 機能の優先順位・Phaseが決まった/変わった
- 3層モデル・差別化・データ蓄積方針などの合意
- 実装方針で後から参照すべき決定（画面構成、データ設計など）
- ユーザーが「議事録に残して」と言ったとき

更新しないもの: 単なるバグ修正・文言微調整のみの作業、未確定のブレインストーミング。

議事録を更新したら、返答の末尾で1行触れる（例:「開発議事録を更新しました」）。

## 作業スタイル（過去の傾向）

- 機能を1画面に詰め込みすぎるのを嫌う → 階層分け・入口化を好む（例: `/gdd` → `/gdd/past`）
- 実装前に「どこをどう直すか」の案を出して確認してから go を出すことが多い
- git commit は明示依頼時のみ実行する

## 注意

- 未ログイン: `getCurrentUser()` → `redirect('/auth/signin')`
- `.env` / `node_modules` はコミットしない
- テストユーザー: yuki.tomimiya@icloud.com
