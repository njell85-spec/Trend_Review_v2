$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root

$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logPath = Join-Path $logDir ("local-daily-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))

function Write-Log {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  $line | Tee-Object -FilePath $logPath -Append
}

function Invoke-Step {
  param(
    [string]$FilePath,
    [string[]]$Arguments = @()
  )

  Write-Log (">>> {0} {1}" -f $FilePath, ($Arguments -join ' '))
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $output = & $FilePath @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  $output | ForEach-Object { $_.ToString() } | Tee-Object -FilePath $logPath -Append
  if ($exitCode -ne 0) {
    throw ("Command failed with exit {0}: {1}" -f $exitCode, $FilePath)
  }
}

function Test-StagedChanges {
  & git diff --cached --quiet
  if ($LASTEXITCODE -eq 0) { return $false }
  if ($LASTEXITCODE -eq 1) { return $true }
  throw "git diff --cached --quiet failed with exit $LASTEXITCODE"
}

function Commit-And-Push {
  param(
    [string[]]$Paths,
    [string]$Message
  )

  Invoke-Step git (@('add') + $Paths)
  if (Test-StagedChanges) {
    Invoke-Step git @('commit', '-m', $Message)
    Invoke-Step git @('push', 'origin', 'main')
  } else {
    Write-Log "No staged changes for: $Message"
  }
}

$korea = [TimeZoneInfo]::FindSystemTimeZoneById('Korea Standard Time')
$runDate = [TimeZoneInfo]::ConvertTime([DateTimeOffset]::Now, $korea).ToString('yyyy-MM-dd')
$markerPath = Join-Path $root ("data\notifications\{0}.json" -f $runDate)
$reportPath = Join-Path $root ("reports\{0}.json" -f $runDate)

Write-Log "Trend Review local daily started for $runDate"

Invoke-Step git @('pull', '--ff-only', 'origin', 'main')

if (Test-Path $markerPath) {
  Write-Log "Notification marker already exists for $runDate. Exiting."
  exit 0
}

if (-not $env:LLM_PROVIDER) { $env:LLM_PROVIDER = 'claude-code' }
if (-not $env:CLAUDE_CODE_MODEL) { $env:CLAUDE_CODE_MODEL = 'opus' }
if (-not $env:CLAUDE_CODE_COMMAND) { $env:CLAUDE_CODE_COMMAND = 'claude.cmd' }

Invoke-Step npm.cmd @('ci')
Invoke-Step npm.cmd @('test')

if (-not (Test-Path $reportPath)) {
  Invoke-Step node @('src/cli.js', '--date', $runDate, '--no-notify')
  Commit-And-Push -Paths @('data', 'reports', 'public') -Message 'chore: local daily trend review output'
} else {
  Write-Log "Report already exists for $runDate. Reusing existing report."
}

$waitSeconds = if ($env:LOCAL_PAGES_DEPLOY_WAIT_SECONDS) { [int]$env:LOCAL_PAGES_DEPLOY_WAIT_SECONDS } else { 90 }
if ($waitSeconds -gt 0) {
  Write-Log "Waiting $waitSeconds seconds for GitHub Pages deployment."
  Start-Sleep -Seconds $waitSeconds
}

Invoke-Step node @('src/notify/send-latest.js')
Commit-And-Push -Paths @('data/notifications') -Message 'chore: record local daily notification'

Write-Log "Trend Review local daily completed for $runDate"
