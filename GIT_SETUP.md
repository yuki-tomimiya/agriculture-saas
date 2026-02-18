# Git と GitHub のセットアップ手順

Node.js、Git、GitHub アカウントの準備ができたら、このプロジェクトを GitHub にプッシュする手順です。

---

## ステップ 1: このプロジェクトを Git リポジトリにする

プロジェクトのフォルダ（`c:\Users\yukit\OneDrive\プロジェクト`）で、ターミナル（PowerShell やコマンドプロンプト）を開いて：

```bash
# Git リポジトリとして初期化
git init

# 最初のコミット（すべてのファイルを追加）
git add .

# コミット（変更を記録）
git commit -m "Initial commit: 農業SaaS プロジェクト"
```

**確認**: `.git` フォルダが作成されていれば OK。

---

## ステップ 2: GitHub にリポジトリを作成

1. **GitHub にログイン** → https://github.com/
2. 右上の **「+」** → **「New repository」**
3. リポジトリ名を入力（例: `agriculture-saas` や `farm-management`）
4. **Public** または **Private** を選択（Private なら非公開）
5. **「Create repository」** をクリック

**重要**: 「Initialize this repository with a README」は **チェックしない**（既にローカルにコードがあるため）

---

## ステップ 3: ローカルのコードを GitHub にプッシュ

GitHub でリポジトリを作成すると、次のようなコマンド例が表示されます。**あなたのリポジトリの URL** に置き換えて実行：

```bash
# GitHub のリポジトリを「origin」という名前で追加
git remote add origin https://github.com/あなたのユーザー名/リポジトリ名.git

# メインブランチを「main」に設定（GitHub のデフォルト）
git branch -M main

# GitHub にプッシュ
git push -u origin main
```

**初回プッシュ時**: GitHub のユーザー名とパスワード（または Personal Access Token）の入力を求められる場合があります。

---

## ステップ 4: 確認

GitHub のリポジトリページを開いて、ファイルが表示されていれば成功です。

---

## よくあるエラーと対処

### エラー: "fatal: not a git repository"
→ `git init` を実行していない。プロジェクトフォルダで `git init` を実行。

### エラー: "remote origin already exists"
→ 既にリモートが設定済み。`git remote -v` で確認し、必要なら `git remote remove origin` してから再設定。

### エラー: "Authentication failed"
→ GitHub の認証が必要。Personal Access Token を使う場合:
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 「Generate new token」→ `repo` スコープを選択
3. 生成されたトークンをコピーして、パスワードの代わりに入力

### エラー: ".env" がコミットされてしまった
→ `.gitignore` に `.env` が含まれているか確認。含まれているのにコミット済みなら:
```bash
git rm --cached .env
git commit -m "Remove .env from tracking"
git push
```

---

## 今後の作業フロー

コードを変更したら：

```bash
# 変更を確認
git status

# 変更をステージング（追加）
git add .

# コミット（変更を記録）
git commit -m "変更内容の説明"

# GitHub にプッシュ
git push
```

---

## 次のステップ

GitHub にプッシュできたら、**RELEASE_CHECKLIST.md** の「公開のしかた」に進みます：
- Vercel や Railway で GitHub のリポジトリを連携
- 本番用データベースを用意
- 環境変数を設定
- デプロイ
