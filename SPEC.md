# C++ to Rust Translator — Specification

## Purpose

Assist a C++ engineer learning Rust by surfacing **contextual Rust hints** for the C++ concepts present in their code. Hints are informational only — the user writes Rust themselves.

## Core Principles

1. **LLM-only**: No regex fallback. If the local LLM server is unreachable, the extension shows an offline indicator and does nothing else.
2. **Non-destructive**: The extension never overwrites user-authored files.
3. **Hints are ephemeral**: Only hints relevant to the **current C++ file's current contents** are kept. Removing `std::vector` from the C++ file removes the `Vec<T>` hint.
4. **Hover-driven discovery**: Hovering a C++ construct highlights (or reveals) the matching hint.
5. **Strict output contract**: LLM returns only `//` comments and ≤3-line Rust skeletons — never full implementations.

## Triggers

- **On save** of a C++ file (`onDidSaveTextDocument`) — the only automatic trigger.
- **Manual command**: `C++ to Rust: Refresh Hints`.
- No per-keystroke updates. No open/edit triggers.

## Files & Storage

- For a C++ file `foo.cpp`, hints are written to a sibling file **`foo.hints.md`** (Markdown, not `.rs`).
- Rationale: Markdown renders nicely in the side pane, avoids Rust-file confusion, and is clearly a generated artifact.
- The `.hints.md` file is **fully regenerated** on each save — no merging, because all hints are derived from current C++ content only.
- The user's own `.rs` scratch file (if any) is never touched by the extension.

### `.hints.md` structure

```markdown
# Rust Hints for foo.cpp
<!-- generated: 2026-04-15T12:34:56Z -->
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

Each section has an `<!-- anchor: cpp-line-N -->` pointing at the C++ line where the construct was detected. The LLM is asked to emit anchors along with hints.

## Hover Behavior

- Register a `HoverProvider` for `cpp`, `c`, `cuda-cpp`.
- On hover: look up the hover position against the most recent hint anchors for this file.
- If a hint matches, show it inline as a Markdown hover popup.
- Optional stretch: also highlight the matching section in the side-by-side `.hints.md` view.

## Status Bar

Persistent left-aligned item. States:

| Text | Meaning |
|---|---|
| `$(check) C++→Rust: online` | Last health check to LLM succeeded |
| `$(sync~spin) C++→Rust: thinking…` | LLM request in flight |
| `$(error) C++→Rust: offline` | Last health check or request failed |
| `$(circle-slash) C++→Rust: disabled` | `cppToRust.llmEnabled = false` |

Health check: `GET {endpoint}/v1/models` every 30s while a C++ file is the active editor. Click status bar → retry health check.

## LLM Contract

- Endpoint: `{cppToRust.llmEndpoint}/v1/chat/completions` (OpenAI-compatible).
- Model: `{cppToRust.llmModel}`.
- Request body includes `chat_template_kwargs: { enable_thinking: false }`.
- Timeout: 15s per request. On failure, state → offline; no fallback.

### System prompt requirements

Output **must**:
- Be valid Markdown with `## <C++ feature>` headings.
- Each heading followed by an HTML comment anchor: `<!-- anchor: cpp-line-N -->`.
- Body: only `//` Rust comment lines; hints ≤3 lines; no prose, no fenced code blocks, no full function bodies.
- Only emit sections for features **actually present** in the supplied C++ source.

## Commands

| Command | Trigger |
|---|---|
| `cppToRust.refreshHints` | Manual refresh for active C++ file |
| `cppToRust.openHints` | Open `.hints.md` side-by-side |
| `cppToRust.toggleEnabled` | Enable/disable the extension |

(Remove the old `translate` / `openRustEditor` / `toggleAutoUpdate` commands.)

## Settings

| Key | Default | Notes |
|---|---|---|
| `cppToRust.llmEnabled` | `true` | Master switch |
| `cppToRust.llmEndpoint` | `http://localhost:8001` | llama-server base URL |
| `cppToRust.llmModel` | `unsloth/Qwen3.5-35B-A3B` | Model alias |
| `cppToRust.sideBySide` | `true` | Auto-open `.hints.md` beside C++ file |
| `cppToRust.healthCheckIntervalMs` | `30000` | Status bar poll cadence |

(Remove `autoUpdate`, `showSyntaxHints`, `showConceptualMapping`.)

## Removed vs. Current Behavior

- ❌ Regex-based `concept-mapper.ts` + `feature-detector.ts` pattern code — delete.
- ❌ On-change debounced writes — replaced by on-save.
- ❌ Overwriting `.rs` files — replaced by `.hints.md`.
- ❌ "Static translate" fallback path — gone.
- ✅ LLM client (`llm-client.ts`) — kept; system prompt updated to the Markdown+anchors contract.

## Open Questions

1. Should hover matching be line-anchored (simple) or range-anchored (needs richer output from LLM)? Start line-anchored.
2. Should `.hints.md` auto-close when the C++ file closes? Probably yes — track like current `openedRustFiles`.
3. Cache last successful hints per file in memory, so rapid saves without LLM changes don't re-render? Defer.
