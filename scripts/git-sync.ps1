#requires -Version 5
<#
.SYNOPSIS
  C:\homepage を origin/main へ「安全に」fast-forward 同期する。
.DESCRIPTION
  ログオン時（遅延・バックグラウンド）に呼ばれる想定。安全設計：
    - main ブランチのときだけ実行する
    - 未コミット変更・未追跡ファイルがあれば同期しない（何も変更しない）
    - git pull --ff-only origin main（分岐していたらマージせず中止）
    - エラー時は作業ツリーを一切変更せず、ログだけ残す
  すべての結果は scripts\git-sync.log に追記する。
  リポジトリの場所はこのスクリプトの親フォルダから自動判定するため、
  クローン先が C:\homepage 以外でもそのまま動作する。
#>

$ErrorActionPreference = 'Continue'

$repo = Split-Path $PSScriptRoot -Parent
$log  = Join-Path $PSScriptRoot 'git-sync.log'

function Write-Log {
    param([string]$Level, [string]$Message)
    $line = '{0}  [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'), $Level, $Message
    try { Add-Content -Path $log -Value $line -Encoding UTF8 } catch { }
}

# --- 作業ディレクトリへ移動 ---
try {
    Set-Location -Path $repo -ErrorAction Stop
} catch {
    Write-Log 'ERROR' "リポジトリへ移動できません: $repo"
    exit 1
}

# --- git の存在確認 ---
& git --version *> $null
if ($LASTEXITCODE -ne 0) { Write-Log 'ERROR' 'git が見つかりません（PATH 未設定?）'; exit 1 }

# --- git リポジトリか確認 ---
& git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) { Write-Log 'ERROR' "git リポジトリではありません: $repo"; exit 1 }

# --- main ブランチのみ実行 ---
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null).Trim()
if ($branch -ne 'main') {
    Write-Log 'SKIP' "現在のブランチ '$branch' は main ではないため同期しません"
    exit 0
}

# --- 安全弁：未コミット変更・未追跡ファイルがあれば中止（何も変更しない）---
$dirty = & git status --porcelain
if ($LASTEXITCODE -ne 0) { Write-Log 'ERROR' 'git status に失敗しました'; exit 1 }
if ($dirty) {
    Write-Log 'SKIP' '未コミット変更/未追跡ファイルあり。同期を中止しました（変更なし）'
    foreach ($l in $dirty) { Write-Log 'DIRTY' $l }
    exit 0
}

# --- fast-forward のみ（失敗しても作業ツリーは不変）---
$out = & git pull --ff-only origin main 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Log 'ERROR' ("fast-forward 不可（分岐/ネットワーク等）。変更なし: " + ($out -join ' '))
    exit 1
}

Write-Log 'OK' ("同期完了: " + ($out -join ' '))
exit 0
