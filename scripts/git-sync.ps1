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

# --- Ensure image folders referenced by the article HTML exist ---
# Scans every *.html in the repo root for image paths shaped like
#   images/<category>/<folder>/<file>   (e.g. images/travel/hasshoku/hasshoku-1.webp)
# and creates <repo>\images\<category>\<folder>\ when it is missing.
# Notes on safety:
#   - Works for any category (travel / cooking / yurulog / carwash / ...).
#   - Existing folders are left untouched (Test-Path guard).
#   - Only empty folders are created; git ignores empty directories, so this
#     never makes the working tree "dirty" and cannot break the ff-only sync.
#   - Created folder names are printed to the console (visible on manual runs)
#     and recorded in git-sync.log (visible for background/logon runs).
function Ensure-ImageFolders {
    param([string]$RepoRoot)

    $htmlFiles = Get-ChildItem -Path $RepoRoot -Filter '*.html' -File -ErrorAction SilentlyContinue
    if (-not $htmlFiles) { return }

    # Capture the two folder segments after "images/". Segment/file names use
    # word chars, hyphen and dot; top-level files like images/car1.webp (only
    # one segment) intentionally do not match, so no folder is created for them.
    $regex   = [regex]'images/([A-Za-z0-9_-]+)/([A-Za-z0-9_-]+)/[A-Za-z0-9_.-]+'
    $wanted  = New-Object 'System.Collections.Generic.HashSet[string]'

    foreach ($f in $htmlFiles) {
        $content = Get-Content -Path $f.FullName -Raw -ErrorAction SilentlyContinue
        if (-not $content) { continue }
        foreach ($m in $regex.Matches($content)) {
            [void]$wanted.Add(('images/{0}/{1}' -f $m.Groups[1].Value, $m.Groups[2].Value))
        }
    }

    foreach ($rel in $wanted) {
        $full = Join-Path $RepoRoot ($rel -replace '/', '\')
        if (-not (Test-Path -LiteralPath $full)) {
            try {
                New-Item -ItemType Directory -Path $full -Force -ErrorAction Stop | Out-Null
                Write-Log 'MKDIR' $rel
                Write-Host ('Created image folder: {0}' -f $rel)
            } catch {
                Write-Log 'ERROR' ('Failed to create folder ' + $rel + ' -- ' + $_.Exception.Message)
            }
        }
    }
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

# After a successful sync, make sure every image folder referenced by the
# article HTML exists (creates missing ones only; existing ones are left as-is).
Ensure-ImageFolders -RepoRoot $repo

exit 0
