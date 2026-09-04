$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
& "D:\node\corepack.cmd" pnpm --dir $repoRoot --filter "@iphone-fleet-agent/hatchet-workflows" build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$wslRepo = "/mnt/e/iphone-fleet-agent"
$command = "cd '$wslRepo' && HATCHET_EMBEDDED_DATA_DIR=/home/rong/.cache/iphone-fleet-agent/hatchet-embedded node workflows/hatchet/dist/a4-integration.js"
wsl -d Ubuntu-E -- bash -lc $command
exit $LASTEXITCODE
