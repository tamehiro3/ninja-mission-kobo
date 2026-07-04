# ============================================================
# CNP にんじゃミッション工房 - GitHub Pages 公開スクリプト
# 「★ゲームを公開する.bat」から実行されます
# ============================================================
$ErrorActionPreference = "Stop"
$repoName = "ninja-mission-kobo"
$gameDir = $PSScriptRoot

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

# gh コマンドを探す（インストール直後はPATH未反映のことがある）
$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
    $candidate = "$env:ProgramFiles\GitHub CLI\gh.exe"
    if (Test-Path $candidate) { $gh = $candidate } else {
        Write-Host "GitHub CLI が見つかりません。先に以下を実行してください：" -ForegroundColor Red
        Write-Host "  winget install --id GitHub.cli"
        Read-Host "Enterで終了"
        exit 1
    }
} else { $gh = $gh.Source }

Write-Step "1/5 GitHubログイン確認"
& $gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ブラウザでGitHubにログインします。" -ForegroundColor Yellow
    Write-Host "・GitHubアカウントがない場合は、開いた画面から無料で作成できます"
    Write-Host "・画面に表示される 8桁のコード をブラウザに入力してください"
    & $gh auth login --hostname github.com --git-protocol https --web
    if ($LASTEXITCODE -ne 0) { Read-Host "ログインに失敗しました。Enterで終了"; exit 1 }
}

Write-Step "2/5 ゲームファイルをコミット"
Set-Location $gameDir
git add -A
git commit -m "CNP ninja mission kobo" 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "（変更なし。そのまま続行）" }

Write-Step "3/5 GitHubリポジトリを作成してアップロード"
$owner = (& $gh api user -q .login)
& $gh repo view "$owner/$repoName" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    & $gh repo create $repoName --public --source . --push
} else {
    git remote get-url origin 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { git remote add origin "https://github.com/$owner/$repoName.git" }
    git push -u origin HEAD 2>$null
    if ($LASTEXITCODE -ne 0) { git push -u origin HEAD --force }
}

Write-Step "4/5 GitHub Pages を有効化"
$branch = (git branch --show-current)
& $gh api "repos/$owner/$repoName/pages" -X POST -f "source[branch]=$branch" -f "source[path]=/" 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "（すでに有効化ずみ。そのまま続行）" }

$url = "https://$owner.github.io/$repoName/"
Write-Step "5/5 公開完了を待っています（1〜2分かかります）"
$ok = $false
for ($i = 0; $i -lt 24; $i++) {
    Start-Sleep -Seconds 10
    try {
        $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
        if ($res.StatusCode -eq 200) { $ok = $true; break }
    } catch { Write-Host "  じゅんびちゅう… ($(($i+1)*10)秒)" }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
if ($ok) { Write-Host " 公開できました！ゲームのURL：" -ForegroundColor Green }
else { Write-Host " アップロードは完了。数分後に以下のURLで遊べます：" -ForegroundColor Yellow }
Write-Host ""
Write-Host "   $url" -ForegroundColor White
Write-Host ""
Write-Host " スマホでこのURLを開いて：" -ForegroundColor Green
Write-Host "   iPhone : Safariで開く → 共有ボタン → ホーム画面に追加"
Write-Host "   Android: Chromeで開く → メニュー(⋮) → アプリをインストール"
Write-Host "============================================================" -ForegroundColor Green
Start-Process $url
Set-Clipboard -Value $url
Write-Host "（URLはコピーずみ。LINEやメールでスマホに送れます）"
Read-Host "Enterで終了"
