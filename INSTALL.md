# Installation

Pal targets **Linux + NVIDIA CUDA**. A single script does everything except start the server.

## One-shot install

```bash
./install.sh
```

What it does, in order:

1. **Preflight** — checks `node>=20`, `npm`, `cmake`, `code` CLI, `curl`, an NVIDIA GPU (`nvidia-smi`), and ≥25 GB free on the model cache partition. Fails with a one-liner fix if anything is missing.
2. **Build llama.cpp** — clones + builds `llama-server` with CUDA + OpenSSL into `$LLAMA_CPP_DIR` (default `$HOME/Source/llama.cpp`). Skipped if the binary already exists.
3. **Pre-fetch the GGUF** — downloads `$MODEL_HF` into `$LLAMA_CACHE` (default `$HOME/.cache/llama.cpp`) by briefly starting `llama-server` and killing it once it begins serving. Skipped if a cache marker exists.
4. **Build the extension** — `npm install` (if `package.json` is newer than `node_modules`) + `npm run compile`.
5. **Package & install the VSIX** — `vsce package` → `code --install-extension --force`.

### Flags

| Flag | Effect |
|---|---|
| `--rebuild-llama` | Force re-run of `scripts/build-llama.sh` |
| `--refetch-model` | Re-download the GGUF |
| `--skip-model` | Don't pre-fetch; download lazily on first server run |
| `--help` | Print usage |

### Environment overrides

| Var | Default | Purpose |
|---|---|---|
| `LLAMA_CPP_DIR` | `$HOME/Source/llama.cpp` | llama.cpp checkout |
| `LLAMA_CACHE` | `$HOME/.cache/llama.cpp` | GGUF cache dir (absolute path) |
| `MODEL_HF` | `unsloth/Qwen3.6-35B-A3B-GGUF:UD-Q4_K_XL` | `repo:quant` passed to `-hf` |

## After installing — start the server

The server is a separate long-running process you keep in its own terminal:

```bash
scripts/run-llama-server.sh
```

Open a `.cpp` file in VS Code. Within 30 seconds the status bar should show `$(check) C++→Rust: online`. See `scripts/README.md` for server env knobs.

## Re-running

`./install.sh` is idempotent — re-run it any time. It skips already-built artifacts and only always re-packages and re-installs the VSIX.

## Troubleshooting

- **`code: command not found`** — in VS Code, Command Palette → *Shell Command: Install 'code' command in PATH*.
- **Pre-fetch times out** — see `/tmp/pal-prefetch.log` for llama-server output. Network or HF rate-limit issues usually resolve by re-running; the partial download resumes.
- **Status bar stays `offline`** — is `scripts/run-llama-server.sh` running? `curl -s http://localhost:8001/v1/models | jq .` should return the model ID.
- **Wrong port** — if you changed `llama-server`'s port, update `cppToRust.llmEndpoint` in VS Code settings.
- **Swap CUDA for CPU** — set `MODEL_HF` to a smaller CPU-friendly quant and re-run `./install.sh --refetch-model`. Note: `build-llama.sh` still builds with CUDA; the GPU check will fail. Remove the GPU gate from `install.sh` if you're deliberately CPU-only.

## Uninstall

```bash
code --uninstall-extension rust-cpp-translator.cpp2rustpal
rm -rf "$LLAMA_CACHE" "$LLAMA_CPP_DIR"
```
