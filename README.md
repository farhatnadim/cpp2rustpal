# Pal — C++ to Rust (`cpp2rustpal`)

A VS Code extension that helps C++ engineers learn Rust by surfacing contextual Rust hints for the C++ constructs in their code. On save of a C++ file, Pal asks a local LLM to identify relevant features and writes a sibling `foo.cpp.hints.md` Markdown file with short Rust hints, anchored to the C++ line where each construct appears. Hover a C++ construct to see the matching hint inline.

Pal also mirrors your C++ project as a Cargo project: if your C++ code lives in `cpp_foo/` (identified by a `CMakeLists.txt`), Pal creates and maintains a sibling `rust_foo/` Cargo crate, running `cargo add` for crates the LLM recommends (e.g. `rayon` for `<thread>`). You write the Rust yourself — Pal never overwrites your code.

## How it works

- **Trigger**: on save of a `cpp`, `c`, or `cuda-cpp` file. No per-keystroke updates.
- **Hints file**: `foo.cpp.hints.md` (sibling), fully regenerated each save. Sections are sorted ascending by C++ line number.
- **Hover**: the extension matches the hovered line against the latest hint anchors and shows the hint as a Markdown popup.
- **Cargo mirror**: walks up from the saved file until it finds `CMakeLists.txt`; creates a `rust_<name>/` sibling via `cargo new --bin`. Runs `cargo add` for LLM-suggested crates (fire-and-forget, serialized per target).
- **LLM-only**: if the local LLM server is unreachable, the status bar shows `offline` and no hints are written. There is no regex fallback.
- **Status bar**: shows `online` / `thinking…` / `offline` / `disabled`. Polls `GET {endpoint}/v1/models` every 30 s while a C++ file is active.

See `SPEC.md` for the full contract.

## Hints file format

```markdown
# Rust Hints for foo.cpp
<!-- generated: 2026-04-16T12:34:56Z -->
<!-- model: unsloth/Qwen3.5-35B-A3B -->

## std::vector<int>  <!-- anchor: cpp-line-12 -->
// std::vector<int> → Vec<i32>
// Hint: let mut v: Vec<i32> = Vec::new();
// Note: v[i] panics on OOB; use v.get(i) → Option<&i32>

## Lambda  <!-- anchor: cpp-line-18 -->
// Lambda → Closure
// Hint: let f = |x: i32| x * 2;
// Note: Fn / FnMut / FnOnce depending on capture
```

Bodies are `//` Rust comment lines only; hints are capped at three lines each and never contain full function bodies.

## Install (Linux + CUDA)

One command bootstraps everything except starting the server:

```bash
./install.sh
```

It runs preflight checks, builds `llama.cpp`, pre-fetches the GGUF into `$HOME/.cache/llama.cpp`, compiles the extension, packages it, and installs the VSIX via `code --install-extension`. Re-running is idempotent — already-built pieces are skipped. See [`INSTALL.md`](./INSTALL.md) for flags and env overrides.

After install, start the server in its own terminal:

```bash
scripts/run-llama-server.sh
```

Open a `.cpp` file in VS Code — the status bar flips to online within 30 s. See [`scripts/README.md`](./scripts/README.md) for server env knobs.

## Install

```bash
git clone git@github.com:farhatnadim/cpp2rustpal.git
cd cpp2rustpal
npm install
npm run compile
npx vsce package
code --install-extension cpp2rustpal-0.1.0.vsix
```

For development, press `F5` in VS Code to launch an Extension Development Host.

## Commands

| Command | Description |
|---|---|
| `C++ to Rust: Refresh Hints` | Manually regenerate hints for the active C++ file |
| `C++ to Rust: Open Hints` | Open the sibling `.hints.md` in a side-by-side editor |
| `C++ to Rust: Toggle Enabled` | Flip the master switch (`cppToRust.llmEnabled`) |
| `C++ to Rust: Open Mirrored Cargo Project` | Open the mirrored `rust_<name>/` folder in a new window |
| `C++ to Rust: Pick Model` | Pick a model from `/v1/models` (or free-text entry when offline); also bound to the model status-bar item |

## Settings

| Key | Default | Description |
|---|---|---|
| `cppToRust.llmEnabled` | `true` | Master switch |
| `cppToRust.llmEndpoint` | `http://localhost:8001` | `llama-server` base URL |
| `cppToRust.llmModel` | `unsloth/Qwen3.5-35B-A3B` | Model alias |
| `cppToRust.sideBySide` | `true` | Auto-open `.hints.md` beside the C++ file |
| `cppToRust.healthCheckIntervalMs` | `30000` | Status bar health-poll cadence |
| `cppToRust.cargoMirrorEnabled` | `true` | Scaffold and maintain `rust_<name>/` next to detected `cpp_<name>/` |

## Development

```bash
npm install
npm run compile    # tsc -p ./ → out/
npm run watch      # tsc -watch
npm run lint       # eslint src --ext ts
npx vsce package   # build .vsix
```

Source layout (`src/`):

- `extension.ts` — activation shim, command registration.
- `feature-detector.ts` — orchestrator: save listener, status bar, hover provider, hints file writer.
- `llm-client.ts` — OpenAI-compatible chat client with strict output contract (`##` headings, `<!-- anchor: cpp-line-N -->`, trailing `<!-- deps: … -->`).
- `cargo-mirror.ts` — `CMakeLists.txt` ancestor walk, `cargo new --bin`, serialized `cargo add`.

## License

MIT
