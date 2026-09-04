$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$postgresScript = "/mnt/e/iphone-fleet-agent/scripts/wsl/local-postgres.sh"

wsl -d Ubuntu-E -- bash $postgresScript start
if ($LASTEXITCODE -ne 0) { throw "Failed to start project-local PostgreSQL" }

$environmentLine = wsl -d Ubuntu-E -- bash $postgresScript env
if ($environmentLine -notmatch '^FLEET_DATABASE_URL=(.+)$') {
  throw "Could not obtain FLEET_DATABASE_URL from local PostgreSQL helper"
}
$env:FLEET_DATABASE_URL = $Matches[1]

Push-Location $projectRoot
try {
  corepack pnpm integration
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL integration tests failed" }
}
finally {
  Pop-Location
}
