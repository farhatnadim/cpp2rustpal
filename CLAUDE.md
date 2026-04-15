# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VS Code extension ("Pal — C++ to Rust") that surfaces Rust equivalents for C++ constructs the user is writing. Activates on `cpp`, `c`, `cuda-cpp`. Published entry point is `./out/extension.js`, compiled from `src/`.

## Commands

```bash
npm install
npm run compile      # tsc -p ./ → out/
npm run watch        # tsc -watch
npm run lint         # eslint src --ext ts
npm test             # vscode-test (no tests authored yet)
npx vsce package     # build .vsix
```

Debug the extension by pressing `F5` in VS Code to launch an Extension Development Host. No single-test command is wired up because no test files exist.

## Architecture

Three-file core in `src/`:

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
