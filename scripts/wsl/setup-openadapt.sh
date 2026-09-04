#!/usr/bin/env bash
set -euo pipefail

repo_root="/mnt/e/iphone-fleet-agent"
venv_root="${HOME}/.cache/iphone-fleet-agent/openadapt-flow-1.35.0"

python3 -c 'import sys; assert sys.version_info[:2] == (3, 12), sys.version'
if [[ ! -x "${venv_root}/bin/python" ]]; then
  python3 -m venv "${venv_root}"
fi
"${venv_root}/bin/python" -m pip install --disable-pip-version-check "pip==26.2.1"
"${venv_root}/bin/python" -m pip install --disable-pip-version-check -r "${repo_root}/spikes/openadapt/requirements.lock.txt"
"${venv_root}/bin/python" -c 'import openadapt_flow; print(openadapt_flow.__version__)'
