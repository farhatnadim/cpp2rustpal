# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Two surfaces sharing infrastructure for C++ → Rust hints:

- **VS Code extension** (`extension/`) — surfaces hints inline as you write C++. Activates on `cpp`, `c`, `cuda-cpp`. Published entry point: `./out/extension/extension.js`, compiled from `extension/`.
- **Python CLI** (`cli/`) — standalone file watcher that streams rich mentorship-style hints to the terminal. Supports Anthropic API and local llama.cpp server.
- **Shared scripts** (`scripts/`) — `build_llama.sh` (GPU-aware build) and `start_model.sh` (server runner). Both surfaces use the same env vars: `LLAMA_CPP_DIR`, `MODEL_HF`, `PORT`, endpoint `http://localhost:8001`.

## Commands

```bash
# Extension
npm install
npm run compile      # tsc -p ./ → out/extension/
npm run watch        # tsc -watch
npm run lint         # eslint extension --ext ts
npm test             # vscode-test (no tests authored yet)
npx vsce package     # build .vsix

# CLI
python3 -m venv cli/.venv && source cli/.venv/bin/activate
pip install -r cli/requirements.txt
python3 cli/cpp_to_rust_hints.py path/to/file.cpp [--backend local|anthropic]

# Shared model server
bash scripts/build_llama.sh   # build llama-server (once)
bash scripts/start_model.sh   # start model server on port 8001
```

Debug the extension by pressing `F5` in VS Code to launch an Extension Development Host. No single-test command is wired up because no test files exist.

## Architecture

Three-file core in `extension/`:

- **`extension.ts`** — activation shim. Instantiates `FeatureDetector`, registers the three `cppToRust.*` commands, forwards to the detector.
- **`feature-detector.ts`** — the orchestrator. Owns VS Code state: config settings, debounce timers per-document, the set of extension-opened sidecar files, and the status-bar item. Wires document events (change/save/close) to translation runs and manages the side-by-side editor.
- **`concept-mapper.ts`** — pure, regex-based C++ → Rust feature detection and Rust-comment rendering. No VS Code imports; the static fallback path.
- **`llm-client.ts`** — OpenAI-compatible chat-completions client targeting a local `llama-server` (default `http://localhost:8001`). Used when `cppToRust.llmEnabled` is true; on failure the detector falls back to `concept-mapper`.

Control flow: C++ document event → `FeatureDetector` debounces (300 ms) → tries `LlmClient` → on error/disabled uses `concept-mapper.detectFeatures` + `generateRustContent` → writes a sibling `.rs` file, optionally opened beside the C++ editor.

## Important: SPEC.md describes a pending rewrite

`SPEC.md` is the **target design**, not the current behavior. Key divergences between spec and current code — treat the spec as the source of truth when making changes:

- Spec: **LLM-only, no regex fallback**. Current: regex fallback via `concept-mapper.ts` is active.
- Spec: trigger **on save only**. Current: debounced on every change.
- Spec: output is sibling **`foo.hints.md`** (Markdown with `## heading` + `<!-- anchor: cpp-line-N -->` per feature). Current: writes a sibling **`.rs`** file.
- Spec: adds a `HoverProvider` that matches hover position to hint anchors. Current: none.
- Spec commands: `cppToRust.refreshHints`, `cppToRust.openHints`, `cppToRust.toggleEnabled`. Current: `translate`, `openRustEditor`, `toggleAutoUpdate` (to be removed).
- Spec settings to remove: `autoUpdate`, `showSyntaxHints`, `showConceptualMapping`. To add: `healthCheckIntervalMs`. Status bar should poll `GET {endpoint}/v1/models` every 30 s.
- Spec LLM request must include `chat_template_kwargs: { enable_thinking: false }` and a 15 s timeout; output contract is `//`-only Rust comments, ≤3-line skeletons, no full bodies.

When modifying features, check whether the change belongs to the rewrite path in SPEC.md; if so, prefer moving toward the spec rather than extending legacy regex/on-change code.

## LLM server expectation

The extension assumes a locally running `llama-server` exposing an OpenAI-compatible API at `cppToRust.llmEndpoint`. Default model alias: `unsloth/Qwen3.5-35B-A3B`. `setup.sh` and `INSTALL.md` cover host setup.
