#!/usr/bin/env bash
set -euo pipefail

# Run llama-server with the default Pal model.
#
# Env vars:
#   LLAMA_CPP_DIR  Path to the llama.cpp checkout containing the built
#                  llama-server binary. Default: $HOME/Source/llama.cpp
#   LLAMA_CACHE    Absolute directory where llama.cpp caches downloaded
#                  GGUF blobs. Default: $HOME/.cache/llama.cpp
#                  (keeps the cache stable across runs so the model is
#                  downloaded once, not every time the server starts).
#   MODEL_HF       HuggingFace repo:quant spec passed to -hf. Default:
#                  unsloth/Qwen3.6-35B-A3B-GGUF:UD-Q4_K_XL

REPO_DIR="${LLAMA_CPP_DIR:-$HOME/Source/llama.cpp}"
SERVER_BIN="${REPO_DIR}/llama-server"

export LLAMA_CACHE="${LLAMA_CACHE:-$HOME/.cache/llama.cpp}"
mkdir -p "${LLAMA_CACHE}"

MODEL_HF="${MODEL_HF:-unsloth/Qwen3.6-35B-A3B-GGUF:UD-Q4_K_XL}"

if [ ! -x "${SERVER_BIN}" ]; then
    echo "llama-server not found at ${SERVER_BIN}." >&2
    echo "Build it first: scripts/build-llama.sh" >&2
    exit 1
fi

exec "${SERVER_BIN}" \
    -hf "${MODEL_HF}" \
    --temp 0.6 \
    --top-p 0.95 \
    --top-k 20 \
    --min-p 0.00 \
    --port 8001
