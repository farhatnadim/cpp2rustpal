#!/usr/bin/env bash
set -euo pipefail
# Build llama.cpp with CUDA (if GPU detected) + HTTPS support.
#
# Env vars:
#   LLAMA_CPP_DIR  — where to clone/build llama.cpp
#                    (default: $HOME/Source/llama.cpp)

REPO_DIR="${LLAMA_CPP_DIR:-$HOME/Source/llama.cpp}"
BUILD_DIR="${REPO_DIR}/build"

# 1. System dependencies (libssl-dev required for -hf HuggingFace downloads)
echo "==> Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y \
    pciutils \
    build-essential \
    cmake \
    curl \
    libcurl4-openssl-dev \
    libssl-dev

# 2. Clone if missing
if [ ! -d "${REPO_DIR}" ]; then
    echo "==> Cloning llama.cpp into ${REPO_DIR}..."
    git clone https://github.com/ggml-org/llama.cpp "${REPO_DIR}"
else
    echo "==> llama.cpp already present at ${REPO_DIR}, pulling latest..."
    git -C "${REPO_DIR}" pull --ff-only
fi

# 3. Detect GPU
USE_CUDA=OFF
if command -v nvidia-smi &>/dev/null && nvidia-smi &>/dev/null; then
    echo "==> NVIDIA GPU detected — building with CUDA support"
    USE_CUDA=ON
else
    echo "==> No NVIDIA GPU detected — building CPU-only"
fi

# 4. Clean cached CMake state so config re-runs cleanly
rm -rf "${BUILD_DIR}"

# 5. Configure
echo "==> Configuring (CUDA=${USE_CUDA})..."
cmake "${REPO_DIR}" -B "${BUILD_DIR}" \
    -DBUILD_SHARED_LIBS=OFF \
    -DGGML_CUDA="${USE_CUDA}" \
    -DLLAMA_OPENSSL=ON \
    -DLLAMA_CURL=ON

# 6. Build
echo "==> Building..."
cmake --build "${BUILD_DIR}" --config Release -j \
    --clean-first \
    --target llama-server

# 7. Copy binary next to repo root
cp "${BUILD_DIR}/bin/llama-server" "${REPO_DIR}/"

echo ""
echo "Build complete. llama-server is at: ${REPO_DIR}/llama-server"
echo ""
echo "Start the model server with:"
echo "  bash scripts/start_model.sh"
