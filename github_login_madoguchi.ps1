# ============================================================
# GitHubログイン窓口：常に有効な認証コードを表示し続ける
# 認証できたら自動で deploy_to_github.ps1 を実行して公開まで進む
# ============================================================
$ErrorActionPreference = "Continue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$clientId = "178c6fc778ccc68e1d6a"  # GitHub CLI 公式クライアントID
$token = $null

while (-not $token) {
    try {
        $resp = Invoke-RestMethod -Method Post -Uri "https://github.com/login/device/code" -Headers @{ Accept = "application/json" } -Body @{ client_id = $clientId; scope = "repo read:org gist workflow" }
    } catch {
        Clear-Host
        Write-Host "ネットワークエラー。30びょうごに さいせつぞくします..." -ForegroundColor Yellow
        Start-Sleep -Seconds 30
        continue
    }
    $deadline = (Get-Date).AddSeconds($resp.expires_in - 30)
    $interval = [int]$resp.interval + 1
    $opened = $false

    while ((Get-Date) -lt $deadline) {
        Clear-Host
        Write-Host ""
        Write-Host "  =====================================================" -ForegroundColor Cyan
        Write-Host "   GitHub ログイン窓口（にんじゃゲーム公開用）" -ForegroundColor Cyan
        Write-Host "  =====================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "   1. ブラウザで  https://github.com/login/device  を開く"
        Write-Host ""
        Write-Host "   2. このコードを入力：" -NoNewline
        Write-Host ""
        Write-Host ""
        Write-Host ("        >>>   " + $resp.user_code + "   <<<") -ForegroundColor Green
        Write-Host ""
        Write-Host "   3. [Continue] → [Authorize GitHub] を押す"
        Write-Host ""
        Write-Host ("   （コードの有効期限: " + $deadline.ToString("HH:mm") + " まで。切れても自動で新しい") -ForegroundColor DarkGray
        Write-Host "     コードに変わるので、この画面のコードを使えば必ずOK）" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "   認証を確認しています..." -ForegroundColor DarkGray

        if (-not $opened) { Start-Process "https://github.com/login/device"; $opened = $true }

        Start-Sleep -Seconds $interval
        try {
            $r = Invoke-RestMethod -Method Post -Uri "https://github.com/login/oauth/access_token" -Headers @{ Accept = "application/json" } -Body @{ client_id = $clientId; device_code = $resp.device_code; grant_type = "urn:ietf:params:oauth:grant-type:device_code" }
        } catch { continue }
        if ($r.access_token) { $token = $r.access_token; break }
        if ($r.error -eq "slow_down") { $interval += 5 }
        if ($r.error -eq "expired_token" -or $r.error -eq "access_denied") { break }
    }
}

Clear-Host
Write-Host ""
Write-Host "  ログインできました！ つづけて ゲームを公開します..." -ForegroundColor Green
Write-Host ""

# gh CLI にトークンを登録
$gh = "$env:LOCALAPPDATA\Programs\GitHubCLI\bin\gh.exe"
if (-not (Test-Path $gh)) { $gh = "gh" }
$token | & $gh auth login --hostname github.com --with-token
& $gh auth setup-git --hostname github.com

# 公開スクリプトへ（ログイン済みなので全自動で進む）
& powershell -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\deploy_to_github.ps1"
