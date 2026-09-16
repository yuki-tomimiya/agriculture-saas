# 農薬・肥料テーブル追加のマイグレーション

`PesticideRecord` と `FertilizerRecord` を追加したマイグレーションがあります。

## 手順（プロジェクトルートで実行）

1. **Prisma クライアントの生成**
   ```bash
   npx prisma generate
   ```

2. **マイグレーションの適用**
   ```bash
   npx prisma migrate deploy
   ```
   または開発中なら:
   ```bash
   npx prisma migrate dev
   ```

これで農薬管理・肥料管理の各ページが利用可能になります。
