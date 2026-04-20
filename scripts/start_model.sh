#!/usr/bin/env bash
set -euo pipefail
# Start llama-server with the default Qwen model.
#
# Environment variables (all optional):
#   LLAMA_CPP_DIR   — directory containing the llama-server binary
#                     (default: $HOME/Source/llama.cpp)
#   LLAMA_CACHE     — directory where llama.cpp caches downloaded GGUF blobs
#                     (default: $HOME/.cache/llama.cpp)
#   MODEL_HF        — HuggingFace repo:quant to load
#                     (default: unsloth/Qwen3.6-35B-A3B-GGUF:UD-Q4_K_XL)
#   PORT            — port to listen on (default: 8001)

LLAMA_CPP_DIR="${LLAMA_CPP_DIR:-$HOME/Source/llama.cpp}"
MODEL_HF="${MODEL_HF:-unsloth/Qwen3.6-35B-A3B-GGUF:UD-Q4_K_XL}"
PORT="${PORT:-8001}"

LLAMA_SERVER="$LLAMA_CPP_DIR/llama-server"

export LLAMA_CACHE="${LLAMA_CACHE:-$HOME/.cache/llama.cpp}"
mkdir -p "${LLAMA_CACHE}"

if [ ! -x "$LLAMA_SERVER" ]; then
    echo "Error: llama-server not found at $LLAMA_SERVER"
    echo ""
    echo "Build it with:"
    echo "  bash scripts/build_llama.sh"
    echo ""
    echo "Or set LLAMA_CPP_DIR to the directory containing the llama-server binary."
    exit 1
fi

echo "Starting llama-server on port $PORT"
echo "Model: $MODEL_HF"
echo "Press Ctrl+C to stop."
echo ""

exec "$LLAMA_SERVER" \
    -hf "$MODEL_HF" \
    --temp 0.6 \
    --top-p 0.95 \
    --top-k 20 \
    --min-p 0.00 \
    --port "$PORT"
