@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ===== Git 状態確認 =====
echo.

echo [1] ブランチ一覧
git branch -a 2>nul
if errorlevel 1 (echo   （リポジトリがまだ初期化されていません）)
echo.

echo [2] 直近のコミット
git log -1 --oneline 2>nul
if errorlevel 1 (echo   （コミットがありません）)
echo.

echo [3] リモート設定
git remote -v 2>nul
if errorlevel 1 (echo   （リモート未設定）)
echo.

echo [4] user.name / user.email（このリポジトリ）
git config user.name 2>nul
git config user.email 2>nul
echo.

echo [5] ステータス
git status -s 2>nul
if errorlevel 1 (echo   （リポジトリがまだ初期化されていません）)

echo.
echo ===== 確認終了 =====
pause
