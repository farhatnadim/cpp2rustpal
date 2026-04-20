#!/usr/bin/env python3
"""
generate_book_index.py — parses the Rust Book's SUMMARY.md and writes
tools/book_chapters.json with title → localhost URL mappings.

Usage:
    python3 tools/generate_book_index.py [--base-url http://localhost:3000]
"""

import argparse
import json
import os
import re
import sys

SUMMARY = os.path.join(os.path.dirname(__file__), "rust-book", "src", "SUMMARY.md")
OUTPUT = os.path.join(os.path.dirname(__file__), "book_chapters.json")

# Matches: - [Title](some/path/ch04-01-foo.md)
LINK_RE = re.compile(r'\[([^\]]+)\]\(([^)]+\.md)\)')


def parse_summary(summary_path: str, base_url: str) -> list[dict]:
    chapters = []
    with open(summary_path) as f:
        for line in f:
            m = LINK_RE.search(line)
            if not m:
                continue
            title, md_path = m.group(1), m.group(2)
            # Strip any leading directory components — book serves files flat
            filename = os.path.basename(md_path).replace(".md", ".html")
            url = f"{base_url.rstrip('/')}/{filename}"
            chapters.append({"title": title, "url": url})
    return chapters


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:3000")
    parser.add_argument("--summary", default=SUMMARY)
    parser.add_argument("--output", default=OUTPUT)
    args = parser.parse_args()

    if not os.path.exists(args.summary):
        print(f"Error: SUMMARY.md not found at {args.summary}", file=sys.stderr)
        print("Run tools/setup_book.sh first.", file=sys.stderr)
        sys.exit(1)

    chapters = parse_summary(args.summary, args.base_url)
    with open(args.output, "w") as f:
        json.dump(chapters, f, indent=2)

    print(f"Wrote {len(chapters)} chapters to {args.output}")


if __name__ == "__main__":
    main()
