# LLM Server Prerequisite

Pal talks to a locally-running `llama-server` over an OpenAI-compatible API. The extension does **nothing** without it — the status bar will show `offline` and no hints will be written.

These two scripts build and run a CUDA-accelerated `llama.cpp` server with the default Qwen model.

## 1. Build `llama.cpp`

```bash
scripts/build-llama.sh
```

What it does:

- Installs system deps (`libssl-dev`, `libcurl4-openssl-dev`, `cmake`, `build-essential`, …) via `apt-get` — requires `sudo`.
- Clones `github.com/ggml-org/llama.cpp` into `$LLAMA_CPP_DIR` (default `$HOME/Source/llama.cpp`) if missing.
- Wipes the build dir and re-configures CMake with `GGML_CUDA=ON`, `LLAMA_OPENSSL=ON`, `LLAMA_CURL=ON`.
- Builds `llama-cli`, `llama-mtmd-cli`, `llama-server`, `llama-gguf-split` and copies them into the repo root.

Override the checkout path:

```bash
LLAMA_CPP_DIR=/opt/llama.cpp scripts/build-llama.sh
```

## 2. Run the server

```bash
scripts/run-llama-server.sh
```

Listens on `http://localhost:8001` by default (llama-server's own default), which matches `cppToRust.llmEndpoint`.

Environment knobs:

| Var | Default | Purpose |
|---|---|---|
| `LLAMA_CPP_DIR` | `$HOME/Source/llama.cpp` | Where the built `llama-server` lives |
| `LLAMA_CACHE` | `$HOME/.cache/llama.cpp` | Absolute cache dir for downloaded GGUF blobs. **Stable across runs** — the model is pulled from HuggingFace once, not every launch |
| `MODEL_HF` | `unsloth/Qwen3.6-35B-A3B-GGUF:UD-Q4_K_XL` | `repo:quant` passed to `-hf` |

Example — different cache location and a smaller quant:

```bash
LLAMA_CACHE=/mnt/models/llama-cache \
MODEL_HF=unsloth/Qwen3.6-35B-A3B-GGUF:Q4_K_M \
scripts/run-llama-server.sh
```

## Verifying

Once the server is up:

```bash
curl -s http://localhost:8001/v1/models | jq .
```

You should see the model ID in the response. In VS Code, open a C++ file — the status bar should flip to `$(check) C++→Rust: online`.

## Notes

- The first run downloads the full GGUF (several GB). Subsequent runs hit the `LLAMA_CACHE` directly — no re-download.
- If you're on a fresh shell and `LLAMA_CACHE` isn't exported, the script sets it to `$HOME/.cache/llama.cpp` automatically.
- Matching the extension's default endpoint requires llama-server to listen on `8001`. If you change it (e.g. `--port 9000`), update `cppToRust.llmEndpoint` in VS Code settings.
