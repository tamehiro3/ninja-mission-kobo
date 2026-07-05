# ============================================================
# Netlify ログイン窓口：Googleアカウントで2〜3クリックでOK
# ============================================================
$ErrorActionPreference = "Continue"
$logFile = "$PSScriptRoot\login_madoguchi.log"
function Log($msg) { ((Get-Date).ToString("HH:mm:ss") + " NETLIFY " + $msg) | Add-Content -Path $logFile -Encoding UTF8 }

function Test-NetlifyToken {
    $cfg = "$env:APPDATA\netlify\Config\config.json"
    if (-not (Test-Path $cfg)) { return $false }
    try {
        $j = Get-Content $cfg -Raw | ConvertFrom-Json
        foreach ($u in $j.users.PSObject.Properties) {
            if ($u.Value.auth.token) { return $true }
        }
    } catch {}
    return $false
}

Log "=== Netlify窓口起動 ==="
while (-not (Test-NetlifyToken)) {
    Clear-Host
    Write-Host ""
    Write-Host "  =====================================================" -ForegroundColor Cyan
    Write-Host "   Netlify ログイン窓口（にんじゃゲーム公開用）" -ForegroundColor Cyan
    Write-Host "  =====================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   これからブラウザが開きます。やることは："
    Write-Host ""
    Write-Host "   1. 『Sign up』→『Google』ボタンで Gmail をえらぶ" -ForegroundColor Green
    Write-Host "      （すでにログインずみなら この手順はスキップされます）"
    Write-Host ""
    Write-Host "   2. 『Authorize』ボタンを押す" -ForegroundColor Green
    Write-Host ""
    Write-Host "   ※ コードの入力は いっさい ありません"
    Write-Host ""
    Log "netlify login 実行"
    netlify login
    if (Test-NetlifyToken) { break }
    Write-Host ""
    Write-Host "  まだログインが かくにんできませんでした。" -ForegroundColor Yellow
    Write-Host "  Enterを押すと もういちど ブラウザが ひらきます。" -ForegroundColor Yellow
    Read-Host
}

Log "ログイン成功"
Clear-Host
Write-Host ""
Write-Host "  ✅ Netlifyログイン かんりょう！" -ForegroundColor Green
Write-Host ""
Write-Host "  このウィンドウは とじてOKです。" -ForegroundColor Green
Write-Host "  （公開作業は Claude が じどうで つづけます）"
Write-Host ""
Read-Host "Enterで とじる"
