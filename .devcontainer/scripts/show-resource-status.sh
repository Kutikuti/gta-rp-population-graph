#!/usr/bin/env bash
set -euo pipefail

print_cgroup_file() {
  local label="$1"
  local path="$2"

  if [ -r "$path" ]; then
    printf '%s: %s\n' "$label" "$(cat "$path")"
  else
    printf '%s: unavailable\n' "$label"
  fi
}

echo "Inspecting container architecture and resource limits..."
printf 'uname -m: %s\n' "$(uname -m)"

echo "Node.js resource view:"
node <<'NODE'
const os = require('node:os')

console.log(`process.platform: ${process.platform}`)
console.log(`process.arch: ${process.arch}`)
console.log(`os.availableParallelism(): ${os.availableParallelism()}`)
console.log(`os.cpus().length: ${os.cpus().length}`)
console.log(`os.totalmem(): ${os.totalmem()}`)
console.log(`os.freemem(): ${os.freemem()}`)
NODE

print_cgroup_file "cgroup cpu.max" "/sys/fs/cgroup/cpu.max"
print_cgroup_file "cgroup cpuset.cpus.effective" "/sys/fs/cgroup/cpuset.cpus.effective"
print_cgroup_file "cgroup memory.max" "/sys/fs/cgroup/memory.max"
print_cgroup_file "cgroup memory.current" "/sys/fs/cgroup/memory.current"

echo "lscpu summary:"
lscpu | sed -n '/^Architecture:/p;/^CPU(s):/p;/^On-line CPU(s) list:/p;/^Model name:/p;/^Thread(s) per core:/p;/^Core(s) per socket:/p;/^Socket(s):/p;/^NUMA node(s):/p'
