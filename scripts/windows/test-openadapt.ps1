$ErrorActionPreference = "Stop"

$wslCommand = "/home/rong/.cache/iphone-fleet-agent/openadapt-flow-1.35.0/bin/python /mnt/e/iphone-fleet-agent/spikes/openadapt/a6_spike.py"
wsl -d Ubuntu-E -- bash -lc $wslCommand
exit $LASTEXITCODE
