# ============================================================
# CNP にんじゃミッション工房 - Netlify 公開スクリプト
# 「★ゲームを公開する.bat」から実行されます
# ============================================================
$ErrorActionPreference = "Continue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$gameDir = $PSScriptRoot

Write-Host "`n=== 1/3 Netlifyログイン確認 ===" -ForegroundColor Cyan
$cfgPath = "$env:APPDATA\netlify\Config\config.json"
$token = $null
if (Test-Path $cfgPath) {
    try {
        $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
        $token = $cfg.users.($cfg.userId).auth.token
    } catch {}
}
if (-not $token) {
    Write-Host "Netlifyに未ログインです。ログイン窓口を開きます..." -ForegroundColor Yellow
    & powershell -NoProfile -ExecutionPolicy Bypass -File "$gameDir\netlify_login_madoguchi.ps1"
    $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
    $token = $cfg.users.($cfg.userId).auth.token
    if (-not $token) { Read-Host "ログインできませんでした。Enterで終了"; exit 1 }
}

$siteInfo = Get-Content "$gameDir\netlify_site.json" -Raw | ConvertFrom-Json
$siteId = $siteInfo.site_id
$url = $siteInfo.url

Write-Host "`n=== 2/3 ゲームをアップロード ===" -ForegroundColor Cyan
$zip = "$env:TEMP\ninja_deploy_$(Get-Date -Format HHmmss).zip"
Set-Location $gameDir
# Pythonでzip作成（zip内パスをスラッシュ区切りにするため）
$py = @"
import zipfile
files = ['index.html','style.css','data.js','gen.js','ads.js','game.js','manifest.webmanifest','sw.js','ads.txt',
         'icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png']
with zipfile.ZipFile(r'$zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(f, f)
print('zip ok')
"@
$py | python -
if ($LASTEXITCODE -ne 0) { Read-Host "zip作成に失敗しました。Enterで終了"; exit 1 }

$deploy = Invoke-RestMethod -Method Post -Uri "https://api.netlify.com/api/v1/sites/$siteId/deploys" -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/zip" } -InFile $zip
Write-Host ("アップロード完了 (deploy: " + $deploy.id + ")")

Write-Host "`n=== 3/3 公開を確認しています ===" -ForegroundColor Cyan
$ok = $false
for ($i = 0; $i -lt 24; $i++) {
    Start-Sleep -Seconds 5
    try {
        $d = Invoke-RestMethod -Uri "https://api.netlify.com/api/v1/sites/$siteId/deploys/$($deploy.id)" -Headers @{ Authorization = "Bearer $token" }
        if ($d.state -eq "ready") { $ok = $true; break }
        if ($d.state -eq "error") { break }
    } catch {}
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
if ($ok) { Write-Host " 公開できました！ゲームのURL：" -ForegroundColor Green }
else { Write-Host " アップロードは完了。1〜2分後に以下のURLで確認できます：" -ForegroundColor Yellow }
Write-Host ""
Write-Host ("   " + $url) -ForegroundColor White
Write-Host ""
Write-Host " スマホでこのURLを開いて："
Write-Host "   iPhone : Safariで開く → 共有ボタン → ホーム画面に追加"
Write-Host "   Android: Chromeで開く → メニュー(⋮) → アプリをインストール"
Write-Host "============================================================" -ForegroundColor Green
try { Set-Clipboard -Value $url; Write-Host "（URLはコピーずみ）" } catch {}
Read-Host "Enterで終了"
