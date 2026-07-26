#requires -Version 5
# Register a Scheduled Task that runs git-sync.ps1 in the background at logon.
# Run this once, manually, on the PC. Administrator rights are NOT required.
#   - Trigger: at the current user's logon
#   - Delay  : 45 seconds (do not slow down startup)
#   - Run    : PowerShell hidden and non-interactive (background)
#   - Rights : current user, limited (no elevation)
# Logon tasks run asynchronously, so Windows startup is not blocked.
# Re-running is safe: -Force overwrites the task with the same name.
#
# Example:
#   powershell -NoProfile -ExecutionPolicy Bypass -File C:\homepage\scripts\install-sync-task.ps1

$ErrorActionPreference = 'Stop'

$script = Join-Path $PSScriptRoot 'git-sync.ps1'
if (-not (Test-Path $script)) { throw "git-sync.ps1 not found: $script" }

$taskName = 'homepage-sync'

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $script)

# 45-second delay after logon
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

Write-Host ("Registered task '{0}' (background sync 45s after logon)." -f $taskName)
Write-Host ''
Write-Host 'Manual test:'
Write-Host ('  Start-ScheduledTask -TaskName ' + $taskName)
Write-Host ('  Get-Content "' + (Join-Path $PSScriptRoot 'git-sync.log') + '" -Tail 5')
Write-Host ''
Write-Host 'Uninstall:'
Write-Host ('  Unregister-ScheduledTask -TaskName ' + $taskName + ' -Confirm:$false')
