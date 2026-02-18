# セットアップ手順

## 問題：ブラウザで開けない場合

### 1. 依存関係のインストール（必須）

プロジェクトディレクトリで以下のコマンドを実行してください：

```bash
npm install
```

これには数分かかる場合があります。

### 2. データベースのセットアップ

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

サーバーが起動すると、以下のメッセージが表示されます：
```
  ▲ Next.js 14.x.x
  - Local:        http://localhost:3001
```

### 4. ブラウザで確認

ブラウザで以下のURLを開いてください：
```
http://localhost:3001
```

## エラーが発生する場合

### エラー: "Cannot find module"
→ `npm install` を実行してください

### エラー: "Port 3001 is already in use"
→ 別のターミナルで実行中のプロセスを停止してください
- Windows: タスクマネージャーで `node.exe` を終了
- または: `taskkill /F /IM node.exe` を実行

### エラー: "Prisma Client is not generated"
→ `npx prisma generate` を実行してください

### エラー: "Database does not exist"
→ `.env` ファイルが正しく設定されているか確認してください
→ `npx prisma migrate dev` を実行してください

## 確認事項

- [ ] `node_modules` フォルダが存在する
- [ ] `.env` ファイルが存在する
- [ ] `prisma/dev.db` ファイルが存在する（マイグレーション後）
- [ ] 開発サーバーが起動している（`npm run dev` 実行後）
