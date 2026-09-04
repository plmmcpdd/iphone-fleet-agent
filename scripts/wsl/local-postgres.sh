#!/usr/bin/env bash
set -euo pipefail

project_root="/mnt/e/iphone-fleet-agent"
runtime_root="$project_root/.runtime/postgres"
package_root="$runtime_root/root"
deb_root="$runtime_root/debs"
data_root="${XDG_CACHE_HOME:-$HOME/.cache}/iphone-fleet-agent/postgres-16"
data_dir="$data_root/data"
log_file="$data_root/postgres.log"
port="${FLEET_PG_PORT:-55432}"
bin_dir="$package_root/usr/lib/postgresql/16/bin"
share_dir="$package_root/usr/share/postgresql/16"
export LD_LIBRARY_PATH="$package_root/usr/lib/x86_64-linux-gnu:$package_root/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}"

prepare() {
  mkdir -p "$deb_root" "$package_root" "$data_root"
  if [[ ! -x "$bin_dir/postgres" ]]; then
    (
      cd "$deb_root"
      apt-get download postgresql-16 postgresql-client-16 libpq5 libxslt1.1
      for package in ./*.deb; do
        dpkg-deb -x "$package" "$package_root"
      done
    )
  fi
  if [[ ! -f "$data_dir/PG_VERSION" ]]; then
    "$bin_dir/initdb" -D "$data_dir" -L "$share_dir" --auth=trust --no-locale --encoding=UTF8
  fi
}

start() {
  prepare
  if ! "$bin_dir/pg_ctl" -D "$data_dir" status >/dev/null 2>&1; then
    "$bin_dir/pg_ctl" -D "$data_dir" -l "$log_file" -o "-h 127.0.0.1 -p $port -k $data_root" start
  fi
  until "$bin_dir/pg_isready" -h 127.0.0.1 -p "$port" >/dev/null 2>&1; do
    sleep 0.2
  done
  if ! "$bin_dir/psql" -h 127.0.0.1 -p "$port" -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = 'fleet_test'" | grep -q 1; then
    "$bin_dir/createdb" -h 127.0.0.1 -p "$port" fleet_test
  fi
}

stop() {
  if [[ -f "$data_dir/PG_VERSION" ]] && "$bin_dir/pg_ctl" -D "$data_dir" status >/dev/null 2>&1; then
    "$bin_dir/pg_ctl" -D "$data_dir" stop -m fast
  fi
}

status() {
  "$bin_dir/pg_isready" -h 127.0.0.1 -p "$port"
}

environment() {
  printf 'FLEET_DATABASE_URL=postgresql://%s@127.0.0.1:%s/fleet_test\n' "$(id -un)" "$port"
}

case "${1:-}" in
  prepare) prepare ;;
  start) start ;;
  stop) stop ;;
  status) status ;;
  env) environment ;;
  *) echo "usage: $0 <prepare|start|stop|status|env>" >&2; exit 2 ;;
esac
