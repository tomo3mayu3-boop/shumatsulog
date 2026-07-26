#requires -Version 5
# Safely fast-forward the repo (e.g. C:\homepage) to origin/main.
# Intended to run at logon (delayed, background). Safety rules:
#   - Run only when the current branch is main
#   - Do nothing if there are uncommitted or untracked changes
#   - git pull --ff-only origin main (abort if diverged)
#   - On any error, change nothing and only append to the log
# All results are appended to scripts\git-sync.log.
# The repo path is derived from this script's parent folder, so it works
# even if cloned somewhere other than C:\homepage.

$ErrorActionPreference = 'Continue'

$repo = Split-Path $PSScriptRoot -Parent
$log  = Join-Path $PSScriptRoot 'git-sync.log'

function Write-Log {
    param([string]$Level, [string]$Message)
    $line = '{0}  [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'), $Level, $Message
    try { Add-Content -Path $log -Value $line -Encoding UTF8 } catch { }
}

# --- Move into the repo ---
try {
    Set-Location -Path $repo -ErrorAction Stop
} catch {
    Write-Log 'ERROR' "Cannot enter repo: $repo"
    exit 1
}

# --- git available? ---
& git --version *> $null
if ($LASTEXITCODE -ne 0) { Write-Log 'ERROR' 'git not found (PATH not set?)'; exit 1 }

# --- Is this a git repo? ---
& git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) { Write-Log 'ERROR' "Not a git repository: $repo"; exit 1 }

# --- main branch only ---
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null).Trim()
if ($branch -ne 'main') {
    Write-Log 'SKIP' "Current branch '$branch' is not main; skipping"
    exit 0
}

# --- Safety: stop if there are uncommitted or untracked changes (make no change) ---
$dirty = & git status --porcelain
if ($LASTEXITCODE -ne 0) { Write-Log 'ERROR' 'git status failed'; exit 1 }
if ($dirty) {
    Write-Log 'SKIP' 'Uncommitted or untracked changes present; aborting (no change made)'
    foreach ($l in $dirty) { Write-Log 'DIRTY' $l }
    exit 0
}

# --- fast-forward only (working tree stays unchanged on failure) ---
$out = & git pull --ff-only origin main 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Log 'ERROR' ('fast-forward not possible (diverged/network). No change: ' + ($out -join ' '))
    exit 1
}

Write-Log 'OK' ('Sync complete: ' + ($out -join ' '))
exit 0
