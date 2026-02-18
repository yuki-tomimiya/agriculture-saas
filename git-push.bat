@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo === GitHub にプッシュ ===
echo.

REM コミットがあるか確認
git log -1 --oneline >nul 2>&1
if errorlevel 1 (
    echo エラー: コミットがありません。先に「git-init-and-commit.bat」を実行してください。
    pause
    exit /b 1
)

REM リモートが未設定なら追加
git remote add origin https://github.com/yuki-tomimiya/agriculture-saas.git 2>nul
if errorlevel 1 (
    echo リモートは既に設定済みです。
)

echo ブランチを main に合わせます...
git branch -M main

echo.
echo GitHub にプッシュしています。
echo 認証を求められたら: GitHub のユーザー名 と パスワードまたは Personal Access Token を入力してください。
echo.
git push -u origin main

if errorlevel 1 (
    echo.
    echo --- プッシュに失敗しました ---
    echo ・認証エラー: GitHub でパスワードの代わりに Personal Access Token を使う必要があります。
    echo   GitHub - Settings - Developer settings - Personal access tokens でトークンを作成し、パスワード欄に入力してください。
    echo ・「src refspec main does not match any」: 先に「git-init-and-commit.bat」を実行してコミットを作成してください。
    echo.
) else (
    echo.
    echo === 完了 ===
    echo https://github.com/yuki-tomimiya/agriculture-saas でコードを確認できます。
)

pause
