#!/usr/bin/env bash
set -euo pipefail

# Build llama.cpp with CUDA + HTTPS support.
#
# Env vars:
#   LLAMA_CPP_DIR  Path to the llama.cpp checkout. Default: $HOME/Source/llama.cpp
#                  (cloned if missing). Binaries are copied into this dir.

REPO_DIR="${LLAMA_CPP_DIR:-$HOME/Source/llama.cpp}"
BUILD_DIR="${REPO_DIR}/build"

# 1. System deps. libssl-dev is REQUIRED for -hf / HuggingFace HTTPS downloads.
sudo apt-get update
sudo apt-get install -y \
    pciutils \
    build-essential \
    cmake \
    curl \
    libcurl4-openssl-dev \
    libssl-dev

# 2. Clone if missing.
if [ ! -d "${REPO_DIR}" ]; then
    git clone https://github.com/ggml-org/llama.cpp "${REPO_DIR}"
fi

# 3. Clean cached CMake state so the OpenSSL lookup re-runs.
rm -rf "${BUILD_DIR}"

# 4. Configure with CUDA + OpenSSL (HTTPS).
cmake "${REPO_DIR}" -B "${BUILD_DIR}" \
    -DBUILD_SHARED_LIBS=OFF \
    -DGGML_CUDA=ON \
    -DLLAMA_OPENSSL=ON \
    -DLLAMA_CURL=ON

# 5. Build.
cmake --build "${BUILD_DIR}" --config Release -j \
    --clean-first \
    --target llama-cli llama-mtmd-cli llama-server llama-gguf-split

# 6. Copy binaries next to the repo root (matches the original workflow).
cp "${BUILD_DIR}"/bin/llama-* "${REPO_DIR}/"

echo
echo "Build complete. Binaries in ${REPO_DIR}/"
