#!/usr/bin/env bash
set -euo pipefail

# Pal — seamless install (Linux + NVIDIA CUDA).
#
# Flags:
#   --rebuild-llama   Force re-run of scripts/build-llama.sh
#   --refetch-model   Remove cache marker and re-download the GGUF
#   --skip-model      Skip pre-fetch (download lazily on first server run)
#   --help            Print usage

usage() {
    sed -n '3,11p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
}

REBUILD_LLAMA=0
REFETCH_MODEL=0
SKIP_MODEL=0
for arg in "$@"; do
    case "$arg" in
        --rebuild-llama) REBUILD_LLAMA=1 ;;
        --refetch-model) REFETCH_MODEL=1 ;;
        --skip-model)    SKIP_MODEL=1 ;;
        --help|-h)       usage ;;
        *) echo "unknown flag: $arg"; usage ;;
    esac
done

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

export LLAMA_CPP_DIR="${LLAMA_CPP_DIR:-$HOME/Source/llama.cpp}"
export LLAMA_CACHE="${LLAMA_CACHE:-$HOME/.cache/llama.cpp}"
MODEL_HF="${MODEL_HF:-unsloth/Qwen3.6-35B-A3B-GGUF:UD-Q4_K_XL}"

step() { printf '\n\033[1;34m[%s]\033[0m %s\n' "$1" "$2"; }
fail() { printf '\033[1;31mfailed:\033[0m %s\n' "$1" >&2; exit 1; }

########################################
# 1. Preflight
########################################
step 1/5 "preflight checks"

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || fail "$1 not found. $2"
}

require_cmd node   "Install Node 20+: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
require_cmd npm    "npm missing (ships with Node)."
require_cmd cmake  "sudo apt-get install -y cmake"
require_cmd code   "Open VS Code → Command Palette → 'Shell Command: Install code command in PATH'"
require_cmd curl   "sudo apt-get install -y curl"

node_major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$node_major" -ge 20 ] || fail "Node $node_major found; need >= 20."

if ! command -v nvidia-smi >/dev/null 2>&1 || ! nvidia-smi -L | grep -q GPU; then
    fail "No NVIDIA GPU detected. Default model needs CUDA. Install drivers or set MODEL_HF to a CPU-friendly quant and re-run."
fi

mkdir -p "$LLAMA_CACHE"
avail_kb="$(df -Pk "$LLAMA_CACHE" | awk 'NR==2 {print $4}')"
[ "$avail_kb" -ge $((25 * 1024 * 1024)) ] || fail "<25 GB free on $LLAMA_CACHE partition. Point LLAMA_CACHE at a larger volume."

echo "ok: node $(node -v), npm $(npm -v), cmake $(cmake --version | head -1 | awk '{print $3}'), GPU detected, $(( avail_kb / 1024 / 1024 )) GB free on cache"

########################################
# 2. Build llama.cpp
########################################
step 2/5 "build llama.cpp"

if [ "$REBUILD_LLAMA" -eq 1 ] || [ ! -x "$LLAMA_CPP_DIR/llama-server" ]; then
    bash "$REPO_ROOT/scripts/build-llama.sh"
else
    echo "llama-server already built at $LLAMA_CPP_DIR/llama-server — skipping (--rebuild-llama to force)"
fi

########################################
# 3. Pre-fetch model
########################################
step 3/5 "pre-fetch model ($MODEL_HF)"

cache_marker="$LLAMA_CACHE/$(echo "${MODEL_HF%%:*}" | tr '/' '_').done"

if [ "$SKIP_MODEL" -eq 1 ]; then
    echo "--skip-model: lazy download on first server run"
elif [ "$REFETCH_MODEL" -eq 1 ] || [ ! -f "$cache_marker" ]; then
    [ "$REFETCH_MODEL" -eq 1 ] && rm -f "$cache_marker"
    echo "downloading to $LLAMA_CACHE (multi-GB; may take a while)…"
    log="/tmp/pal-prefetch.log"
    : > "$log"
    "$LLAMA_CPP_DIR/llama-server" -hf "$MODEL_HF" --port 18001 --host 127.0.0.1 >"$log" 2>&1 &
    pid=$!
    trap 'kill $pid 2>/dev/null || true' EXIT
    ok=0
    for _ in $(seq 1 360); do
        if ! kill -0 "$pid" 2>/dev/null; then
            break
        fi
        if curl -sf http://127.0.0.1:18001/v1/models >/dev/null 2>&1; then
            ok=1
            break
        fi
        sleep 5
    done
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
    trap - EXIT
    [ "$ok" -eq 1 ] || fail "pre-fetch did not reach serving state within 30 min. See $log"
    touch "$cache_marker"
    echo "model cached; marker: $cache_marker"
else
    echo "model already cached — skipping (--refetch-model to force)"
fi

########################################
# 4. Build the extension
########################################
step 4/5 "build the extension"

if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
    npm install
else
    echo "node_modules up to date — skipping npm install"
fi

npm run compile

########################################
# 5. Package & install the VSIX
########################################
step 5/5 "package & install the VSIX"

VERSION="$(node -p "require('./package.json').version")"
VSIX="cpp2rustpal-${VERSION}.vsix"

npx --yes vsce package --out "$VSIX"
code --install-extension "$VSIX" --force

cat <<EOF

done.

next: start the LLM server in another terminal
    scripts/run-llama-server.sh

then open a .cpp file in VS Code — the status bar should flip to online within 30s.
EOF
