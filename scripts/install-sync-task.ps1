#requires -Version 5
<#
.SYNOPSIS
  ログオン時に git-sync.ps1 をバックグラウンド実行するタスクを登録する（初回のみ手動実行）。
.DESCRIPTION
  - トリガー: 現在ユーザーのログオン時
  - 遅延    : 45 秒（ログオン直後を避け、起動を妨げない）
  - 実行    : PowerShell を非表示ウィンドウ・非対話で起動（バックグラウンド）
  - 権限    : 現在ユーザー・限定権限（管理者不要）
  Task Scheduler のログオンタスクは非同期に動くため、Windows の起動やデスクトップ表示を待たせない。
  再実行しても -Force で同名タスクを上書きするので安全。
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File C:\homepage\scripts\install-sync-task.ps1
#>

$ErrorActionPreference = 'Stop'

$script = Join-Path $PSScriptRoot 'git-sync.ps1'
if (-not (Test-Path $script)) { throw "git-sync.ps1 が見つかりません: $script" }

$taskName = 'homepage-sync'

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $script)

# ログオン後 45 秒遅延
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$trigger.Delay = 'PT45S'

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
    -MultipleInstances IgnoreNew

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal -Force | Out-Null

Write-Host "✅ 登録しました: タスク '$taskName'（ログオン45秒後にバックグラウンド同期）"
Write-Host ""
Write-Host "手動テスト:"
Write-Host "  Start-ScheduledTask -TaskName $taskName"
Write-Host ("  Get-Content `"{0}`" -Tail 5" -f (Join-Path $PSScriptRoot 'git-sync.log'))
Write-Host ""
Write-Host "解除:"
Write-Host ('  Unregister-ScheduledTask -TaskName ' + $taskName + ' -Confirm:$false')
