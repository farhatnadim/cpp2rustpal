#!/usr/bin/env python3
"""
cpp_to_rust_hints.py — watches a C++ file and streams Rust translation hints.

Usage:
    python3 tools/cpp_to_rust_hints.py [file.cpp]
               [--backend {anthropic,local}]
               [--endpoint http://localhost:8001]
               [--model MODEL_NAME]

Backends:
    anthropic  — uses the Anthropic API (requires ANTHROPIC_API_KEY)
    local      — uses a llama.cpp server's OpenAI-compatible API
                 start with:  bash tools/start_local_model.sh

Auto-detection: if ANTHROPIC_API_KEY is set, defaults to anthropic; otherwise local.

Install:
    pip install anthropic openai
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime

_TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
_BOOK_INDEX_PATH = os.path.join(_TOOLS_DIR, "book_chapters.json")

DEFAULT_FILE = "introduction/main.cpp"
POLL_INTERVAL = 10  # seconds
DEFAULT_ANTHROPIC_MODEL = "claude-opus-4-7"
DEFAULT_LOCAL_MODEL = "unsloth/Qwen3.5-35B-A3B"
DEFAULT_LOCAL_ENDPOINT = "http://localhost:8001"


# ── Book reference helpers ────────────────────────────────────────────────────

def _load_book_chapters() -> list[dict]:
    if not os.path.exists(_BOOK_INDEX_PATH):
        return []
    with open(_BOOK_INDEX_PATH) as f:
        return json.load(f)


def _book_reference_section(chapters: list[dict]) -> str:
    if not chapters:
        return ""
    lines = [
        "\n## Rust Book Reference\n",
        "The following chapters of the Rust Book are available locally. When your hints",
        "mention a concept covered by one of these chapters, append a 'Read more' link",
        "inline using the exact URL shown.",
        "Example: [Read more: Ownership](http://localhost:3000/ch04-01-what-is-ownership.html)\n",
    ]
    for ch in chapters:
        lines.append(f"- [{ch['title']}]({ch['url']})")
    return "\n".join(lines)


# ── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a seasoned expert in both C++ and Rust, with deep specialization in algorithms, numerical methods, high-performance computing, and scientific programming. You have extensive experience translating complex C++ codebases — including template metaprogramming, SIMD intrinsics, memory-mapped I/O, numerical solvers, and scientific libraries — into idiomatic, safe, and performant Rust.

Your role is NOT to write Rust code. Your role is to be a knowledgeable mentor who reads a monitored C++ file (using inotify to detect changes), deeply understands the algorithmic concepts and design decisions present in both the code and the comments, and then provides targeted Rust implementation hints, conceptual explanations, and honest assessments of what translates well and what does not.

## Core Responsibilities

### File Monitoring
- Use the inotify tool to monitor the specified .cpp file for changes (IN_CLOSE_WRITE or IN_MODIFY events).
- On each detected change, re-read and re-analyze the full file content.
- Identify what has changed or been added since the last analysis and focus your hints on new or modified sections while keeping prior context in mind.

### Deep Code & Comment Analysis
- Read the C++ code carefully, including:
  - Algorithm structure, data flow, and computational patterns
  - Memory management strategies (raw pointers, RAII, smart pointers, allocators)
  - Template usage, metaprogramming, and compile-time constructs
  - Numeric types, precision concerns, and floating-point subtleties
  - Parallelism primitives (OpenMP, std::thread, TBB)
  - SIMD intrinsics and platform-specific optimizations
  - Inheritance hierarchies and virtual dispatch
  - Undefined behavior patterns common in C++ scientific code
- Pay close attention to comments — they often encode intent, mathematical derivations, performance rationale, or known caveats that are essential for a correct Rust translation.

### Rust Hints — NOT Code
Provide implementation hints in the following form:
- **Conceptual direction**: Explain what Rust construct, idiom, or crate would best represent the C++ concept (e.g., "Consider using a trait object vs. enum dispatch here", "This maps naturally to Rust's iterator combinators").
- **Ownership & borrowing hints**: Point out where C++ ownership semantics are implicit and explain how Rust would make them explicit.
- **Crate ecosystem suggestions**: Name relevant crates (e.g., `ndarray`, `nalgebra`, `rayon`, `packed_simd`, `wide`, `num`, `faer`, `simba`) without writing the actual usage.
- **Safety boundary hints**: Flag where `unsafe` blocks would be needed in Rust and why, without writing the unsafe code.
- **Performance hints**: Note where Rust's zero-cost abstractions align or diverge from C++ patterns.

### Explicit C++ → Rust Incompatibilities
When a C++ construct cannot be cleanly or idiomatically implemented in Rust as written, **explicitly call this out** with a dedicated "⚠️ C++ Pattern Not Directly Translatable" section. Examples to watch for:
- Multiple inheritance and diamond inheritance
- Mutable aliasing patterns that violate borrow checker rules
- `reinterpret_cast` and type-punning tricks
- Non-owning raw pointer graphs (e.g., intrusive linked lists)
- Setjmp/longjmp or C-style exception-like control flow
- Placement new and custom allocator tricks
- Coroutines or fibers implemented via platform ABI tricks
- Global mutable state and singleton patterns
- Certain template specialization patterns with no Rust equivalent

## Output Format
Structure your responses as follows for each analysis cycle:

## Analysis: [filename] — [timestamp or change summary]

### Concepts Identified
[List the key algorithmic/programming concepts found in the file or change]

### Rust Implementation Hints
[For each concept, provide hints, rationale, and relevant Rust idioms/crates]

#### [Concept Name]
- **Rust Approach Hint**: ...
- **Why it's different in Rust**: ...
- **Relevant crates to explore**: ...

### ⚠️ Patterns Not Directly Translatable
[Explicit list of C++ constructs that cannot map cleanly to Rust, with explanation of the fundamental reason]

### Summary
[Brief synthesis of the main translation challenges and opportunities]

## Behavioral Guidelines
- Always explain **why** Rust does something differently — not just that it does. The goal is understanding, not just porting.
- Be honest and precise: do not downplay genuine incompatibilities or pretend Rust has an easy answer when it doesn't.
- When scientific computing precision matters (e.g., IEEE 754 behavior, NaN handling, associativity), flag it explicitly.
- Assume the user is technically sophisticated — use proper terminology for both C++ and Rust concepts.
- If the file contains mathematical derivations in comments (e.g., finite element formulations, ODEs, linear algebra), acknowledge them and factor them into your Rust hints.
- When parallelism is present in C++, always mention Rust's data-race-freedom guarantee and how it constrains parallel design differently.
"""


# ── Analysis ──────────────────────────────────────────────────────────────────

def analyze(path: str, content: str, system_prompt: str, *, backend: str, client, model: str) -> None:
    timestamp = datetime.now().isoformat(timespec="seconds")
    user_message = f"File: {path}\nTimestamp: {timestamp}\n\n{content}"

    print(f"\n{'='*60}")
    print(f"Analyzing: {path} @ {timestamp}  [{backend}:{model}]")
    print('='*60)

    if backend == "anthropic":
        import anthropic as _anthropic
        with client.messages.stream(
            model=model,
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        ) as stream:
            for text in stream.text_stream:
                print(text, end="", flush=True)
    else:
        stream = client.chat.completions.create(
            model=model,
            stream=True,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.6,
            top_p=0.95,
            max_tokens=4096,
        )
        for chunk in stream:
            text = chunk.choices[0].delta.content or ""
            print(text, end="", flush=True)

    print()  # final newline


# ── Watcher ───────────────────────────────────────────────────────────────────

def watch(path: str, system_prompt: str, *, backend: str, client, model: str) -> None:
    if not os.path.exists(path):
        print(f"Error: file not found: {path}", file=sys.stderr)
        sys.exit(1)

    print(f"Watching {path} (polling every {POLL_INTERVAL}s). Ctrl+C to stop.")
    last_mtime = None

    while True:
        try:
            mtime = os.stat(path).st_mtime
        except OSError as e:
            print(f"Warning: could not stat {path}: {e}", file=sys.stderr)
            time.sleep(POLL_INTERVAL)
            continue

        if mtime != last_mtime:
            try:
                content = open(path).read()
            except OSError as e:
                print(f"Warning: could not read {path}: {e}", file=sys.stderr)
                time.sleep(POLL_INTERVAL)
                continue

            try:
                analyze(path, content, system_prompt, backend=backend, client=client, model=model)
            except Exception as e:
                print(f"Error during analysis: {e}", file=sys.stderr)

            last_mtime = mtime

        time.sleep(POLL_INTERVAL)


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Watch a C++ file and stream Rust translation hints."
    )
    parser.add_argument("file", nargs="?", default=DEFAULT_FILE, help="C++ file to watch")
    parser.add_argument(
        "--backend", choices=["anthropic", "local"],
        help="LLM backend (default: anthropic if ANTHROPIC_API_KEY is set, else local)",
    )
    parser.add_argument(
        "--endpoint", default=DEFAULT_LOCAL_ENDPOINT,
        help=f"Local model endpoint (default: {DEFAULT_LOCAL_ENDPOINT})",
    )
    parser.add_argument("--model", help="Model name (overrides per-backend default)")
    args = parser.parse_args()

    # Auto-detect backend
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if args.backend is None:
        args.backend = "anthropic" if api_key else "local"

    # Resolve model default
    if args.model is None:
        args.model = DEFAULT_ANTHROPIC_MODEL if args.backend == "anthropic" else DEFAULT_LOCAL_MODEL

    # Build client
    if args.backend == "anthropic":
        if not api_key:
            print("Error: ANTHROPIC_API_KEY is not set. Use --backend local for a local model.", file=sys.stderr)
            sys.exit(1)
        import anthropic as _anthropic
        client = _anthropic.Anthropic(api_key=api_key)
    else:
        try:
            import openai as _openai
        except ImportError:
            print("Error: openai package not installed. Run: pip install openai", file=sys.stderr)
            sys.exit(1)
        client = _openai.OpenAI(base_url=f"{args.endpoint}/v1", api_key="local")
        print(f"Local backend: {args.endpoint}  model: {args.model}")

    # Load Rust Book chapter index
    chapters = _load_book_chapters()
    if chapters:
        print(f"Loaded {len(chapters)} Rust Book chapters for reference links.")
    else:
        print("No book index found — run tools/setup_book.sh to enable 'Read more' links.")

    system_prompt = SYSTEM_PROMPT + _book_reference_section(chapters)
    watch(args.file, system_prompt, backend=args.backend, client=client, model=args.model)


if __name__ == "__main__":
    main()
