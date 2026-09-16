@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo === Git の設定を確認 ===
git config user.email >nul 2>&1
if errorlevel 1 (
    echo メールが未設定のため、このリポジトリ用に設定します。
    git config user.email "you@example.com"
    git config user.name "Your Name"
    echo 後で「git config user.email あなたのメール」で変更できます。
)
git config user.name >nul 2>&1
if errorlevel 1 (
    git config user.email "you@example.com"
    git config user.name "Your Name"
)

echo.
echo === Git リポジトリの初期化 ===
git init
if errorlevel 1 (
    echo エラー: git init に失敗しました。Git がインストールされているか確認してください。
    pause
    exit /b 1
)

echo.
echo === ファイルをステージング ===
git add .
if errorlevel 1 (
    echo エラー: git add に失敗しました。
    pause
    exit /b 1
)

echo.
echo === 初回コミット ===
git commit -m "Initial commit: Tillto プロジェクト"
if errorlevel 1 (
    echo.
    echo コミットに失敗しました。考えられる原因:
    echo 1. 既にコミット済みで変更がない
    echo 2. 上で設定したメール/名前を変更したい場合
    echo.
    echo 既にコミットがある場合は、このまま「git-push.bat」を実行してみてください。
    git branch -M main 2>nul
    echo.
    pause
    exit /b 0
)

echo.
echo === ブランチを main に設定 ===
git branch -M main

echo.
echo === ここまで完了 ===
echo 次に「git-push.bat」をダブルクリックして GitHub にプッシュしてください。
pause
